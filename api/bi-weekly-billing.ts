import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { db } from "../db/client.js";
import { charges } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

/** Returns the ISO week number for a given date. */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[bi-weekly-billing] Cron triggered at", new Date().toISOString());

  // Week-number gate: only run on even weeks
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  if (weekNumber % 2 !== 0) {
    console.log(`[bi-weekly-billing] Odd week (${weekNumber}), skipping.`);
    return res.status(200).json({ ok: true, skipped: true, reason: `odd week ${weekNumber}` });
  }

  try {
    // 1. Query all tallied charges
    const tallied = await db
      .select()
      .from(charges)
      .where(eq(charges.status, "tallied"));

    console.log(`[bi-weekly-billing] Found ${tallied.length} tallied charges`);

    if (tallied.length === 0) {
      return res.status(200).json({ ok: true, invoices: 0, message: "No tallied charges" });
    }

    // 2. Group by location_id
    const byLocation = new Map<string, typeof tallied>();
    for (const charge of tallied) {
      if (!byLocation.has(charge.locationId)) byLocation.set(charge.locationId, []);
      byLocation.get(charge.locationId)!.push(charge);
    }

    // 3. Invoice each location via Stripe
    const stripe = getStripeClient();
    let invoiceCount = 0;
    let totalAmountCents = 0;

    for (const [locationId, locationCharges] of byLocation) {
      try {
        // Find Stripe customer by location_id metadata
        const existing = await stripe.customers.search({
          query: `metadata["location_id"]:"${locationId}"`,
        });

        if (existing.data.length === 0) {
          console.warn(`[bi-weekly-billing] No Stripe customer for location ${locationId}, skipping`);
          continue;
        }

        const customerId = existing.data[0].id;
        const chargeCount = locationCharges.length;
        const amountCents = locationCharges.reduce((sum, c) => sum + c.amountCents, 0);

        // Create a single invoice item for the total
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: amountCents,
          currency: "usd",
          description: `SpaFlow Revenue Engine - Booked Appointments (${chargeCount} appointments)`,
        });

        // Create, finalize, and send the invoice — Net 2 (48-hour shutoff)
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: 2,
          auto_advance: true,
        });

        const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(finalized.id);

        totalAmountCents += amountCents;
        invoiceCount++;

        console.log(
          `[bi-weekly-billing] Invoice sent for location ${locationId}: ` +
          `${finalized.id} — $${(amountCents / 100).toFixed(2)} (${chargeCount} appointments)`,
        );

        // 4. Mark these charges as invoiced
        const chargeIds = locationCharges.map((c) => c.id);
        await db
          .update(charges)
          .set({ status: "invoiced" })
          .where(sql`${charges.id} = ANY(${chargeIds})`);

        console.log(`[bi-weekly-billing] Marked ${chargeIds.length} charges as invoiced for location ${locationId}`);
      } catch (err: any) {
        console.error(`[bi-weekly-billing] Error processing location ${locationId}:`, err.message);
        // Do NOT update DB status — charges remain tallied for next run
      }
    }

    // 5. Summary
    const summary = {
      ok: true,
      week: weekNumber,
      invoices: invoiceCount,
      totalAmount: `$${(totalAmountCents / 100).toFixed(2)}`,
      chargesProcessed: tallied.length,
    };
    console.log("[bi-weekly-billing] Complete:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error("[bi-weekly-billing] Fatal error:", err.message, err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
