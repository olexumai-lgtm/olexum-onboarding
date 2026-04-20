import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../db/client.js";
import { charges } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Handler — Pay-Per-Appointment ledger endpoint
//
// Receives a POST webhook from GoHighLevel, returns 200 immediately,
// then asynchronously deduplicates and writes a charge record to Postgres.
// This endpoint does NOT communicate with Stripe.
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  console.log("[booking-event] Incoming payload:", JSON.stringify(body));

  // Return 200 immediately — all processing is fire-and-forget
  res.status(200).json({ ok: true });

  // Async processing — errors are logged, never surface to the caller
  processBookingEvent(body).catch((err) => {
    console.error("[booking-event] Async processing failed:", err.message, err.stack);
  });
}

// ---------------------------------------------------------------------------
// Async processing
// ---------------------------------------------------------------------------
async function processBookingEvent(body: any): Promise<void> {
  const contactId: string = body.contact_id ?? body.contactId ?? "";
  const externalAppointmentId: string =
    body.external_appointment_id ?? body.externalAppointmentId ?? "";
  const locationId: string = body.location_id ?? body.locationId ?? "";
  const rawTimestamp: string = body.timestamp ?? "";

  if (!externalAppointmentId) {
    console.warn("[booking-event] Missing external_appointment_id, skipping.");
    return;
  }

  if (!contactId || !locationId) {
    console.warn("[booking-event] Missing contact_id or location_id, skipping.");
    return;
  }

  // Deduplication: check if this appointment was already tallied
  const existing = await db
    .select({ id: charges.id })
    .from(charges)
    .where(eq(charges.externalAppointmentId, externalAppointmentId))
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `[booking-event] Duplicate: external_appointment_id=${externalAppointmentId} already exists, skipping.`,
    );
    return;
  }

  // Insert the charge record
  await db.insert(charges).values({
    contactId,
    externalAppointmentId,
    locationId,
    appointmentTimestamp: rawTimestamp ? new Date(rawTimestamp) : new Date(),
    amountCents: 2000,
    status: "tallied",
  });

  console.log(
    `[booking-event] Charge tallied: external_appointment_id=${externalAppointmentId}, location=${locationId}`,
  );
}
