# Receive registrations in your Google Sheet

This site pipes every completed application into a **single Google spreadsheet** in **your Google account**. It uses `google-apps-script.gs`, which runs inside your Google account. Your one spreadsheet file is named **`CampMUN — Registrations`**.

## How rows are organised

- **Every school gets its own sheet (tab)** inside the one `CampMUN — Registrations` spreadsheet. The first delegate submitted by a school automatically creates a tab named after that school. Every further delegate or faculty member from that same school goes into that same tab, one full row per person.
- **All Individual applicants share one tab** named `Individuals`, one row per applicant.
- Every tab has the header `Received at`, `Application ID`, `Name`, `Email`, `School`, `Registration type`, `Committee preference`, `Consent`, `Verified`, `Comment`.
- This is the same layout as the downloadable Excel report: one worksheet per school, plus the `Individuals` worksheet (see the Excel section below).

## Approving / verifying a delegate (programmer-only)

The last two columns are for your (the programmer's) manual review:

- **`Verified`** — type `TRUE` (or `YES` / `1`) in this column for a row to **approve** that delegate.
- **`Comment`** — optional. Anything you type here is shown to the delegate next to their verification status on the register page.

The delegate sees a green **"Verified ✓"** badge plus your comment on their applications in the **Account** area of the register page; un-reviewed rows show an amber **"Awaiting review"** badge. Only you can ever change these two columns:

- The **web app only reads** the `Verified` / `Comment` columns (it has no write path to them), and
- delegates can never edit the spreadsheet — they only receive their status back through the site.

If your spreadsheet was created before these two columns existed, add them once to every tab: put `Verified` in column I and `Comment` in column J of the header row (they stay empty until you review a row). New tabs from this script version include them automatically.

## Setup

1. Create a new Google Sheet named **CampMUN Management** (this is only the host for the script; the real data spreadsheet is created automatically).
2. Choose **Extensions → Apps Script**.
3. Replace the starter code with the complete contents of `google-apps-script.gs`, then save.
4. Choose **Deploy → New deployment → Web app**.
5. Set **Execute as** to **Me**, and set **Who has access** to **Anyone**. Deploy, authorise, and copy the `/exec` Web App URL.
6. Set the **`GOOGLE_APPS_SCRIPT_URL`** value in your server's `.env` file to that `/exec` URL.
7. (Optional) Run `setup` once to create and format the `CampMUN — Registrations` spreadsheet with the `Individuals` tab.
8. Submit one test registration per account type and confirm:
   - a school application creates (or reuses) a tab named after the school with the row, and
   - an individual application adds a row to the `Individuals` tab.

The spreadsheet is created in the root of your Google Drive. To keep it organised, you can move it into a "CampMUN" folder anytime — it keeps working because it is found by name.

Only the deployment URL is placed on the website. It does not reveal your Google login or permit visitors to open the file. You own every spreadsheet and receive every website application there.

## Download the Excel export

Two ways to get the same data as Excel (`.xlsx`, one worksheet per school plus `Individuals`):

- **From the Apps Script editor / spreadsheet:** open the `CampMUN — Registrations` spreadsheet → the **CampMUN** menu → **Download Excel export**, or run `createExcelExport()` in the Apps Script editor. The `.xlsx` file is saved to your Google Drive.
- **From the server:** `GET /api/admin/export` with the **`x-admin-key`** header set to your `ADMIN_KEY` from `.env`. It returns `campmun-registrations.xlsx` with the same per-school worksheet layout.

For email alerts: in a spreadsheet choose **Tools → Notification settings** and enable email notifications for new form changes. You can also add Google Form or third-party workflows later if required.