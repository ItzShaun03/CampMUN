/* ============================================================
   CAMP MUN — SERVER ENTRY POINT
   This file only wires the pieces together. Every concern lives
   in a small module under src/ so it is easy to find:

     src/config.js        env settings + feature flags
     src/models.js        the 5 Mongo collections
     src/database.js      connecting to MongoDB (+ health checks)
     src/content.js       images/documents folders + uploads
     src/delivery.js      Google Sheets + confirmation email
     src/auth-helpers.js  token helpers shared by routes
     src/routes/auth.js         accounts & sessions
     src/routes/registrations.js  applications & seat limits
     src/routes/admin.js        uploads & Excel export
     src/routes/info.js         /api/health & /api/content
   ============================================================ */

import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";

import { root, port, mongoUri } from "./src/config.js";
import { contentRoot } from "./src/content.js";
import { connectionAttempt } from "./src/database.js";
import infoRoutes from "./src/routes/info.js";
import authRoutes from "./src/routes/auth.js";
import registrationRoutes from "./src/routes/registrations.js";
import adminRoutes from "./src/routes/admin.js";

const app = express();

/* ---- Security headers + body parsing ------------------------- */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  originAgentCluster: true,
  referrerPolicy: { policy: "no-referrer" }
}));
/* Locks down browser features the site never uses (helmet 8 dropped
   the permissionsPolicy option, so the header is set directly). */
app.use((_, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  next();
});
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

/* ---- Rate limiting --------------------------------------------
   The general /api limiter covers every route. Auth gets a far
   tighter limit (brute-force protection) and the admin area, which
   is key-gated, still gets a flood guard. */
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 90, standardHeaders: "draft-8", legacyHeaders: false });
app.use("/api", (req, res, next) => (req.path.startsWith("/admin") ? next() : apiLimiter(req, res, next)));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { ok: false, message: "Too many attempts. Please wait a few minutes and try again." }
});
app.use("/api/auth", authLimiter);

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false });
app.use("/api/admin", adminLimiter);

/* ---- Static files: ONLY the public site, never source code ----
   The server root holds server.js, src/, package.json, .env etc.
   Serving it wholesale would hand out the entire codebase, so the
   only paths reachable are the shipped pages, scripts, styles, the
   assets/ folder and uploaded content/ files. Everything else 404s. */
const PUBLIC_FILES = new Set([
  "/styles.css",
  "/app.js",
  "/features.js",
  "/site-config.js",
  "/three-ambient.js",
  "/index.html",
  "/about.html",
  "/conference.html",
  "/resources.html",
  "/register.html",
  "/contact.html"
]);

app.use((req, res, next) => {
  let pathname;
  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    return res.status(400).type("text").send("Bad request.");
  }
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_FILES.has(pathname + ".html") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/content/");
  if (!isPublic || pathname.includes("..") || pathname.includes("//") || pathname.includes("\\")) {
    return res.status(404).type("text").send("Not found.");
  }
  next();
});

app.use(express.static(root, { extensions: ["html"] }));
app.use("/content", express.static(contentRoot, { index: false }));

/* ---- API routes --------------------------------------------- */
app.use("/api", infoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/admin", adminRoutes);

/* ---- Final error handler ------------------------------------ */
app.use((error, _, res, __) => {
  if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
    return res.status(400).json({ ok: false, message: "Invalid request body." });
  }
  console.error(error);
  res.status(500).json({ ok: false, message: "Something went wrong. Please try again shortly." });
});

/* ---- Start ---------------------------------------------------
   Mongo connection fires as soon as database.js is imported.
   Without MONGODB_URI the portal still serves pages; registrations
   only reach Google Sheets and email.
   ------------------------------------------------------------ */
if (!mongoUri) {
  console.warn("MONGODB_URI is missing. Registrations will only reach Google Sheets and email.");
} else {
  connectionAttempt;
}

app.listen(port, () => console.log(`CampMUN portal running at http://localhost:${port}`));
