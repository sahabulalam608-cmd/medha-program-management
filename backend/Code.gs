/**
 * Medha Program Management — Apps Script backend (Code.gs)
 * Standalone Web App for MPM.
 *
 * SETUP
 * 1. Create a new Apps Script project: script.google.com → New project
 * 2. Replace Code.gs with this file
 * 3. Project Settings → Script Properties → Add:
 *      SHEET_ID = 1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII
 * 4. Project Settings → Time zone = Asia/Dhaka
 * 5. Run setupProgramSheets() once to create tabs + Status dropdown
 * 6. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone (or specific people if you want auth)
 * 7. Copy the Web App URL → paste into MPM site "Connect backend" modal
 */

const SHEET_ID = PropertiesService.getScriptProperties().getProperty("SHEET_ID")
  || "1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII";

/* Third spreadsheet — Medha Batch-01 Master (the NCM PART-2 member list) */
const BATCH01_SHEET_ID = PropertiesService.getScriptProperties().getProperty("BATCH01_SHEET_ID")
  || "1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw";

/* Second spreadsheet — NCM Part 1 (master file + monthly trackers) */
const NCM_SHEET_ID = PropertiesService.getScriptProperties().getProperty("NCM_SHEET_ID")
  || "1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE";

/**
 * NCM tracker sheet layout (columns A..Y, headers on row 3, data from row 4).
 * type: ro = read-only | att = Punctual/Late/Absent dropdown | num = manual number
 *       auto = sheet formula (never write these)
 */
var NCM_TRACKER_COLS = [
  { key: "sl",              label: "SL",                      type: "ro",   col: 1 },
  { key: "memberId",        label: "Member ID",               type: "ro",   col: 2 },
  { key: "name",            label: "Name",                    type: "ro",   col: 3 },
  { key: "class1",          label: "Class 1",                 type: "att",  col: 4 },
  { key: "class2",          label: "Class 2",                 type: "att",  col: 5 },
  { key: "feedback1",       label: "Feedback 1",              type: "att",  col: 6 },
  { key: "feedback2",       label: "Feedback 2",              type: "att",  col: 7 },
  { key: "workshopAttendance", label: "Workshop Attendance",  type: "att",  col: 8 },
  { key: "workshopClass1",  label: "Workshop Class 1",        type: "att",  col: 9 },
  { key: "examReview1",     label: "Exam & Review Class 1",   type: "att",  col: 10 },
  { key: "punctualCount",   label: "Punctual Count",          type: "auto", col: 11 },
  { key: "lateCount",       label: "Late Count",              type: "auto", col: 12 },
  { key: "absentCount",     label: "Absent Count",            type: "auto", col: 13 },
  { key: "attendancePct",   label: "Attendance Score (%)",    type: "auto", col: 14 },
  { key: "remarks",         label: "Remarks",                 type: "auto", col: 15 },
  { key: "attendance10",    label: "Attendance",              type: "auto", col: 16 },
  { key: "assignment20",    label: "Assignment",              type: "num",  col: 17 },
  { key: "workshop20",      label: "Workshop",                type: "num",  col: 18 },
  { key: "emailFeedback5",  label: "Email & Feedback",        type: "num",  col: 19 },
  { key: "monthlyExam30",   label: "Monthly Exam",            type: "num",  col: 20 },
  { key: "professional10",  label: "Professional",            type: "num",  col: 21 },
  { key: "paymentCompliance5", label: "Payment Compliance",   type: "num",  col: 22 },
  { key: "total100",        label: "Total",                   type: "auto", col: 23 },
  { key: "grade",           label: "Grade",                   type: "auto", col: 24 },
  { key: "resultCard",      label: "Result Card",             type: "auto", col: 25 }
];

var NCM_TRACKER_TABS = ["October Tracker", "September Tracker", "August Tracker", "July Tracker"];
var NCM_HEADER_ROW = 3;   // row holding the real column names
var NCM_FIRST_DATA_ROW = 4;

const CONFIG = {
  SPREADSHEET_ID: SHEET_ID,
  PROGRAM_SPREADSHEET_ID: SHEET_ID,
  LOG_SHEET: "EmailLog",
  SETTINGS_SHEET: "Settings",
  PROGRAMS: {
    "NCM PART-1": { sheetName: "Members NCM-P1" },
    "NCM PART-2": { sheetName: "Members NCM-P2" }
  },
  FROM_NAME: "Medha Operations Team",
  VERSION: "mpm-1.0"
};

/* ========== HTTP entry point ========== */

function doGet(e) {
  return jsonResponse_({ success: true, name: "Medha Program Management API", version: CONFIG.VERSION });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = body.action || "";
    var data = body;
    var result = handleApi_(action, data);
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ success: false, message: String(err.message || err) });
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========== API router ========== */

function handleApi_(action, data) {
  switch (action) {
    case "getAllMembers": return getAllMembers_();
    case "getProgramMembers": return getProgramMembers(data.program || "", data.force === true);
    case "sendProgramMails": return sendProgramMails(data.payload || data);
    case "getEmailLogs": return getEmailLogs(data.limit || 40);
    case "getEmailQuota": return getEmailQuota();
    case "getMailBadge": return getMailBadge(data.withList === true);
    case "ping": return {
      success: true,
      name: "Medha Program Management API",
      version: CONFIG.VERSION,
      account: (function () { try { return Session.getEffectiveUser().getEmail(); } catch (e) { return ""; } })(),
      at: new Date().getTime()
    };
    case "markMailSeen": return markMailSeen();
    case "markMailRead": return markMailRead(data.threadId);
    case "setupGmail": return setupGmail();
    case "markMailUnseen": return markMailUnseen();
    case "fetchLogMailBody": return fetchLogMailBody(data.subject || "", data.recipient || "");
    case "getFormStatus": return getFormStatus(data.form || data.formType || "application");
    case "saveFormSettings": return saveFormSettings(data.settings || data);
    case "listProgramSchedules": return listProgramSchedules();
    case "scheduleProgramMail": return scheduleProgramMail(data.payload || data);
    case "cancelProgramSchedule": return cancelProgramSchedule(data.id || "");
    case "updateProgramSchedule": return updateProgramSchedule(data.payload || data);
    case "saveProgramDraft": return saveProgramDraft(data.draft || data);
    case "loadProgramDraft": return loadProgramDraft(data.program || "");
    case "listDriveFolderFiles": return listDriveFolderFiles(data.folderUrl || data.folderId || "");
    case "setupProgramSheets": return setupProgramSheets();
    case "getNcmMaster": return getNcmMaster_();
    case "getNcmTracker": return getNcmTracker_(data.tab || data.month || "");
    case "setNcmTrackerCell": return setNcmTrackerCell_(data);
    case "listFiles": return listFiles();
    case "addFile": return addFile(data);
    case "uploadFile": return uploadFile(data);
    case "updateFile": return updateFile(data);
    case "deleteFile": return deleteFile(data);
    case "supportDiscover": return supportDiscover();
    case "supportDiscoverTickets": return supportDiscoverTickets();
    case "supportConnect": return supportConnect();
    case "supportLogin": return supportLogin();
    case "supportRequest": return supportRequest(data);
    case "supportStatus": return supportStatus();
    case "setSupportCredentials": return setSupportCredentials(data);
    case "getFormSettings": return getFormSettings();
    case "saveFormSettings": return saveFormSettings(data);
    case "deleteFormSettings": return deleteFormSettings(data);
    case "getFormState": return getFormState(data.id || "");
    case "checkFrameable": return checkFrameable(data);
    case "generateResultDocs": return generateResultDocs(data);
    case "emailResults": return emailResults(data);
    case "getResults": return getResults();
    case "uploadResultAssets": return uploadResultAssets();
    case "getAgreements": return getAgreements();
    case "upsertAgreement": return upsertAgreement(data);
    case "deleteAgreement": return deleteAgreement(data);
    case "seedAgreements": return seedAgreements(data);
    case "syncGmailSent": return syncGmailSentEmails(data || {});
    case "ensureGmailSyncTrigger": return ensureGmailSyncTrigger();
    case "disableGmailSyncTrigger": return disableGmailSyncTrigger();
    case "ping": return { success: true, pong: Date.now() };
    default: return { success: false, message: "Unknown action: " + action };
  }
}

/* ========== Members API ========== */

/* ------------------------------------------------------------------
   Medha Batch-01 Master sheet — the NCM PART-2 member list.
   The tab name and the column positions are found automatically so the
   sheet can be reorganised without touching the code.
   ------------------------------------------------------------------ */

