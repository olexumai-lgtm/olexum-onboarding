import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/client.js";
import { webhookIdempotency, charges } from "../../db/schema.js";
import { eq } from "drizzle-orm";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const BILLING_EVENTS = new Set(["completed", "no_show", "no-show", "noshow"]);

interface ParsedPayload {
  phone: string;
  externalAppointmentId: string;
  appointmentTime: string;
  eventType: string;
}

function parsePayload(body: any): ParsedPayload {
  return {
    phone: body.phone ?? body.Phone ?? body.client_phone ?? body.mobile ?? "",
    externalAppointmentId:
      body.external_appointment_id ??
      body.externalAppointmentId ??
      body.appointment_id ??
      body.appointmentId ??
      body.id ??
      "",
    appointmentTime:
      body.appointment_time ??
      body.appointmentTime ??
      body.start_time ??
      body.startTime ??
      body.start_date_time ??
      "",
    eventType: (
      body.event_type ??
      body.eventType ??
      body.type ??
      body.status ??
      ""
    ).toLowerCase(),
  };
}

const TAG_MAP: Record<string, string> = {
  created: "status:booked",
  booked: "status:booked",
  rescheduled: "status:rescheduled",
  cancelled: "status:cancelled",
  canceled: "status:cancelled",
  completed: "status:completed",
  no_show: "status:no-show",
  "no-show": "status:no-show",
  noshow: "status:no-show",
};

function mapTag(eventType: string): string | null {
  return TAG_MAP[eventType] ?? null;
}

function ghlHeaders() {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

async function upsertContact(
  locationId: string,
  phone: string,
): Promise<string> {
  const searchRes = await fetch(
    `${GHL_API_BASE}/contacts/search/duplicate?locationId=${locationId}&number=${encodeURIComponent(phone)}`,
    { method: "GET", headers: ghlHeaders() },
  );

  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`GHL contact search failed (${searchRes.status}): ${text}`);
  }

  const searchData = await searchRes.json();
  const existing = searchData.contact;
  if (existing?.id) return existing.id;

  const createRes = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({ locationId, phone }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`GHL contact create failed (${createRes.status}): ${text}`);
  }

  const createData = await createRes.json();
  return createData.contact.id;
}

async function updateContactCustomFields(
  contactId: string,
  appointmentTime: string,
  externalAppointmentId: string,
): Promise<void> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: ghlHeaders(),
    body: JSON.stringify({
      customFields: [
        { key: "next_appointment_time", field_value: appointmentTime },
        { key: "external_appointment_id", field_value: externalAppointmentId },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL contact update failed (${res.status}): ${text}`);
  }
}

async function applyTag(contactId: string, tag: string): Promise<void> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL tag apply failed (${res.status}): ${text}`);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: required in production
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("[crm-sync] WEBHOOK_SECRET is not set; refusing request");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  const providedSecret =
    req.headers["x-olexum-webhook-secret"] ||
    req.headers["x-webhook-secret"];
  if (providedSecret !== expectedSecret) {
    console.warn("[crm-sync] Unauthorized webhook request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const locationId = req.query.location_id as string;
  if (!locationId) return res.status(400).json({ error: "Missing location_id" });

  const body = req.body;
  console.log(
    `[crm-sync] Incoming for location ${locationId}:`,
    JSON.stringify(body),
  );

  const parsed = parsePayload(body);

  if (!parsed.phone || !parsed.externalAppointmentId || !parsed.eventType) {
    console.error("[crm-sync] Missing required fields:", parsed);
    return res.status(400).json({
      error:
        "Missing required fields: phone, external_appointment_id, event_type",
    });
  }

  const tag = mapTag(parsed.eventType);
  if (!tag) {
    console.error(`[crm-sync] Unknown event_type: ${parsed.eventType}`);
    return res
      .status(400)
      .json({ error: `Unknown event_type: ${parsed.eventType}` });
  }

  const idempotencyKey = `${locationId}:${parsed.externalAppointmentId}:${parsed.eventType}`;
  const existing = await db
    .select({ idempotencyKey: webhookIdempotency.idempotencyKey })
    .from(webhookIdempotency)
    .where(eq(webhookIdempotency.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[crm-sync] Duplicate, key=${idempotencyKey}`);
    return res.status(200).json({ ok: true, duplicate: true });
  }

  let contactId: string;
  try {
    contactId = await upsertContact(locationId, parsed.phone);
    console.log(`[crm-sync] Contact upserted: ${contactId}`);

    await updateContactCustomFields(
      contactId,
      parsed.appointmentTime,
      parsed.externalAppointmentId,
    );
    console.log(`[crm-sync] Custom fields updated for ${contactId}`);

    await applyTag(contactId, tag);
    console.log(`[crm-sync] Tag "${tag}" applied to ${contactId}`);
  } catch (err: any) {
    console.error(
      `[crm-sync] GHL sync failed for key=${idempotencyKey}:`,
      err.message,
    );
    return res
      .status(500)
      .json({ error: "GHL sync failed", detail: err.message });
  }

  // Charge insert for billable events (idempotent via unique index)
  if (BILLING_EVENTS.has(parsed.eventType)) {
    try {
      await db
        .insert(charges)
        .values({
          contactId,
          externalAppointmentId: parsed.externalAppointmentId,
          locationId,
          appointmentTimestamp: parsed.appointmentTime
            ? new Date(parsed.appointmentTime)
            : new Date(),
          amountCents: 2000,
          status: "tallied",
        })
        .onConflictDoNothing();
      console.log(
        `[crm-sync] Charge tallied for appt ${parsed.externalAppointmentId}`,
      );
    } catch (err: any) {
      console.error(`[crm-sync] Charge insert error:`, err.message);
    }
  }

  await db.insert(webhookIdempotency).values({ idempotencyKey });

  console.log(`[crm-sync] Complete: key=${idempotencyKey}`);
  return res.status(200).json({ ok: true, eventType: parsed.eventType, tag });
}
