import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "@notionhq/client";

import Stripe from "stripe";

const APPOINTMENT_RATE_CENTS = parseInt(
  process.env.APPOINTMENT_RATE_CENTS ?? "4000",
  10,
);

// ---------------------------------------------------------------------------
// Notion helpers
// ---------------------------------------------------------------------------
function getNotionClient() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not set");
  return new Client({ auth: apiKey });
}

function getBookingsDbId() {
  const raw = process.env.NOTION_BOOKINGS_DB ?? "";
  const id = raw.split("?")[0];
  if (!id) throw new Error("NOTION_BOOKINGS_DB is not set");
  return id;
}

async function ensureBookingsColumns(apiKey: string, databaseId: string) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
  const dbUrl = `https://api.notion.com/v1/databases/${databaseId}`;

  // Rename the default "Name" title property to "Contact Name".
  // Notion databases always have exactly one title property; we can't create a
  // second one, so we rename the existing one instead.
  const renameRes = await fetch(dbUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: { Name: { name: "Contact Name" } },
    }),
  });

  if (!renameRes.ok) {
    const text = await renameRes.text();
    // 400 likely means it was already renamed — log and continue
    console.warn("[Notion] Title rename response:", renameRes.status, text);
  }

  // Now add the remaining (non-title) properties.
  const properties: Record<string, object> = {
    "Contact Phone": { phone_number: {} },
    "Contact Email": { email: {} },
    "Contact ID": { rich_text: {} },
    "Location ID": { rich_text: {} },
    "Appointment Date": { date: {} },
    "Booking Timestamp": { date: {} },
    "Event Type": {
      select: {
        options: [
          { name: "booked" },
          { name: "rescheduled" },
          { name: "canceled" },
          { name: "no-show" },
        ],
      },
    },
    Billable: { checkbox: {} },
    "Non-Billable Reason": { rich_text: {} },
    "Raw Payload": { rich_text: {} },
  };

  const res = await fetch(dbUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Notion] Failed to ensure bookings columns:", res.status, text);
  }
}

const rt = (v: string) => ({ rich_text: [{ text: { content: v } }] });

function buildNotionProperties(
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  contactId: string,
  locationId: string,
  appointmentDate: string,
  eventType: string,
  billable: boolean,
  nonBillableReason: string,
  rawPayload: string,
) {
  return {
    "Contact Name": { title: [{ text: { content: contactName } }] },
    "Contact Phone": { phone_number: contactPhone || null },
    "Contact Email": { email: contactEmail || null },
    "Contact ID": rt(contactId),
    "Location ID": rt(locationId),
    "Appointment Date": appointmentDate
      ? { date: { start: appointmentDate } }
      : { date: null },
    "Booking Timestamp": { date: { start: new Date().toISOString() } },
    "Event Type": { select: { name: eventType } },
    Billable: { checkbox: billable },
    "Non-Billable Reason": rt(nonBillableReason),
    "Raw Payload": rt(rawPayload.slice(0, 2000)), // Notion rich_text limit
  };
}

async function findExistingPage(
  apiKey: string,
  databaseId: string,
  contactId: string,
  locationId: string,
): Promise<{ id: string } | null> {
  // Notion SDK v5 removed databases.query — use REST API directly
  const res = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Contact ID", rich_text: { equals: contactId } },
            { property: "Location ID", rich_text: { equals: locationId } },
          ],
        },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 1,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[Notion] Query failed:", res.status, text);
    return null;
  }

  const data = await res.json();
  return data.results?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------
function getStripeClient(): any {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

async function getOrCreateStripeCustomer(
  stripe: any,
  locationId: string,
): Promise<string> {
  // Search for existing customer by metadata
  const existing = await stripe.customers.search({
    query: `metadata["location_id"]:"${locationId}"`,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    name: `Location ${locationId}`,
    metadata: { location_id: locationId },
  });

  return customer.id;
}

async function createStripeInvoiceItem(
  stripe: any,
  customerId: string,
  contactName: string,
  appointmentDate: string,
) {
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: APPOINTMENT_RATE_CENTS,
    currency: "usd",
    description: `Appointment: ${contactName} on ${appointmentDate}`,
  });
}

// ---------------------------------------------------------------------------
// Extract fields from GHL webhook payload
// ---------------------------------------------------------------------------
function extractFields(body: any) {
  // GHL webhook payloads can vary — try common field paths
  const contactName =
    body.contact_name ??
    body.contactName ??
    body.full_name ??
    body.name ??
    [body.first_name ?? body.firstName, body.last_name ?? body.lastName]
      .filter(Boolean)
      .join(" ") ??
    "";
  const contactPhone =
    body.contact_phone ?? body.phone ?? body.contactPhone ?? "";
  const contactEmail =
    body.contact_email ?? body.email ?? body.contactEmail ?? "";
  const contactId =
    body.contact_id ?? body.contactId ?? body.contact?.id ?? "";
  const locationId =
    body.location_id ?? body.locationId ?? body.location?.id ?? "";
  const appointmentDate =
    body.appointment_time ??
    body.appointmentTime ??
    body.start_time ??
    body.startTime ??
    body.selectedTimezone ??
    body.date ??
    "";
  const eventType = (
    body.event_type ??
    body.eventType ??
    body.type ??
    body.status ??
    ""
  ).toLowerCase();

  return {
    contactName,
    contactPhone,
    contactEmail,
    contactId,
    locationId,
    appointmentDate,
    eventType,
  };
}