function normHeader_(v) {
  return String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** find a column index by header name (exact first, then "contains") */
function pickCol_(headers, priority, loose) {
  for (var i = 0; i < priority.length; i++) {
    for (var j = 0; j < headers.length; j++) {
      if (normHeader_(headers[j]) === priority[i]) return j;
    }
  }
  for (var i = 0; i < priority.length; i++) {
    for (var j = 0; j < headers.length; j++) {
      if (normHeader_(headers[j]).indexOf(priority[i]) !== -1) return j;
    }
  }
  if (loose) {
    for (var j = 0; j < headers.length; j++) {
      for (var k = 0; k < loose.length; k++) {
        if (normHeader_(headers[j]).indexOf(loose[k]) !== -1) return j;
      }
    }
  }
  return -1;
}

var B01_COLS_ = {
  id:     { p: ["memberid", "membercode", "studentid", "id"] },
  name:   { p: ["name", "membername", "fullname", "studentname"] },
  email:  { p: ["email", "programenrolledemail", "enrolledemail", "medhaaccessmail"], loose: ["mail"] },
  status: { p: ["status", "mailstatus", "mailstate"] },
  sentAt: { p: ["sentat", "lastsent", "lastmail", "mailedat", "sentdate"] },
  phone:  { p: ["phone", "mobile", "contact"] },
  whatsapp: { p: ["whatsapp", "whatsappnumber", "whatsappno"] },
  address: { p: ["address", "addr", "location", "district"] },
  facebook: { p: ["facebook", "facebookprofile", "fb", "fblink", "fbprofile"] },
  medhaEmail: { p: ["medhaemail", "medhaaccessmail", "medhaloginemail", "medhaloginaccessemail", "medhamail"] },
  courseMail: { p: ["coursemail", "coursemailaddress"] },
  tranId: { p: ["tranid", "transid", "transactionid", "trxid", "trid", "paymentid"] },
  plan:   { p: ["plan", "package"] },
  team:   { p: ["team", "teamcategory", "category", "group"] },
  payStatus: { p: ["paymentstatus", "paymentstate"] },
  amount: { p: ["amount", "paidamount", "total"] },
  payDate: { p: ["paymentdate", "paidon", "dateofpayment", "transactiondate", "paydate"] },
  payChannel: { p: ["paymentchannel", "channel", "paymentmethod", "method"] },
};

/** Read one sheet as a member list, or return null when it is not one. */
function parseMemberSheet_(sh) {
  var last = sh.getLastRow();
  var maxCol = Math.min(sh.getLastColumn(), 30);
  if (!last || !maxCol) return null;

  /* the header row is not always row 1 — look for it in the first rows */
  for (var hr = 0; hr < Math.min(6, last); hr++) {
    var headers = sh.getRange(hr + 1, 1, 1, maxCol).getValues()[0];
    var idx = {};
    var ok = true;
    for (var key in B01_COLS_) {
      var c = B01_COLS_[key];
      idx[key] = pickCol_(headers, c.p, c.loose);
    }
    if (idx.name < 0) continue;
    if (idx.id < 0 && idx.email < 0 && idx.tranId < 0) continue;

    var values = sh.getRange(hr + 1, 1, last - hr, maxCol).getValues();
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      var cell = function (n) { return (n >= 0 && r[n] != null) ? r[n] : ""; };
      var str = function (n) { return String(cell(n)).trim(); };
      var tranId = idx.tranId >= 0 ? str(idx.tranId) : "";
      var memberId = idx.id >= 0 ? str(idx.id) : "";
      var name = str(idx.name);
      var email = str(idx.email);
      if (!name && !email) continue;
      if (/example/i.test(memberId)) continue;
      /* the Master File has no "Member ID" column — build one from the row
         number so every member still has a stable key */
      if (!memberId) memberId = tranId || ("NCM-P2-" + ("" + (i + 1)).slice(-2));
      var row = {
        sl: str(0),
        memberId: memberId,
        name: name,
        email: email,
        status: str(idx.status),
        sentAt: (cell(idx.sentAt) instanceof Date)
          ? Utilities.formatDate(cell(idx.sentAt), Session.getScriptTimeZone() || "Asia/Dhaka", "dd-MM-yyyy HH:mm:ss")
          : str(idx.sentAt),
        _row: hr + 1 + i,
        /* keep the old marker so the rest of the app knows this is Part 2 */
        _tab: "Members NCM-P2",
        _src: sh.getName(),
        program: "NCM PART-2",
      };
      if (idx.phone >= 0) row.phone = bdPhone_(cell(idx.phone));
      if (idx.whatsapp >= 0) row.whatsapp = bdPhone_(cell(idx.whatsapp));
      if (idx.address >= 0) row.address = str(idx.address);
      if (idx.facebook >= 0) row.facebook = str(idx.facebook);
      if (idx.medhaEmail >= 0) row.medhaEmail = str(idx.medhaEmail);
      if (idx.courseMail >= 0) row.courseMail = str(idx.courseMail);
      if (tranId) row.tranId = tranId;
      if (idx.plan >= 0) row.plan = str(idx.plan);
      if (idx.team >= 0) row.team = str(idx.team);
      if (idx.payStatus >= 0) row.paymentStatus = str(idx.payStatus);
      if (idx.amount >= 0) row.amount = str(idx.amount);
      if (idx.payDate >= 0) row.paymentDate = str(idx.payDate);
      if (idx.payChannel >= 0) row.paymentChannel = str(idx.payChannel);
      rows.push(row);
    }
    if (rows.length) return rows;
  }
  return null;
}

/** Bangladesh mobile numbers always start with 0 */
function bdPhone_(v) {
  var s = String(v == null ? "" : v).trim();
  if (!s) return "";
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
  var digits = s.replace(/\D/g, "");
  if (!digits) return s;
  if (digits.indexOf("880") === 0 && digits.length > 10) return "0" + digits.slice(3);
  if (digits.indexOf("0") === 0) return digits;
  return "0" + digits;
}

/** Find the member list inside the Batch-01 Master spreadsheet */
/**
 * Merge member rows that come from different tabs of the same spreadsheet.
 * Rows are matched on the member id, then the email, then the name — so the
 * profile tab, the payment tab and the attendance tab combine into one record.
 */
function mergeRows_(rows) {
  var byId = {}, byMail = {}, byName = {};
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var key = String(r.memberId || "").toLowerCase();
    var mail = String(r.email || "").toLowerCase();
    var nm = String(r.name || "").toLowerCase().trim();
    var hit = (key && byId[key]) || (mail && byMail[mail]) || (nm && byName[nm]);
    if (!hit) {
      hit = {};
      for (var k in r) hit[k] = r[k];
      out.push(hit);
    } else {
      for (var k2 in r) {
        var v = r[k2];
        if (v === "" || v == null) continue;
        if (hit[k2] === "" || hit[k2] == null) hit[k2] = v;
      }
    }
    if (key) byId[key] = hit;
    if (mail) byMail[mail] = hit;
    if (nm) byName[nm] = hit;
  }
  return out;
}

/**
 * Read EVERY tab of the Batch-01 Master spreadsheet and combine them.
 * The Master File tab supplies the profile (name, email, course mail, phone,
 * WhatsApp, address, Facebook, Medha email, transaction id); the other tabs
 * (payment check, Members Serial, Call Data, Task Data, attendance ...) add
 * whatever they carry.
 */
function batch01Members_() {
  var ss;
  try { ss = SpreadsheetApp.openById(BATCH01_SHEET_ID); }
  catch (e) { return null; }

  var collected = [];
  var sheets = ss.getSheets();
  /* The "Master File" tab holds the full list (name, email, phone, WhatsApp,
     address, course mail, Facebook, Medha e-mail, transaction id). Read it
     first so its values are the ones that end up in the member record. */
  var ordered = [];
  for (var mi = 0; mi < sheets.length; mi++) {
    if (/^master file$/i.test(String(sheets[mi].getName() || "").trim())) ordered.push(sheets[mi]);
  }
  for (var si = 0; si < sheets.length; si++) {
    if (ordered.indexOf(sheets[si]) === -1) ordered.push(sheets[si]);
  }
  sheets = ordered;
  for (var j = 0; j < sheets.length; j++) {
    var rows = parseMemberSheet_(sheets[j]);
    if (rows && rows.length) {
      for (var i = 0; i < rows.length; i++) {
        rows[i]._src = sheets[j].getName();
        collected.push(rows[i]);
      }
    }
  }
  if (!collected.length) return null;
  return mergeRows_(collected);
}

function getAllMembers_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var out = {};
  out._all = [];
  for (var p in CONFIG.PROGRAMS) {
    var conf = CONFIG.PROGRAMS[p];
    var sh = ss.getSheetByName(conf.sheetName);
    if (!sh) { out[p] = []; continue; }
    var data = sh.getDataRange().getValues();
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var email = String(r[3] || "").trim();
      if (!email || email.indexOf("@") === -1) continue;
      var memberId = String(r[1] || "").trim();
      if (/example/i.test(memberId)) continue;
      rows.push({
        sl: r[0],
        memberId: memberId,
        name: String(r[2] || "").trim(),
        email: email,
        status: String(r[4] || "").trim(),
        sentAt: String(r[5] || "").trim(),
        _row: i + 1,
        _tab: conf.sheetName,
        program: p,
      });
    }
    out[p] = rows;
    out._all = out._all.concat(rows);
  }

  /* NCM PART-2 comes from the Medha Batch-01 Master sheet when it can be read.
     The Master File has no "Member ID" column, so the two lists are matched
     on the email address (then on the name) — that keeps the old member id
     and mail status while adding the richer Master File details. */
  var b01 = batch01Members_();
  if (b01 && b01.length) {
    var oldP2 = out["NCM PART-2"] || [];
    var byMail = {}, byName = {};
    for (var i = 0; i < oldP2.length; i++) {
      var m0 = oldP2[i];
      if (m0.email) byMail[String(m0.email).toLowerCase()] = m0;
      if (m0.name) byName[String(m0.name).toLowerCase().trim()] = m0;
    }

    var merged = [];
    var used = {};
    for (var j = 0; j < b01.length; j++) {
      var row = b01[j];
      var old1 = row.email ? byMail[String(row.email).toLowerCase()] : null;
      if (!old1 && row.name) old1 = byName[String(row.name).toLowerCase().trim()];
      if (old1) {
        /* keep the id, mail status and date from the older tab */
        if (old1.memberId) row.memberId = old1.memberId;
        if (!row.status && old1.status) row.status = old1.status;
        if (!row.sentAt && old1.sentAt) row.sentAt = old1.sentAt;
        used[String(old1.memberId || "").toLowerCase()] = true;
        used[String(old1.email || "").toLowerCase()] = true;
      }
      merged.push(row);
    }
    /* anyone who is only in the older tab is kept as well */
    var extras = [];
    for (var k = 0; k < oldP2.length; k++) {
      var om = oldP2[k];
      if (!used[String(om.memberId || "").toLowerCase()] && !used[String(om.email || "").toLowerCase()]) {
        extras.push(om);
      }
    }

    out["NCM PART-2"] = merged.concat(extras);
    out._p2Source = b01.length ? b01[0]._src : "";
    out._p2FromBatch01 = true;
    out._p2Note = extras.length ? extras.length + " member(s) come from the older tab" : "";
    out._all = (out["NCM PART-1"] || []).concat(out["NCM PART-2"]);
  } else {
    out._p2Source = "Members NCM-P2";
    out._p2FromBatch01 = false;
    out._p2Note = "Batch-01 Master sheet is not reachable";
  }
  return { success: true, data: out };
}

function getProgramSheet_(programName) {
  if (!programName || programName === 'Others') return null;
  var ss = SpreadsheetApp.openById(CONFIG.PROGRAM_SPREADSHEET_ID);
  var conf = (CONFIG.PROGRAMS || {})[programName];
  var sheet = null;
  if (conf && conf.sheetName) sheet = ss.getSheetByName(conf.sheetName);
  if (!sheet) {
    var sheets = ss.getSheets();
    var target = String(programName || "").toLowerCase().replace(/\s+/g, "");
    var want1 = /part-?1|ncm-?p1|p1/.test(target);
    var want2 = /part-?2|ncm-?p2|p2/.test(target);
    for (var i = 0; i < sheets.length; i++) {
      var n = sheets[i].getName().toLowerCase().replace(/\s+/g, "");
      if (want1 && /ncm-?p1|part-?1|members.*p1/.test(n)) { sheet = sheets[i]; break; }
      if (want2 && /ncm-?p2|part-?2|members.*p2/.test(n)) { sheet = sheets[i]; break; }
    }
  }
  return sheet;
}

