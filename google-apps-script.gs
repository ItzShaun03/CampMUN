/**
 * CampMUN registration receiver for Google Sheets.
 *
 * All applications land in ONE spreadsheet file ("CampMUN — Registrations").
 * Inside it, every school gets its OWN sheet (tab) named after the school —
 * each delegate/faculty member from that school is one row in that tab. All
 * Individual applicants share a single "Individuals" tab, one row per person.
 *
 * This mirrors the structure used for the downloadable Excel report: one
 * worksheet per school, plus one "Individuals" worksheet.
 *
 * Setup instructions are in GOOGLE-SHEETS-SETUP.md. Deploy this project as a
 * Web App (Execute as: Me, Who has access: Anyone). No site key or Google
 * account credential belongs on the website.
 */
const SPREADSHEET_NAME = 'CampMUN — Registrations';
const INDIVIDUALS_TAB = 'Individuals';
const HEADERS = ['Received at', 'Application ID', 'Name', 'Email', 'School', 'Registration type', 'Committee preference', 'Consent', 'Verified', 'Comment'];

/*
 * VERIFICATION (programmer-only, by convention of this spreadsheet):
 *   - Columns I (Verified) and J (Comment) belong to the programmer.
 *   - To approve a delegate, type TRUE in the Verified column for that row.
 *   - Optionally add a note in the Comment column — it is shown to the
 *     delegate next to their verification status on the register page.
 *   - doGet only READS these columns. Visitors can never write to them:
 *     doPost never touches columns beyond the 8 registration columns, and
 *     the web app has no route that can change Verified or Comment.
 * Accepted "verified" markers: TRUE, YES, 1 (case-insensitive).
 */
const VERIFIED_MARKERS = ['TRUE', 'YES', '1'];

/**
 * Tab names must be valid in Google Sheets (no [ ] : * ? / \ , unique, and
 * cap on length). "Individuals" is reserved for individual applicants.
 */
function tabNameFor(kind, school) {
  if (kind !== 'school') return INDIVIDUALS_TAB;
  const base = String(school || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 90);
  const candidate = base || 'School';
  return candidate === INDIVIDUALS_TAB ? candidate + ' — School' : candidate;
}

/**
 * File and tab lookups are cached in script properties so later posts are
 * fast, with a Drive/name fallback if the cache is stale.
 */
function openOrCreateSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const cachedId = props.getProperty('spreadsheet:' + SPREADSHEET_NAME);
  if (cachedId) {
    try { return SpreadsheetApp.openById(cachedId); } catch (error) {}
  }
  const existing = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (existing.hasNext()) {
    const file = existing.next();
    props.setProperty('spreadsheet:' + SPREADSHEET_NAME, file.getId());
    return SpreadsheetApp.openById(file.getId());
  }
  const created = SpreadsheetApp.create(SPREADSHEET_NAME);
  props.setProperty('spreadsheet:' + SPREADSHEET_NAME, created.getId());
  seedTab(created.insertSheet(INDIVIDUALS_TAB));
  const defaultSheet = created.getSheetByName('Sheet1');
  if (defaultSheet) created.deleteSheet(defaultSheet);
  return created;
}

function seedTab(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#10140f').setFontColor('#f8f5ee');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

function getOrCreateTab(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(name);
  }
  return seedTab(sheet);
}

/**
 * Find a row by Application ID (column 2) and update it in place so edits
 * never create duplicates; otherwise append a new row.
 */
function upsertRow(sheet, id, row) {
  const last = sheet.getLastRow();
  if (last >= 2) {
    const ids = sheet.getRange(2, 2, last - 1, 1).getValues().flat().map(String);
    const at = ids.indexOf(String(id).trim());
    if (at !== -1) {
      sheet.getRange(at + 2, 1, 1, row.length).setValues([row]);
      return 'updated';
    }
  }
  sheet.appendRow(row);
  return 'created';
}

function setup() {
  const spreadsheet = openOrCreateSpreadsheet();
  getOrCreateTab(spreadsheet, INDIVIDUALS_TAB);
  return spreadsheet.getUrl();
}

function doPost(e) {
  const data = e && e.parameter ? e.parameter : {};
  if (data.campmun_hp) return output({ ok: true }); // Honeypot: silently ignore bots.
  const required = ['name', 'email', 'school', 'role', 'committee'];
  if (required.some(key => !String(data[key] || '').trim())) return output({ ok: false, error: 'Missing required fields' });
  const spreadsheet = openOrCreateSpreadsheet();
  const tab = getOrCreateTab(spreadsheet, tabNameFor(data.kind, data.school));
  const id = String(data.applicationId || ('CM-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(100 + Math.random() * 900)));
  const row = [new Date(), id, data.name, data.email, data.school, data.role, data.committee, data.consent === 'true' ? 'Yes' : 'No'];
  const action = upsertRow(tab, id, row);
  return output({ ok: true, applicationId: id, action });
}

/**
 * Read a registration's verification status back for the website.
 * Called as GET /exec?applicationId=CM-……
 * Searches every tab for the row, then returns what the programmer typed
 * in the Verified and Comment columns. Never modifies the sheet.
 */
function doGet(e) {
  const data = e && e.parameter ? e.parameter : {};
  const id = String(data.applicationId || '').trim();
  if (!id) return output({ ok: false, error: 'Application ID required' });

  try {
    const spreadsheet = openOrCreateSpreadsheet();
    for (const sheet of spreadsheet.getSheets()) {
      const last = sheet.getLastRow();
      if (last < 2) continue;
      const ids = sheet.getRange(2, 2, last - 1, 1).getValues().flat().map(String);
      const at = ids.indexOf(id);
      if (at === -1) continue;
      // Columns 9 and 10 are Verified and Comment.
      const row = sheet.getRange(at + 2, 9, 1, 2).getValues()[0];
      const raw = String(row[0] || '').trim().toUpperCase();
      return output({
        ok: true,
        applicationId: id,
        verified: VERIFIED_MARKERS.indexOf(raw) !== -1,
        comment: String(row[1] || '').trim()
      });
    }
  } catch (error) {
    return output({ ok: false, error: 'Lookup failed' });
  }
  return output({ ok: true, applicationId: id, verified: false, comment: '' });
}

/**
 * Save an Excel (.xlsx) copy beside the spreadsheet — one worksheet per
 * school plus the Individuals worksheet. Run from the Apps Script editor or
 * via a custom menu (see onOpen).
 */
function createExcelExport() {
  const spreadsheet = openOrCreateSpreadsheet();
  const file = DriveApp.getFileById(spreadsheet.getId());
  const xlsx = file.getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const out = DriveApp.createFile(xlsx.setName(SPREADSHEET_NAME + '.xlsx'));
  return 'Excel file created: ' + out.getUrl();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CampMUN')
    .addItem('Download Excel export', 'createExcelExport')
    .addToUi();
}

function output(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
