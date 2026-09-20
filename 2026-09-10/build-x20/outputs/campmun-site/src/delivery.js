/* ============================================================
   CAMP MUN — BACKGROUND DELIVERY
   After a registration is saved, these helpers fan it out:
   1. to your Google Sheet (via the deployed Apps Script URL), and
   2. as a confirmation email (via SMTP).
   Both run in the background so a slow external service can never
   hold up the application form.
   ============================================================ */

import path from "node:path";
import fs from "node:fs/promises";
import { root, sheetsUrl, mailer } from "./config.js";

export async function sendToGoogleSheet(registration) {
  if (!sheetsUrl) return false;
  const body = new URLSearchParams({
    applicationId: registration.applicationId,
    name: registration.name,
    email: registration.email,
    school: registration.school,
    role: registration.role,
    committee: registration.committee,
    consent: String(registration.consent),
    kind: registration.userKind === "SchoolUser" ? "school" : "individual"
  });
  const response = await fetch(sheetsUrl, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Google Sheets delivery failed (${response.status})`);
  return true;
}

export async function sendConfirmationEmail(registration) {
  if (!mailer) return false;
  const template = await fs.readFile(path.join(root, "data", "confirmation-email.txt"), "utf8");
  const text = template
    .replaceAll("{{name}}", registration.name)
    .replaceAll("{{role}}", registration.role)
    .replaceAll("{{committee}}", registration.committee)
    .replaceAll("{{applicationId}}", registration.applicationId);
  await mailer.sendMail({
    from: process.env.EMAIL_FROM,
    to: registration.email,
    subject: "Your CampMUN application has been received",
    text
  });
  return true;
}

/* Fire-and-forget delivery with clear, separate error messages. */
export function deliverInBackground(doc) {
  (async () => {
    try {
      if (await sendToGoogleSheet(doc)) {
        doc.sheetsDeliveredAt = new Date();
        await doc.save();
      }
    } catch (sheetError) {
      console.error("Application stored, but Google Sheet delivery failed:", sheetError.message);
    }
    try {
      await sendConfirmationEmail(doc);
    } catch (mailError) {
      console.error("Application stored, but confirmation email failed:", mailError.message);
    }
  })();
}