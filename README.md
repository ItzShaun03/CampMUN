# CampMUN portal

This is a secure Node.js CampMUN website. Registrations are stored in MongoDB, delivered to your Google Sheet, and can send a confirmation email.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`, then enter your own values (MongoDB URI, Google Sheets URL, SMTP and an `ADMIN_KEY` for the Manage/upload page).
3. For a visual local preview immediately, run `node local-server.js`. For the full registration portal, run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`.

Do not open `index.html` directly. `node local-server.js` serves the visual website. The production portal server adds registration, MongoDB and Google Sheets.

## Configure MongoDB Atlas

Create a free Atlas cluster and database user, allow the hosting server IP under Network Access, then paste the connection string into `MONGODB_URI` in `.env`. Collections are created automatically on first connection:

- `registrations` — submitted applications (unique email index)
- `school_users` — School login accounts
- `individual_users` — Individual login accounts
- `sessions` — active login tokens (30-day expiry)
- `logins` — master email → password-hash list for Secretariat lookups

School and Individual credentials are kept separately, so each account type is stored in its own collection.

### If `/api/health` reports `"mongo": false`

Run `npm run dev`, then open `http://localhost:3000/api/health` — the server now also lists which collections exist.

Was sign up or log in unavailable? The most common cause is Atlas blocking the connecting IP (the handshake fails with `tlsv1 alert internal error`). Fix: Atlas → Network Access → Add your server's public IP (or `0.0.0.0/0` while testing) → Save, then restart the server. You can read your current public IP from the console warning the server prints when MongoDB fails to connect.

## Configure your Google Sheet

Create a Google Sheet you own and follow [GOOGLE-SHEETS-SETUP.md](GOOGLE-SHEETS-SETUP.md) to deploy `google-apps-script.gs` from that Sheet. Paste its `/exec` URL into `GOOGLE_APPS_SCRIPT_URL` in `.env`.

The server stores the application in MongoDB first, then sends the same entry to your Sheet. A temporary Sheet failure cannot discard a record already stored in MongoDB.

## Confirmation emails

Fill the SMTP values in `.env`. For Gmail, use an App Password, never your normal password. Change the candidate message in `data/confirmation-email.txt`.

## Edit content and visual files

- Event details, committees, resources and contacts: `site-config.js`
- Features on/off (accounts, forms, 3D, gallery, resources, uploads): `features.js`
- Email message: `data/confirmation-email.txt`
- Pages: `index.html`, `about.html`, `conference.html`, `resources.html`, `register.html`, `contact.html`
- Backend: `server.js` wires everything; each concern lives in its own small module under `src/`
  (`src/config.js`, `src/models.js`, `src/database.js`, `src/content.js`, `src/delivery.js`,
  `src/auth-helpers.js`, `src/routes/*.js`)
- Shared page interactions: `app.js`
- Public photographs, logos and PDFs on pages: `assets/`
- Public photos shown in the gallery and documents on the Resources page: `content/`

## Security included

Credentials are kept in `.env`, never browser code. Accounts are split by type into `school_users` and `individual_users` collections, use bcrypt-hashed passwords and rotating random session tokens (30-day expiry). Users sign up as a School or Individual once and then log in to apply. The backend uses security headers, rate limits, server-side validation, a bot honeypot, unique email prevention, and does not expose candidate records publicly. Use HTTPS when deployed.

### Deploy the pages on GitHub Pages

The seven pages are static, so they can be hosted free on GitHub Pages
while the Node server runs elsewhere (your computer, or a host like
Render, Railway or Fly.io).

1. Push the repo to GitHub and enable Pages (Settings → Pages → deploy
   from the `main` branch root).
2. Set `apiBase` in `site-config.js` to the URL of the running Node
   server, e.g. `"https://campmun-api.example.com"` (or
   `"http://localhost:3000"` while testing locally).
3. Add the Pages origin to `CORS_ORIGIN` in the server's `.env`, e.g.
   `CORS_ORIGIN=https://yourname.github.io`. Restart the server.
4. Keep the Node server running — MongoDB, accounts, registrations,
   uploads and exports all come from it. If it is down, the site shows
   the "Account service is offline" message.