// ---------------------------------------------------------------------------
// Billing logic
// ---------------------------------------------------------------------------
function computeBilling(
  eventType: string,
  appointmentDate: string,
): { billable: boolean; reason: string } {
  switch (eventType) {
    case "booked":
      return { billable: true, reason: "" };

    case "canceled": {
      const now = Date.now();
      const bookingTime = appointmentDate ? new Date(appointmentDate).getTime() : 0;
      const diffMs = Math.abs(now - bookingTime);
      const thirtyMinMs = 30 * 60 * 1000;

      if (diffMs < thirtyMinMs) {
        return { billable: false, reason: "canceled within 30 min" };
      }
      return { billable: true, reason: "" };
    }

    case "no-show":
      return { billable: true, reason: "" };

    case "rescheduled":
      // Billable status unchanged — handled separately
      return { billable: false, reason: "" };

    default:
      return { billable: true, reason: "" };
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  console.log("[booking-event] Incoming payload:", JSON.stringify(body, null, 2));

  try {
    const {
      contactName,
      contactPhone,
      contactEmail,
      contactId,
      locationId,
      appointmentDate,
      eventType,
    } = extractFields(body);

    if (!eventType) {
      console.error("[booking-event] No event type found in payload");
      return res.status(200).json({ ok: true, skipped: true, reason: "no event type" });
    }

    const rawPayload = JSON.stringify(body);
    const notion = getNotionClient();
    const databaseId = getBookingsDbId();

    await ensureBookingsColumns(process.env.NOTION_API_KEY!, databaseId);

    // -----------------------------------------------------------------------
    // Rescheduled: update existing row only
    // -----------------------------------------------------------------------
    if (eventType === "rescheduled") {
      const existing = await findExistingPage(process.env.NOTION_API_KEY!, databaseId, contactId, locationId);
      if (existing) {
        await notion.pages.update({
          page_id: existing.id,
          properties: {
            "Appointment Date": appointmentDate
              ? { date: { start: appointmentDate } }
              : { date: null },
            "Event Type": { select: { name: "rescheduled" } },
            "Raw Payload": rt(rawPayload.slice(0, 2000)),
          },
        });
        console.log("[booking-event] Updated existing page for reschedule:", existing.id);
      } else {
        console.warn("[booking-event] No existing page found for reschedule, creating new row");
        const props = buildNotionProperties(
          contactName, contactPhone, contactEmail, contactId, locationId,
          appointmentDate, eventType, true, "", rawPayload,
        );
        await notion.pages.create({ parent: { database_id: databaseId }, properties: props });
      }
      // Skip Stripe for rescheduled — already billed on original booking
      return res.status(200).json({ ok: true, event: "rescheduled" });
    }

    // -----------------------------------------------------------------------
    // No-show: update existing row
    // -----------------------------------------------------------------------
    if (eventType === "no-show") {
      const { billable, reason } = computeBilling(eventType, appointmentDate);
      const existing = await findExistingPage(process.env.NOTION_API_KEY!, databaseId, contactId, locationId);

      if (existing) {
        await notion.pages.update({
          page_id: existing.id,
          properties: {
            "Event Type": { select: { name: "no-show" } },
            Billable: { checkbox: billable },
            "Non-Billable Reason": rt(reason),
            "Raw Payload": rt(rawPayload.slice(0, 2000)),
          },
        });
        console.log("[booking-event] Updated existing page for no-show:", existing.id);
      } else {
        console.warn("[booking-event] No existing page found for no-show, creating new row");
        const props = buildNotionProperties(
          contactName, contactPhone, contactEmail, contactId, locationId,
          appointmentDate, "no-show", billable, reason, rawPayload,
        );
        await notion.pages.create({ parent: { database_id: databaseId }, properties: props });
      }

      // Billable no-show → create Stripe invoice item
      if (billable) {
        try {
          const stripe = getStripeClient();
          const customerId = await getOrCreateStripeCustomer(stripe, locationId);
          await createStripeInvoiceItem(stripe, customerId, contactName, appointmentDate);
          console.log("[booking-event] Stripe invoice item created for no-show");
        } catch (stripeErr: any) {
          console.error("[booking-event] Stripe error:", stripeErr.message);
        }
      }

      return res.status(200).json({ ok: true, event: "no-show" });
    }

    // -----------------------------------------------------------------------
    // Booked / canceled / other: create new row
    // -----------------------------------------------------------------------
    const { billable, reason } = computeBilling(eventType, appointmentDate);

    const props = buildNotionProperties(
      contactName, contactPhone, contactEmail, contactId, locationId,
      appointmentDate, eventType, billable, reason, rawPayload,
    );

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: props,
    });
    console.log("[booking-event] Notion page created for event:", eventType);

    // Stripe: only for billable events
    if (billable) {
      try {
        const stripe = getStripeClient();
        const customerId = await getOrCreateStripeCustomer(stripe, locationId);
        await createStripeInvoiceItem(stripe, customerId, contactName, appointmentDate);
        console.log("[booking-event] Stripe invoice item created");
      } catch (stripeErr: any) {
        console.error("[booking-event] Stripe error:", stripeErr.message);
      }
    } else {
      console.log("[booking-event] Non-billable, skipping Stripe. Reason:", reason);
    }

    return res.status(200).json({ ok: true, event: eventType, billable });
  } catch (err: any) {
    console.error("[booking-event] Error:", err.message, err.stack);
    // Always return 200 — GHL won't retry on 5xx
    return res.status(200).json({ ok: true, error: err.message });
  }
}
