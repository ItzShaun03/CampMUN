/* ============================================================
   CAMP MUN — ACCOUNT ROUTES  (/api/auth/)
   signup   POST   create a School or Individual account
   login    POST   issue a session token
   logout   POST   invalidate the current token
   me       GET    who is signed in right now
   account  PUT    update own details / password
   ============================================================ */

import express from "express";
import bcrypt from "bcryptjs";
import nodeCrypto from "node:crypto";
import { featureOn } from "../config.js";
import { waitForMongo } from "../database.js";
import { safeString } from "../utils.js";
import { SchoolUser, IndividualUser, Session, USER_MODELS, userKindOf, syncLogin } from "../models.js";
import { bearerToken, publicUser, currentUser, hashToken } from "../auth-helpers.js";

const router = express.Router();

/* ---- POST /api/auth/signup ---------------------------------- */
router.post("/signup", async (req, res, next) => {
  try {
    if (!featureOn("auth")) return res.status(403).json({ ok: false, message: "Accounts are currently disabled. Please contact the Secretariat." });
    if (!(await waitForMongo())) return res.status(503).json({ ok: false, message: "Account creation is temporarily unavailable — the registration database is not connected. Please try again shortly or contact the Secretariat." });

    const accountType = req.body.accountType === "school" ? "school" : req.body.accountType === "individual" ? "individual" : "";
    const email = safeString(req.body.email, 180).toLowerCase();
    const password = String(req.body.password || "");
    const consent = req.body.consent === true || req.body.consent === "on" || req.body.consent === "true";
    const firstName = safeString(req.body.firstName, 60);
    const lastName = safeString(req.body.lastName, 60);

    if (!accountType || !firstName || !lastName || !consent || password.length < 8 || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ ok: false, message: "Please complete every field, accept the privacy consent and use a password of at least 8 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const common = { firstName, lastName, email, passwordHash };
    const values = accountType === "school"
      ? {
          ...common,
          school: safeString(req.body.school, 180),
          city: safeString(req.body.city, 100),
          country: safeString(req.body.country, 100),
          phone: safeString(req.body.phone, 30),
          numDelegates: safeString(req.body.delegates, 10),
          numFaculty: safeString(req.body.faculty, 10),
          teacherName: safeString(req.body.teacherName, 120),
          teacherMobile: safeString(req.body.teacherMobile, 30),
          teacherEmail: safeString(req.body.teacherEmail, 180).toLowerCase()
        }
      : {
          ...common,
          phone: safeString(req.body.phone, 30),
          grade: safeString(req.body.grade, 40),
          school: safeString(req.body.school, 180),
          city: safeString(req.body.city, 100),
          country: safeString(req.body.country, 100),
          committeePreferences: safeString(req.body.committeePreferences, 3000),
          whyIndividual: safeString(req.body.whyIndividual, 3000),
          whyAccepted: safeString(req.body.whyAccepted, 3000),
          experience: safeString(req.body.experience, 3000)
        };

    const required = accountType === "school"
      ? [
          ["school", "Name of your school"], ["city", "City"], ["country", "Country"], ["phone", "Phone number"],
          ["numDelegates", "Number of delegates"], ["numFaculty", "Number of faculty"],
          ["teacherName", "Teacher or faculty name"], ["teacherMobile", "Teacher mobile"], ["teacherEmail", "Teacher email"]
        ]
      : [
          ["phone", "Phone number"], ["grade", "Grade or class"], ["school", "School name"], ["city", "City"], ["country", "Country"],
          ["committeePreferences", "Committee preferences"], ["whyIndividual", "Why you are registering individually"],
          ["whyAccepted", "Why you should be accepted"], ["experience", "Your past MUN experience"]
        ];
    const missing = required.filter(([key]) => !safeString(values[key], 3000));
    if (missing.length) return res.status(400).json({ ok: false, message: `Please complete: ${missing.map(([, label]) => label).join(", ")}.` });

    const Model = accountType === "school" ? SchoolUser : IndividualUser;
    if (await Model.findOne({ email })) return res.status(409).json({ ok: false, message: "An account already exists for that email. Log in instead." });

    const doc = await Model.create(values);
    const kind = userKindOf(accountType);
    await syncLogin(doc.email, doc.passwordHash, kind);

    const token = nodeCrypto.randomBytes(32).toString("hex");
    await Session.create({ tokenHash: hashToken(token), kind, user: doc._id });
    res.status(201).json({ ok: true, token, user: publicUser(doc, kind) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ ok: false, message: "An account already exists for that email. Log in instead." });
    next(error);
  }
});

/* ---- POST /api/auth/login ----------------------------------- */
router.post("/login", async (req, res, next) => {
  try {
    if (!featureOn("auth")) return res.status(403).json({ ok: false, message: "Accounts are currently disabled." });
    if (!(await waitForMongo())) return res.status(503).json({ ok: false, message: "Log in is temporarily unavailable — the registration database is not connected. Please try again shortly or contact the Secretariat." });

    const email = safeString(req.body.email, 180).toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ ok: false, message: "Enter your email and password to log in." });

    const [school, individual] = await Promise.all([SchoolUser.findOne({ email }), IndividualUser.findOne({ email })]);
    const kind = school ? "SchoolUser" : individual ? "IndividualUser" : "";
    const found = school || individual;
    if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
      return res.status(401).json({ ok: false, message: "Incorrect email or password." });
    }

    const token = nodeCrypto.randomBytes(32).toString("hex");
    await Session.create({ tokenHash: hashToken(token), kind, user: found._id });
    res.json({ ok: true, token, user: publicUser(found, kind) });
  } catch (error) {
    next(error);
  }
});

