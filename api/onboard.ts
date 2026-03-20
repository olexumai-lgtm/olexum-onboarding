import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "@notionhq/client";

const GHL_BASE = "https://services.leadconnectorhq.com";

interface FormPayload {
  company_name: string;
  industry: string;
  company_size: { employees: string; locations: string };
  avg_client_value: string;
  contact_info: {
    full_name: string;
    email: string;
    phone: string;
    role: string;
  };
  website_url: string;
  timezone: string;
  hours: string;
  voice_gender: string;
  voice_accent: string;
  call_goal: string;
  info_collection: string;
  faqs: string;
  calendar: string;
  crm: string;
  meeting_types: string;
  booking_rules: string;
  phone_provider: string;
  forwarding: string;
  additional_info: string;
  signature_name: string;
  signer_title: string;
  date_signed: string;
  signer_email: string;
}

// ---------------------------------------------------------------------------
// 1. Create GHL Sub-Account
// ---------------------------------------------------------------------------
async function createGHLSubAccount(data: FormPayload) {
  const contact = data.contact_info ?? {};

  const body = {
    name: data.company_name,
    phone: contact.phone,
    email: contact.email,
    address: "",
    city: "",
    state: "",
    country: "US",
    postalCode: "",
    website: data.website_url ?? "",
    timezone: mapTimezone(data.timezone),
    settings: {
      allowDuplicateContact: false,
      allowDuplicateOpportunity: false,
      allowFacebookNameMerge: false,
    },
  };

  const res = await fetch(`${GHL_BASE}/locations/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL create sub-account failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  // The API returns the location object directly or nested
  return (json.location ?? json) as { id: string; name: string };
}

// ---------------------------------------------------------------------------
// 2. Apply Snapshot to Sub-Account
// ---------------------------------------------------------------------------
async function applySnapshot(locationId: string) {
  const snapshotId = (process.env.GHL_SNAPSHOT_ID ?? "").replace(/^id:\s*/i, "");

  const res = await fetch(
    `${GHL_BASE}/locations/${locationId}/templates/`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({ snapshotId }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL apply snapshot failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// 3. Log Client to Notion
// ---------------------------------------------------------------------------
async function logToNotion(data: FormPayload, locationId: string) {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  // Strip any view query param from the database ID
  const databaseId = (process.env.NOTION_DATABASE_ID ?? "").split("?")[0];
  const contact = data.contact_info ?? {};

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: data.company_name } }] },
      Email: { email: contact.email },
      Phone: { phone_number: contact.phone },
      Industry: { select: { name: data.industry } },
      "Contact Name": {
        rich_text: [{ text: { content: contact.full_name ?? "" } }],
      },
      "GHL Location ID": {
        rich_text: [{ text: { content: locationId } }],
      },
      Website: { url: data.website_url || null },
      Status: { select: { name: "Onboarding" } },
      "Date Signed": {
        rich_text: [{ text: { content: data.date_signed ?? "" } }],
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Send team notification (webhook)
// ---------------------------------------------------------------------------
async function notifyTeam(data: FormPayload, locationId: string) {
  const webhookUrl = process.env.TEAM_NOTIFICATION_WEBHOOK;
  if (!webhookUrl) return; // Skip if no webhook configured

  const contact = data.contact_info ?? {};
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `New client onboarded: ${data.company_name}`,
      company: data.company_name,
      contact: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      industry: data.industry,
      ghl_location_id: locationId,
    }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapTimezone(tz: string): string {
  const map: Record<string, string> = {
    ET: "America/New_York",
    CT: "America/Chicago",
    MT: "America/Denver",
    PT: "America/Los_Angeles",
  };
  return map[tz] ?? "America/New_York";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = req.body as FormPayload;

    if (!data.company_name || !data.contact_info?.email) {
      return res
        .status(400)
        .json({ error: "Missing required fields: company_name, contact email" });
    }

    // Step 1: Create GHL sub-account
    const location = await createGHLSubAccount(data);

    // Step 2: Apply snapshot template
    await applySnapshot(location.id);

    // Step 3 & 4 in parallel — neither blocks the other
    await Promise.allSettled([
      logToNotion(data, location.id),
      notifyTeam(data, location.id),
    ]);

    return res.status(200).json({
      success: true,
      locationId: location.id,
    });
  } catch (err: any) {
    console.error("Onboard error:", err);
    return res.status(500).json({
      error: "Onboarding failed",
      detail: err.message ?? String(err),
    });
  }
}