function getProgramMembers(programName, forceRefresh) {
  if (String(programName || "") === "Others") return { success: true, members: [], message: "Others uses manual email list" };
  try {
    if (!programName) return { success: false, message: "Select a program", members: [] };
    var cacheKey = "pm_members_" + String(programName).replace(/\s+/g, "_");
    if (forceRefresh) {
      try { CacheService.getScriptCache().remove(cacheKey); } catch (fr) {}
    } else {
      try {
        var cached = CacheService.getScriptCache().get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (cErr) {}
    }
    var sheet = getProgramSheet_(programName);
    if (!sheet) return { success: false, message: "Sheet not found for " + programName, members: [] };
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { success: true, program: programName, sheetName: sheet.getName(), members: [] };
    var headers = data[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
    function col() {
      for (var a = 0; a < arguments.length; a++) {
        var want = arguments[a].toLowerCase();
        for (var i = 0; i < headers.length; i++) {
          if (headers[i] === want || headers[i].indexOf(want) === 0) return i;
        }
      }
      return -1;
    }
    var iSL = col("sl");
    var iId = col("member id", "memberid", "id");
    var iName = col("name");
    var iEmail = col("email");
    var iStatus = col("status");
    var iSent = col("sentat", "sent at", "last sent");
    var members = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var email = iEmail >= 0 ? String(row[iEmail] || "").trim() : "";
      if (!email || email.indexOf("@") === -1) continue;
      var sentRaw = iSent >= 0 ? row[iSent] : "";
      var sentAt = "";
      if (sentRaw instanceof Date) {
        sentAt = Utilities.formatDate(sentRaw, Session.getScriptTimeZone(), "dd-MM-yyyy hh:mm:ss a");
      } else if (sentRaw) {
        sentAt = String(sentRaw);
      }
      members.push({
        rowIndex: r + 1,
        sl: iSL >= 0 ? row[iSL] : r,
        memberId: iId >= 0 ? String(row[iId] || "").trim() : "",
        name: iName >= 0 ? String(row[iName] || "").trim() : "",
        email: email,
        status: iStatus >= 0 ? String(row[iStatus] || "").trim() : "",
        sentAt: sentAt,
        decision: "Not Decided"
      });
    }
    var result = {
      success: true,
      program: programName,
      sheetName: sheet.getName(),
      members: members,
      count: members.length
    };
    try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 15); } catch (ce) {}
    return result;
  } catch (err) {
    return { success: false, message: err.message, members: [] };
  }
}

/* ========== Mail send ========== */

function sendProgramMails(payload) {
  try {
    payload = payload || {};
    var recipients = payload.recipients || [];
    if (!recipients.length) return { success: false, message: "No recipients", sent: 0 };

    var subject = payload.subject || "Message from Medha";
    var built = buildProgramEmailHtml_(payload.bodyHtml || payload.body || "", payload.bannerMode || "none", "", "", null, null, payload.includeAutoNote !== false);

    var sent = 0, failed = [];
    for (var i = 0; i < recipients.length; i++) {
      var rec = recipients[i];
      var to = String(rec.email || "").trim();
      if (!to || to.indexOf("@") === -1) { failed.push(to || "(empty)"); continue; }
      try {
        GmailApp.sendEmail(to, subject, "", {
          htmlBody: personalizeBody_(built.html, rec),
          from: CONFIG.FROM_NAME,
          name: CONFIG.FROM_NAME,
        });
        sent++;
        // Update sheet status
        try {
          var ss = SpreadsheetApp.openById(CONFIG.PROGRAM_SPREADSHEET_ID);
          var sheet = getProgramSheet_(payload.program || "");
          if (sheet && rec.rowIndex) {
            var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            for (var h = 0; h < headers.length; h++) {
              if (String(headers[h]).toLowerCase() === "status") sheet.getRange(rec.rowIndex, h + 1).setValue("Sent");
              if (String(headers[h]).toLowerCase().replace(/\s/g, "") === "sentat") {
                sheet.getRange(rec.rowIndex, h + 1).setValue(
                  Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss")
                );
              }
            }
          }
        } catch (se) {}
      } catch (e) {
        failed.push(to + ": " + e.message);
      }
    }

    try {
      logEmail("Program Mail: " + (payload.program || ""), sent, recipients.map(function(r){return r.email;}).join(", "), subject, sent > 0 ? "Sent" : "Failed", "Portal", "", payload.bodyHtml || "");
    } catch (le) {}

    return { success: sent > 0, sent: sent, failed: failed.length, failedList: failed, message: "Sent " + sent + " of " + recipients.length };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function personalizeBody_(html, rec) {
  var name = rec.name || "";
  var id = rec.memberId || "";
  var email = rec.email || "";
  return String(html)
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{memberId\}\}/g, id)
    .replace(/\{\{member id\}\}/gi, id)
    .replace(/\{\{email\}\}/g, email);
}

/* ========== Email log ========== */

function logEmail(type, count, recipients, subject, status, sentBy, notes, bodyHtml) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.LOG_SHEET);
      logSheet.appendRow(["Timestamp", "Type", "Recipients Count", "Recipients", "Subject", "Status", "Sent By", "Notes", "Body"]);
      logSheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("#ffffff");
    }
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(["Timestamp", "Type", "Recipients Count", "Recipients", "Subject", "Status", "Sent By", "Notes", "Body"]);
    }
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss");
    var body = String(bodyHtml || "");
    if (body.length > 45000) body = body.substring(0, 45000) + "…";
    logSheet.appendRow([now, type, count, recipients, subject, status, sentBy, notes, body]);
  } catch (e) {}
}

function getEmailLogs(limit) {
  try {
    limit = Math.min(Math.max(parseInt(limit || 40, 10) || 40, 10), 100);
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);
    if (!logSheet || logSheet.getLastRow() < 2) return [];
    var last = logSheet.getLastRow();
    var startRow = Math.max(2, last - limit + 1);
    var numRows = last - startRow + 1;
    var cols = Math.max(8, Math.min(logSheet.getLastColumn(), 9));
    var data = logSheet.getRange(startRow, 1, numRows, cols).getValues();
    var out = [];
    for (var i = data.length - 1; i >= 0; i--) {
      var r = data[i];
      var by = String(r[6] || "");
      var notes = String(r[7] || "");
      var source = "Portal";
      if (/gmail/i.test(by) || /Source:\s*Gmail/i.test(notes)) source = "Gmail";
      else if (/system/i.test(by) || /Source:\s*System/i.test(notes)) source = "System";
      var ts = r[0];
      if (ts instanceof Date) ts = Utilities.formatDate(ts, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss");
      else ts = String(ts || "");
      var body = (r.length > 8) ? String(r[8] || "") : "";
      out.push({
        timestamp: ts, type: r[1], count: r[2], recipients: r[3], subject: r[4], status: r[5],
        sentBy: by, notes: notes, source: source, body: body
      });
    }
    return out;
  } catch (e) { return []; }
}

/* ========== Mail badge ========== */

/**
 * The real Gmail inbox of the account that owns this script.
 * Returns every inbox mail (read and unread) plus the unread count.
 * If Gmail is not authorised yet the reason comes back in `message`
 * so the portal can tell the truth instead of showing made-up mails.
 */
function getMailBadge(withList) {
  var unread = 0, items = [], error = "";
  try {
    try { unread = GmailApp.getInboxUnreadCount(); }
    catch (e1) { error = String((e1 && e1.message) || e1); }

    if (withList) {
      try {
        var threads = GmailApp.search("in:inbox", 0, 50);
        for (var i = 0; i < threads.length; i++) {
          var t = threads[i];
          var msgs = t.getMessages();
          var msg = msgs[msgs.length - 1];
          var from = "", subj = "", d = "", snip = "", un = false;
          try { from = msg.getFrom(); } catch (e2) {}
          try { subj = msg.getSubject(); } catch (e3) {}
          try { snip = msg.getSnippet(); } catch (e3b) {}
          try { un = msg.isUnread(); } catch (e3c) {}
          try { d = Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss"); } catch (e4) {}
          items.push({
            from: from, subject: subj, date: d, snippet: snip,
            unread: un, threadId: t.getId()
          });
        }
      } catch (eL) {
        if (!error) error = String((eL && eL.message) || eL);
      }
    }
  } catch (e) {
    error = String((e && e.message) || e);
  }
  return { success: !error, unread: unread, items: items, message: error };
}

/** Mark one thread as read (the portal calls this when a mail is opened) */
function markMailRead(threadId) {
  try {
    var t = GmailApp.getThreadById(threadId);
    if (!t) return { success: false, message: "Thread not found" };
    t.markRead();
    return { success: true, threadId: threadId };
  } catch (e) {
    return { success: false, message: String((e && e.message) || e) };
  }
}

/** Run this once so Apps Script asks for permission to read Gmail.
    (Without it the inbox cannot be read at all.) */
/**
 * Does everything in one go — run THIS one only.
 *   1. the program tabs and the Status dropdown
 *   2. permission to read the Gmail inbox
 * The result is shown in the Execution log on the left.
 */
function setupAll() {
  var out = [];
  try {
    var r1 = setupProgramSheets();
    out.push(r1 && r1.success ? "Sheets: ready — " + r1.message : "Sheets: " + ((r1 && r1.message) || "failed"));
  } catch (e) { out.push("Sheets: " + String((e && e.message) || e)); }
  try {
    var r2 = setupGmail();
    out.push(r2 && r2.success ? "Gmail: " + r2.message : "Gmail: " + ((r2 && r2.message) || "failed"));
  } catch (e) { out.push("Gmail: " + String((e && e.message) || e)); }
  return { success: true, message: out.join(" | ") };
}

function setupGmail() {
  try {
    var n = GmailApp.getInboxUnreadCount();
    var threads = GmailApp.search("in:inbox", 0, 3);
    return { success: true, message: "Gmail is ready — " + n + " unread, " + threads.length + " recent thread(s) checked." };
  } catch (e) {
    return { success: false, message: String((e && e.message) || e) };
  }
}

function markMailSeen() {
  try {
    var threads = GmailApp.search("is:unread in:inbox", 0, 50);
    for (var i = 0; i < threads.length; i++) {
      try { threads[i].markRead(); } catch (e1) {}
    }
    return { success: true, marked: threads.length };
  } catch (e) { return { success: false, message: String(e) }; }
}

function markMailUnseen() {
  try {
    var threads = GmailApp.search("in:inbox", 0, 10);
    var n = 0;
    for (var i = 0; i < threads.length; i++) {
      try { threads[i].markUnread(); n++; } catch (e1) {}
    }
    return { success: true, marked: n };
  } catch (e) { return { success: false, message: String(e) }; }
}

function fetchLogMailBody(subject, recipient) {
  try {
    subject = String(subject || "").trim();
    recipient = String(recipient || "").trim();
    var q = "in:sent";
    if (subject) q += ' subject:"' + subject.replace(/"/g, "") + '"';
    if (recipient && recipient.indexOf("@") > 0) q += " to:" + recipient.split(/[,;]/)[0].trim();
    var threads = GmailApp.search(q, 0, 3);
    for (var i = 0; i < threads.length; i++) {
      var msg = threads[i].getMessages()[threads[i].getMessageCount() - 1];
      var html = msg.getBody() || msg.getPlainBody() || "";
      if (html) return { success: true, body: html };
    }
    return { success: false, body: "", message: "Body not found" };
  } catch (e) { return { success: false, body: "", message: String(e) }; }
}

/* ========== Quota ========== */

function getEmailQuota() {
  try {
    var remaining = MailApp.getRemainingDailyQuota();
    var now = new Date();
    var estFree = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      success: true,
      remaining: remaining,
      checkedAt: Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss"),
      estimatedFreeAt: Utilities.formatDate(estFree, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss"),
      message: "Quota left: " + remaining
    };
  } catch (e) {
    return { success: false, remaining: null, message: String(e) };
  }
}

/* ========== Form control ========== */

function getFormStatus(formType) {
  try {
    var isFb = (String(formType).toLowerCase() === "feedback" || String(formType).toLowerCase() === "fb");
    var map = getSettingsMap_();
    var openKey = isFb ? "FB_FORM_OPEN" : "FORM_OPEN";
    var deadKey = isFb ? "FB_FORM_DEADLINE" : "FORM_DEADLINE";
    var msgBnKey = isFb ? "FB_CLOSED_MSG_BN" : "CLOSED_MSG_BN";
    var msgEnKey = isFb ? "FB_CLOSED_MSG_EN" : "CLOSED_MSG_EN";
    var openFlag = String(map[openKey] !== undefined ? map[openKey] : "YES").trim().toUpperCase();
    var manualOpen = !(openFlag === "NO" || openFlag === "FALSE" || openFlag === "0" || openFlag === "OFF");
    return {
      form: isFb ? "feedback" : "application",
      open: manualOpen,
      manualOpen: manualOpen,
      messageBn: String(map[msgBnKey] || "বন্ধ"),
      messageEn: String(map[msgEnKey] || "Closed")
    };
  } catch (e) { return { form: "application", open: true, manualOpen: true, messageBn: "বন্ধ", messageEn: "Closed", error: e.message }; }
}

function saveFormSettings(settings) {
  try {
    settings = settings || {};
    var formType = String(settings.formType || "application").toLowerCase();
    var isFb = (formType === "feedback" || formType === "fb");
    var prefix = isFb ? "FB_" : "";
    if (settings.FORM_OPEN !== undefined) setSetting_(prefix + "FORM_OPEN", settings.FORM_OPEN);
    if (settings.FORM_DEADLINE !== undefined) setSetting_(prefix + "FORM_DEADLINE", settings.FORM_DEADLINE);
    if (settings.CLOSED_MSG_BN !== undefined) setSetting_(prefix + "CLOSED_MSG_BN", settings.CLOSED_MSG_BN);
    if (settings.CLOSED_MSG_EN !== undefined) setSetting_(prefix + "CLOSED_MSG_EN", settings.CLOSED_MSG_EN);
    return { success: true, status: getFormStatus(isFb ? "feedback" : "application") };
  } catch (e) { return { success: false, message: e.message }; }
}

function setSetting_(key, value) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sh) { sh = ss.insertSheet(CONFIG.SETTINGS_SHEET); sh.appendRow(["Key", "Value"]); }
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || "").trim() === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