/* ---- POST /api/auth/logout ---------------------------------- */
router.post("/logout", async (req, res, next) => {
  try {
    const token = bearerToken(req);
    if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ---- GET /api/auth/me --------------------------------------- */
router.get("/me", async (req, res, next) => {
  try {
    const account = await currentUser(req);
    if (!account) return res.status(401).json({ ok: false, message: "Not signed in." });
    res.json({ ok: true, user: publicUser(account.doc, account.kind) });
  } catch (error) {
    next(error);
  }
});

/* ---- PUT /api/auth/account ---------------------------------- */
router.put("/account", async (req, res, next) => {
  try {
    if (!featureOn("auth")) return res.status(403).json({ ok: false, message: "Accounts are currently disabled." });
    if (!(await waitForMongo())) return res.status(503).json({ ok: false, message: "Account changes are temporarily unavailable. Please try again shortly." });

    const account = await currentUser(req);
    if (!account) return res.status(401).json({ ok: false, message: "Not signed in." });

    const currentPassword = String(req.body.currentPassword || "");
    if (!currentPassword || !(await bcrypt.compare(currentPassword, account.doc.passwordHash))) {
      return res.status(401).json({ ok: false, message: "Incorrect password. Enter your current password to save changes." });
    }

    const firstName = safeString(req.body.firstName, 60);
    const lastName = safeString(req.body.lastName, 60);
    const email = safeString(req.body.email, 180).toLowerCase();
    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ ok: false, message: "Please complete your name and a valid email address." });
    }

    if (email !== account.doc.email) {
      const Model = USER_MODELS[account.kind];
      if (await Model.findOne({ email })) return res.status(409).json({ ok: false, message: "An account already exists for that email." });
      account.doc.email = email;
    }

    account.doc.firstName = firstName;
    account.doc.lastName = lastName;

    if (account.kind === "SchoolUser") {
      const numDelegates = Number(safeString(req.body.numDelegates, 10));
      const numFaculty = Number(safeString(req.body.numFaculty, 10));
      if (Number.isInteger(numDelegates) && numDelegates >= 1) account.doc.numDelegates = String(numDelegates);
      if (Number.isInteger(numFaculty) && numFaculty >= 0) account.doc.numFaculty = String(numFaculty);
    }

    const newPassword = String(req.body.newPassword || "");
    if (newPassword) {
      if (newPassword.length < 8) return res.status(400).json({ ok: false, message: "New password must be at least 8 characters." });
      account.doc.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await account.doc.save();
    await syncLogin(account.doc.email, account.doc.passwordHash, account.kind);
    res.json({ ok: true, user: publicUser(account.doc, account.kind) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ ok: false, message: "An account already exists for that email." });
    next(error);
  }
});

export default router;