# Zapier Integration Update Guide

Since we've updated the form to include a dedicated Legal Agreement step with a signature, the data sent to Zapier has changed slightly. You'll need to update your Zap to capture these new fields.

## 1. Trigger: Catch Hook
*   **No changes needed** to the Webhook URL.
*   **Action Required:** You must submit a **new test entry** on your live form (or the preview link) to send fresh data to Zapier.
*   **In Zapier:** Go to the "Trigger" step -> "Test" -> Click "Find new records". Select the most recent request (Request B, C, etc.).

## 2. New Data Fields
The form now sends the following **top-level fields** (no longer nested inside `terms_acceptance`):

*   `signature_name`: The full name typed by the user.
*   `signer_title`: The title entered by the user.
*   `signer_email`: The email entered in the signature block.
*   `date_signed`: The date the form was signed (e.g., "February 7, 2026").

## 3. Action: Google Sheets (Update Row / Create Row)
*   **Action Required:** Go to your Google Sheets action step.
*   **Refresh Fields:** Click "Refresh fields" if you don't see the new columns (make sure you've added columns for Signature, Title, Date, etc. in your Google Sheet first!).
*   **Map the Fields:**
    *   Map `signature_name` to your **Signature** column.
    *   Map `signer_title` to your **Title** column.
    *   Map `date_signed` to your **Date Signed** column.
    *   Map `signer_email` to your **Signer Email** column.

## 4. Publish
*   Turn your Zap off and back on (Publish) to ensure the changes are live.

---
**Note on Stripe Redirect:**
The form flow remains: **Form Submission -> Zapier Data Send -> Redirect to Setup Page -> User Clicks "Proceed to Checkout" -> Stripe Payment Link**. This ensures data is captured in Zapier *before* the user leaves for payment.
