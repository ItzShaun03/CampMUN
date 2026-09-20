/* ============================================================
   CAMP MUN — INFO ROUTES  (/api/)
   health   GET   status of Mongo, uploads, Sheets and email
   content  GET   URLs of every image and document on the site
   ============================================================ */

import express from "express";
import mongoose from "mongoose";
import { featureOn, mongoUri, adminKey, sheetsUrl, mailer } from "../config.js";
import { listContent } from "../content.js";
import { listRegistrationCollections } from "../models.js";

const router = express.Router();

/* ---- GET /api/health ---------------------------------------- */
router.get("/health", async (_, res) => {
  const connected = mongoose.connection.readyState === 1;
  const collections = connected
    ? await Promise.all(
        [
          "school_users",
          "individual_users",
          "sessions",
          "logins",
          ...(await listRegistrationCollections())
        ].map(async (name) => ({
          name,
          exists: await mongoose.connection.db.listCollections({ name }).hasNext()
        }))
      ).catch(() => [])
    : [];

  res.json({
    ok: true,
    mongo: connected,
    collections,
    uploadsConfigured: Boolean(adminKey),
    googleSheetsConfigured: Boolean(sheetsUrl),
    emailConfigured: Boolean(mailer),
    authConfigured: featureOn("auth") && Boolean(mongoUri)
  });
});

/* ---- GET /api/content --------------------------------------- */
router.get("/content", async (_, res, next) => {
  try {
    res.json({ ok: true, ...(await listContent()) });
  } catch (error) {
    next(error);
  }
});

export default router;