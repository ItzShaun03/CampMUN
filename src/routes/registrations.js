/* ============================================================
   CAMP MUN — REGISTRATION ROUTES  (/api/registrations/)
   POST   /            submit a new delegate / faculty application
   GET    /mine        list the signed-in account's registrations
   PUT    /:id         edit one of your own registrations

   Seats are enforced per School account (delegate & faculty caps),
   and Individual accounts can submit at most one application.
   When MongoDB is unavailable the form still stores applications to
   Google Sheets + email instead of failing.
   ============================================================ */

import express from "express";
import { featureOn, sheetsUrl } from "../config.js";
import { waitForMongo } from "../database.js";
import { safeString, createId } from "../utils.js";
import { registrationModelFor, registrationCollectionName, INDIVIDUAL_REGISTRATIONS } from "../models.js";
import { currentUser } from "../auth-helpers.js";
import { sendToGoogleSheet, sendConfirmationEmail, deliverInBackground } from "../delivery.js";

const router = express.Router();

/* ---- Local form helpers -------------------------------------- */
const cleanString = (value) => String(value || "").trim();

/* The registration collection to read/write for a signed-in account. */
const collectionForAccount = (account) =>
  account
    ? registrationCollectionName({ school: account.doc.school, userKind: account.kind })
    : INDIVIDUAL_REGISTRATIONS;

const registrationValues = (body) => ({
  name: safeString(body.name, 120),
  email: safeString(body.email, 180).toLowerCase(),
  school: safeString(body.school, 180),
  role: safeString(body.role, 80),
  committee: safeString(body.committee, 180),
  consent: body.consent === true || body.consent === "on" || body.consent === "true"
});

const registrationValid = (values) =>
  Object.entries(values).every(([key, value]) => key === "consent" || cleanString(value)) &&
  values.consent &&
  /^\S+@\S+\.\S+$/.test(values.email);

const publicRegistration = (doc) => ({
  applicationId: doc.applicationId,
  name: doc.name,
  email: doc.email,
  school: doc.school,
  role: doc.role,
  committee: doc.committee,
  consent: doc.consent,
  updatedAt: doc.updatedAt
});

/* ---- POST /api/registrations -------------------------------- */
router.post("/", async (req, res, next) => {
  try {
    if (!featureOn("registrations")) return res.status(403).json({ ok: false, message: "Registrations are currently disabled." });

    /* Honeypot: bots that fill the hidden campmun_hp field get a fake success. */
    if (safeString(req.body.campmun_hp, 20)) return res.status(202).json({ ok: true });

    const values = registrationValues(req.body);
    if (!registrationValid(values) || !cleanString(req.body.name)) {
      return res.status(400).json({ ok: false, message: "Please complete all required fields." });
    }

    /* Enforce each account's seat allowance (if accounts are on).
       The school name and role come from the account, never the form. */
    const account = await currentUser(req);
    if (account) {
      values.school = account.doc.school || values.school;
      if (account.kind === "SchoolUser" && !/faculty/i.test(values.role)) values.role = "Delegate";
    }
    const userKind = account?.kind || "IndividualUser";
    const targetCollection = registrationCollectionName({ school: values.school, userKind });
    const Model = registrationModelFor(targetCollection);

    if (account && featureOn("auth")) {
      if (account.kind === "SchoolUser") {
        const delegateTotal = Math.max(1, Number(account.doc.numDelegates) || 1);
        const facultyTotal = Math.max(0, Number(account.doc.numFaculty) || 0);
        const total = await Model.countDocuments({ user: account.doc._id, userKind: account.kind });
        const facultyCount = await Model.countDocuments({ user: account.doc._id, userKind: account.kind, role: /faculty/i });
        const delegateCount = total - facultyCount;

        if (/faculty/i.test(values.role)) {
          if (facultyCount >= facultyTotal) {
            return res.status(409).json({
              ok: false,
              message: facultyTotal === 0
                ? "All faculty seats are already registered. Edit an existing registration instead."
                : `All ${facultyTotal} faculty seat${facultyTotal === 1 ? "" : "s"} are already registered. Edit an existing registration instead.`
            });
          }
        } else if (delegateCount >= delegateTotal) {
          return res.status(409).json({
            ok: false,
            message: `All ${delegateTotal} delegate${delegateTotal === 1 ? "" : "s"} are already registered. Edit an existing registration instead.`
          });
        }
      } else {
        const count = await Model.countDocuments({ user: account.doc._id, userKind: account.kind });
        if (count >= 1) return res.status(409).json({ ok: false, message: "You already submitted your application. Edit it instead." });
      }
    }

    const registration = { ...values, applicationId: createId(), user: account?.doc._id, userKind };
    const stored = { mongodb: false, sheets: false, email: false };

    if (await waitForMongo()) {
      const doc = await Model.create(registration);
      stored.mongodb = true;
      deliverInBackground(doc);
    } else {
      console.warn("MongoDB is not connected. Storing the application to Google Sheets only.");
      try { await sendToGoogleSheet(registration); stored.sheets = true; } catch (sheetError) { console.error("Application delivered nowhere: Google Sheet delivery failed:", sheetError.message); }
      try { await sendConfirmationEmail(registration); stored.email = true; } catch (mailError) { console.error("Application delivered nowhere: confirmation email failed:", mailError.message); }
    }

    if (!stored.mongodb && !stored.sheets) {
      return res.status(502).json({ ok: false, message: "Your application could not be saved right now. Please contact the Secretariat or try again shortly." });
    }

    res.status(201).json({ ok: true, applicationId: registration.applicationId, stored });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ ok: false, message: "That email already has a CampMUN application. Use a different email for each delegate, or edit the existing application." });
    }
    next(error);
  }
});

