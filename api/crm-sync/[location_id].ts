import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/client.js";
import { webhookIdempotency } from "../../db/schema.js";
import { eq } from "drizzle-orm";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

// ---------------------------------------------------------------------------
// Generic CRM payload parser
// ---------------------------------------------------------------------------
interface ParsedPayload {
  phone: string;
  externalAppointmentId: string;
  appointmentTime: string; // ISO 8601 UTC
  eventType: string;
}

function parsePayload(body: any): ParsedPayload {
  return {
    phone:
      body.phone ?? body.Phone ?? body.client_phone ?? body.mobile ?? "",
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

// ---------------------------------------------------------------------------
// Event type -> GHL tag mapping
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GHL API v2 helpers
// ---------------------------------------------------------------------------
function ghlHeaders() {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

/** Step 1: Upsert contact by phone, returns contact_id */
async function upsertContact(
  locationId: string,
  phone: string,
): Promise<string> {
  // Search for existing contact by phone
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

  if (existing?.id) {
    return existing.id;
  }

  // Create new contact
  const createRes = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId,
      phone,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`GHL contact create failed (${createRes.status}): ${text}`);
  }

  const createData = await createRes.json();
  return createData.contact.id;
}

/** Steps 2 & 3: Update custom fields on the contact */
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
        { key: "next_appointment_time", value: appointmentTime },
        { key: "external_appointment_id", value: externalAppointmentId },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL contact update failed (${res.status}): ${text}`);
  }
}

/** Step 4: Apply a tag to the contact */
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const locationId = req.query.location_id as string;
  if (!locationId) {
    return res.status(400).json({ error: "Missing location_id" });
  }

  const body = req.body;
  console.log(`[crm-sync] Incoming for location ${locationId}:`, JSON.stringify(body));

  const parsed = parsePayload(body);

  if (!parsed.phone || !parsed.externalAppointmentId || !parsed.eventType) {
    console.error("[crm-sync] Missing required fields:", parsed);
    return res.status(400).json({ error: "Missing required fields: phone, external_appointment_id, event_type" });
  }

  const tag = mapTag(parsed.eventType);
  if (!tag) {
    console.error(`[crm-sync] Unknown event_type: ${parsed.eventType}`);
    return res.status(400).json({ error: `Unknown event_type: ${parsed.eventType}` });
  }

  // Idempotency check
  const idempotencyKey = `${locationId}:${parsed.externalAppointmentId}:${parsed.eventType}`;

  const existing = await db
    .select({ idempotencyKey: webhookIdempotency.idempotencyKey })
    .from(webhookIdempotency)
    .where(eq(webhookIdempotency.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[crm-sync] Duplicate webhook, key=${idempotencyKey}`);
    return res.status(200).json({ ok: true, duplicate: true });
  }

  // Strict GHL write order — if any step fails, return 500 so the CRM retries
  try {
    // Step 1: Upsert contact
    const contactId = await upsertContact(locationId, parsed.phone);
    console.log(`[crm-sync] Contact upserted: ${contactId}`);

    // Steps 2 & 3: Update custom fields
    await updateContactCustomFields(
      contactId,
      parsed.appointmentTime,
      parsed.externalAppointmentId,
    );
    console.log(`[crm-sync] Custom fields updated for contact ${contactId}`);

    // Step 4: Apply tag
    await applyTag(contactId, tag);
    console.log(`[crm-sync] Tag "${tag}" applied to contact ${contactId}`);
  } catch (err: any) {
    console.error(`[crm-sync] GHL sync failed for key=${idempotencyKey}:`, err.message);
    return res.status(500).json({ error: "GHL sync failed", detail: err.message });
  }

  // All steps succeeded — record idempotency key
  await db.insert(webhookIdempotency).values({ idempotencyKey });

  console.log(`[crm-sync] Complete: key=${idempotencyKey}`);
  return res.status(200).json({ ok: true });
}
