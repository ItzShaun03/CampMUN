/* ============================================================
   CAMP MUN — ADMIN ROUTES  (/api/admin/)
   Every route here is protected by the ADMIN_KEY (x-admin-key
   header) and only works while the "uploads" feature is on.
   files   GET     list uploaded images & documents
   upload  POST    store a new image or document
   file    DELETE  remove an uploaded file
   export  GET     download all registrations as a .xlsx workbook
   ============================================================ */

import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import nodeCrypto from "node:crypto";
import ExcelJS from "exceljs";
import { featureOn, adminKey } from "../config.js";
import { listContent, upload, contentRoot } from "../content.js";
import { safeString } from "../utils.js";
import { registrationModelFor, listRegistrationCollections } from "../models.js";

const router = express.Router();

/* ---- Gate: feature flag + ADMIN_KEY header ------------------ */
const keysMatch = (received) => {
  const expected = Buffer.from(adminKey);
  const given = Buffer.from(String(received || ""));
  return expected.length === given.length && nodeCrypto.timingSafeEqual(expected, given);
};

const authorizeAdmin = (req, res, next) => {
  if (!featureOn("uploads")) return res.status(403).json({ ok: false, message: "Uploads are disabled in features.js. Set \"uploads\": true to use the Manage page." });
  if (!adminKey) return res.status(403).json({ ok: false, message: "Set ADMIN_KEY in .env to enable the Manage page." });
  if (!keysMatch(req.get("x-admin-key"))) return res.status(401).json({ ok: false, message: "Invalid admin key. Re-enter the key from your .env file." });
  next();
};

/* ---- GET /api/admin/files ----------------------------------- */
router.get("/files", authorizeAdmin, async (_, res, next) => {
  try {
    res.json({ ok: true, uploadsConfigured: Boolean(adminKey), ...(await listContent()) });
  } catch (error) {
    next(error);
  }
});

/* ---- POST /api/admin/upload --------------------------------- */
router.post("/upload", authorizeAdmin, upload.fields([{ name: "image", maxCount: 1 }, { name: "document", maxCount: 1 }]), async (req, res, next) => {
  try {
    const files = Object.values(req.files || {}).flat();
    if (!files.length) return res.status(400).json({ ok: false, message: "Choose an image or PDF to upload." });

    const uploaded = files.map((file) => {
      const category = file.fieldname === "document" ? "documents" : "images";
      return { category, name: file.filename, url: `content/${category}/${encodeURIComponent(file.filename)}` };
    });
    res.status(201).json({ ok: true, files: uploaded });
  } catch (error) {
    next(error);
  }
});

/* ---- DELETE /api/admin/file --------------------------------- */
router.delete("/file", authorizeAdmin, async (req, res, next) => {
  try {
    const category = safeString(req.query.category, 30);
    const name = safeString(req.query.name, 200);
    if (!["images", "documents"].includes(category) || !name) {
      return res.status(400).json({ ok: false, message: "A valid category and filename are required." });
    }

    /* Guard against path traversal: the resolved target must stay inside the folder. */
    const folder = path.resolve(path.join(contentRoot, category));
    const target = path.resolve(path.join(folder, path.basename(name)));
    if (!target.startsWith(folder + path.sep)) return res.status(400).json({ ok: false, message: "Invalid filename." });

    try {
      await fs.unlink(target);
    } catch (error) {
      if (error.code === "ENOENT") return res.status(404).json({ ok: false, message: "File not found." });
      throw error;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ---- GET /api/admin/export -----------------------------------
   One worksheet per school plus an "Individuals" worksheet,
   mirroring the Google Sheet layout.
   ------------------------------------------------------------ */
const SHEET_HEADERS = ["Received at", "Application ID", "Name", "Email", "School", "Registration type", "Committee preference", "Consent"];

const excelSheetName = (original) => {
  const base = String(original || "School").replace(/[\\/:*?"<>|[\]]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 27);
  return (base || "School") === "Individuals" ? "Schools" : base || "School";
};

router.get("/export", authorizeAdmin, async (_, res, next) => {
  try {
    const docs = [];
    for (const name of await listRegistrationCollections()) {
      const found = await registrationModelFor(name).find({}).sort({ createdAt: 1 }).exec();
      docs.push(...found);
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampMUN Portal";

    const groups = new Map();
    groups.set("Individuals", []);
    for (const doc of docs) {
      const row = [doc.createdAt || new Date(), doc.applicationId, doc.name, doc.email, doc.school, doc.role, doc.committee, doc.consent ? "Yes" : "No"];
      if (doc.userKind === "IndividualUser") {
        groups.get("Individuals").push(row);
      } else {
        const name = excelSheetName(doc.school);
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(row);
      }
    }

    for (const [name, rows] of groups) {
      let sheetName = name;
      let suffix = 1;
      while (Array.from(workbook.worksheets).some((ws) => ws.name === sheetName)) {
        suffix += 1;
        sheetName = name.slice(0, 25) + "_" + suffix;
      }

      const sheet = workbook.addWorksheet(sheetName);
      sheet.addRow(SHEET_HEADERS);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFF8F5EE" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10140F" } };
      headerRow.alignment = { vertical: "middle" };
      sheet.getRow(1).height = 22;
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      rows.forEach((row) => sheet.addRow(row));
      sheet.columns.forEach((column, index) => {
        if (column) column.width = Math.min(34, Math.max(14, (SHEET_HEADERS[index] || "").length + 6));
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"campmun-registrations.xlsx\"");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;