/* ============================================================
   CAMP MUN — CONFIGURATION
   The single place that reads environment variables (.env) and
   the feature flags (features.js). Every other module imports
   the settings it needs from here.
   ============================================================ */

import path from "node:path";
import fs from "node:fs/promises";
import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";

/* ---- Paths & server basics
   config.js lives in src/, so the project root is one folder up. */
export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const port = Number(process.env.PORT || 3000);

/* ---- External services (from .env) -------------------------- */
export const mongoUri = process.env.MONGODB_URI;
export const sheetsUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
export const adminKey = (process.env.ADMIN_KEY || "").trim();

const smtpReady = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM
);

export const mailer = smtpReady
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== "false",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

/* ---- Feature flags ------------------------------------------
   Features live in features.js — the same single boolean file the
   browser loads — so one file controls both the pages and the APIs.
   ------------------------------------------------------------ */
let features = {};
try {
  const raw = await fs.readFile(path.join(root, "features.js"), "utf8");
  const marker = "CAMPMUN_FEATURES =";
  const body = raw.slice(raw.indexOf(marker) + marker.length);
  features = JSON.parse(body.slice(0, body.lastIndexOf("}") + 1));
} catch (error) {
  console.warn("Could not read features.js, running with all features enabled:", error.message);
}

export const featureOn = (name) => features[name] !== false;