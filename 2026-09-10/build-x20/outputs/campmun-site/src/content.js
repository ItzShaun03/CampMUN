/* ============================================================
   CAMP MUN — CONTENT FILES
   Manages the public images/ and documents/ folders:
   - creates the folders on boot,
   - lists what is inside them for /api/content and the admin page,
   - validates and stores admin uploads (multer).
   ============================================================ */

import path from "node:path";
import fs from "node:fs/promises";
import multer from "multer";
import { root } from "./config.js";

export const contentRoot = path.join(root, "content");

export const contentTypes = {
  images: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"],
  documents: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".ppt", ".pptx", ".xls", ".xlsx", ".csv", ".odt", ".md"]
};

await fs.mkdir(path.join(contentRoot, "images"), { recursive: true });
await fs.mkdir(path.join(contentRoot, "documents"), { recursive: true });

/* Public URLs of every presentable image and document. */
export const listContent = async () => {
  const result = { images: [], documents: [] };
  for (const [category, extensions] of Object.entries(contentTypes)) {
    try {
      const names = await fs.readdir(path.join(contentRoot, category));
      names
        .filter((name) => extensions.includes(path.extname(name).toLowerCase()))
        .sort()
        .forEach((name) => result[category].push(`content/${category}/${name}`));
    } catch {
      /* category folder does not exist yet */
    }
  }
  return result;
};

/* ---- Admin uploads ------------------------------------------- */
const sanitizeName = (original) => {
  const base = path.basename(String(original || "").replace(/[^A-Za-z0-9._-]+/g, "-").toLowerCase());
  return base || `file-${Date.now()}`;
};

const allowedUpload = (fieldname, original) => {
  const category = fieldname === "document" ? "documents" : "images";
  return contentTypes[category].includes(path.extname(original).toLowerCase());
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const dir = path.join(contentRoot, file.fieldname === "document" ? "documents" : "images");
        await fs.mkdir(dir, { recursive: true });
        cb(null, dir);
      } catch (error) {
        cb(error);
      }
    },
    /* Never overwrite an existing file: append -2, -3, ... instead. */
    filename: async (req, file, cb) => {
      try {
        const dir = path.join(contentRoot, file.fieldname === "document" ? "documents" : "images");
        const name = sanitizeName(file.originalname);
        const ext = path.extname(name);
        const stem = name.slice(0, name.length - ext.length);
        let candidate = name;
        for (let n = 1; n <= 999; n += 1) {
          try {
            await fs.access(path.join(dir, candidate));
          } catch {
            break;
          }
          candidate = `${stem}-${n}${ext}`;
        }
        cb(null, candidate);
      } catch (error) {
        cb(error);
      }
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, allowedUpload(file.fieldname, file.originalname))
});