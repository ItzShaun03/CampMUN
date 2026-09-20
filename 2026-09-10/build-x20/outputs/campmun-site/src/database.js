/* ============================================================
   CAMP MUN — DATABASE CONNECTION
   Owns the MongoDB connection lifecycle: the initial attempt,
   a degraded-mode check used by the API routes, and a helpful
   message when Atlas blocks the public IP.
   ============================================================ */

import mongoose from "mongoose";
import { mongoUri } from "./config.js";
import { ensureCollections } from "./models.js";

const CONNECT_OPTIONS = { serverSelectionTimeoutMS: 8000 };

/* Start connecting as soon as the module is imported. */
export const connectionAttempt = mongoUri
  ? mongoose.connect(mongoUri, CONNECT_OPTIONS)
      .then(async () => { await ensureCollections(); return true; })
      .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        fetch("https://api.ipify.org")
          .then((r) => r.text())
          .then((ip) => console.error(`Your public IP is ${ip} — allow it in Atlas > Network Access > IP Access List, then restart.`))
          .catch(() => {});
        return false;
      })
  : Promise.resolve(false);

mongoose.connection?.on?.("disconnected", () =>
  console.warn("MongoDB disconnected — will attempt reconnect on next request")
);

/* Returns true when Mongo is reachable, so routes can degrade
   gracefully (store to Google Sheets + email only) when it is not.
   Re-attempts a fresh connection on demand, bounded by an 8s timeout,
   so a restart or a network change is picked up without ever hanging. */
export const waitForMongo = async () => {
  if (mongoose.connection.readyState === 1) return true;
  if (!mongoUri) return false;

  const attempt = mongoose.connect(mongoUri, CONNECT_OPTIONS)
    .then(async () => { await ensureCollections(); return true; })
    .catch(() => false);
  const ok = await Promise.race([
    attempt,
    new Promise((resolve) => setTimeout(() => resolve(false), 8000)),
  ]);
  if (ok === true || mongoose.connection.readyState === 1) return true;

  return false;
};