function getSettingsMap_() {
  var map = {};
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
    if (!sh) return map;
    var data = sh.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      var k = String(data[i][0] || "").trim();
      var v = data[i][1];
      if (k) map[k] = v;
    }
  } catch (e) {}
  return map;
}

/* ========== Program sheet setup ========== */

function setupProgramSheets() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.PROGRAM_SPREADSHEET_ID);
    var names = ["Members NCM-P1", "Members NCM-P2"];
    var sheets = ss.getSheets();
    for (var n = 0; n < names.length; n++) {
      var sh = ss.getSheetByName(names[n]);
      if (!sh) {
        for (var si = 0; si < sheets.length; si++) {
          var sn = sheets[si].getName().toLowerCase().replace(/\s+/g, "");
          if (n === 0 && (sn.indexOf("ncm-p1") >= 0 || sn.indexOf("part1") >= 0)) { sh = sheets[si]; break; }
          if (n === 1 && (sn.indexOf("ncm-p2") >= 0 || sn.indexOf("part2") >= 0)) { sh = sheets[si]; break; }
        }
      }
      if (!sh) sh = ss.insertSheet(names[n]);
      var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 6)).getValues()[0];
      var need = ["SL", "Member ID", "Name", "Email", "Status", "SentAt"];
      if (!headers[0] || String(headers[0]).trim() === "") {
        sh.getRange(1, 1, 1, 6).setValues([need]);
      }
      var statusCol = 5, sentCol = 6;
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Pending", "Sent", "Skip", "Hold"], true)
        .setAllowInvalid(true).build();
      sh.getRange(2, statusCol, 200, 1).setDataValidation(rule);
      sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#5b21b6").setFontColor("#ffffff");
    }
    var logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.LOG_SHEET);
      logSheet.appendRow(["Timestamp", "Type", "Recipients Count", "Recipients", "Subject", "Status", "Sent By", "Notes", "Body"]);
      logSheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("#ffffff");
    }
    setupAgreementsSheet_(ss);
    return { success: true, message: "Program sheets ready" };
  } catch (e) { return { success: false, message: e.message }; }
}

/* ========== Email HTML builder (minimal) ========== */

function buildProgramEmailHtml_(bodyHtml, bannerMode, customBannerUrl, customFooterUrl, bannerBase64, footerBase64, includeAutoNote) {
  if (includeAutoNote === undefined) includeAutoNote = true;
  var autoNote = includeAutoNote
    ? '<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;font-style:italic;">This is an automated email. Please do not reply.</p>'
    : "";
  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head>' +
    '<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,sans-serif;">' +
    '<div style="padding:24px 12px;background:#f5f3ff;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
      '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">' +
        '<tr><td style="padding:28px 32px;font-size:15px;line-height:1.7;color:#1e1b4b;">' +
          (bodyHtml || "") + autoNote +
        '</td></tr>' +
        '<tr><td style="padding:14px 20px;text-align:center;font-size:11px;color:#9ca3af;background:#faf8ff;">© ' +
          new Date().getFullYear() + ' Online Tech Academy | Medha Program</td></tr>' +
      '</table></td></tr></table>' +
    '</div></body></html>';
  return { html: html, inline: {} };
}

/* ========== Schedules (basic) ========== */

function scheduleProgramMail(payload) {
  try {
    payload = payload || {};
    var when = payload.when;
    if (!when) return { success: false, message: "Schedule time required" };
    var d = new Date(when);
    if (isNaN(d.getTime())) return { success: false, message: "Invalid date" };
    var id = "pm_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
    var props = PropertiesService.getScriptProperties();
    var list = [];
    try { list = JSON.parse(props.getProperty("PM_SCHEDULES") || "[]"); } catch (e) { list = []; }
    list.push({ id: id, when: d.toISOString(), payload: payload, status: "scheduled", createdAt: new Date().toISOString() });
    props.setProperty("PM_SCHEDULES", JSON.stringify(list));
    return { success: true, id: id, when: d.toISOString(), message: "Scheduled for " + d.toISOString() };
  } catch (e) { return { success: false, message: e.message }; }
}

function listProgramSchedules() {
  try {
    var list = [];
    try { list = JSON.parse(PropertiesService.getScriptProperties().getProperty("PM_SCHEDULES") || "[]"); } catch (e) {}
    for (var i = 0; i < list.length; i++) list[i].idx = i + 1;
    return { success: true, schedules: list };
  } catch (e) { return { success: false, schedules: [], message: e.message }; }
}

function cancelProgramSchedule(id) {
  try {
    var list = [];
    try { list = JSON.parse(PropertiesService.getScriptProperties().getProperty("PM_SCHEDULES") || "[]"); } catch (e) {}
    list = list.filter(function(s) { return s.id !== id; });
    PropertiesService.getScriptProperties().setProperty("PM_SCHEDULES", JSON.stringify(list));
    return { success: true, message: "Cancelled" };
  } catch (e) { return { success: false, message: e.message }; }
}

function updateProgramSchedule(payload) {
  try {
    var id = payload.id;
    var list = [];
    try { list = JSON.parse(PropertiesService.getScriptProperties().getProperty("PM_SCHEDULES") || "[]"); } catch (e) {}
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        if (payload.when) list[i].when = new Date(payload.when).toISOString();
        if (payload.payload) list[i].payload = Object.assign({}, list[i].payload || {}, payload.payload);
        list[i].status = "scheduled";
        break;
      }
    }
    PropertiesService.getScriptProperties().setProperty("PM_SCHEDULES", JSON.stringify(list));
    return { success: true, message: "Updated", schedules: list };
  } catch (e) { return { success: false, message: e.message }; }
}

/* ========== Drafts ========== */

function saveProgramDraft(draft) {
  try {
    var key = "PM_DRAFT_" + String(draft.program || "default").replace(/\s+/g, "_");
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(draft));
    return { success: true, message: "Draft saved" };
  } catch (e) { return { success: false, message: e.message }; }
}

function loadProgramDraft(program) {
  try {
    var key = "PM_DRAFT_" + String(program || "default").replace(/\s+/g, "_");
    var raw = PropertiesService.getScriptProperties().getProperty(key);
    return { success: true, draft: raw ? JSON.parse(raw) : null };
  } catch (e) { return { success: false, draft: null, message: e.message }; }
}

/* ========== Drive folder ========== */

function listDriveFolderFiles(folderUrlOrId) {
  try {
    var id = extractDriveId_(folderUrlOrId);
    if (!id) return { success: false, message: "Invalid Drive folder link", files: [] };
    var folder = DriveApp.getFolderById(id);
    var files = folder.getFiles();
    var list = [];
    while (files.hasNext()) {
      var f = files.next();
      list.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType(), size: f.getSize() });
    }
    return { success: true, folderName: folder.getName(), files: list };
  } catch (err) {
    return { success: false, message: err.message, files: [] };
  }
}

function extractDriveId_(url) {
  if (!url) return "";
  var m = String(url).match(/\/folders\/([a-zA-Z0-9_-]+)/) || String(url).match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "";
}

/* ========== Gmail sync ========== */

