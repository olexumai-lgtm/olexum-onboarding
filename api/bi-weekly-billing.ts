import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStripeClient(): any {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

function getBookingsDbId() {
  const raw = process.env.NOTION_BOOKINGS_DB ?? "";
  const id = raw.split("?")[0];
  if (!id) throw new Error("NOTION_BOOKINGS_DB is not set");
  return id;
}

function notionHeaders() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

/** Returns the ISO week number for a given date. */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// Notion: ensure Billed columns exist
// ---------------------------------------------------------------------------
async function ensureBilledColumns(databaseId: string) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "PATCH",
    headers: notionHeaders(),
    body: JSON.stringify({
      properties: {
        Billed: { checkbox: {} },
        "Billed Date": { date: {} },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[bi-weekly-billing] Column ensure response:", res.status, text);
  }
}

// ---------------------------------------------------------------------------
// Notion: query unbilled billable rows
// ---------------------------------------------------------------------------
interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

async function queryUnbilledRows(databaseId: string): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  let startCursor: string | undefined;

  do {
    const body: Record<string, any> = {
      filter: {
        and: [
          { property: "Billable", checkbox: { equals: true } },
          { property: "Billed", checkbox: { equals: false } },
        ],
      },
      page_size: 100,
    };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      { method: "POST", headers: notionHeaders(), body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[bi-weekly-billing] Notion query failed:", res.status, text);
      break;
    }

    const data = await res.json();
    allPages.push(...data.results);
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return allPages;
}

// ---------------------------------------------------------------------------
// Notion: mark rows as billed
// ---------------------------------------------------------------------------
async function markRowBilled(pageId: string) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(),
    body: JSON.stringify({
      properties: {
        Billed: { checkbox: true },
        "Billed Date": { date: { start: new Date().toISOString() } },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[bi-weekly-billing] Failed to mark page billed:", pageId, res.status, text);
  }
}

// ---------------------------------------------------------------------------
// Extract Location ID from Notion page properties
// ---------------------------------------------------------------------------
function getLocationId(page: NotionPage): string {
  const prop = page.properties["Location ID"];
  return prop?.rich_text?.[0]?.plain_text ?? "";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[bi-weekly-billing] Cron triggered at", new Date().toISOString());

  // -------------------------------------------------------------------------
  // Week-number gate: only run on even weeks
  // -------------------------------------------------------------------------
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  if (weekNumber % 2 !== 0) {
    console.log(`[bi-weekly-billing] Odd week (${weekNumber}), skipping.`);
    return res.status(200).json({ ok: true, skipped: true, reason: `odd week ${weekNumber}` });
  }

  try {
    const databaseId = getBookingsDbId();
    await ensureBilledColumns(databaseId);

    // -----------------------------------------------------------------------
    // 1. Query Notion for unbilled billable rows
    // -----------------------------------------------------------------------
    const rows = await queryUnbilledRows(databaseId);
    console.log(`[bi-weekly-billing] Found ${rows.length} unbilled billable rows`);

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, invoices: 0, message: "No unbilled rows" });
    }

    // -----------------------------------------------------------------------
    // 2. Group rows by Location ID
    // -----------------------------------------------------------------------
    const byLocation = new Map<string, NotionPage[]>();
    for (const row of rows) {
      const locId = getLocationId(row);
      if (!locId) {
        console.warn("[bi-weekly-billing] Row missing Location ID, skipping:", row.id);
        continue;
      }
      if (!byLocation.has(locId)) byLocation.set(locId, []);
      byLocation.get(locId)!.push(row);
    }

    // -----------------------------------------------------------------------
    // 3. For each location, create a Stripe invoice from pending items
    // -----------------------------------------------------------------------
    const stripe = getStripeClient();
    let invoiceCount = 0;
    let totalAmountCents = 0;

    for (const [locationId, pages] of byLocation) {
      try {
        // Find Stripe customer for this location
        const existing = await stripe.customers.search({
          query: `metadata["location_id"]:"${locationId}"`,
        });

        if (existing.data.length === 0) {
          console.warn(`[bi-weekly-billing] No Stripe customer for location ${locationId}, skipping`);
          continue;
        }

        const customerId = existing.data[0].id;

        // Create an invoice from the pending invoice items
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: 3,
          auto_advance: true,
        });

        // Finalize and send the invoice
        const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(finalized.id);

        const amountDue = finalized.amount_due ?? 0;
        totalAmountCents += amountDue;
        invoiceCount++;

        console.log(
          `[bi-weekly-billing] Invoice sent for location ${locationId}: ` +
          `${finalized.id} — $${(amountDue / 100).toFixed(2)} (${pages.length} bookings)`,
        );

        // Mark all Notion rows for this location as billed
        for (const page of pages) {
          await markRowBilled(page.id);
        }
      } catch (err: any) {
        console.error(`[bi-weekly-billing] Error processing location ${locationId}:`, err.message);
      }
    }

    // -----------------------------------------------------------------------
    // 4. Summary
    // -----------------------------------------------------------------------
    const summary = {
      ok: true,
      week: weekNumber,
      invoices: invoiceCount,
      totalAmount: `$${(totalAmountCents / 100).toFixed(2)}`,
      rowsProcessed: rows.length,
    };
    console.log("[bi-weekly-billing] Complete:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error("[bi-weekly-billing] Fatal error:", err.message, err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
