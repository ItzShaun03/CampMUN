/* Dependency-free local preview server. Use server.js in production for MongoDB, Sheets and email. */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/api/content") {
    const contentTypes = { images: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"], documents: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".ppt", ".pptx", ".xls", ".xlsx", ".csv", ".odt", ".md"] };
    const result = { images: [], documents: [] };
    for (const [category, extensions] of Object.entries(contentTypes)) {
      try {
        for (const name of await fs.readdir(path.join(root, "content", category))) {
          if (extensions.includes(path.extname(name).toLowerCase())) result[category].push(`content/${category}/${name}`);
        }
      } catch { /* category folder does not exist yet */ }
    }
    result.images.sort(); result.documents.sort();
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ ok: true, ...result }));
  }
  if (url.pathname.startsWith("/api/")) { response.writeHead(503, { "Content-Type": "application/json" }); return response.end(JSON.stringify({ ok: false, message: "Local preview mode is active. Start the production server after MongoDB configuration to accept registrations." })); }
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root)) { response.writeHead(403); return response.end("Forbidden"); }
  try { const body = await fs.readFile(file); response.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(body); }
  catch { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Not found"); }
});
server.listen(3000, "127.0.0.1", () => console.log("CampMUN preview running at http://localhost:3000"));