function syncGmailSentEmails(options) {
  options = options || {};
  var days = Number(options.days) || 7;
  var maxThreads = Math.min(Number(options.max) || 80, 100);
  var updated = 0, logged = 0, matched = 0;
  try {
    var members = getAllProgramMemberEmails_();
    var memberCount = Object.keys(members).length;
    if (!memberCount) return { success: true, updated: 0, logged: 0, message: "No members found" };
    var threads = GmailApp.search("in:sent newer_than:" + days + "d", 0, maxThreads);
    var ss = SpreadsheetApp.openById(CONFIG.PROGRAM_SPREADSHEET_ID || CONFIG.SPREADSHEET_ID);
    for (var t = 0; t < threads.length; t++) {
      var msgs = threads[t].getMessages();
      for (var m = 0; m < msgs.length; m++) {
        var msg = msgs[m];
        var toRaw = msg.getTo() || "";
        var ccRaw = msg.getCc() || "";
        var allTo = (toRaw + "," + ccRaw).split(/[,;]/);
        var subject = msg.getSubject() || "";
        var when = msg.getDate();
        var ts = Utilities.formatDate(when, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss");
        for (var a = 0; a < allTo.length; a++) {
          var addr = String(allTo[a] || "").replace(/.*</, "").replace(/>.*/, "").trim().toLowerCase();
          if (!addr || addr.indexOf("@") < 0) continue;
          var mem = members[addr];
          if (!mem) continue;
          matched++;
          if (mem.status && String(mem.status).toLowerCase() === "sent") continue;
          try {
            var sh = ss.getSheetByName(mem.sheetName);
            if (sh) {
              sh.getRange(mem.rowIndex, mem.statusCol).setValue("Sent");
              sh.getRange(mem.rowIndex, mem.sentCol).setValue(ts);
              updated++;
            }
          } catch (ue) {}
          try {
            logEmail("Gmail Sync: " + (mem.program || ""), 1, addr, subject, "Sent", "Gmail", "Source: Gmail · " + ts, "");
            logged++;
          } catch (le) {}
        }
      }
    }
    return { success: true, updated: updated, logged: logged, matched: matched, message: "Updated " + updated + " rows · logged " + logged };
  } catch (err) {
    return { success: false, message: err.message, updated: 0, logged: 0 };
  }
}

function getAllProgramMemberEmails_() {
  var map = {};
  try {
    var ss = SpreadsheetApp.openById(CONFIG.PROGRAM_SPREADSHEET_ID || CONFIG.SPREADSHEET_ID);
    for (var p in CONFIG.PROGRAMS) {
      var conf = CONFIG.PROGRAMS[p];
      var sh = ss.getSheetByName(conf.sheetName);
      if (!sh) continue;
      var data = sh.getDataRange().getValues();
      var headers = data[0];
      var emailCol = -1, statusCol = -1, sentCol = -1;
      for (var h = 0; h < headers.length; h++) {
        var lname = String(headers[h]).toLowerCase().replace(/\s/g, "");
        if (lname === "email") emailCol = h;
        else if (lname === "status") statusCol = h;
        else if (lname === "sentat") sentCol = h;
      }
      if (emailCol < 0) continue;
      for (var r = 1; r < data.length; r++) {
        var email = String(data[r][emailCol] || "").trim().toLowerCase();
        if (!email || email.indexOf("@") === -1) continue;
        map[email] = {
          program: p,
          sheetName: conf.sheetName,
          rowIndex: r + 1,
          statusCol: statusCol + 1,
          sentCol: sentCol + 1,
          status: String(data[r][statusCol] || ""),
        };
      }
    }
  } catch (e) {}
  return map;
}

function ensureGmailSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncGmailSentEmails") ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger("syncGmailSentEmails").timeBased().everyHours(1).create();
  return { success: true, message: "Gmail auto-sync every hour" };
}

function disableGmailSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncGmailSentEmails") ScriptApp.deleteTrigger(triggers[i]);
  }
  return { success: true, message: "Disabled" };
}
/* ============ NCM Part-1 sheet (master file + monthly trackers) ============ */

function getNcmMaster_() {
  try {
    var ss = SpreadsheetApp.openById(NCM_SHEET_ID);
    var sh = ss.getSheetByName("NCM Master File");
    if (!sh) return { success: false, message: "NCM Master File tab not found", rows: [] };
    var data = sh.getDataRange().getValues();
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;
      rows.push({
        row: i + 1,
        sl: str_(r[0]), memberId: str_(r[1]), name: str_(r[2]),
        phone: str_(r[4]), whatsapp: str_(r[5]),
        programEmail: str_(r[6]), silverEmail: str_(r[7]), medhaEmail: str_(r[8]),
        plan: str_(r[9]), tag: str_(r[10]),
        fbProfile: str_(r[11]), pageLink: str_(r[12]),
        paymentDate: fmt_(r[13]), paymentChannel: str_(r[14]),
        team: str_(r[15]), amount: str_(r[16]), paymentStatus: str_(r[17]),
        due: str_(r[18]),
        julySF: str_(r[19]), augSF: str_(r[20]), sepSF: str_(r[21]), octSF: str_(r[22])
      });
    }
    return { success: true, rows: rows, count: rows.length };
  } catch (e) {
    return { success: false, message: e.message, rows: [] };
  }
}

function getNcmTracker_(tab) {
  try {
    if (!tab) tab = NCM_TRACKER_TABS[0];
    var ss = SpreadsheetApp.openById(NCM_SHEET_ID);
    var sh = ss.getSheetByName(tab);
    if (!sh) return { success: false, message: "Tab not found: " + tab, rows: [] };
    var lastRow = sh.getLastRow();
    if (lastRow < NCM_FIRST_DATA_ROW) return { success: true, rows: [], tab: tab };
    var data = sh.getRange(NCM_FIRST_DATA_ROW, 1, lastRow - NCM_FIRST_DATA_ROW + 1, 25).getValues();
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;                       // no Member ID → skip
      // skip legend / note rows (Member ID without a digit, e.g. "Punctual")
      if (!/\d/.test(String(r[1]))) continue;
      var rec = { _row: NCM_FIRST_DATA_ROW + i };
      for (var c = 0; c < NCM_TRACKER_COLS.length; c++) {
        var spec = NCM_TRACKER_COLS[c];
        var v = r[spec.col - 1];
        rec[spec.key] = (v instanceof Date) ? fmt_(v) : (v === "" || v === null ? "" : String(v));
      }
      rows.push(rec);
    }
    return { success: true, rows: rows, tab: tab, count: rows.length };
  } catch (e) {
    return { success: false, message: e.message, rows: [] };
  }
}

/**
 * Write a single tracker cell.
 * payload: { tab, row (absolute sheet row), key, value }
 * Row/column are resolved from the sheet itself so the layout can change safely.
 */
function setNcmTrackerCell_(payload) {
  try {
    payload = payload || {};
    var tab = payload.tab || NCM_TRACKER_TABS[0];
    var row = parseInt(payload.row, 10);
    var key = String(payload.key || "");
    var value = payload.value;

    var spec = null;
    for (var i = 0; i < NCM_TRACKER_COLS.length; i++) {
      if (NCM_TRACKER_COLS[i].key === key) { spec = NCM_TRACKER_COLS[i]; break; }
    }
    if (!spec) return { success: false, message: "Unknown column key: " + key };
    if (spec.type === "ro" || spec.type === "auto") {
      return { success: false, message: "Column '" + spec.label + "' is calculated by the sheet and cannot be edited here." };
    }

    var ss = SpreadsheetApp.openById(NCM_SHEET_ID);
    var sh = ss.getSheetByName(tab);
    if (!sh) return { success: false, message: "Tab not found: " + tab };
    if (!row || row < NCM_FIRST_DATA_ROW) return { success: false, message: "Invalid row" };

    // Confirm the row really holds this member (safety)
    var memberId = String(sh.getRange(row, 2).getValue()).trim();
    if (!memberId) return { success: false, message: "Row " + row + " has no Member ID" };

    var cell = sh.getRange(row, spec.col);
    if (spec.type === "att") {
      var v = String(value || "").trim();
      if (v && ["Punctual", "Late", "Absent"].indexOf(v) === -1) {
        return { success: false, message: "Attendance must be Punctual, Late or Absent" };
      }
      cell.setValue(v);
    } else {
      if (value === "" || value === null || value === undefined) cell.setValue("");
      else {
        var num = Number(value);
        if (isNaN(num)) return { success: false, message: "Score must be a number" };
        cell.setValue(num);
      }
    }

    // Return the recalculated row so the UI can show the auto columns immediately
    var fresh = getNcmTracker_(tab);
    var updated = null;
    if (fresh.success) {
      for (var f = 0; f < fresh.rows.length; f++) {
        if (fresh.rows[f]._row === row) { updated = fresh.rows[f]; break; }
      }
    }
    return { success: true, row: row, key: key, value: value, memberId: memberId, updated: updated };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function str_(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return fmt_(v);
  return String(v).trim();
}

function fmt_(v) {
  if (!(v instanceof Date)) return String(v);
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(v, tz, "dd-MM-yyyy HH:mm:ss");
}

/* ============ Files (Google Drive) ============ */

var MPM_FILES_FOLDER = "MPM Files";

function getFilesFolder_() {
  var folders = DriveApp.getFoldersByName(MPM_FILES_FOLDER);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(MPM_FILES_FOLDER);
}

/** Metadata side-car so the portal knows the display name + original link */
function filesIndex_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("MPM_FILES_INDEX");
  try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}

function saveFilesIndex_(list) {
  PropertiesService.getScriptProperties().setProperty("MPM_FILES_INDEX", JSON.stringify(list));
}

function listFiles() {
  try {
    var folder = getFilesFolder_();
    var out = [];
    var index = filesIndex_();
    var byId = {};
    for (var i = 0; i < index.length; i++) byId[index[i].id] = index[i];

    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      var meta = byId[f.getId()] || {};
      out.push({
        id: f.getId(),
        name: meta.name || f.getName(),
        url: f.getUrl(),
        kind: meta.kind || "upload",
        size: f.getSize(),
        mime: f.getMimeType(),
        at: f.getLastUpdated ? f.getLastUpdated().getTime() : Date.now()
      });
    }
    // link-type entries (not real Drive files) come from the index
    for (var j = 0; j < index.length; j++) {
      if (index[j].kind === "link") {
        out.push({
          id: index[j].id,
          name: index[j].name,
          url: index[j].url,
          kind: "link",
          size: 0,
          mime: "",
          at: index[j].at || Date.now()
        });
      }
    }
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return { success: true, files: out };
  } catch (e) {
    return { success: false, message: e.message, files: [] };
  }
}

