import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "@notionhq/client";
import { db } from "../../db/client.js";
import {
  webhookIdempotency,
  charges,
  locations,
} from "../../db/schema.js";
import { eq } from "drizzle-orm";

interface ParsedPayload {
  externalAppointmentId: string;
  contactId: string;
  appointmentTime: string;
  eventType: string;
}

function parsePayload(body: any): ParsedPayload {
  return {
    externalAppointmentId:
      body.external_appointment_id ??
      body.externalAppointmentId ??
      body.appointment_id ??
      body.appointmentId ??
      "",
    contactId: body.contact_id ?? body.contactId ?? "",
    appointmentTime:
      body.appointment_time ??
      body.appointmentTime ??
      body.next_appointment_time ??
      body.nextAppointmentTime ??
      "",
    eventType: (body.event_type ?? body.eventType ?? "completed").toLowerCase(),
  };
}

// Only these tag-mapped events are billable. GHL workflow should only fire
// for status:completed and status:no-show; this set is the second line of defense.
const BILLABLE_EVENTS = new Set([
  "completed",
  "status:completed",
  "no_show",
  "no-show",
  "noshow",
  "status:no-show",
]);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth — same shared secret as crm-sync
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error(
      "[billing-event] WEBHOOK_SECRET is not set; refusing request",
    );
    return res.status(500).json({ error: "Server misconfigured" });
  }
  const providedSecret =
    req.headers["x-olexum-webhook-secret"] ||
    req.headers["x-webhook-secret"];
  if (providedSecret !== expectedSecret) {
    console.warn("[billing-event] Unauthorized webhook request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const locationId = req.query.location_id as string;
  if (!locationId)
    return res.status(400).json({ error: "Missing location_id" });

  const body = req.body;
  console.log(
    `[billing-event] Incoming for location ${locationId}:`,
    JSON.stringify(body),
  );

  const parsed = parsePayload(body);

  if (!parsed.externalAppointmentId || !parsed.contactId) {
    console.error("[billing-event] Missing required fields:", parsed);
    return res.status(400).json({
      error: "Missing required fields: external_appointment_id, contact_id",
    });
  }

  if (!BILLABLE_EVENTS.has(parsed.eventType)) {
    console.warn(
      `[billing-event] Non-billable eventType received: ${parsed.eventType}. ` +
        `Check the GHL workflow trigger — it should only fire on status:completed or status:no-show.`,
    );
    return res.status(400).json({
      error: `Non-billable event_type: ${parsed.eventType}`,
    });
  }

  // Idempotency: namespaced to billing so it can't collide with crm-sync keys.
  const idempotencyKey = `billing:${locationId}:${parsed.externalAppointmentId}`;
  const existing = await db
    .select({ idempotencyKey: webhookIdempotency.idempotencyKey })
    .from(webhookIdempotency)
    .where(eq(webhookIdempotency.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[billing-event] Duplicate, key=${idempotencyKey}`);
    return res.status(200).json({ ok: true, duplicate: true });
  }

  // Look up the location's per-booking price
  const loc = await db
    .select()
    .from(locations)
    .where(eq(locations.locationId, locationId))
    .limit(1);

  if (loc.length === 0) {
    console.error(
      `[billing-event] No locations row for ${locationId}. ` +
        `Onboarding never completed Stripe customer creation, or location_id mismatch.`,
    );
    return res.status(404).json({
      error: "Location not found in billing records",
    });
  }

  const priceCents = loc[0].priceCents;

  // Insert charge. The unique index on external_appointment_id gives second-layer dedupe
  // (in case the GHL workflow fires twice concurrently and both pass the idempotency check).
  try {
    await db
      .insert(charges)
      .values({
        contactId: parsed.contactId,
        externalAppointmentId: parsed.externalAppointmentId,
        locationId,
        appointmentTimestamp: parsed.appointmentTime
          ? new Date(parsed.appointmentTime)
          : new Date(),
        amountCents: priceCents,
        status: "tallied",
      })
      .onConflictDoNothing();

    console.log(
      `[billing-event] Charge tallied for appt ${parsed.externalAppointmentId} ` +
        `at location ${locationId}: $${(priceCents / 100).toFixed(2)}`,
    );

    // --- NOTION BILLING DASHBOARD SYNC ---
    try {
      const notionKey = process.env.NOTION_API_KEY;
      const notionDb = process.env.NOTION_BOOKINGS_DB;

      if (notionKey && notionDb) {
        const notion = new Client({ auth: notionKey });
        await notion.pages.create({
          parent: { database_id: notionDb },
          properties: {
            "Appointment ID": { title: [{ text: { content: parsed.externalAppointmentId } }] },
            "Location ID": { rich_text: [{ text: { content: locationId } }] },
            "Contact ID": { rich_text: [{ text: { content: parsed.contactId } }] },
            "Status": { select: { name: parsed.eventType } },
            "Price": { number: priceCents / 100 },
            "Appointment Time": { date: { start: parsed.appointmentTime || new Date().toISOString() } }
          },
        });
        console.log(`[billing-event] Logged appointment ${parsed.externalAppointmentId} to Notion Dashboard`);
      }
    } catch (notionErr: any) {
      console.error(`[billing-event] Notion sync failed (non-fatal):`, notionErr.message);
    }
    // -------------------------------------
  } catch (err: any) {
    console.error(`[billing-event] Charge insert error:`, err.message);
    // Do NOT record idempotency key — let GHL workflow retry.
    return res.status(500).json({
      error: "Charge insert failed",
      detail: err.message,
    });
  }

  await db.insert(webhookIdempotency).values({ idempotencyKey });

  console.log(`[billing-event] Complete: key=${idempotencyKey}`);
  return res.status(200).json({
    ok: true,
    locationId,
    externalAppointmentId: parsed.externalAppointmentId,
    amountCents: priceCents,
  });
}
