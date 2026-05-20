import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { db } from "../db/client.js";
import { charges, locations, billingRuns } from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";

// Cadence safety net: monthly cron should never fire more than once every 25 days.
// Protects against accidental re-trigger via ?force=true within the same window.
const MIN_DAYS_BETWEEN_RUNS = 25;

// How long the spa owner has to pay each emailed invoice.
const DAYS_UNTIL_DUE = 7;

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
    "[monthly-billing] Cron triggered at",
    new Date().toISOString(),
  );

  // Manual trigger override for testing: /api/monthly-billing?force=true
  const force = req.query.force === "true";

  // Cadence guard: skip if last run was < 25 days ago
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
          `[monthly-billing] Last run was ${daysSince.toFixed(1)}d ago; skipping.`,
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

    console.log(`[monthly-billing] Found ${tallied.length} tallied charges`);

    if (tallied.length === 0) {
      await db.insert(billingRuns).values({
        invoiceCount: 0,
        totalCents: 0,
        chargesProcessed: 0,
        locationsSkippedTrustPeriod: 0,
      });
      return res
        .status(200)
        .json({ ok: true, invoices: 0, message: "No tallied charges" });
    }

    // Group charges by location
    const byLocation = new Map<string, typeof tallied>();
    for (const charge of tallied) {
      if (!byLocation.has(charge.locationId))
        byLocation.set(charge.locationId, []);
      byLocation.get(charge.locationId)!.push(charge);
    }

    const stripe = getStripeClient();
    const now = new Date();
    let invoiceCount = 0;
    let totalAmountCents = 0;
    let locationsSkippedTrustPeriod = 0;

    for (const [locationId, locationCharges] of byLocation) {
      try {
        // Look up location: Stripe customer + trust period state
        const loc = await db
          .select()
          .from(locations)
          .where(eq(locations.locationId, locationId))
          .limit(1);

        if (loc.length === 0) {
          console.warn(
            `[monthly-billing] No locations record for ${locationId}; skipping.`,
          );
          continue;
        }

        const locationRow = loc[0];

        // 30-day trust period gate.
        // Skip this location entirely if its trust period hasn't ended yet.
        // Charges remain `tallied` and will be picked up on the next monthly run after the trust period elapses.
        if (locationRow.trustPeriodEndsAt > now) {
          const daysRemaining =
            (locationRow.trustPeriodEndsAt.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24);
          console.log(
            `[monthly-billing] Location ${locationId} still in trust period ` +
              `(${daysRemaining.toFixed(1)}d remaining, ends ${locationRow.trustPeriodEndsAt.toISOString()}). ` +
              `Skipping; ${locationCharges.length} charges remain tallied.`,
          );
          locationsSkippedTrustPeriod++;
          continue;
        }

        const customerId = locationRow.stripeCustomerId;
        const chargeCount = locationCharges.length;
        const amountCents = locationCharges.reduce(
          (sum, c) => sum + c.amountCents,
          0,
        );

        // One invoice item per location, summing all tallied charges.
        // Individual price-per-booking is already baked into each charge's amountCents.
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: amountCents,
          currency: "usd",
          description: `SpaFlow — ${chargeCount} booked appointment${chargeCount === 1 ? "" : "s"}`,
        });

        // INVOICE ONLY. No auto-charge, ever. Every invoice is emailed and paid manually.
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: DAYS_UNTIL_DUE,
          auto_advance: true,
          metadata: {
            location_id: locationId,
            charge_count: String(chargeCount),
          },
        });

        const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
        await stripe.invoices.sendInvoice(finalized.id!);

        totalAmountCents += amountCents;
        invoiceCount++;

        console.log(
          `[monthly-billing] Sent invoice ${finalized.id} for location ${locationId}: ` +
            `$${(amountCents / 100).toFixed(2)} (${chargeCount} appts, due in ${DAYS_UNTIL_DUE}d)`,
        );

        // Mark charges invoiced only after successful finalization + send.
        const chargeIds = locationCharges.map((c) => c.id);
        await db
          .update(charges)
          .set({ status: "invoiced" })
          .where(sql`${charges.id} = ANY(${chargeIds})`);
      } catch (err: any) {
        console.error(
          `[monthly-billing] Failed for location ${locationId}:`,
          err.message,
        );
        // Do NOT mark charges invoiced — they'll retry next run
      }
    }

    await db.insert(billingRuns).values({
      invoiceCount,
      totalCents: totalAmountCents,
      chargesProcessed: tallied.length,
      locationsSkippedTrustPeriod,
    });

    const summary = {
      ok: true,
      invoices: invoiceCount,
      totalAmount: `$${(totalAmountCents / 100).toFixed(2)}`,
      chargesProcessed: tallied.length,
      locationsSkippedTrustPeriod,
    };
    console.log("[monthly-billing] Complete:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error("[monthly-billing] Fatal:", err.message, err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