/** Add a link (or a file created from a Drive URL) */
function addFile(payload) {
  try {
    var file = (payload && payload.file) || {};
    var name = String(file.name || "Untitled").trim();
    var url = String(file.url || "").trim();
    var id = "link_" + Utilities.getUuid().replace(/-/g, "").substring(0, 10);
    var list = filesIndex_();
    list.unshift({ id: id, name: name, url: url, kind: "link", at: Date.now() });
    saveFilesIndex_(list);
    return { success: true, file: { id: id, name: name, url: url, kind: "link", size: 0, mime: "", at: Date.now() } };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** Upload a binary file into the MPM Files folder */
function uploadFile(payload) {
  try {
    var file = (payload && payload.file) || {};
    if (!file.base64) return { success: false, message: "No file data" };
    var folder = getFilesFolder_();
    var blob = Utilities.newBlob(
      Utilities.base64Decode(file.base64),
      file.mime || "application/octet-stream",
      file.name || "upload"
    );
    var created = folder.createFile(blob);
    var list = filesIndex_();
    list.push({ id: created.getId(), name: file.name || created.getName(), kind: "upload", at: Date.now() });
    saveFilesIndex_(list);
    return {
      success: true,
      file: {
        id: created.getId(),
        name: file.name || created.getName(),
        url: created.getUrl(),
        kind: "upload",
        size: created.getSize(),
        mime: created.getMimeType(),
        at: Date.now()
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** Rename / change the link of an existing entry */
function updateFile(payload) {
  try {
    var file = (payload && payload.file) || {};
    var list = filesIndex_();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === file.id) {
        if (file.name) list[i].name = String(file.name).trim();
        if (file.url !== undefined) list[i].url = String(file.url).trim();
        list[i].at = Date.now();
        found = true;
        break;
      }
    }
    if (!found) {
      // maybe it is a real Drive file not yet in the index
      try {
        var f = DriveApp.getFileById(file.id);
        if (file.name) f.setName(String(file.name).trim());
        list.push({ id: f.getId(), name: file.name || f.getName(), kind: "upload", at: Date.now() });
        found = true;
      } catch (e2) { /* not a Drive file */ }
    }
    saveFilesIndex_(list);
    if (!found) return { success: false, message: "File not found" };
    return { success: true, file: file };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** Move a file to trash (Drive) or remove the link (index) */
function deleteFile(payload) {
  try {
    var id = String((payload && payload.id) || "");
    if (!id) return { success: false, message: "Missing id" };
    var list = filesIndex_().filter(function (x) { return x.id !== id; });
    saveFilesIndex_(list);
    try {
      DriveApp.getFileById(id).setTrashed(true);
    } catch (e) { /* link-type entry, nothing to trash */ }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ============ Medha Support proxy (app.medha.pro) ============ */
/*
 * The support portal is a separate origin. Apps Script can talk to it with
 * UrlFetchApp and keep the session, so the portal can surface support data
 * inside MPM without any CORS pain.
 *
 * Run supportDiscover() once to find the exact login endpoint of the
 * deployment, then the rest works automatically.
 */

var SUPPORT_BASE = "https://app.medha.pro";
var SUPPORT_LOGIN_CANDIDATES = [
  "/api/auth/login",
  "/api/login",
  "/api/support/login",
  "/api/ops/support/login",
  "/api/ops/login",
  "/api/session",
  "/api/auth/signin",
  "/auth/login",
  "/login"
];

/** Ticket-list endpoints to probe once logged in */
var SUPPORT_TICKET_CANDIDATES = [
  "/api/ops/support/tickets",
  "/api/support/tickets",
  "/api/tickets",
  "/api/ops/tickets",
  "/api/support",
  "/api/ops/support",
  "/api/conversations",
  "/api/messages",
  "/api/inbox"
];

/** Field names the ticket payloads may use (so the UI can read any shape) */
var SUPPORT_TICKET_FIELDS = {
  id: ["id", "ticket_id", "ticketId", "code", "reference", "number"],
  subject: ["subject", "title", "message", "body", "text"],
  user: ["user", "user_email", "userEmail", "email", "customer", "requester", "created_by"],
  status: ["status", "state", "stage"],
  priority: ["priority", "urgency", "level"],
  type: ["type", "kind", "category", "channel"],
  age: ["age", "created_at", "createdAt", "created", "timestamp"],
  assignee: ["assignee", "assigned_to", "assignedTo", "agent", "owner"]
};

function supportProps_() {
  return PropertiesService.getScriptProperties();
}

function supportCred_() {
  var p = supportProps_();
  var raw = p.getProperty("SUPPORT_CRED");
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return { email: "howlaserahsan@gmail.com", password: "OTA@123456789" };
}

function saveSupportCred_(cred) {
  supportProps_().setProperty("SUPPORT_CRED", JSON.stringify(cred || {}));
}

/** Store the support login (called by the portal when the user saves it) */
function setSupportCredentials(payload) {
  try {
    var cred = (payload && payload.cred) || {};
    if (cred.email) saveSupportCred_({ email: String(cred.email), password: String(cred.password || "") });
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

/**
 * Try every likely login endpoint and report which one works.
 * Run this once from the Apps Script editor and read the logs / return value.
 */
function supportDiscover() {
  var cred = supportCred_();
  var results = [];
  for (var i = 0; i < SUPPORT_LOGIN_CANDIDATES.length; i++) {
    var path = SUPPORT_LOGIN_CANDIDATES[i];
    var body = JSON.stringify({ email: cred.email, password: cred.password });
    try {
      var res = UrlFetchApp.fetch(SUPPORT_BASE + path, {
        method: "post",
        contentType: "application/json",
        payload: body,
        muteHttpExceptions: true,
        followRedirects: true
      });
      var code = res.getResponseCode();
      var txt = String(res.getContentText() || "").slice(0, 300);
      var headers = res.getAllHeaders();
      var hasCookie = !!(headers["Set-Cookie"] || headers["set-cookie"]);
      var hasToken = /"?(token|access_token|jwt|session)"?\s*[:=]/i.test(txt);
      results.push({ path: path, status: code, hasCookie: hasCookie, hasToken: hasToken, sample: txt });
      if (code >= 200 && code < 400 && (hasCookie || hasToken)) {
        // store whichever credential the endpoint accepted
        if (hasCookie) {
          supportProps_().setProperty("SUPPORT_COOKIE", String(headers["Set-Cookie"] || headers["set-cookie"]));
          supportProps_().setProperty("SUPPORT_LOGIN_PATH", path);
          return { success: true, found: path, status: code, all: results };
        }
        var m = txt.match(/"?(token|access_token|jwt)"?\s*[:=]\s*"?([^",}]{8,})"?/i);
        if (m) {
          supportProps_().setProperty("SUPPORT_TOKEN", m[2]);
          supportProps_().setProperty("SUPPORT_LOGIN_PATH", path);
          return { success: true, found: path, status: code, all: results };
        }
      }
    } catch (e) {
      results.push({ path: path, error: String(e.message || e) });
    }
  }
  return { success: false, message: "No working login endpoint found — check the list", all: results };
}

/** Log in and remember the session (cookie or token) */
function supportLogin() {
  try {
    var p = supportProps_();
    var cred = supportCred_();
    var path = p.getProperty("SUPPORT_LOGIN_PATH") || SUPPORT_LOGIN_CANDIDATES[0];
    var res = UrlFetchApp.fetch(SUPPORT_BASE + path, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ email: cred.email, password: cred.password }),
      muteHttpExceptions: true,
      followRedirects: true
    });
    var headers = res.getAllHeaders();
    var cookie = String(headers["Set-Cookie"] || headers["set-cookie"] || "");
    if (cookie) p.setProperty("SUPPORT_COOKIE", cookie);
    var txt = String(res.getContentText() || "");
    var m = txt.match(/"?(token|access_token|jwt)"?\s*[:=]\s*"?([^",}]{8,})"?/i);
    if (m) p.setProperty("SUPPORT_TOKEN", m[2]);
    return { success: res.getResponseCode() < 400, status: res.getResponseCode(), hasCookie: !!cookie, sample: txt.slice(0, 200) };
  } catch (e) { return { success: false, message: e.message }; }
}

/**
 * Authenticated call into the support portal.
 * payload: { path, method, body }   path is relative to app.medha.pro
 */
function supportRequest(payload) {
  try {
    payload = payload || {};
    var p = supportProps_();
    var path = String(payload.path || "");
    if (!path) return { success: false, message: "Missing path" };
    if (path.charAt(0) !== "/") path = "/" + path;
    var method = String(payload.method || "get").toUpperCase();
    var headers = { "Accept": "application/json" };
    var cookie = p.getProperty("SUPPORT_COOKIE");
    var token = p.getProperty("SUPPORT_TOKEN");
    if (cookie) headers["Cookie"] = cookie;
    if (token) headers["Authorization"] = "Bearer " + token;
    var opts = { method: method, headers: headers, muteHttpExceptions: true, followRedirects: true };
    if (payload.body !== undefined && payload.body !== null && method !== "GET") {
      headers["Content-Type"] = "application/json";
      opts.payload = typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body);
    }
    var res = UrlFetchApp.fetch(SUPPORT_BASE + path, opts);
    var txt = String(res.getContentText() || "");
    var json = null;
    try { json = JSON.parse(txt); } catch (e) {}
    return { success: res.getResponseCode() < 400, status: res.getResponseCode(), data: json, raw: txt.slice(0, 2000) };
  } catch (e) { return { success: false, message: e.message }; }
}

/**
 * Once logged in, find the endpoint that lists support tickets.
 * Stores the working path so the portal can render tickets natively.
 */
function supportDiscoverTickets() {
  try {
    var p = supportProps_();
    var cookie = p.getProperty("SUPPORT_COOKIE");
    var token = p.getProperty("SUPPORT_TOKEN");
    if (!cookie && !token) return { success: false, message: "Not logged in yet — run supportLogin() first" };
    var results = [];
    for (var i = 0; i < SUPPORT_TICKET_CANDIDATES.length; i++) {
      var path = SUPPORT_TICKET_CANDIDATES[i];
      var headers = { "Accept": "application/json" };
      if (cookie) headers["Cookie"] = cookie;
      if (token) headers["Authorization"] = "Bearer " + token;
      try {
        var res = UrlFetchApp.fetch(SUPPORT_BASE + path, {
          method: "get", headers: headers, muteHttpExceptions: true, followRedirects: true
        });
        var txt = String(res.getContentText() || "");
        var json = null;
        try { json = JSON.parse(txt); } catch (e) {}
        var isArray = Array.isArray(json);
        var isWrapped = json && typeof json === "object" && !isArray &&
          Object.keys(json).some(function (k) { return Array.isArray(json[k]); });
        results.push({ path: path, status: res.getResponseCode(), isArray: isArray, isWrapped: isWrapped, sample: txt.slice(0, 160) });
        if (res.getResponseCode() < 400 && (isArray || isWrapped)) {
          p.setProperty("SUPPORT_TICKET_PATH", path);
          return { success: true, found: path, status: res.getResponseCode(), all: results };
        }
      } catch (e) {
        results.push({ path: path, error: String(e.message || e) });
      }
    }
    return { success: false, message: "No ticket endpoint found", all: results };
  } catch (e) { return { success: false, message: e.message }; }
}

/** Normalise a raw ticket payload into a flat list the UI understands */
function normaliseTickets_(raw) {
  var list = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    for (var k in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && Array.isArray(raw[k])) { list = raw[k]; break; }
    }
  }
  return list.map(function (t, i) {
    var out = { _i: i };
    for (var field in SUPPORT_TICKET_FIELDS) {
      var keys = SUPPORT_TICKET_FIELDS[field];
      out[field] = "";
      for (var j = 0; j < keys.length; j++) {
        var v = t[keys[j]];
        if (v === undefined || v === null) continue;
        if (typeof v === "object") {
          if (field === "user") {
            v = v.email || v.user_email || v.name || v.fullName || v.username || "";
            if (!v) continue;
          } else {
            v = v.name || v.title || v.label || "";
            if (!v) continue;
          }
        }
        if (field === "age" && typeof v === "number") {
          v = (v < 100000000000 ? new Date(v * 1000).toISOString() : new Date(v).toISOString());
        }
        out[field] = String(v);
        break;
      }
    }
    if (!out.id) out.id = "MD-" + String(100000 + i);
    return out;
  });
}

/**
 * One-shot: log in, find the ticket endpoint, return the tickets.
 * The portal calls this and renders a native support table.
 */
function supportConnect() {
  try {
    var login = supportLogin();
    if (!login.success) return { success: false, step: "login", message: "Login failed", detail: login };
    var disc = supportDiscoverTickets();
    if (!disc.success) return { success: false, step: "tickets", message: disc.message, detail: disc };
    var p = supportProps_();
    var path = p.getProperty("SUPPORT_TICKET_PATH");
    var res = supportRequest({ path: path, method: "get" });
    return {
      success: true,
      ticketPath: path,
      count: res.data ? normaliseTickets_(res.data).length : 0,
      tickets: res.data ? normaliseTickets_(res.data) : [],
      raw: res.raw ? String(res.raw).slice(0, 400) : ""
    };
  } catch (e) { return { success: false, message: e.message }; }
}