/* ---- GET /api/registrations/:id/verify -----------------------
   Read the Verified / Comment columns back from the Google Sheet
   for one of the signed-in user's applications. Only the programmer
   can mark rows verified — the Apps Script web app only ever reads
   those columns, never writes them. Returns a safe default when the
   spreadsheet is unreachable or the row has not been reviewed yet. */
router.get("/:id/verify", async (req, res, next) => {
  try {
    if (!featureOn("registrations")) return res.status(403).json({ ok: false, message: "Registrations are currently disabled." });

    const account = await currentUser(req);
    if (!account || !featureOn("auth")) return res.status(401).json({ ok: false, message: "Sign in to check verification status." });

    const doc = await registrationModelFor(collectionForAccount(account)).findOne({ applicationId: safeString(req.params.id, 60) }).exec();
    if (!doc || String(doc.user) !== String(account.doc._id)) {
      return res.status(404).json({ ok: false, message: "Application not found." });
    }

    if (!sheetsUrl) return res.json({ ok: true, verified: false, comment: "" });

    const response = await fetch(`${sheetsUrl}?applicationId=${encodeURIComponent(doc.applicationId)}`, {
      signal: AbortSignal.timeout(8000)
    });
    let verified = false;
    let comment = "";
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      verified = data.verified === true;
      comment = String(data.comment || "").slice(0, 500);
    }
    res.json({ ok: true, verified, comment });
  } catch (error) {
    if (error?.name === "TimeoutError") return res.json({ ok: true, verified: false, comment: "" });
    next(error);
  }
});

/* ---- GET /api/registrations/mine ----------------------------- */
router.get("/mine", async (req, res, next) => {
  try {
    if (!featureOn("registrations")) return res.status(403).json({ ok: false, message: "Registrations are currently disabled." });

    const account = await currentUser(req);
    if (!account) return res.status(401).json({ ok: false, message: "Not signed in." });

    const school = account.kind === "SchoolUser";
    const delegateTotal = school ? Math.max(1, Number(account.doc.numDelegates) || 1) : 1;
    const facultyTotal = school ? Math.max(0, Number(account.doc.numFaculty) || 0) : 0;

    const docs = await registrationModelFor(collectionForAccount(account)).find({ user: account.doc._id, userKind: account.kind }).sort({ createdAt: 1 }).exec();
    const facultyCount = docs.filter((doc) => /faculty/i.test(doc.role)).length;

    res.json({
      ok: true,
      accountType: school ? "school" : "individual",
      delegateTotal,
      facultyTotal,
      delegateCount: docs.length - facultyCount,
      facultyCount,
      registrations: docs.map(publicRegistration)
    });
  } catch (error) {
    next(error);
  }
});

/* ---- PUT /api/registrations/:id ------------------------------ */
router.put("/:id", async (req, res, next) => {
  try {
    if (!featureOn("registrations")) return res.status(403).json({ ok: false, message: "Registrations are currently disabled." });

    const account = await currentUser(req);
    if (!account || !featureOn("auth")) return res.status(401).json({ ok: false, message: "Sign in to edit an application." });

    const values = registrationValues(req.body);
    if (!registrationValid(values)) return res.status(400).json({ ok: false, message: "Please complete all required fields." });

    if (account) values.school = account.doc.school || values.school;

    const doc = await registrationModelFor(collectionForAccount(account)).findOne({ applicationId: safeString(req.params.id, 60) }).exec();
    if (!doc || String(doc.user) !== String(account.doc._id)) {
      return res.status(404).json({ ok: false, message: "Application not found." });
    }

    Object.assign(doc, values);
    await doc.save();
    deliverInBackground(doc);
    res.json({ ok: true, registration: publicRegistration(doc), updated: true });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ ok: false, message: "That email already has a CampMUN application. Use a different email for each delegate, or edit the existing application." });
    }
    next(error);
  }
});

export default router;