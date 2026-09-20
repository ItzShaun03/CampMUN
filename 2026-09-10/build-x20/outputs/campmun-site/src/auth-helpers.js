/* ============================================================
   CAMP MUN — AUTH HELPERS
   Shared pieces for routes that need to know who is signed in:
   reading the bearer token, turning a stored user into a safe
   public object, and resolving the token to its account.
   ============================================================ */

import mongoose from "mongoose";
import nodeCrypto from "node:crypto";
import { featureOn } from "./config.js";
import { Session, USER_MODELS } from "./models.js";

/* Pull the raw bearer token out of the Authorization header. */
export const bearerToken = (req) => {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

/* One-way hash applied to every token before it is stored. */
export const hashToken = (raw) => nodeCrypto.createHash("sha256").update(String(raw || "")).digest("hex");

/* Only fields we are happy to send to the browser. */
export const publicUser = (doc, kind) => ({
  id: doc._id,
  accountType: kind === "SchoolUser" ? "school" : "individual",
  name: `${doc.firstName} ${doc.lastName}`.trim(),
  school: doc.school || "",
  email: doc.email,
  firstName: doc.firstName,
  lastName: doc.lastName,
  ...(kind === "SchoolUser" ? { numDelegates: doc.numDelegates, numFaculty: doc.numFaculty } : {})
});

/* Resolve the request's token to its user + account kind, or null. */
export const currentUser = async (req) => {
  const token = bearerToken(req);
  if (!token || !featureOn("auth") || mongoose.connection.readyState !== 1) return null;

  const session = await Session.findOne({ tokenHash: hashToken(token) }).exec();
  if (!session) return null;

  const Model = USER_MODELS[session.kind];
  const doc = Model ? await Model.findById(session.user).exec() : null;
  return doc ? { doc, kind: session.kind } : null;
};