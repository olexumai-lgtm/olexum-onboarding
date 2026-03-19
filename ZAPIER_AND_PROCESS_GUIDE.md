# Olexum Onboarding Process & Zapier Guide

This document outlines the complete data flow and your responsibilities to ensure the onboarding process runs efficiently.

## 1. The Onboarding Flow

The system is designed to minimize friction while ensuring legal compliance and data collection.

1.  **Data Collection (Form):** User fills out business info, operations, voice identity, etc.
    *   *New:* Includes **Average Client Expenditure** for ROI tracking.
    *   *New:* Includes **Additional Information** text box for extra context.
2.  **Legal Agreement:** User signs the **16-day trial agreement** (14 days + 48h setup).
    *   *Feature:* Users can download a PDF of their signed agreement immediately.
3.  **Submission:** Data is sent to Zapier.
4.  **Redirect:** User is sent to the "Secure Setup" page.
5.  **Calendar:** User books their **Day 15 ROI review call**.
6.  **Stripe:** User activates the trial (credit card required, no immediate charge).

## 2. Your Responsibilities (Zapier & Data)

To ensure the data collected in Step 1 reaches your internal systems, you must configure Zapier.

### A. Trigger: Catch Hook
*   **Status:** Already set up.
*   **Action:** You must send a **new test submission** through the form to refresh the data in Zapier. The payload structure has changed slightly to include flattened signature fields and new business data.

### B. Action: Google Sheets (or CRM)
You need to map the incoming data to your destination. Ensure your Google Sheet has columns for the following **new fields**:

| Field Name | Description | Zapier Key |
| :--- | :--- | :--- |
| **Average Client Expenditure** | Financial baseline for ROI tracking | `avg_client_value` |
| **Additional Information** | Extra context or questions from the client | `additional_info` |
| **Signature Name** | Full legal name typed by the user | `signature_name` |
| **Signer Title** | Title of the person signing (e.g., CEO) | `signer_title` |
| **Signer Email** | Email address for the signature record | `signer_email` |
| **Date Signed** | Date of signature (e.g., "February 8, 2026") | `date_signed` |

**Critical Step:** Go to your Zap, click "Refresh Fields" in the Google Sheets action, and map these new keys to your columns.

### C. Recommended Additional Actions (Optional)
To increase efficiency, consider adding these steps to your Zap:

1.  **Email Confirmation:** Send an automated email to the `signer_email` with a copy of the agreement text or a confirmation that their trial application is being processed.
2.  **Slack/Team Notification:** Alert your team that a new onboarding form has been submitted so they can prepare for the upcoming Stripe trial activation.

## 3. Trial & Subscription Logic

The legal agreement and site messaging now explicitly state:
*   **Trial Duration:** 16 Days (14-day trial + 48-hour setup buffer).
*   **Conversion:** Automatically converts to a **$600/month** subscription if not cancelled.
*   **Cancellation:** Client can cancel anytime via the Stripe dashboard.
*   **Setup Time:** We promise setup within **48 hours**.

**Why this matters:** This language protects you by obtaining consent for the future charge *now*, while still positioning the offer as a "risk-free trial" to the user.

## 4. Next Steps for You

1.  **Test the Form:** Run through the full process as a user would. Download the PDF to check the formatting.
2.  **Update Zapier:** Map the new signature fields and the new business data fields.
3.  **Monitor Stripe:** Ensure your Stripe product is set up with a **16-day trial period** so the first charge happens automatically at the correct time.