/** Health check — is the support portal reachable and are we logged in? */
function supportStatus() {
  try {
    var p = supportProps_();
    return {
      success: true,
      base: SUPPORT_BASE,
      loginPath: p.getProperty("SUPPORT_LOGIN_PATH") || "",
      hasCookie: !!p.getProperty("SUPPORT_COOKIE"),
      hasToken: !!p.getProperty("SUPPORT_TOKEN"),
      email: (supportCred_().email || "")
    };
  } catch (e) { return { success: false, message: e.message }; }
}

/* ============ Form registry (control any Google/HTML form) ============ */
/*
 * Every form gets its own set of keys in the Settings sheet:
 *   FORM_<ID>_NAME | FORM_<ID>_TYPE | FORM_<ID>_LINK | FORM_<ID>_OPEN
 *   FORM_<ID>_OPEN_FROM | FORM_<ID>_DEADLINE | FORM_<ID>_MSG_BN | FORM_<ID>_MSG_EN
 * The sheet stays the source of truth — the portal only reads and writes it.
 */

function formIds_(map) {
  var ids = {};
  for (var k in map) {
    var m = k.match(/^FORM_(.+)_NAME$/i);
    if (m) ids[m[1]] = true;
  }
  return Object.keys(ids);
}

function getFormSettings() {
  try {
    var map = getSettingsMap_();
    var ids = formIds_(map);
    if (!ids.length) {
      // seed one form so the panel is never empty
      ids = ["APP"];
      map["FORM_APP_NAME"] = "Application Form";
      map["FORM_APP_TYPE"] = "google";
      map["FORM_APP_OPEN"] = "NO";
      map["FORM_APP_MSG_EN"] = "The application period has ended.";
      map["FORM_APP_MSG_BN"] = "";
      saveSettingsMap_(map);
    }
    var forms = ids.map(function (id) {
      return {
        id: id,
        name: String(map["FORM_" + id + "_NAME"] || id),
        type: String(map["FORM_" + id + "_TYPE"] || "google"),
        link: String(map["FORM_" + id + "_LINK"] || ""),
        open: String(map["FORM_" + id + "_OPEN"] || "NO").toUpperCase() !== "NO",
        openFrom: String(map["FORM_" + id + "_OPEN_FROM"] || ""),
        deadline: String(map["FORM_" + id + "_DEADLINE"] || ""),
        msgBn: String(map["FORM_" + id + "_MSG_BN"] || ""),
        msgEn: String(map["FORM_" + id + "_MSG_EN"] || "")
      };
    });
    return { success: true, forms: forms };
  } catch (e) {
    return { success: false, message: e.message, forms: [] };
  }
}

/** Create / update / delete one form entry */
function saveFormSettings(payload) {
  try {
    payload = payload || {};
    var form = payload.form || {};
    var id = String(form.id || "").trim();
    if (!id) return { success: false, message: "Missing form id" };
    id = id.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase() || "FORM";
    var map = getSettingsMap_();
    var p = "FORM_" + id + "_";
    if (form.name !== undefined) map[p + "NAME"] = String(form.name);
    if (form.type !== undefined) map[p + "TYPE"] = String(form.type || "google");
    if (form.link !== undefined) map[p + "LINK"] = String(form.link || "");
    if (form.open !== undefined) map[p + "OPEN"] = form.open ? "YES" : "NO";
    if (form.openFrom !== undefined) map[p + "OPEN_FROM"] = String(form.openFrom || "");
    if (form.deadline !== undefined) map[p + "DEADLINE"] = String(form.deadline || "");
    if (form.msgBn !== undefined) map[p + "MSG_BN"] = String(form.msgBn || "");
    if (form.msgEn !== undefined) map[p + "MSG_EN"] = String(form.msgEn || "");
    saveSettingsMap_(map);
    return { success: true, status: getFormSettings() };
  } catch (e) { return { success: false, message: e.message }; }
}

function deleteFormSettings(payload) {
  try {
    var id = String((payload && payload.id) || "").trim();
    if (!id) return { success: false, message: "Missing id" };
    var map = getSettingsMap_();
    var p = "FORM_" + id + "_";
    ["NAME", "TYPE", "LINK", "OPEN", "OPEN_FROM", "DEADLINE", "MSG_BN", "MSG_EN"].forEach(function (k) {
      delete map[p + k];
    });
    saveSettingsMap_(map);
    return { success: true, status: getFormSettings() };
  } catch (e) { return { success: false, message: e.message }; }
}

function saveSettingsMap_(map) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sh) { sh = ss.insertSheet(CONFIG.SETTINGS_SHEET); sh.appendRow(["Key", "Value"]); }
  var data = sh.getDataRange().getValues();
  var rows = {};
  for (var i = 0; i < data.length; i++) {
    var k = String(data[i][0] || "").trim();
    if (k) rows[k] = i + 1;
  }
  for (var key in map) {
    if (rows[key]) sh.getRange(rows[key], 2).setValue(map[key]);
    else sh.appendRow([key, map[key]]);
  }
}

/** Public check — is this form open right now? (used by the Forms page) */
function getFormState(id) {
  try {
    var all = getFormSettings();
    if (!all.success) return { success: false, message: all.message };
    for (var i = 0; i < all.forms.length; i++) {
      if (all.forms[i].id === id) {
        var f = all.forms[i];
        var now = new Date();
        var open = f.open;
        if (f.openFrom) {
          var of = parseDeadlineDate_(f.openFrom);
          if (of && !isNaN(of.getTime()) && now < of) open = false;
        }
        if (f.deadline) {
          var dl = parseDeadlineDate_(f.deadline);
          if (dl && !isNaN(dl.getTime()) && now > dl) open = false;
        }
        return { success: true, form: f, open: open };
      }
    }
    return { success: false, message: "Form not found" };
  } catch (e) { return { success: false, message: e.message }; }
}

/** Parse "dd-MM-yyyy HH:mm" or "yyyy-MM-dd HH:mm" into a Date */
function parseDeadlineDate_(raw) {
  if (!raw) return null;
  var s = String(raw).trim();
  var m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ ,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1], +m1[4], +m1[5], +(m1[6] || 0));
  var m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], +(m2[6] || 0));
  var t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

/**
 * Can this URL be embedded in an iframe?
 * Reads X-Frame-Options / CSP frame-ancestors so the portal can tell the
 * operator exactly what to change on their server.
 */
function checkFrameable(payload) {
  try {
    payload = payload || {};
    var url = String(payload.url || "");
    if (!/^https?:\/\//i.test(url)) return { success: false, message: "Bad url" };
    var res = UrlFetchApp.fetch(url, { method: "get", muteHttpExceptions: true, followRedirects: true });
    var h = res.getAllHeaders();
    var xfo = String(h["X-Frame-Options"] || h["x-frame-options"] || "");
    var csp = String(h["Content-Security-Policy"] || h["content-security-policy"] || "");
    var frameAncestors = "";
    var cm = csp.match(/frame-ancestors([^;]*)/i);
    if (cm) frameAncestors = cm[1].trim();
    var blocked = false;
    var reason = "";
    if (xfo && !/sameorigin/i.test(xfo)) { blocked = true; reason = "X-Frame-Options: " + xfo; }
    if (frameAncestors && !/'self'/i.test(frameAncestors)) { blocked = true; reason = "CSP frame-ancestors: " + frameAncestors; }
    return {
      success: true,
      url: url,
      status: res.getResponseCode(),
      frameable: !blocked,
      reason: reason,
      xFrameOptions: xfo,
      cspFrameAncestors: frameAncestors,
      hint: blocked
        ? "Add 'Content-Security-Policy: frame-ancestors https://<this-site>' (or remove X-Frame-Options) on that server to allow embedding."
        : ""
    };
  } catch (e) {
    return { success: false, message: String(e.message || e) };
  }
}


/* ============ Agreements (participation agreement register) ============ */
/*
 * Lives in the Medha Program sheet as the "Agreements" tab.
 * Columns: SL | Member ID | Name | Batch | Status | Signed Date | Document Link | Notes
 *   Status -> dropdown: Pending / Signed / Declined / Not required
 */

var AGREEMENT_HEADERS = ["SL", "Member ID", "Name", "Batch", "Status", "Signed Date", "Document Link", "Notes"];
var AGREEMENT_STATUSES = ["Pending", "Signed", "Declined", "Not required"];

function setupAgreementsSheet_(ss) {
  var sh = ss.getSheetByName("Agreements");
  if (!sh) sh = ss.insertSheet("Agreements");
  var need = AGREEMENT_HEADERS.length;
  if (sh.getLastColumn() < need) sh.getRange(1, 1, 1, need).setValues([AGREEMENT_HEADERS]);
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, need).setValues([AGREEMENT_HEADERS]);
  sh.getRange(1, 1, 1, need).setFontWeight("bold").setBackground("#5b21b6").setFontColor("#ffffff");
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(AGREEMENT_STATUSES, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, 5, Math.max(sh.getLastRow(), 1) + 200, 1).setDataValidation(rule);
  sh.setFrozenRows(1);
  return sh;
}

function getAgreements() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName("Agreements");
    if (!sh) return { success: true, rows: [], exists: false, message: "Agreements tab not created yet" };
    var last = sh.getLastRow();
    if (last < 2) return { success: true, rows: [], exists: true };
    var data = sh.getRange(2, 1, last - 1, AGREEMENT_HEADERS.length).getValues();
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (!r[1] && !r[2]) continue;
      rows.push({
        row: i + 2,
        sl: str_(r[0]),
        memberId: str_(r[1]),
        name: str_(r[2]),
        batch: str_(r[3]),
        status: str_(r[4]),
        signedDate: fmt_(r[5]),
        link: str_(r[6]),
        notes: str_(r[7]),
        _row: i + 2
      });
    }
    return { success: true, rows: rows, exists: true, count: rows.length };
  } catch (e) {
    return { success: false, message: e.message, rows: [] };
  }
}

