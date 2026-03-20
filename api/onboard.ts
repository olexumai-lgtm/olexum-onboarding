import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "@notionhq/client";

const GHL_BASE = "https://services.leadconnectorhq.com";
const DRY_RUN = process.env.DRY_RUN === "true";

interface FormPayload {
  company_name: string;
  industry: string;
  industry_other?: string;
  company_size: { employees: string; locations: string };
  avg_client_value: string;
  contact_info: {
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  website_url: string;
  timezone: string;
  timezone_other?: string;
  hours: string;
  voice_gender: string;
  voice_accent: string;
  call_goal: string;
  call_goal_other?: string;
  info_collection: string;
  faqs: string;
  calendar: string;
  calendar_other?: string;
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

  if (DRY_RUN) {
    const fakeId = `dry-run-${Date.now()}`;
    console.log("[DRY_RUN] Would create GHL sub-account:", JSON.stringify(body, null, 2));
    console.log(`[DRY_RUN] Returning fake location id: ${fakeId}`);
    return { id: fakeId, name: data.company_name };
  }

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

  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would apply snapshot ${snapshotId} to location ${locationId}`);
    console.log(`[DRY_RUN] PUT ${GHL_BASE}/locations/${locationId}/templates/`, JSON.stringify({ snapshotId }));
    return { ok: true };
  }

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
async function ensureNotionSchema(notion: Client, databaseId: string) {
  console.log("[Notion] ensureNotionSchema called with databaseId:", databaseId);

  let db;
  try {
    console.log("[Notion] Retrieving database schema...");
    db = await notion.databases.retrieve({ database_id: databaseId });
    console.log("[Notion] Database retrieved successfully. Title:", JSON.stringify((db as any).title));
  } catch (err: any) {
    console.error("[Notion] FAILED to retrieve database:", err.code, err.status, err.message);
    console.error("[Notion] Full error:", JSON.stringify(err, null, 2));
    throw err;
  }

  console.log("[Notion] Database response keys:", Object.keys(db).join(", "));
  const existing = (db as any).properties ?? {};
  console.log("[Notion] Existing properties:", Object.keys(existing).join(", "));

  const required: Record<string, object> = {
    Name: { title: {} },
    Email: { email: {} },
    Phone: { phone_number: {} },
    Industry: { select: { options: [] } },
    "Company Size": { rich_text: {} },
    "Avg Client Value": { number: { format: "dollar" } },
    "Contact Name": { rich_text: {} },
    "Contact Role": { rich_text: {} },
    Website: { url: {} },
    Timezone: { select: { options: [] } },
    "Business Hours": { rich_text: {} },
    "Voice Gender": { select: { options: [] } },
    "Voice Accent": { rich_text: {} },
    "Call Goal": { select: { options: [] } },
    "Info Collection": { rich_text: {} },
    FAQs: { rich_text: {} },
    Calendar: { select: { options: [] } },
    CRM: { rich_text: {} },
    "Meeting Types": { rich_text: {} },
    "Booking Rules": { rich_text: {} },
    "Phone Provider": { rich_text: {} },
    "Call Forwarding": { rich_text: {} },
    "Additional Info": { rich_text: {} },
    "GHL Location ID": { rich_text: {} },
    Status: { select: { options: [] } },
    "Signature Name": { rich_text: {} },
    "Signer Title": { rich_text: {} },
    "Signer Email": { email: {} },
    "Date Signed": { date: {} },
  };

  const missing: Record<string, object> = {};
  for (const [name, schema] of Object.entries(required)) {
    if (!existing[name]) {
      missing[name] = schema;
    }
  }

  if (Object.keys(missing).length > 0) {
    console.log("[Notion] Missing properties to add:", Object.keys(missing).join(", "));
    try {
      const updateRes = await notion.databases.update({
        database_id: databaseId,
        properties: missing,
      });
      console.log("[Notion] Database schema updated successfully");
    } catch (err: any) {
      console.error("[Notion] FAILED to update database schema:", err.code, err.status, err.message);
      console.error("[Notion] Full error:", JSON.stringify(err, null, 2));
      throw err;
    }
  } else {
    console.log("[Notion] All required properties already exist");
  }
}

async function logToNotion(data: FormPayload, locationId: string) {
  console.log("[Notion] logToNotion called for company:", data.company_name, "locationId:", locationId);

  const apiKey = process.env.NOTION_API_KEY;
  console.log("[Notion] NOTION_API_KEY present:", !!apiKey, "length:", apiKey?.length ?? 0);

  const rawDbId = process.env.NOTION_DATABASE_ID ?? "";
  const databaseId = rawDbId.split("?")[0];
  console.log("[Notion] Raw NOTION_DATABASE_ID:", rawDbId);
  console.log("[Notion] Parsed databaseId:", databaseId, "length:", databaseId.length);

  if (!apiKey) {
    console.error("[Notion] NOTION_API_KEY is not set — skipping Notion logging");
    return;
  }
  if (!databaseId) {
    console.error("[Notion] NOTION_DATABASE_ID is not set — skipping Notion logging");
    return;
  }

  const notion = new Client({ auth: apiKey });
  const contact = data.contact_info ?? {};
  const size = data.company_size ?? {};

  await ensureNotionSchema(notion, databaseId);

  const industry = resolveOther(data.industry, data.industry_other);
  const timezone = resolveOther(data.timezone, data.timezone_other);
  const callGoal = resolveOther(data.call_goal, data.call_goal_other);
  const calendar = resolveOther(data.calendar, data.calendar_other);

  const rt = (v: string | undefined) =>
    ({ rich_text: [{ text: { content: v ?? "" } }] });

  const properties = {
    // Business Info
    Name: { title: [{ text: { content: data.company_name } }] },
    Email: { email: contact.email || null },
    Phone: { phone_number: contact.phone || null },
    Industry: { select: { name: industry || "Unknown" } },
    "Company Size": rt(
      [size.employees && `${size.employees} employees`, size.locations && `${size.locations} locations`]
        .filter(Boolean).join(", "),
    ),
    "Avg Client Value": { number: parseFloat(data.avg_client_value) || null },
    "Contact Name": rt(contact.name),
    "Contact Role": rt(contact.role),
    Website: { url: data.website_url || null },

    // Operations
    Timezone: { select: { name: timezone || "ET" } },
    "Business Hours": rt(data.hours),

    // Voice Identity
    "Voice Gender": { select: { name: data.voice_gender || "female" } },
    "Voice Accent": rt(data.voice_accent),

    // Call Goals
    "Call Goal": { select: { name: callGoal || "book" } },
    "Info Collection": rt(data.info_collection),
    FAQs: rt(data.faqs),

    // Systems & Tools
    Calendar: { select: { name: calendar || "google" } },
    CRM: rt(data.crm),
    "Meeting Types": rt(data.meeting_types),
    "Booking Rules": rt(data.booking_rules),
    "Phone Provider": rt(data.phone_provider),
    "Call Forwarding": rt(data.forwarding),
    "Additional Info": rt(data.additional_info),

    // Internal
    "GHL Location ID": rt(locationId),
    Status: { select: { name: "Onboarding" } },

    // Legal / Signature
    "Signature Name": rt(data.signature_name),
    "Signer Title": rt(data.signer_title),
    "Signer Email": { email: data.signer_email || null },
    "Date Signed": { date: { start: data.date_signed || null } },
  };

  console.log("[Notion] Creating page with properties:", JSON.stringify(properties, null, 2));

  try {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
    console.log("[Notion] Page created successfully! Page ID:", (page as any).id);
  } catch (err: any) {
    console.error("[Notion] FAILED to create page:", err.code, err.status, err.message);
    console.error("[Notion] Full error:", JSON.stringify(err, null, 2));
    throw err;
  }
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
      contact: contact.name,
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

/** If user picked "other", use the freeform _other value instead. */
function resolveOther(value: string | undefined, other: string | undefined): string {
  if (value === "other" && other) return other;
  return value ?? "";
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

    if (DRY_RUN) {
      console.log("[DRY_RUN] Dry run mode enabled — GHL API calls will be skipped");
    }

    // Step 1: Create GHL sub-account
    const location = await createGHLSubAccount(data);

    // Step 2: Apply snapshot template
    await applySnapshot(location.id);

    // Step 3 & 4 in parallel — neither blocks the other
    const [notionResult, notifyResult] = await Promise.allSettled([
      logToNotion(data, location.id),
      notifyTeam(data, location.id),
    ]);

    console.log("[Handler] Notion result:", notionResult.status,
      notionResult.status === "rejected" ? notionResult.reason : "OK");
    console.log("[Handler] Notify result:", notifyResult.status,
      notifyResult.status === "rejected" ? notifyResult.reason : "OK");

    return res.status(200).json({
      success: true,
      locationId: location.id,
      dryRun: DRY_RUN,
    });
  } catch (err: any) {
    console.error("Onboard error:", err);
    return res.status(500).json({
      error: "Onboarding failed",
      detail: err.message ?? String(err),
    });
  }
}
