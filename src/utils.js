/* ============================================================
   CAMP MUN — SMALL SHARED HELPERS
   Trivial formatters used across the API routes.
   ============================================================ */

import nodeCrypto from "node:crypto";

/* Trim a value and cap its length before it reaches a schema. */
export const safeString = (value, max) => String(value || "").trim().slice(0, max);

/* Human-friendly unique application reference, e.g. CM-20270916-3E80F1. */
export const createId = () =>
  `CM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nodeCrypto.randomUUID().slice(0, 6).toUpperCase()}`;