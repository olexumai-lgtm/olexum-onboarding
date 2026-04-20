import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { db } from "../db/client.js";
import { charges, locations, billingRuns } from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";

const MIN_DAYS_BETWEEN_RUNS = 13; // bi-weekly cadence with a 1-day buffer

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  console.log(
    "[bi-weekly-billing] Cron triggered at",
    new Date().toISOString(),
  );

  // Manual trigger override: /api/bi-weekly-billing?force=true
  const force = req.query.force === "true";

  // Cadence guard: skip if last run was < 13 days ago
  if (!force) {
    const lastRun = await db
      .select()
      .from(billingRuns)
      .orderBy(desc(billingRuns.ranAt))
      .limit(1);

    if (lastRun.length > 0) {
      const daysSince =
        (Date.now() - lastRun[0].ranAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < MIN_DAYS_BETWEEN_RUNS) {
        console.log(
          `[bi-weekly-billing] Last run was ${daysSince.toFixed(1)}d ago; skipping.`,
        );
        return res.status(200).json({
          ok: true,
          skipped: true,
          daysSinceLastRun: daysSince,
        });
      }
    }
  }

  try {
    const tallied = await db
      .select()
      .from(charges)
      .where(eq(charges.status, "tallied"));

    console.log(`[bi-weekly-billing] Found ${tallied.length} tallied charges`);

    if (tallied.length === 0) {
      await db.insert(billingRuns).values({
        invoiceCount: 0,
        totalCents: 0,
        chargesProcessed: 0,
      });
      return res
        .status(200)
        .json({ ok: true, invoices: 0, message: "No tallied charges" });
    }

    const byLocation = new Map<string, typeof tallied>();
    for (const charge of tallied) {
      if (!byLocation.has(charge.locationId))
        byLocation.set(charge.locationId, []);
      byLocation.get(charge.locationId)!.push(charge);
    }

    const stripe = getStripeClient();
    let invoiceCount = 0;
    let totalAmountCents = 0;

    for (const [locationId, locationCharges] of byLocation) {
      try {
        // Look up Stripe customer via locations table (not customers.search)
        const loc = await db
          .select()
          .from(locations)
          .where(eq(locations.locationId, locationId))
          .limit(1);

        if (loc.length === 0) {
          console.warn(
            `[bi-weekly-billing] No locations record for ${locationId}; skipping.`,
          );
          continue;
        }

        const customerId = loc[0].stripeCustomerId;
        const chargeCount = locationCharges.length;
        const amountCents = locationCharges.reduce(
          (sum, c) => sum + c.amountCents,
          0,
        );

        // Decide: first invoice (capture PM) or subsequent (auto-charge)
        const customer = await stripe.customers.retrieve(customerId);
        const hasDefaultPM =
          !customer.deleted &&
          !!customer.invoice_settings?.default_payment_method;

        await stripe.invoiceItems.create({
          customer: customerId,
          amount: amountCents,
          currency: "usd",
          description: `SpaFlow — ${chargeCount} booked appointment${chargeCount === 1 ? "" : "s"}`,
        });

        let invoice: Stripe.Invoice;
        if (hasDefaultPM) {
          // Subsequent invoice: auto-charge
          invoice = await stripe.invoices.create({
            customer: customerId,
            collection_method: "charge_automatically",
            auto_advance: true,
            metadata: { location_id: locationId },
          });
        } else {
          // First invoice: emailed, save PM on payment
          invoice = await stripe.invoices.create({
            customer: customerId,
            collection_method: "send_invoice",
            days_until_due: 2,
            auto_advance: true,
            metadata: { location_id: locationId, is_first_invoice: "true" },
            payment_settings: {
              save_default_payment_method: "on_success",
            } as any,
          });
        }

        const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
        if (!hasDefaultPM) {
          await stripe.invoices.sendInvoice(finalized.id!);
        }

        totalAmountCents += amountCents;
        invoiceCount++;

        console.log(
          `[bi-weekly-billing] ${hasDefaultPM ? "Auto-charged" : "Sent"} invoice ${finalized.id} ` +
            `for location ${locationId}: $${(amountCents / 100).toFixed(2)} (${chargeCount} appts)`,
        );

        // Mark charges invoiced only after successful finalization
        const chargeIds = locationCharges.map((c) => c.id);
        await db
          .update(charges)
          .set({ status: "invoiced" })
          .where(sql`${charges.id} = ANY(${chargeIds})`);
      } catch (err: any) {
        console.error(
          `[bi-weekly-billing] Failed for location ${locationId}:`,
          err.message,
        );
        // Do NOT mark charges invoiced — they'll retry next run
      }
    }

    await db.insert(billingRuns).values({
      invoiceCount,
      totalCents: totalAmountCents,
      chargesProcessed: tallied.length,
    });

    const summary = {
      ok: true,
      invoices: invoiceCount,
      totalAmount: `$${(totalAmountCents / 100).toFixed(2)}`,
      chargesProcessed: tallied.length,
    };
    console.log("[bi-weekly-billing] Complete:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error("[bi-weekly-billing] Fatal:", err.message, err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