/** Insert or update one agreement row */
function upsertAgreement(payload) {
  try {
    payload = payload || {};
    var f = payload.form || {};
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = setupAgreementsSheet_(ss);
    var last = sh.getLastRow();
    var targetRow = parseInt(payload.row, 10);

    // find an existing row with the same Member ID (when not editing a known row)
    if (!targetRow && f.memberId) {
      var data = sh.getRange(2, 1, Math.max(last - 1, 0), AGREEMENT_HEADERS.length).getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][1]).trim() === String(f.memberId).trim()) { targetRow = i + 2; break; }
      }
    }

    var values = [
      f.sl || "",
      String(f.memberId || "").trim(),
      String(f.name || "").trim(),
      String(f.batch || "").trim(),
      String(f.status || "Pending").trim(),
      f.signedDate || "",
      String(f.link || "").trim(),
      String(f.notes || "").trim()
    ];

    if (targetRow) {
      sh.getRange(targetRow, 1, 1, AGREEMENT_HEADERS.length).setValues([values]);
    } else {
      values[0] = sh.getLastRow();               // auto SL
      sh.appendRow(values);
      targetRow = sh.getLastRow();
    }
    return { success: true, row: targetRow, status: getAgreements() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteAgreement(payload) {
  try {
    var row = parseInt((payload || {}).row, 10);
    if (!row || row < 2) return { success: false, message: "Invalid row" };
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName("Agreements");
    if (!sh) return { success: false, message: "Agreements tab not found" };
    sh.deleteRow(row);
    return { success: true, status: getAgreements() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** Create a Pending agreement row for every member that has none */
function seedAgreements(payload) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = setupAgreementsSheet_(ss);
    var existing = {};
    var last = sh.getLastRow();
    if (last >= 2) {
      var cur = sh.getRange(2, 2, last - 1, 2).getValues();
      for (var i = 0; i < cur.length; i++) {
        if (cur[i][0]) existing[String(cur[i][0]).trim()] = true;
      }
    }
    var members = [];
    var p1 = ss.getSheetByName("Members NCM-P1");
    var p2 = ss.getSheetByName("Members NCM-P2");
    [["NCM PART-1", p1], ["NCM PART-2", p2]].forEach(function (pair) {
      if (!pair[1]) return;
      var d = pair[1].getDataRange().getValues();
      for (var r = 1; r < d.length; r++) {
        var id = String(d[r][1] || "").trim();
        var em = String(d[r][3] || "").trim();
        if (!id || em.indexOf("@") === -1) continue;
        if (/example/i.test(id)) continue;
        members.push([id, String(d[r][2] || "").trim(), pair[0]]);
      }
    });
    var added = 0;
    for (var m = 0; m < members.length; m++) {
      if (existing[members[m][0]]) continue;
      sh.appendRow(["", members[m][0], members[m][1], members[m][2], "Pending", "", "", ""]);
      added++;
    }
    // renumber SL
    var n = sh.getLastRow();
    if (n >= 2) {
      var nums = [];
      for (var q = 2; q <= n; q++) nums.push([q - 1]);
      sh.getRange(2, 1, nums.length, 1).setValues(nums);
    }
    return { success: true, added: added, status: getAgreements() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ============ Results: Google Docs + email ============ */
/* Mirrors the NCM Result Card layout: OTA logo, navy/orange headings,
   Member Information table, Performance Status table, Authority Remarks. */

var RESULTS_HEADERS = ["Month", "Member ID", "Name", "Total", "Grade", "Method", "Generated At"];
var RC_NAVY = "#1d3a8a";
var RC_ORANGE = "#ff6a34";
var RC_GOLD = "#b8862f";
var RC_GREY = "#6b6f7a";
var RC_CREAM = "#faf3e8";

/**
 * The result-card logo lives in Drive so Apps Script can embed it.
 * Run uploadResultAssets() once — it stores both images in the MPM Files folder.
 */
function rcLogoBlob_() {
  var files = DriveApp.getFilesByName("ota-logo-wide.png");
  if (files.hasNext()) return files.next().getBlob();
  return null;
}

function rcFbBlob_() {
  var files = DriveApp.getFilesByName("facebook-icon.png");
  if (files.hasNext()) return files.next().getBlob();
  return null;
}

/** One-time: put the result-card logo + facebook icon into Drive so the
 *  Google Doc generator can embed them. */
function uploadResultAssets() {
  try {
    var folder = getFilesFolder_();
    var names = ["ota-logo-wide.png", "facebook-icon.png"];
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var existing = DriveApp.getFilesByName(names[i]);
      if (existing.hasNext()) { out.push(existing.next().getUrl() + " (already there)"); continue; }
      // pull the image from the public site and store it
      var res = UrlFetchApp.fetch("https://2o71oxcley2n3.space.minimax.io/assets/img/" + names[i], { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        var blob = res.getBlob().setName(names[i]);
        folder.createFile(blob);
        out.push(names[i] + " uploaded");
      } else {
        out.push(names[i] + " FAILED (HTTP " + res.getResponseCode() + ")");
      }
    }
    return { success: true, message: out.join(" · ") };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** Look up email / phone / facebook from the NCM Master File */
function rcMemberMeta_(memberId) {
  try {
    var ss = SpreadsheetApp.openById(NCM_SHEET_ID);
    var sh = ss.getSheetByName("NCM Master File");
    if (!sh) return {};
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1] || "").trim() === String(memberId || "").trim()) {
        return {
          email: str_(data[i][6]),
          phone: str_(data[i][4]),
          fbProfile: str_(data[i][11])
        };
      }
    }
  } catch (e) {}
  return {};
}

function rcFill_(template, m) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (mm, key) {
    var v = m[key];
    return (v === undefined || v === null) ? "" : String(v);
  });
}

function rcBuildDoc_(m, monthLabel, template) {
  var doc = DocumentApp.create("NCM Result Card - " + (m.name || m.memberId || "") + " - " + monthLabel);
  var b = doc.getBody();
  var meta = m.meta || rcMemberMeta_(m.memberId);

  var logo = rcLogoBlob_();
  if (logo) {
    var img = b.appendParagraph().appendInlineImage(logo).asInlineImage();
    try { img.setWidth(460).setHeight(115); } catch (e) {}
  }
  b.appendParagraph("NEXT CHAPTER MASTERMIND").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  b.appendParagraph("❖");
  b.appendParagraph("MONTHLY RESULT CARD").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph((m.evalMonth || monthLabel || "") + " — Evaluation Period");
  b.appendParagraph("");
  b.appendParagraph("MEMBER INFORMATION").setHeading(DocumentApp.ParagraphHeading.HEADING2);

  var infoRows = [
    ["Member Name", m.name || "—"],
    ["Member ID", m.memberId || "—"],
    ["Email", m.email || meta.email || "—"],
    ["Mobile No.", meta.phone || "—"],
    ["Evaluation Month", m.evalMonth || monthLabel || ""],
    ["Score", (m.total || 0) + "/100"],
    ["Grade", m.grade || "—"]
  ];
  if (meta.fbProfile) infoRows.push(["Facebook Profile", meta.fbProfile]);
  for (var i = 0; i < infoRows.length; i++) {
    b.appendParagraph(infoRows[i][0] + ":  " + infoRows[i][1]);
  }

  b.appendParagraph("");
  b.appendParagraph("PERFORMANCE STATUS").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var g = function (v) { return (v === "" || v === null || v === undefined) ? "" : String(v); };
  var sum = function (x, y) {
    var a = parseFloat(x), c = parseFloat(y);
    if (isNaN(a) && isNaN(c)) return "";
    return (isNaN(a) ? 0 : a) + (isNaN(c) ? 0 : c);
  };
  var perf = [
    ["Attendance & Assignment", sum(g(m.attendance10), g(m.assignment20)), "30"],
    ["Workshop", g(m.workshop20), "20"],
    ["Email & Feedback", g(m.emailFeedback5), "5"],
    ["Monthly Exam", g(m.monthlyExam30), "30"],
    ["Professionalism & Payment Completeness", sum(g(m.professional10), g(m.paymentCompliance5)), "15"]
  ];
  for (var p = 0; p < perf.length; p++) {
    b.appendParagraph(perf[p][0] + "  |  " + perf[p][1] + "  |  " + perf[p][2]);
  }

  b.appendParagraph("");
  b.appendParagraph("AUTHORITY REMARKS").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph(m.resultCard || m.remarks || "—");
  b.appendParagraph("");
  b.appendParagraph("Sirajul Islam Jony").setHeading(DocumentApp.ParagraphHeading.HEADING3);
  b.appendParagraph("Project Manager");
  b.appendParagraph("Online Tech Academy");
  doc.saveAndClose();
  return doc;
}

/** Create one Google Doc per member with their result card */
function generateResultDocs(payload) {
  try {
    payload = payload || {};
    var members = payload.members || [];
    var month = payload.label || payload.month || payload.tab || "";
    var template = payload.template || "";
    if (!members.length) return { success: false, message: "No members selected" };

    var urls = [], made = 0;
    for (var i = 0; i < members.length; i++) {
      try {
        var doc = rcBuildDoc_(members[i], month, template);
        urls.push(doc.getUrl());
        made++;
      } catch (e) { /* skip */ }
    }
    try { appendResultsRows_(month, members, "Google Docs"); } catch (e2) {}
    return { success: made > 0, count: made, urls: urls, message: made + " Google Doc(s) created" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** Email each member their result card */
function emailResults(payload) {
  try {
    payload = payload || {};
    var members = payload.members || [];
    var month = payload.label || payload.month || payload.tab || "";
    var template = payload.template || "";
    var subject = payload.subject || ("Your " + month + " Result Card — Medha Program Management");
    var intro = payload.body || "Please find your result card below.";
    if (!members.length) return { success: false, message: "No members selected" };

    var sent = 0, failed = 0;
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      try {
        var meta = m.meta || rcMemberMeta_(m.memberId);
        var doc = rcBuildDoc_(m, month, template);
        var to = m.email || meta.email || "";
        if (!to) { failed++; continue; }
        GmailApp.sendEmail(to, subject, intro + "\n\n" + doc.getUrl() + "\n\nBest regards,\nMedha Program Management",
          { name: "Medha Program Management" });
        sent++;
      } catch (e) { failed++; }
    }
    try { appendResultsRows_(month, members, "Email"); } catch (e2) {}
    return { success: sent > 0, count: sent, failed: failed, message: sent + " email(s) sent" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function appendResultsRows_(month, members, method) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName("Results");
    if (!sh) {
      sh = ss.insertSheet("Results");
      sh.appendRow(RESULTS_HEADERS);
      sh.getRange(1, 1, 1, RESULTS_HEADERS.length).setFontWeight("bold").setBackground("#5b21b6").setFontColor("#ffffff");
    }
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss");
    for (var i = 0; i < members.length; i++) {
      sh.appendRow([month, members[i].memberId || "", members[i].name || "", members[i].total || 0, members[i].grade || "", method, now]);
    }
    sh.setFrozenRows(1);
  } catch (e) {}
}

/** Previously generated results */
function getResults() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName("Results");
    if (!sh || sh.getLastRow() < 2) return { success: true, rows: [] };
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, RESULTS_HEADERS.length).getValues();
    var rows = [];
    var byMonth = {};
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var m = str_(r[0]);
      if (!byMonth[m]) byMonth[m] = { month: m, count: 0, how: str_(r[5]), at: 0 };
      byMonth[m].count++;
      var t = r[6] instanceof Date ? r[6].getTime() : 0;
      if (t > byMonth[m].at) byMonth[m].at = t;
    }
    for (var k in byMonth) rows.push(byMonth[k]);
    rows.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return { success: true, rows: rows };
  } catch (e) {
    return { success: false, message: e.message, rows: [] };
  }
}
