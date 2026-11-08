/* === Medha Program Management — API layer === */
/* Reads from Google Sheets via CSV (read-only) and optionally from
   Apps Script Web App (full functionality: mail, write, etc.) */

const SHEET_ID = "1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII";
const SHEET_TABS = ["Members NCM-P1", "Members NCM-P2"];

/* Second sheet — NCM Part 1 current tracker (separate spreadsheet) */
const NCM_SHEET_ID = "1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE";
const NCM_TABS = {
  master: "NCM Master File",
  trackers: ["October Tracker", "September Tracker", "August Tracker", "July Tracker"],
};

/* Tracker column spec — mirrors physical columns A..Y of the NCM tracker sheet.
   type: ro = read-only | att = Punctual/Late/Absent dropdown | num = manual number
         auto = sheet formula (read-only display) */
const TRACKER_COLS = [
  { key: "sl",             label: "SL",                     type: "ro",   w: 54,  g: "identity" },
  { key: "memberId",       label: "Member ID",              type: "ro",   w: 130, g: "identity" },
  { key: "name",           label: "Name",                   type: "ro",   w: 190, g: "identity" },
  { key: "class1",         label: "Class 1",                type: "att",  w: 116, g: "attendance" },
  { key: "class2",         label: "Class 2",                type: "att",  w: 116, g: "attendance" },
  { key: "feedback1",      label: "Feedback 1",             type: "att",  w: 124, g: "attendance" },
  { key: "feedback2",      label: "Feedback 2",             type: "att",  w: 124, g: "attendance" },
  { key: "workshopAttendance", label: "Workshop Attendance", type: "att", w: 158, g: "activity" },
  { key: "workshopClass1", label: "Workshop Class 1",       type: "att",  w: 152, g: "activity" },
  { key: "examReview1",    label: "Exam & Review Class 1",  type: "att",  w: 162, g: "activity" },
  { key: "punctualCount",  label: "Punctual",               type: "auto", w: 104, g: "summary" },
  { key: "lateCount",      label: "Late",                   type: "auto", w: 84,  g: "summary" },
  { key: "absentCount",    label: "Absent",                 type: "auto", w: 92,  g: "summary" },
  { key: "attendancePct",  label: "Attendance %",           type: "auto", w: 132, g: "summary" },
  { key: "remarks",        label: "Remarks",                type: "auto", w: 110, g: "summary" },
  { key: "attendance10",   label: "Attendance (10)",        type: "auto", w: 142, g: "score" },
  { key: "assignment20",   label: "Assignment (20)",        type: "num",  w: 142, g: "score" },
  { key: "workshop20",     label: "Workshop (20)",          type: "num",  w: 140, g: "score" },
  { key: "emailFeedback5", label: "Email & Feedback (5)",   type: "num",  w: 152, g: "score" },
  { key: "monthlyExam30",  label: "Monthly Exam (30)",      type: "num",  w: 152, g: "score" },
  { key: "professional10", label: "Professional Beh. (10)", type: "num",  w: 168, g: "score" },
  { key: "paymentCompliance5", label: "Payment Compliance (5)", type: "num", w: 168, g: "score" },
  { key: "total100",       label: "Total (100)",            type: "auto", w: 120, g: "score" },
  { key: "grade",          label: "Grade",                  type: "auto", w: 92,  g: "score" },
  { key: "resultCard",     label: "Result Card Note",       type: "auto", w: 230, g: "score" },
];
const TRACKER_GROUPS = [
  { key: "identity",  label: "Member",                 span: 3 },
  { key: "attendance",label: "Class Attendance & Feedback", span: 4 },
  { key: "activity",  label: "Activity & Exam",         span: 3 },
  { key: "summary",   label: "Attendance Summary",      span: 5 },
  { key: "score",     label: "Score Summary (100 Marks)", span: 10 },
];

const Api = (() => {
  const cache = new Map();
  const CACHE_TTL = 3_000;  // 3s memory TTL — localStorage keeps last full snapshot

  const getConfig = () => {
    try {
      const raw = localStorage.getItem("mpm.config");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };
  const setConfig = (cfg) => localStorage.setItem("mpm.config", JSON.stringify(cfg));

  /* Factory default — every device uses this until an admin clears it in Settings */
  const DEFAULT_BACKEND_URL = "https://script.google.com/macros/s/AKfycbzi5PcsOkMRTmtZRFmy6-L6KkHWTfoQPQoeZ7rAx2pWrFyraayQq55UBjqCIRrG65yumQ/exec";

  /* undefined = not loaded yet; null = key missing in sheet; string = loaded (may be "") */
  let _sharedBackendUrl = undefined;

  const parseSettingsKv_ = (gvizData) => {
    const map = {};
    try {
      const table = (gvizData && gvizData.table) || {};
      const rows = table.rows || [];
      rows.forEach((r) => {
        const cells = (r && r.c) || [];
        const k = String((cells[0] && cells[0].v != null) ? cells[0].v : "").trim();
        const v = String((cells[1] && cells[1].v != null) ? cells[1].v : "").trim();
        if (k) map[k] = v;
      });
    } catch (e) {}
    return map;
  };

  /** Load shared backend URL from the Settings sheet (works without backend via gviz). */
  const loadSharedBackendUrl = async () => {
    try {
      const data = await readGviz(SHEET_ID, "Settings", 0, { timeout: 5000, retries: 1 });
      const map = parseSettingsKv_(data);
      if (Object.prototype.hasOwnProperty.call(map, "mpm.backendUrl")) {
        _sharedBackendUrl = String(map["mpm.backendUrl"] || "").trim();
      } else {
        _sharedBackendUrl = null; /* key not present yet → fall back to default */
      }
    } catch (e) {
      _sharedBackendUrl = null;
    }
    return getBackendUrl();
  };

  const getBackendUrl = () => {
    /* Sheet is source of truth once loaded (including empty = cleared for everyone) */
    if (_sharedBackendUrl !== undefined && _sharedBackendUrl !== null) {
      return _sharedBackendUrl;
    }
    const local = String((getConfig().backendUrl || "")).trim();
    if (local) return local;
    return DEFAULT_BACKEND_URL;
  };

  /* --- JSONP via Google Sheets gviz endpoint (cross-origin safe) --- */
  const jsonp = (tab) => readGviz(SHEET_ID, tab);

  /** Generic gviz JSONP reader for any (sheetId, tab) */
  const readGviz = (sheetId, tab, attempt = 0, opts = {}) => new Promise((resolve, reject) => {
    const TIMEOUT = opts.timeout || 6000;
    const RETRIES = opts.retries === undefined ? 1 : opts.retries;
    const cbName = "__mpm_jsonp_" + Math.random().toString(36).slice(2, 10);
    /* A tab id (gid) is used instead of a name whenever we have one:
       a wrong tab name makes Google return the FIRST tab of the sheet,
       which is how the wrong member list used to be loaded. */
    const tabKey = String(tab || "").trim();
    const sheetParam = /^\d+$/.test(tabKey)
      ? `gid=${encodeURIComponent(tabKey)}`
      : `sheet=${encodeURIComponent(tabKey)}`;
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${sheetParam}&tqx=out:json;responseHandler:${cbName}&cb=${Date.now()}`;
    const script = document.createElement("script");
    script.src = url;
    let settled = false;
    // Keep the global defined forever — Google may call the handler AFTER we
    // gave up (late script load). Deleting it would throw "is not defined".
    const neutralise = () => { window[cbName] = function () {}; };
    const dropScript = () => { if (script.parentNode) script.remove(); };

    window[cbName] = (data) => {
      if (settled) return;
      settled = true;
      dropScript();
      neutralise();
      resolve(data);
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      dropScript();
      neutralise();
      reject(new Error("Sheet fetch failed (" + tab + ")"));
    };
    document.head.appendChild(script);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      dropScript();
      neutralise();
      // one silent retry — transient Google/network hiccups are common
      if (attempt < RETRIES) {
        readGviz(sheetId, tab, attempt + 1, opts).then(resolve).catch(reject);
      } else {
        reject(new Error("Sheet fetch timed out (" + tab + ")"));
      }
    }, TIMEOUT);
  });

  const gvizRows = (data) => {
    if (!data || !data.table || !data.table.rows) return [];
    return data.table.rows.map(r => (r.c || []).map(c => (c && c.v != null ? c.v : "")));
  };

  /**
   * Bangladesh mobile numbers always start with 0.
   * The sheet stores them as plain numbers (1734806516), so the leading 0 is
   * missing. This normalises every form we might meet:
   *   "1734806516"        -> "01734806516"
   *   "+8801734806516"    -> "01734806516"
   *   "8801734806516"     -> "01734806516"
   *   "01734806516"       -> unchanged
   *   "1734806516.0"      -> "01734806516"  (numeric text cell)
   *   "—" / "n/a" / ""    -> unchanged
   */
  const bdPhone = (v) => {
    if (v == null || v === "") return "";
    /* gviz often returns phones as numbers (1784662254) */
    if (typeof v === "number" && isFinite(v)) v = Math.round(v);
    let s = String(v).trim();
    if (!s) return "";
    /* a numeric cell that was stored as text comes back as "1734806516.0" */
    if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
    const digits = s.replace(/\D/g, "");
    if (!digits) return s;                 // not a phone — leave it alone
    if (digits.startsWith("880") && digits.length > 10) return "0" + digits.slice(3);
    if (digits.startsWith("0")) return digits;
    return "0" + digits;
  };

  /** Google Sheets gviz returns date cells as "Date(2026,9,19,14,44,10)" */
  const parseSheetDate = (v) => {
    if (v == null) return "";
    if (v instanceof Date) return v;
    const s = String(v).trim();
    if (!s) return "";
    const m = s.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
    if (m) {
      const [, y, mo, d, h, mi, sec] = m;
      return new Date(+y, +mo, +d, +(h || 0), +(mi || 0), +(sec || 0));
    }
    const t = Date.parse(s);
    return isNaN(t) ? "" : new Date(t);
  };

  const gvizToMembers = (data, tab) => {
    if (!data || !data.table || !data.table.rows) return [];
    const rows = data.table.rows.map((row, idx) => {
      const c = row.c || [];
      const raw = (i) => (c[i] && c[i].v != null ? c[i].v : "");
      const str = (i) => String(raw(i) == null ? "" : raw(i)).trim();

      const sentRaw = raw(5);
      const sentVal = parseSheetDate(sentRaw);
      const pad = (n) => String(n).padStart(2, "0");
      const sentAt = sentVal instanceof Date
        ? `${pad(sentVal.getDate())}-${pad(sentVal.getMonth() + 1)}-${sentVal.getFullYear()} ${pad(sentVal.getHours())}:${pad(sentVal.getMinutes())}:${pad(sentVal.getSeconds())}`
        : str(5);

      return {
        sl: str(0),
        memberId: str(1),
        name: str(2),
        email: str(3),
        status: str(4),
        sentAt: sentAt,
        _row: idx + 1,
        _tab: tab,
        /* the "own mailbox" rows used to check that mail reached everybody */
        _example: /example/i.test(str(1)),
      };
    });

    /* keep the example rows aside — the mail portal shows them (first at the
       top, last at the bottom), every other page leaves them out */
    const all = rows.filter(m => m.email && m.email.indexOf("@") !== -1);
    const list = all.filter(m => !m._example);
    list._examples = all.filter(m => m._example);
    return list;
  };

  const fetchSheet = async (tab) => {
    const key = `sheet:${tab}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
    try {
      const data = await jsonp(tab);
      const out = gvizToMembers(data, tab);
      if (out && out.length) {
        cache.set(key, { v: out, t: Date.now() });
        return out;
      }
    } catch (e) {}
    if (tab === "Members NCM-P1") return P1_MASTER_MEMBERS;
    if (tab === "Members NCM-P2") return BATCH01_MASTER_MEMBERS;
    return [];
  };

  /* ================= Medha Batch-01 Master sheet (NCM PART-2 source) =================
     The NCM PART-2 list now comes from the "Medha Batch-01 Master" spreadsheet,
     which carries more members than the old "Members NCM-P2" tab. The tab name
     inside that spreadsheet is discovered automatically and the columns are read
     by their headers, so the layout does not have to be guessed.
  */
  const BATCH01_SHEET_ID = "1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw";
  /* The tabs of the Medha Batch-01 Master sheet, by their tab id.
     The ids are used because a tab name that does not exist makes Google
     quietly return the FIRST tab ("payment check") instead.
     "Master File" comes first — it is the one that holds the full list. */
  const BATCH01_TABS = [
    { gid: "2071651608", name: "Master File" },
    { gid: "738811071", name: "Master File (alt)" },
    { gid: "0", name: "payment check" },
    { gid: "851131585", name: "Call Data" },
    { gid: "1421796387", name: "Task Data" },
    { gid: "179477977", name: "13 Oct Attendance" },
    { gid: "1882812613", name: "13th Oct Task Data" },
    { gid: "682914187", name: "21st Oct Task Data" },
  ];

  const normLabel = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");

  /**
   * Find a column by header name.
   *   exactOnly — only a header that matches the name exactly (so "Status"
   *               never picks up "Payment Status")
   *   loose     — last-resort substring match
   */
  const pickCol = (cols, priority, loose, exactOnly) => {
    const safe = (c) => {
      const n = normLabel(c);
      /* Tran_id must never win the member-id column */
      if (n.indexOf("tran") !== -1 || n.indexOf("trx") !== -1) return false;
      return true;
    };
    for (const p of priority) {
      const i = cols.findIndex(c => safe(c) && normLabel(c) === p);
      if (i >= 0) return i;
    }
    if (exactOnly) return -1;
    for (const p of priority) {
      const i = cols.findIndex(c => safe(c) && normLabel(c).indexOf(p) !== -1);
      if (i >= 0) return i;
    }
    if (loose) {
      const i = cols.findIndex(c => safe(c) && loose.some(f => normLabel(c).indexOf(f) !== -1));
      if (i >= 0) return i;
    }
    return -1;
  };

  const COL = {
    /* "id" on its own is too risky — "Paid" contains it */
    id:    { priority: ["memberid", "membercode", "studentid", "id"] },
    name:  { priority: ["name", "membername", "fullname", "studentname"] },
    email: { priority: ["email", "programenrolledemail", "courseemail", "enrolledemail", "medhaaccessmail"], loose: ["mail"] },
    /* only an exact "Status" — "Payment Status" is a different thing */
    status:{ priority: ["status", "mailstatus", "mailstate"], exactOnly: true },
    sentAt:{ priority: ["sentat", "lastsent", "lastmail", "mailedat", "sentdate"] },
    phone: { priority: ["phone", "mobile", "contact"] },
    whatsapp: { priority: ["whatsapp", "whatsappnumber", "whatsappno"] },
    address: { priority: ["address", "addr", "location", "district"] },
    facebook: { priority: ["facebook", "facebookprofile", "fb", "fblink", "fbprofile"] },
    medhaEmail: { priority: ["medhaemail", "medha_email", "medhaaccessmail", "medhaloginemail", "medhaloginaccessemail", "medhamail"] },
    courseMail: { priority: ["coursemail", "course mail", "coursemailaddress"] },
    tranId: { priority: ["tranid", "transid", "transactionid", "trxid", "trid", "paymentid"] },
    plan:  { priority: ["plan", "package"] },
    team:  { priority: ["team", "teamcategory", "category", "group"] },
    payStatus: { priority: ["paymentstatus", "paymentstate"] },
    amount:{ priority: ["amount", "paidamount", "total"] },
    payDate: { priority: ["paymentdate", "paidon", "dateofpayment", "transactiondate", "paydate"] },
    payChannel: { priority: ["paymentchannel", "channel", "paymentmethod", "method"] },
  };

  /**
   * Read the member list out of a gviz payload by looking at the headers.
   * Returns null when the tab is clearly not a member list — that is how we
   * detect a wrong tab name (gviz silently falls back to the first tab).
   */
  const parseMembersByHeader = (data, tabLabel) => {
    if (!data || !data.table || !data.table.rows) return null;
    const cols = (data.table.cols || []).map(c => c.label || "");
    const idx = {};
    for (const k of Object.keys(COL)) idx[k] = pickCol(cols, COL[k].priority, COL[k].loose, COL[k].exactOnly);

    /* a member list must have a name — and either an id or an email.
       Some master sheets have no "Member ID" column at all; the id is then
       taken from the transaction id, or built from the row number. */
    if (idx.name < 0) return null;
    if (idx.id < 0 && idx.email < 0 && idx.tranId < 0) return null;

    const pad = (n) => String(n).padStart(2, "0");
    const fmtDate = (raw) => {
      const d = parseSheetDate(raw);
      if (d instanceof Date && !isNaN(d)) {
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${pad(d.getFullYear())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
      return raw == null ? "" : String(raw).trim();
    };

    const out = data.table.rows.map((row, i) => {
      const c = row.c || [];
      const raw = (n) => (n >= 0 && c[n] && c[n].v != null ? c[n].v : "");
      const str = (n) => String(raw(n) == null ? "" : raw(n)).trim();
      const tranId = idx.tranId >= 0 ? str(idx.tranId) : "";
      let memberId = idx.id >= 0 ? str(idx.id) : "";
      if (!memberId) {
        const n = String(i + 1);
        memberId = tranId || ("NCM-P2-" + (n.length < 2 ? "0" + n : n));
      }
      const m = {
        sl: str(0),
        memberId: memberId,
        name: str(idx.name),
        email: str(idx.email),
        status: str(idx.status),
        sentAt: idx.sentAt >= 0 ? fmtDate(raw(idx.sentAt)) : "",
        _row: i + 1,
        /* keep the old marker so every other part of the app keeps working */
        _tab: "Members NCM-P2",
        _src: tabLabel || "Batch-01 Master",
      };
      if (idx.phone >= 0) m.phone = bdPhone(raw(idx.phone));
      if (idx.whatsapp >= 0) m.whatsapp = bdPhone(raw(idx.whatsapp));
      if (idx.address >= 0) m.address = str(idx.address);
      if (idx.facebook >= 0) m.facebook = str(idx.facebook);
      if (idx.medhaEmail >= 0) m.medhaEmail = str(idx.medhaEmail);
      if (idx.courseMail >= 0) m.courseMail = str(idx.courseMail);
      if (tranId) m.tranId = tranId;
      if (idx.plan >= 0) m.plan = str(idx.plan);
      if (idx.team >= 0) m.team = str(idx.team);
      if (idx.payStatus >= 0) m.paymentStatus = str(idx.payStatus);
      if (idx.amount >= 0) m.amount = str(idx.amount);
      if (idx.payDate >= 0) m.paymentDate = str(idx.payDate);
      if (idx.payChannel >= 0) m.paymentChannel = str(idx.payChannel);
      return m;
    }).filter(m => m.name || m.email || m.memberId);

    if (!out.length) return null;
    return out;
  };

  /* The last known Batch-01 result. A successful read is used from then on;
     a failure is retried every couple of minutes (in case the sheet is
     shared later). */
  let batch01Cache = null;
  const BATCH01_RETRY_MS = 15_000;

  /**
   * Find the tab names of a spreadsheet.
   * gviz needs the tab name, and Google does not list them in an API, so we
   * read them from the published HTML view. If that is not available we fall
   * back to the well-known names.
   */
  /* Every tab of a sheet, with its id and name. The id is what we read. */
  const discoverTabs = async (sheetId) => {
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`, { mode: "cors" });
      if (!res.ok) return [];
      const html = await res.text();
      const out = [];
      const seen = {};
      const push = (nm, gid) => {
        gid = String(gid || "").trim();
        nm = String(nm || "").trim();
        if (!gid || seen[gid] || nm.length > 60) return;
        seen[gid] = 1;
        out.push({ gid, name: nm });
      };
      /* the sheet menu carries both: name: "…", gid: "…" */
      let m;
      const re1 = /name:\s*"([^"]{1,60})"[^{}]{0,400}?gid:\s*"(\d+)"/g;
      while ((m = re1.exec(html))) push(m[1], m[2]);
      /* <a href="#gid=0" ...>Tab name</a> */
      const re2 = /href="#gid=(\d+)"[^>]*>([^<]{1,60})</g;
      while ((m = re2.exec(html))) push(m[2], m[1]);
      /* <a ... gid="0" ...>Tab name</a> */
      const re3 = /gid="(\d+)"[^>]*>([^<]{1,60})</g;
      while ((m = re3.exec(html))) push(m[2], m[1]);
      return out;
    } catch (e) { return []; }
  };

  /**
   * Merge member rows that come from different tabs of the same spreadsheet.
   * Rows are matched on the member id, then on the email, then on the name —
   * so a profile tab and a payment tab combine into one record.
   */
  const mergeMemberRows = (rows) => {
    const byId = {}, byEmail = {}, byName = {};
    const out = [];
    for (const r of rows) {
      const key = String(r.memberId || "").toLowerCase();
      const mail = String(r.email || "").toLowerCase();
      const nm = String(r.name || "").toLowerCase().trim();
      let hit = (key && byId[key]) || (mail && byEmail[mail]) || (nm && byName[nm]);
      if (!hit) {
        hit = { ...r };
        out.push(hit);
      } else {
        for (const k of Object.keys(r)) {
          if (r[k] !== "" && r[k] != null && !(k in hit)) hit[k] = r[k];
          else if (r[k] !== "" && r[k] != null && !hit[k]) hit[k] = r[k];
        }
      }
      if (key) byId[key] = hit;
      if (mail) byEmail[mail] = hit;
      if (nm) byName[nm] = hit;
    }
    return out;
  };


  /** Public CSV export — reliable when gviz headers are blank */
  const fetchBatch01Csv = async () => {
    const gid = "2071651608";
    const url = `https://docs.google.com/spreadsheets/d/${BATCH01_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) throw new Error("CSV " + res.status);
      const text = await res.text();
      /* RFC-style CSV parse — keeps newlines inside quoted address cells */
      const parseCsv = (text) => {
        const rows = [];
        let row = [];
        let cur = "";
        let q = false;
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const next = text[i + 1];
          if (q) {
            if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
            if (ch === '"') { q = false; continue; }
            cur += ch;
            continue;
          }
          if (ch === '"') { q = true; continue; }
          if (ch === ",") { row.push(cur.trim()); cur = ""; continue; }
          if (ch === "\n" || (ch === "\r" && next === "\n") || ch === "\r") {
            if (ch === "\r" && next === "\n") i++;
            row.push(cur.trim());
            if (row.some(c => c)) rows.push(row);
            row = [];
            cur = "";
            continue;
          }
          cur += ch;
        }
        row.push(cur.trim());
        if (row.some(c => c)) rows.push(row);
        return rows;
      };
      const table = parseCsv(text);
      if (table.length < 2) throw new Error("CSV empty");
      const headers = table[0].map(h => String(h || "").replace(/^"|"$/g, "").trim());
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const hNorm = headers.map(norm);
      const find = (...keys) => {
        for (const k of keys) {
          const i = hNorm.indexOf(norm(k));
          if (i >= 0) return i;
        }
        for (const k of keys) {
          const i = hNorm.findIndex(h => h.includes(norm(k)));
          if (i >= 0) return i;
        }
        return -1;
      };
      const iName = find("name");
      const iEmail = find("email");
      const iCourse = find("coursemail", "course mail");
      const iPhone = find("phone", "mobile");
      const iWa = find("whatsapp", "whatsapp");
      const iAddr = find("address");
      const iFb = find("facebook", "fb");
      const iMedha = find("medhaemail", "medha_email", "medha email");
      const iTran = find("tranid", "tran_id", "transactionid");
      if (iName < 0 && iEmail < 0) throw new Error("CSV headers missing");
      const iId = find("memberid", "member id", "id");
      const rows = [];
      for (let r = 1; r < table.length; r++) {
        const cols = table[r].map(c => String(c || "").replace(/^"|"$/g, "").trim());
        const name = iName >= 0 ? cols[iName] || "" : "";
        const email = iEmail >= 0 ? cols[iEmail] || "" : "";
        if (!name && !email) continue;
        const n = String(r);
        const mid = (iId >= 0 && cols[iId]) ? cols[iId] : ("NCM-P2-" + (n.length < 2 ? "0" + n : n));
        rows.push({
          sl: cols[0] || String(r),
          memberId: mid,
          name, email,
          status: "", sentAt: "",
          phone: iPhone >= 0 ? bdPhone(cols[iPhone]) : "",
          whatsapp: iWa >= 0 ? bdPhone(cols[iWa]) : "",
          address: iAddr >= 0 ? (cols[iAddr] || "") : "",
          facebook: iFb >= 0 ? (cols[iFb] || "") : "",
          medhaEmail: iMedha >= 0 ? (cols[iMedha] || "") : "",
          courseMail: iCourse >= 0 ? (cols[iCourse] || "") : "",
          tranId: iTran >= 0 ? (cols[iTran] || "") : "",
          _row: r + 1,
          _tab: "Members NCM-P2",
          _src: "Master File CSV",
        });
      }
      return { ok: true, rows, tab: "Master File", tabs: ["Master File"], sheetId: BATCH01_SHEET_ID, at: Date.now() };
    } catch (e) {
      return { ok: true, rows: BATCH01_MASTER_MEMBERS, tab: "Master File", tabs: ["Master File"], sheetId: BATCH01_SHEET_ID, at: Date.now() };
    }
  };

  /** Find the right tab in the Batch-01 spreadsheet and read the list */
  const fetchBatch01 = async () => {
    const key = "sheet:batch01";
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL && hit.v && hit.v.ok && hit.v.rows && hit.v.rows.some(r => r.phone || r.address || r.medhaEmail)) {
      return hit.v;
    }

    /* Prefer gviz JSONP (CORS-safe). Primary tab: gid 2071651608 (full Member ID + phone/address). */
    const primaryGids = [
      { gid: "2071651608", name: "Master File" },
      { gid: "738811071", name: "Master File (alt)" },
    ];
    for (const tab of primaryGids) {
      try {
        const data = await readGviz(BATCH01_SHEET_ID, tab.gid, 0, { timeout: 8000, retries: 1 });
        const rows = parseMembersByHeader(data, tab.name);
        if (rows && rows.length && rows.some(r => r.phone || r.address || r.medhaEmail || r.memberId)) {
          const out = {
            ok: true, rows: mergeMemberRows(rows), tab: tab.name, tabs: [tab.name],
            sheetId: BATCH01_SHEET_ID, at: Date.now(),
          };
          batch01Cache = out;
          cache.set(key, { v: out, t: Date.now() });
          return out;
        }
      } catch (e) { /* try next */ }
    }

    /* CSV fallback (may fail in browser due to CORS) */
    const csvFirst = await fetchBatch01Csv();
    if (csvFirst.ok && csvFirst.rows && csvFirst.rows.length && csvFirst.rows.some(r => r.phone || r.address)) {
      batch01Cache = csvFirst;
      cache.set(key, { v: csvFirst, t: Date.now() });
      return csvFirst;
    }

    /* the known tabs first (Master File leads), then anything new */
    let tabs = BATCH01_TABS.slice();
    const discovered = await discoverTabs(BATCH01_SHEET_ID);
    for (const d of discovered) {
      if (!tabs.some(t => t.gid === d.gid)) tabs.push(d);
    }

    const collected = [];
    const seenTabs = [];
    for (const tab of tabs) {
      let data;
      try {
        data = await readGviz(BATCH01_SHEET_ID, tab.gid, 0, { timeout: 2500, retries: 0 });
      } catch (e) {
        /* the spreadsheet itself is not reachable (not shared / wrong id) —
           every tab will fail the same way, so stop here */
        const out = { ok: false, rows: null, error: e.message, at: Date.now() };
        batch01Cache = out;
        cache.set(key, { v: out, t: Date.now() });
        return out;
      }
      const rows = parseMembersByHeader(data, tab.name || "Batch-01 Master");
      if (!rows) continue;            // this tab is not a member list
      seenTabs.push(tab.name || tab.gid);
      collected.push(...rows);
    }

    if (collected.length) {
      const rows = mergeMemberRows(collected);
      const out = {
        ok: true, rows, tab: seenTabs[0] || "first tab", tabs: seenTabs,
        sheetId: BATCH01_SHEET_ID, at: Date.now(),
      };
      batch01Cache = out;
      cache.set(key, { v: out, t: Date.now() });
      return out;
    }
    /* gviz failed — public CSV of Master File (gid 738811071) */
    const csv = await fetchBatch01Csv();
    if (csv.ok && csv.rows && csv.rows.length) {
      batch01Cache = csv;
      cache.set(key, { v: csv, t: Date.now() });
      return csv;
    }
    const out = { ok: false, rows: null, error: (csv && csv.error) || "Member list not found in the spreadsheet", at: Date.now() };
    batch01Cache = out;
    cache.set(key, { v: out, t: Date.now() });
    return out;
  };

  /**
   * Merge the Batch-01 Master list into the P2 list.
   * The Master File has no "Member ID" column, so the two lists are matched
   * on the email address first, then on the name. The old member id and mail
   * status are kept, and the richer Master File details are added.
   * Members that exist only in the old tab are kept as well — nothing is lost.
   */
  const mergeBatch01 = (p2old, b01) => {
    if (!(b01 && b01.ok && b01.rows && b01.rows.length)) {
      return {
        p2: p2old,
        source: "Members NCM-P2",
        note: (b01 && b01.error) || "Batch-01 Master sheet is not reachable",
        fromBatch01: false,
      };
    }
    const byMail = {}, byName = {};
    for (const o of p2old) {
      if (o.email) byMail[String(o.email).toLowerCase()] = o;
      if (o.name) byName[String(o.name).toLowerCase().trim()] = o;
    }
    const used = new Set();
    const merged = [];
    for (const row of b01.rows) {
      const old = (row.email && byMail[String(row.email).toLowerCase()])
        || (row.name && byName[String(row.name).toLowerCase().trim()]);
      if (old) {
        if (old.memberId) row.memberId = old.memberId;
        if (!row.status && old.status) row.status = old.status;
        if (!row.sentAt && old.sentAt) row.sentAt = old.sentAt;
        used.add(String(old.memberId || "").toLowerCase());
        used.add(String(old.email || "").toLowerCase());
      }
      merged.push(row);
    }
    const extras = p2old.filter(m =>
      !used.has(String(m.memberId || "").toLowerCase())
      && !used.has(String(m.email || "").toLowerCase()));
    return {
      p2: [...merged, ...extras],
      source: b01.tab,
      note: extras.length ? extras.length + " member(s) come from the older tab" : "",
      fromBatch01: true,
    };
  };

  const buildMemberSet = (p1, p2, source, note, fromBatch01) => ({
    "NCM PART-1": p1,
    "NCM PART-2": p2,
    _all: [...p1, ...p2],
    /* the "own mailbox" rows — the mail portal shows them, nothing else does */
    _examples: {
      "NCM PART-1": (p1 && p1._examples) || [],
      "NCM PART-2": (p2 && p2._examples) || [],
    },
    _p2Source: source,
    _p2Note: note,
    _p2FromBatch01: !!fromBatch01,
  });

  const fetchAllMembers = async () => {
    try {
      const [p1, p2old, b01] = await Promise.all([
        fetchSheet("Members NCM-P1"),
        fetchSheet("Members NCM-P2"),
        fetchBatch01(),
      ]);
      /* NCM PART-2 profile fields always come from Batch-01 Master File (gid 738811071) */
      const m = mergeBatch01(p2old, b01);
      const out = buildMemberSet(p1, m.p2, m.source, m.note, m.fromBatch01);
      out._p2Pending = false;
      writeLocalCache(out);
      return out;
    } catch (err) {
      console.warn("Sheet fetch failed, using demo data:", err.message);
      const demo = demoDataset();
      writeLocalCache(demo);
      return demo;
    }
  };

  const demoDataset = () => {
    const demo = demoMembers();
    return {
      "NCM PART-1": demo.filter(m => m._tab === "Members NCM-P1"),
      "NCM PART-2": demo.filter(m => m._tab === "Members NCM-P2"),
      _all: demo,
      _demo: true,
    };
  };

  /** Background refresh — never blocks the UI, notifies the app when fresh data lands */
  const dataFingerprint = (data) => {
    try {
      const all = (data && data._all) || [];
      const parts = all.map(m =>
        [m.memberId, m.name, m.email, m.phone, m.whatsapp, m.address,
         m.status, m.sentAt, m.medhaEmail, m.courseMail, m.tranId,
         m.plan, m.team, m.facebook].join("|"));
      return String(all.length) + ":" + parts.join(";");
    } catch (e) { return String(Date.now()); }
  };

  let _lastFp = "";

  const backgroundRefresh = () => {
    if (backgroundRefresh._running) return;
    backgroundRefresh._running = true;
    const work = getBackendUrl()
      ? backendCall("getAllMembers")
          .then(r => (r && r.success) ? r.data : fetchAllMembers())
          .catch(() => fetchAllMembers())
      : fetchAllMembers();
    work.then(fresh => {
      backgroundRefresh._running = false;
      if (!fresh) return;
      try { writeLocalCache(fresh); } catch (e) {}
      const fp = dataFingerprint(fresh);
      if (fp !== _lastFp) {
        _lastFp = fp;
        try { if (typeof Api._freshCb === "function") Api._freshCb(fresh); } catch (e) {}
      }
    }).catch(() => { backgroundRefresh._running = false; });
  };

  /** Keep sheet → site in sync every 3s without page reload */
  const startAutoSync = (ms) => {
    const every = typeof ms === "number" ? ms : 3000;
    if (startAutoSync._timer) clearInterval(startAutoSync._timer);
    /* first tick soon, then steady 3s */
    setTimeout(() => { try { backgroundRefresh(); } catch (e) {} }, 1200);
    startAutoSync._timer = setInterval(() => {
      try { backgroundRefresh(); } catch (e) {}
    }, every);
  };
  const stopAutoSync = () => {
    if (startAutoSync._timer) clearInterval(startAutoSync._timer);
    startAutoSync._timer = null;
  };

  const P1_MASTER_MEMBERS = [
  {
    "sl": 1,
    "memberId": "NCM-01",
    "name": "Israt Jahan",
    "email": "isratjahan348065@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:11, 05:33:10 PM",
    "phone": "01770116673",
    "whatsapp": "01726825762",
    "address": "Dhaka",
    "courseMail": "isratjahan348065@gmail.com",
    "medhaEmail": "isratjahan348065@gmail.com",
    "tranId": "MD60-84BXGF",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 2,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 2,
    "memberId": "NCM-02",
    "name": "Omar shah",
    "email": "omarshah77@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:13, 05:33:10 PM",
    "phone": "01776541514",
    "whatsapp": "01776824171",
    "address": "Dhaka",
    "courseMail": "omarshah77@gmail.com",
    "medhaEmail": "omarshah77@gmail.com",
    "tranId": "MD60-OW58UZ",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 3,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 3,
    "memberId": "NCM-03",
    "name": "Redwan Safi",
    "email": "sherminahasan5@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:14, 05:33:10 PM",
    "phone": "01731240147",
    "whatsapp": "01730309973",
    "address": "Dhaka",
    "courseMail": "sherminahasan5@gmail.com",
    "medhaEmail": "sherminahasan5@gmail.com",
    "tranId": "MD60-HZ0ONT",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 4,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 4,
    "memberId": "NCM-04",
    "name": "Sk Mesbah",
    "email": "skmesbah30@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:15, 05:33:10 PM",
    "phone": "01737645689",
    "whatsapp": "01745515412",
    "address": "Dhaka",
    "courseMail": "skmesbah30@gmail.com",
    "medhaEmail": "skmesbah30@gmail.com",
    "tranId": "MD60-AEJ3XT",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 5,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 5,
    "memberId": "NCM-05",
    "name": "MD Tawhid Islam",
    "email": "tawid466@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:20, 05:33:10 PM",
    "phone": "01746225102",
    "whatsapp": "01747925601",
    "address": "Dhaka",
    "courseMail": "tawid466@gmail.com",
    "medhaEmail": "tawid466@gmail.com",
    "tranId": "MD60-MJOK6Z",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 6,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 6,
    "memberId": "NCM-06",
    "name": "Mokter Hossain",
    "email": "moktarsafiz@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:21, 05:33:10 PM",
    "phone": "01771978978",
    "whatsapp": "01799982146",
    "address": "Dhaka",
    "courseMail": "moktarsafiz@gmail.com",
    "medhaEmail": "moktarsafiz@gmail.com",
    "tranId": "MD60-YW7TLB",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 7,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 7,
    "memberId": "NCM-07",
    "name": "Fuad Hasan",
    "email": "mfdhasan@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:22, 05:33:10 PM",
    "phone": "01771239956",
    "whatsapp": "01762076619",
    "address": "Dhaka",
    "courseMail": "mfdhasan@gmail.com",
    "medhaEmail": "mfdhasan@gmail.com",
    "tranId": "MD60-C0FMDY",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 8,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 8,
    "memberId": "NCM-08",
    "name": "Billal hossain",
    "email": "billalbsdk22@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:23, 05:33:10 PM",
    "phone": "01787826162",
    "whatsapp": "01744078859",
    "address": "Dhaka",
    "courseMail": "billalbsdk22@gmail.com",
    "medhaEmail": "billalbsdk22@gmail.com",
    "tranId": "MD60-0EUWVA",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 9,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 9,
    "memberId": "NCM-09",
    "name": "Md Lutfor Rahman",
    "email": "lutfor88518@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:25, 05:33:10 PM",
    "phone": "01716784888",
    "whatsapp": "01773407513",
    "address": "Dhaka",
    "courseMail": "lutfor88518@gmail.com",
    "medhaEmail": "lutfor88518@gmail.com",
    "tranId": "MD60-XPYFJ4",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 10,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 10,
    "memberId": "NCM-10",
    "name": "Md Musa mia",
    "email": "mdmusamiabd@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:30, 05:33:10 PM",
    "phone": "01760987492",
    "whatsapp": "01732643243",
    "address": "Dhaka",
    "courseMail": "mdmusamiabd@gmail.com",
    "medhaEmail": "mdmusamiabd@gmail.com",
    "tranId": "MD60-MK560R",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 11,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 11,
    "memberId": "NCM-11",
    "name": "Abu Sufiyan",
    "email": "ahmedsufiyan521@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:31, 05:33:10 PM",
    "phone": "01760856672",
    "whatsapp": "01744793135",
    "address": "Dhaka",
    "courseMail": "ahmedsufiyan521@gmail.com",
    "medhaEmail": "ahmedsufiyan521@gmail.com",
    "tranId": "MD60-8QK8YQ",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 12,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 12,
    "memberId": "NCM-12",
    "name": "Nasir Ahmed",
    "email": "nasirlabib10@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:33, 05:33:10 PM",
    "phone": "01797645767",
    "whatsapp": "01744099702",
    "address": "Dhaka",
    "courseMail": "nasirlabib10@gmail.com",
    "medhaEmail": "nasirlabib10@gmail.com",
    "tranId": "MD60-3ZDQHM",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 13,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 13,
    "memberId": "NCM-13",
    "name": "Asiful Islam Chowdhury Fahim",
    "email": "fahimasiful@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:34, 05:33:10 PM",
    "phone": "01728450006",
    "whatsapp": "01714564005",
    "address": "Dhaka",
    "courseMail": "fahimasiful@gmail.com",
    "medhaEmail": "fahimasiful@gmail.com",
    "tranId": "MD60-5TUA57",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 14,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 14,
    "memberId": "NCM-14",
    "name": "Kamrun Naher Ripa",
    "email": "ripakamrun46259@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-29 17:33:12, 05:33:10 PM",
    "phone": "01792680002",
    "whatsapp": "01793108366",
    "address": "Dhaka",
    "courseMail": "ripakamrun46259@gmail.com",
    "medhaEmail": "ripakamrun46259@gmail.com",
    "tranId": "MD60-ONNCMR",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 15,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 15,
    "memberId": "NCM-15",
    "name": "Md Abdul Mannan",
    "email": "mannan2627@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:42, 05:33:10 PM",
    "phone": "01740428589",
    "whatsapp": "01738977348",
    "address": "Dhaka",
    "courseMail": "mannan2627@gmail.com",
    "medhaEmail": "mannan2627@gmail.com",
    "tranId": "MD60-6T84AL",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 16,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 16,
    "memberId": "NCM-16",
    "name": "Emran",
    "email": "emranhosse295@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:48, 05:33:10 PM",
    "phone": "01756096571",
    "whatsapp": "01755142545",
    "address": "Dhaka",
    "courseMail": "emranhosse295@gmail.com",
    "medhaEmail": "emranhosse295@gmail.com",
    "tranId": "MD60-2I78NW",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 17,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 17,
    "memberId": "NCM-17",
    "name": "Md. Abdul Hannan",
    "email": "hannan1979od@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:50, 05:33:10 PM",
    "phone": "01795956134",
    "whatsapp": "01784447342",
    "address": "Dhaka",
    "courseMail": "hannan1979od@gmail.com",
    "medhaEmail": "hannan1979od@gmail.com",
    "tranId": "MD60-C1ZZH8",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 18,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 18,
    "memberId": "NCM-18",
    "name": "Abdul Kayum Billah",
    "email": "kayumbillah@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:51, 05:33:10 PM",
    "phone": "01766961248",
    "whatsapp": "01771333465",
    "address": "Dhaka",
    "courseMail": "kayumbillah@gmail.com",
    "medhaEmail": "kayumbillah@gmail.com",
    "tranId": "MD60-SCSTHK",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 19,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 19,
    "memberId": "NCM-19",
    "name": "Md Safuan Ahmed",
    "email": "mdsafuan473@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:52, 05:33:10 PM",
    "phone": "01767398894",
    "whatsapp": "01743911802",
    "address": "Dhaka",
    "courseMail": "mdsafuan473@gmail.com",
    "medhaEmail": "mdsafuan473@gmail.com",
    "tranId": "MD60-FOG3LP",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 20,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 20,
    "memberId": "NCM-20",
    "name": "Md Mahbubur Rahman",
    "email": "mahbub.tail@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:57, 05:33:10 PM",
    "phone": "01757968481",
    "whatsapp": "01753853533",
    "address": "Dhaka",
    "courseMail": "mahbub.tail@gmail.com",
    "medhaEmail": "mahbub.tail@gmail.com",
    "tranId": "MD60-XTZUDR",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 21,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 21,
    "memberId": "NCM-21",
    "name": "Md Shuhanur Rahman",
    "email": "shuhanrahman969@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:14:59, 05:33:10 PM",
    "phone": "01743196433",
    "whatsapp": "01710841051",
    "address": "Dhaka",
    "courseMail": "shuhanrahman969@gmail.com",
    "medhaEmail": "shuhanrahman969@gmail.com",
    "tranId": "MD60-FAG4N6",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 22,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 22,
    "memberId": "NCM-22",
    "name": "Sonia Akter",
    "email": "soniaakter5420@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:00, 05:33:10 PM",
    "phone": "01740336590",
    "whatsapp": "01735019367",
    "address": "Dhaka",
    "courseMail": "soniaakter5420@gmail.com",
    "medhaEmail": "soniaakter5420@gmail.com",
    "tranId": "MD60-IU8ZXE",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 23,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 23,
    "memberId": "NCM-23",
    "name": "Md: Abdullah Al Mahmud somrat",
    "email": "mahmudsomrat90@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:01, 05:33:10 PM",
    "phone": "01798805614",
    "whatsapp": "01797630949",
    "address": "Dhaka",
    "courseMail": "mahmudsomrat90@gmail.com",
    "medhaEmail": "mahmudsomrat90@gmail.com",
    "tranId": "MD60-WKPBCM",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 24,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 24,
    "memberId": "NCM-24",
    "name": "Md. Ohidul Islam",
    "email": "md.ohidulll567@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:03, 05:33:10 PM",
    "phone": "01750222593",
    "whatsapp": "01732189278",
    "address": "Dhaka",
    "courseMail": "md.ohidulll567@gmail.com",
    "medhaEmail": "md.ohidulll567@gmail.com",
    "tranId": "MD60-TRLK3Z",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 25,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 25,
    "memberId": "NCM-25",
    "name": "Syful Reja",
    "email": "syfulrejabd@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:08, 05:33:10 PM",
    "phone": "01726090622",
    "whatsapp": "01766513193",
    "address": "Dhaka",
    "courseMail": "syfulrejabd@gmail.com",
    "medhaEmail": "syfulrejabd@gmail.com",
    "tranId": "MD60-6T3372",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 26,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 26,
    "memberId": "NCM-26",
    "name": "Md Selim Bhuiyan",
    "email": "bhuiyanselim99@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:10, 05:33:10 PM",
    "phone": "01730735070",
    "whatsapp": "01764828853",
    "address": "Dhaka",
    "courseMail": "bhuiyanselim99@gmail.com",
    "medhaEmail": "bhuiyanselim99@gmail.com",
    "tranId": "MD60-29PSL3",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 27,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 27,
    "memberId": "NCM-27",
    "name": "S M AL MAHMUD",
    "email": "almahmud009@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:11, 05:33:10 PM",
    "phone": "01761701500",
    "whatsapp": "01764070899",
    "address": "Dhaka",
    "courseMail": "almahmud009@gmail.com",
    "medhaEmail": "almahmud009@gmail.com",
    "tranId": "MD60-R3XA3E",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 28,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 28,
    "memberId": "NCM-28",
    "name": "Zinat Sultana",
    "email": "zinatsultana.ctg@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:13, 05:33:10 PM",
    "phone": "01744694322",
    "whatsapp": "01787989448",
    "address": "Dhaka",
    "courseMail": "zinatsultana.ctg@gmail.com",
    "medhaEmail": "zinatsultana.ctg@gmail.com",
    "tranId": "MD60-1X8L5B",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 29,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 29,
    "memberId": "NCM-29",
    "name": "MD Jobayer Ahmad Toha",
    "email": "mdjobayerahmadthoha@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:14, 05:33:10 PM",
    "phone": "01743456057",
    "whatsapp": "01725649976",
    "address": "Dhaka",
    "courseMail": "mdjobayerahmadthoha@gmail.com",
    "medhaEmail": "mdjobayerahmadthoha@gmail.com",
    "tranId": "MD60-573GYA",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 30,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 30,
    "memberId": "NCM-30",
    "name": "Abdul Hannan",
    "email": "hannan.dpdc967@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:19, 05:33:10 PM",
    "phone": "01770834942",
    "whatsapp": "01768586345",
    "address": "Dhaka",
    "courseMail": "hannan.dpdc967@gmail.com",
    "medhaEmail": "hannan.dpdc967@gmail.com",
    "tranId": "MD60-HE6YET",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 31,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 31,
    "memberId": "NCM-31",
    "name": "Ashikul islam",
    "email": "afashik10203@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:20, 05:33:10 PM",
    "phone": "01743182621",
    "whatsapp": "01775899457",
    "address": "Dhaka",
    "courseMail": "afashik10203@gmail.com",
    "medhaEmail": "afashik10203@gmail.com",
    "tranId": "MD60-TAUHQO",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 32,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 32,
    "memberId": "NCM-32",
    "name": "Moshiour Rahman Hridoy",
    "email": "moshiourrahmanhridoy@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:21, 05:33:10 PM",
    "phone": "01764175342",
    "whatsapp": "01714554297",
    "address": "Dhaka",
    "courseMail": "moshiourrahmanhridoy@gmail.com",
    "medhaEmail": "moshiourrahmanhridoy@gmail.com",
    "tranId": "MD60-63SZFY",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 33,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 33,
    "memberId": "NCM-33",
    "name": "Md Iqbal Hosen",
    "email": "iqbalhasan140@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:22, 05:33:10 PM",
    "phone": "01775474584",
    "whatsapp": "01736699307",
    "address": "Dhaka",
    "courseMail": "iqbalhasan140@gmail.com",
    "medhaEmail": "iqbalhasan140@gmail.com",
    "tranId": "MD60-V5JA0J",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 34,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 34,
    "memberId": "NCM-34",
    "name": "MD. Ershad Hossain",
    "email": "ershad559@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:25, 05:33:10 PM",
    "phone": "01777468362",
    "whatsapp": "01742207152",
    "address": "Dhaka",
    "courseMail": "ershad559@gmail.com",
    "medhaEmail": "ershad559@gmail.com",
    "tranId": "MD60-1M4NR8",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 35,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 35,
    "memberId": "NCM-35",
    "name": "Humayun Islam",
    "email": "humayunislam2000@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:29, 05:33:10 PM",
    "phone": "01778624774",
    "whatsapp": "01717811503",
    "address": "Dhaka",
    "courseMail": "humayunislam2000@gmail.com",
    "medhaEmail": "humayunislam2000@gmail.com",
    "tranId": "MD60-Z7D8ZG",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 36,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 36,
    "memberId": "NCM-36",
    "name": "Robiul islam bipu",
    "email": "bipurobi.com@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:30, 05:33:10 PM",
    "phone": "01735484618",
    "whatsapp": "01743704723",
    "address": "Dhaka",
    "courseMail": "bipurobi.com@gmail.com",
    "medhaEmail": "bipurobi.com@gmail.com",
    "tranId": "MD60-U6K2EH",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 37,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 37,
    "memberId": "NCM-37",
    "name": "Mominul Islam",
    "email": "fd.momin@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:31, 05:33:10 PM",
    "phone": "01778968888",
    "whatsapp": "01733019912",
    "address": "Dhaka",
    "courseMail": "fd.momin@gmail.com",
    "medhaEmail": "fd.momin@gmail.com",
    "tranId": "MD60-8961J1",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 38,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 38,
    "memberId": "NCM-38",
    "name": "Md Forhad Hossain",
    "email": "ifforhad007@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:32, 05:33:10 PM",
    "phone": "01779051333",
    "whatsapp": "01777823541",
    "address": "Dhaka",
    "courseMail": "ifforhad007@gmail.com",
    "medhaEmail": "ifforhad007@gmail.com",
    "tranId": "MD60-AR94X0",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 39,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 39,
    "memberId": "NCM-39",
    "name": "Azizur Rahman Mozumder",
    "email": "azizurmozumder@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:34, 05:33:10 PM",
    "phone": "01798086291",
    "whatsapp": "01731833476",
    "address": "Dhaka",
    "courseMail": "azizurmozumder@gmail.com",
    "medhaEmail": "azizurmozumder@gmail.com",
    "tranId": "MD60-CB57O7",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 40,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 40,
    "memberId": "NCM-40",
    "name": "Tariqul Islam",
    "email": "tareq.jibon@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:39, 05:33:10 PM",
    "phone": "01739004337",
    "whatsapp": "01799760982",
    "address": "Dhaka",
    "courseMail": "tareq.jibon@gmail.com",
    "medhaEmail": "tareq.jibon@gmail.com",
    "tranId": "MD60-UX90K8",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 41,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 41,
    "memberId": "NCM-41",
    "name": "Mst.Meghna khatun",
    "email": "atelierfinishing@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:41, 05:33:10 PM",
    "phone": "01723738875",
    "whatsapp": "01721518112",
    "address": "Dhaka",
    "courseMail": "atelierfinishing@gmail.com",
    "medhaEmail": "atelierfinishing@gmail.com",
    "tranId": "MD60-6HV29Y",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 42,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 42,
    "memberId": "NCM-42",
    "name": "Abdul Jabbar",
    "email": "abduljabbar1996.com@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:43, 05:33:10 PM",
    "phone": "01775374002",
    "whatsapp": "01718312718",
    "address": "Dhaka",
    "courseMail": "abduljabbar1996.com@gmail.com",
    "medhaEmail": "abduljabbar1996.com@gmail.com",
    "tranId": "MD60-6XMG7F",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 43,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 43,
    "memberId": "NCM-43",
    "name": "Ashikur Rahman Yer",
    "email": "ashikyer@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:44, 05:33:10 PM",
    "phone": "01775057040",
    "whatsapp": "01727583218",
    "address": "Dhaka",
    "courseMail": "ashikyer@gmail.com",
    "medhaEmail": "ashikyer@gmail.com",
    "tranId": "MD60-SGW0JM",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 44,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 44,
    "memberId": "NCM-44",
    "name": "Hasnath Fathema",
    "email": "cnl.shweta@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:45, 05:33:10 PM",
    "phone": "01713527274",
    "whatsapp": "01714559946",
    "address": "Dhaka",
    "courseMail": "cnl.shweta@gmail.com",
    "medhaEmail": "cnl.shweta@gmail.com",
    "tranId": "MD60-D9WD0Z",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 45,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 45,
    "memberId": "NCM-45",
    "name": "Md sobuj ahmed",
    "email": "sobujfd@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:50, 05:33:10 PM",
    "phone": "01721363548",
    "whatsapp": "01743633196",
    "address": "Dhaka",
    "courseMail": "sobujfd@gmail.com",
    "medhaEmail": "sobujfd@gmail.com",
    "tranId": "MD60-LRY7P9",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 46,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 46,
    "memberId": "NCM-46",
    "name": "Shah Jahan Shuvo",
    "email": "shuvoshuvo3945@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:51, 05:33:10 PM",
    "phone": "01791612423",
    "whatsapp": "01792113603",
    "address": "Dhaka",
    "courseMail": "shuvoshuvo3945@gmail.com",
    "medhaEmail": "shuvoshuvo3945@gmail.com",
    "tranId": "MD60-TBT2O0",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 47,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 47,
    "memberId": "NCM-47",
    "name": "Md Naushad Ali",
    "email": "md.alam52148@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:53, 05:33:10 PM",
    "phone": "01758422098",
    "whatsapp": "01781555592",
    "address": "Dhaka",
    "courseMail": "md.alam52148@gmail.com",
    "medhaEmail": "md.alam52148@gmail.com",
    "tranId": "MD60-3SB8IQ",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 48,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 48,
    "memberId": "NCM-48",
    "name": "Hasan Kazi",
    "email": "mdhasankazi100@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:54, 05:33:10 PM",
    "phone": "01732592724",
    "whatsapp": "01719157107",
    "address": "Dhaka",
    "courseMail": "mdhasankazi100@gmail.com",
    "medhaEmail": "mdhasankazi100@gmail.com",
    "tranId": "MD60-G77XQQ",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 49,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 49,
    "memberId": "NCM-49",
    "name": "Mohammad Faruk Rahman",
    "email": "rahman1206@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:15:55, 05:33:10 PM",
    "phone": "01769211692",
    "whatsapp": "01760404654",
    "address": "Dhaka",
    "courseMail": "rahman1206@gmail.com",
    "medhaEmail": "rahman1206@gmail.com",
    "tranId": "MD60-6QRZA4",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 50,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 50,
    "memberId": "NCM-50",
    "name": "MD ASLAMUZZAMAN khan",
    "email": "mk7672912@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:00, 05:33:10 PM",
    "phone": "01784674334",
    "whatsapp": "01743136349",
    "address": "Dhaka",
    "courseMail": "mk7672912@gmail.com",
    "medhaEmail": "mk7672912@gmail.com",
    "tranId": "MD60-OG82OH",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 51,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 51,
    "memberId": "NCM-51",
    "name": "Akhtaruzzaman",
    "email": "poholanbabul@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:01, 05:33:10 PM",
    "phone": "01739548423",
    "whatsapp": "01728547709",
    "address": "Dhaka",
    "courseMail": "poholanbabul@gmail.com",
    "medhaEmail": "poholanbabul@gmail.com",
    "tranId": "MD60-B8T85T",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 52,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 52,
    "memberId": "NCM-52",
    "name": "Md. Zahidul Islam",
    "email": "zahidmofl@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:02, 05:33:10 PM",
    "phone": "01747281686",
    "whatsapp": "01710273898",
    "address": "Dhaka",
    "courseMail": "zahidmofl@gmail.com",
    "medhaEmail": "zahidmofl@gmail.com",
    "tranId": "MD60-DFK9H9",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 53,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 53,
    "memberId": "NCM-53",
    "name": "Md Aminul Islam",
    "email": "nesadabddl@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:04, 05:33:10 PM",
    "phone": "01772080284",
    "whatsapp": "01795497269",
    "address": "Dhaka",
    "courseMail": "nesadabddl@gmail.com",
    "medhaEmail": "nesadabddl@gmail.com",
    "tranId": "MD60-7LK55T",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 54,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 54,
    "memberId": "NCM-54",
    "name": "Asadullah Ahmed",
    "email": "asadullahahmed21@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:04, 05:33:10 PM",
    "phone": "01764853334",
    "whatsapp": "01760582729",
    "address": "Dhaka",
    "courseMail": "asadullahahmed21@gmail.com",
    "medhaEmail": "asadullahahmed21@gmail.com",
    "tranId": "MD60-TZLFMP",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 55,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 55,
    "memberId": "NCM-55",
    "name": "Md. Shofiqul Islam",
    "email": "shofiqchem85@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:10, 05:33:10 PM",
    "phone": "01742439440",
    "whatsapp": "01735293218",
    "address": "Dhaka",
    "courseMail": "shofiqchem85@gmail.com",
    "medhaEmail": "shofiqchem85@gmail.com",
    "tranId": "MD60-0BUV5H",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 56,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 56,
    "memberId": "NCM-56",
    "name": "Ripon Chandra Barman",
    "email": "riponcbbd@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:11, 05:33:10 PM",
    "phone": "01764698426",
    "whatsapp": "01757044144",
    "address": "Dhaka",
    "courseMail": "riponcbbd@gmail.com",
    "medhaEmail": "riponcbbd@gmail.com",
    "tranId": "MD60-AFIWZC",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 57,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 57,
    "memberId": "NCM-57",
    "name": "Humayun Kabir",
    "email": "humayun.nafatex@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:12, 05:33:10 PM",
    "phone": "01782264719",
    "whatsapp": "01745227230",
    "address": "Dhaka",
    "courseMail": "humayun.nafatex@gmail.com",
    "medhaEmail": "humayun.nafatex@gmail.com",
    "tranId": "MD60-KDL1JN",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 58,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 58,
    "memberId": "NCM-58",
    "name": "ABS Md.Nayeem",
    "email": "absnayeem123@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:13, 05:33:10 PM",
    "phone": "01778932762",
    "whatsapp": "01790256153",
    "address": "Dhaka",
    "courseMail": "absnayeem123@gmail.com",
    "medhaEmail": "absnayeem123@gmail.com",
    "tranId": "MD60-K5U23Y",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 59,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 59,
    "memberId": "NCM-59",
    "name": "Nahidul Islam",
    "email": "nahidislam46@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:14, 05:33:10 PM",
    "phone": "01782984233",
    "whatsapp": "01724417189",
    "address": "Dhaka",
    "courseMail": "nahidislam46@gmail.com",
    "medhaEmail": "nahidislam46@gmail.com",
    "tranId": "MD60-FH2V7E",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 60,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 60,
    "memberId": "NCM-60",
    "name": "M. M. Obayed Quader Sultan",
    "email": "apusultan@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:18, 05:33:10 PM",
    "phone": "01795197737",
    "whatsapp": "01750099764",
    "address": "Dhaka",
    "courseMail": "apusultan@gmail.com",
    "medhaEmail": "apusultan@gmail.com",
    "tranId": "MD60-9Q1PMM",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 61,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  },
  {
    "sl": 61,
    "memberId": "NCM-61",
    "name": "Md Faysal",
    "email": "mdfaysal00714@gmail.com",
    "status": "Sent",
    "sentAt": "2026-10-27 14:16:19, 05:33:10 PM",
    "phone": "01752137527",
    "whatsapp": "01785542130",
    "address": "Dhaka",
    "courseMail": "mdfaysal00714@gmail.com",
    "medhaEmail": "mdfaysal00714@gmail.com",
    "tranId": "MD60-ITH94A",
    "plan": "Full Course",
    "team": "Alpha",
    "facebook": "",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 62,
    "_tab": "Members NCM-P1",
    "_src": "Part-1 Master"
  }
];
  const BATCH01_MASTER_MEMBERS = [
  {
    "sl": 1,
    "memberId": "NCM-P2-01",
    "name": "Sohel Razzak",
    "email": "to.rubai@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:14, 03:45:14 PM",
    "phone": "01713014244",
    "whatsapp": "01713014244",
    "address": "Abedin Tower, Level 5 \n35 Kamal Ataturk Avenue, Banani C/A",
    "courseMail": "support@dropletsbd.com",
    "medhaEmail": "dropletsspeed@gmail.com",
    "tranId": "MD60-260928-34131214",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19LRfDvywv/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 2,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 2,
    "memberId": "NCM-P2-02",
    "name": "Saleh Ahmed Hemel",
    "email": "hemelahmed1995@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:15, 03:45:14 PM",
    "phone": "01784662254",
    "whatsapp": "01784662254",
    "address": "Niketon,Dhaka",
    "courseMail": "hemelahmed1995@gmail.com",
    "medhaEmail": "hemelahmed1995@gmail.com",
    "tranId": "MD60-260928-210BC11A",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CfDLBLTUS/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 3,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 3,
    "memberId": "NCM-P2-03",
    "name": "Hafiz Mohammed Iqbal",
    "email": "rahathossain0991@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:17, 03:45:14 PM",
    "phone": "01737949462",
    "whatsapp": "01897624401",
    "address": "Narinda Dhaka",
    "courseMail": "rahathossain0991@gmail.com",
    "medhaEmail": "rahathossain0991@gmail.com",
    "tranId": "MD60-260928-CDCCA8B0",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1JwytcZWTn/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 4,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 4,
    "memberId": "NCM-P2-04",
    "name": "MD. RASEL AHMED",
    "email": "rasel.spmss@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:18, 03:45:14 PM",
    "phone": "01856959596",
    "whatsapp": "01856959596",
    "address": "শার্শা, যশোর",
    "courseMail": "rasel.spmss@gmail.com",
    "medhaEmail": "rasel.spmss@gmail.com",
    "tranId": "MD60-260928-639F6E84",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1K6seE2fQJ/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 5,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 5,
    "memberId": "NCM-P2-05",
    "name": "Foysal Islam",
    "email": "fishimul@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:20, 03:45:14 PM",
    "phone": "01724309634",
    "whatsapp": "01724309634",
    "address": "Satiakola, Kashinathpur, Santhia, Pabna",
    "courseMail": "fishimul@gmail.com",
    "medhaEmail": "feriowalla@gmail.com",
    "tranId": "MD60-260928-987F523E",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/foysalislamshimul",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 6,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 6,
    "memberId": "NCM-P2-06",
    "name": "SM Shopon Ahamed",
    "email": "smshopon6170@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:25, 03:45:14 PM",
    "phone": "01758549566",
    "whatsapp": "01758549566",
    "address": "Gendaria Dhaka",
    "courseMail": "smshopon6170@gmail.com",
    "medhaEmail": "smshopon6170@gmail.com",
    "tranId": "MD60-260928-5F7207C9",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/shpnahame/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 7,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 7,
    "memberId": "NCM-P2-07",
    "name": "Abul Kashem khandany",
    "email": "kashemkhandany89@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:27, 03:45:14 PM",
    "phone": "01735109089",
    "whatsapp": "01735109089",
    "address": "Distilari rod gendariya dhaka",
    "courseMail": "kashemkhandany89@gmail.com",
    "medhaEmail": "kashemkhandany89@gmail.com",
    "tranId": "MD60-260928-A803C6EE",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CJ4Wc6krp/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 8,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 8,
    "memberId": "NCM-P2-08",
    "name": "Muhammad Ibrahim",
    "email": "muhammadibrahim2142001@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:28, 03:45:14 PM",
    "phone": "01842455567",
    "whatsapp": "01842455567",
    "address": "উওরা ডিয়াবাড়ি তুরাগ ঢাকা",
    "courseMail": "muhammadibrahim2142001@gmail.com",
    "medhaEmail": "muhammadibrahim2142001@gmail.com",
    "tranId": "MD60-260928-BDD34D84",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/muhammad.ibrahim.559374",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 9,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 9,
    "memberId": "NCM-P2-09",
    "name": "Salauddin siyam",
    "email": "siyamshafisomaya@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:30, 03:45:14 PM",
    "phone": "01831037929",
    "whatsapp": "01831037929",
    "address": "Comilla",
    "courseMail": "siyamshafisomaya@gmail.com",
    "medhaEmail": "sumiayaa691@gmail.com",
    "tranId": "MD60-260928-40709387",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/14tKkK5D5xm/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 10,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 10,
    "memberId": "NCM-P2-10",
    "name": "Nusrat Jahan",
    "email": "tanny.nusrat21@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:31, 03:45:14 PM",
    "phone": "01717109109",
    "whatsapp": "01717109109",
    "address": "131/1 New Eskaton, Dominno Sorrel, Fl#B3",
    "courseMail": "tanny.nusrat21@gmail.com",
    "medhaEmail": "tanny.nusrat21@gmail.com",
    "tranId": "MD60-260928-B29CDC28",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CPxQ43wKg/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 11,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 11,
    "memberId": "NCM-P2-11",
    "name": "Md. Emam Hossain",
    "email": "ahmadhossain418@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:37, 03:45:14 PM",
    "phone": "01313959178",
    "whatsapp": "01313959178",
    "address": "Chandina,Cumilla",
    "courseMail": "ahmadhossain418@gmail.com",
    "medhaEmail": "ahmadhossain418@gmail.com",
    "tranId": "MD60-260928-6AB49A3B",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/md.emam.hossain.355664",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 12,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 12,
    "memberId": "NCM-P2-12",
    "name": "Al amin",
    "email": "smalaminmt94@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:38, 03:45:14 PM",
    "phone": "01718132035",
    "whatsapp": "01718132035",
    "address": "129,Ahammadbag,basabo, Sabuj bag.",
    "courseMail": "smalaminmt94@gmail.com",
    "medhaEmail": "smalaminmt94@gmail.com",
    "tranId": "MD60-260928-1D6280FE",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CD7t6J58a/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 13,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 13,
    "memberId": "NCM-P2-13",
    "name": "Md. Nasir Uddin Rony",
    "email": "nasirurp@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:40, 03:45:14 PM",
    "phone": "01922000078",
    "whatsapp": "01922000078",
    "address": "Mirpur Dhaka",
    "courseMail": "nasirurp@gmail.com",
    "medhaEmail": "nasirurp@gmail.com",
    "tranId": "MD60-260928-2CFC8949",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1J4oPZTL15/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 14,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 14,
    "memberId": "NCM-P2-14",
    "name": "MD REZAUL KARIM RIPON",
    "email": "iamrezaul1976@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:41, 03:45:14 PM",
    "phone": "01618989495",
    "whatsapp": "01618989495",
    "address": "Islampur ( Opposite Islampur Kamil Madrasah), Kuchiamora- 1540, Sirajdikhan, Munshiganj.",
    "courseMail": "iamrezaul1976@gmail.com",
    "medhaEmail": "iamrezaul1976@gmail.com",
    "tranId": "MD60-260928-9EFDA26C",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/18fXBqvHDZ/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 15,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 15,
    "memberId": "NCM-P2-15",
    "name": "MD. IBRAHIM CHOWDHURY",
    "email": "hmibrahim16@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:42, 03:45:14 PM",
    "phone": "01916815604",
    "whatsapp": "01916815604",
    "address": "বাংলাবাজার, ঢাকা।",
    "courseMail": "hmibrahim16@gmail.com",
    "medhaEmail": "hmibrahim16@gmail.com",
    "tranId": "MD60-260928-F82FB688",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/md.ibrahim.chowdhury.395506",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 16,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 16,
    "memberId": "NCM-P2-16",
    "name": "Md Arafat Rahman",
    "email": "arafat.bog12@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:51, 03:45:14 PM",
    "phone": "01576495753",
    "whatsapp": "01576495753",
    "address": "Shibati Sahe Mosjid Lan Bogura City, Bogura",
    "courseMail": "arafat.bog12@gmail.com",
    "medhaEmail": "arafat.bog12@gmail.com",
    "tranId": "MD60-260928-B899F66F",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/arafatrahman2212",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 17,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 17,
    "memberId": "NCM-P2-17",
    "name": "Md.Akmol Hossain",
    "email": "akmol1939@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:52, 03:45:14 PM",
    "phone": "01744824616",
    "whatsapp": "01744824616",
    "address": "Rajshahi, Natore, lalpur",
    "courseMail": "akmolhossain172@yahoo.com",
    "medhaEmail": "akmolhossain172@yahoo.com",
    "tranId": "MD60-260928-870ED11D",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19Zz2QMhzm/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 18,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 18,
    "memberId": "NCM-P2-18",
    "name": "Md Alauddin",
    "email": "mdalauddin4236@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:54, 03:45:14 PM",
    "phone": "01742852064",
    "whatsapp": "01742852064",
    "address": "house -36, Road -Rabindra Sarani, sector -7,Uttara Dhaka 1230",
    "courseMail": "mdalauddin4236@gmail.com",
    "medhaEmail": "mdalauddin4236@gmail.com",
    "tranId": "MD60-260928-14B951DE",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/16G5iGsga4A/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 19,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 19,
    "memberId": "NCM-P2-19",
    "name": "Mirajul Isllam",
    "email": "marajul.isllam030@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:55, 03:45:14 PM",
    "phone": "01766764320",
    "whatsapp": "01766764320",
    "address": "green city,demra,dhaka",
    "courseMail": "marajul.isllam030@gmail.com",
    "medhaEmail": "marajul.isllam030@gmail.com",
    "tranId": "MD60-260928-04DD5E36",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/Miraj.764320",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 20,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 20,
    "memberId": "NCM-P2-20",
    "name": "Md. ESHAK SIKDER",
    "email": "eshak9t@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:45:56, 03:45:14 PM",
    "phone": "01928554574",
    "whatsapp": "01739504905",
    "address": "Town Noapara, Fakirhat, Bagerhat",
    "courseMail": "eshak9t@gmail.com",
    "medhaEmail": "eshak9t@gmail.com",
    "tranId": "MD60-260928-CFEA944E",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/eshak.sikder.5",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 21,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 21,
    "memberId": "NCM-P2-21",
    "name": "Md Mamun",
    "email": "mdmamunrari848@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:02, 03:45:14 PM",
    "phone": "01309142840",
    "whatsapp": "01309142840",
    "address": "22/A shahid faruk rode jatrabari Dhaka-1204",
    "courseMail": "tawsifvai@gmail.com",
    "medhaEmail": "mdmamunrari848@gmail.com",
    "tranId": "MD60-260928-2FB32BEB",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/popy.akter.7127146",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 22,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 22,
    "memberId": "NCM-P2-22",
    "name": "Nasrin Akhter Rima",
    "email": "nasrinrima2123@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:03, 03:45:14 PM",
    "phone": "01331371636",
    "whatsapp": "01331371636",
    "address": "Boalia,Rajshahi City",
    "courseMail": "mnhossain1402@gmail.com",
    "medhaEmail": "nasrinrima2123@gmail.com",
    "tranId": "MD60-260928-E2D8837D",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1ECo5ZZfjK/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 23,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 23,
    "memberId": "NCM-P2-23",
    "name": "Md Razu Hossain",
    "email": "abrarahamedraju@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:05, 03:45:14 PM",
    "phone": "01811981047",
    "whatsapp": "01811981047",
    "address": "গ্রামঃ খুরশী, নলডাঙ্গা, ঝিনাইদহ সদর",
    "courseMail": "abrarahamedraju@gmail.com",
    "medhaEmail": "abrarahamedraju@gmail.com",
    "tranId": "MD60-260928-77FCC9C7",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/189AMbXtRy/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 24,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 24,
    "memberId": "NCM-P2-24",
    "name": "Md Shoriful Islam",
    "email": "shorifbd1@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:06, 03:45:14 PM",
    "phone": "01767516150",
    "whatsapp": "01767516150",
    "address": "Kashinathpur \nsanthia, Pabna",
    "courseMail": "shorifbd1@gmail.com",
    "medhaEmail": "shorifbd1@gmail.com",
    "tranId": "MD60-260928-AB462C76",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/TheShorif",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 25,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 25,
    "memberId": "NCM-P2-25",
    "name": "MD Selim mia",
    "email": "salim20216@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:08, 03:45:14 PM",
    "phone": "01701148636",
    "whatsapp": "01701148636",
    "address": "খানপুর ইউনিয়ন \nচুলকাটি বাজার \nবাগেরহাট, বাগেরহাট সদর",
    "courseMail": "salim20216@gmail.com",
    "medhaEmail": "salim20216@gmail.com",
    "tranId": "MD60-260928-4CA79DFA",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19X6ZpqqN7/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 26,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 26,
    "memberId": "NCM-P2-26",
    "name": "AL MAHMUD SARKER",
    "email": "mahmud076609@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:17, 03:45:14 PM",
    "phone": "01727228078",
    "whatsapp": "01727228078",
    "address": "Sherpur, Bogura",
    "courseMail": "mahmud076609@gmail.com",
    "medhaEmail": "mahmud076609@gmail.com",
    "tranId": "MD60-260928-B47BD4B4",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1F9P3JaGzj/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 27,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 27,
    "memberId": "NCM-P2-27",
    "name": "A S M Shamsuzzoha Kabir",
    "email": "shamkabir2003@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:19, 03:45:14 PM",
    "phone": "01625002500",
    "whatsapp": "01625002500",
    "address": "Malotinagor (Paiker Para), Word No 11, Bogura Sador, Bogura",
    "courseMail": "shamkabir2003@gmail.com",
    "medhaEmail": "shamkabir2003@gmail.com",
    "tranId": "MD60-260928-E4566EFB",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/shamkabir/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 28,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 28,
    "memberId": "NCM-P2-28",
    "name": "MD Raju Ahmed",
    "email": "rajuahamedmd503@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:21, 03:45:14 PM",
    "phone": "01605113304",
    "whatsapp": "01798530786",
    "address": "সখিপুর ,টাংগাইল",
    "courseMail": "rajuahamedmd503@gmail.com",
    "medhaEmail": "rajuahamedmd503@gmail.com",
    "tranId": "MD60-260928-22FAF794",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/mdrajuahmed.raj.3150",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 29,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 29,
    "memberId": "NCM-P2-29",
    "name": "Mizanur Rahman",
    "email": "mizan.txe@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:22, 03:45:14 PM",
    "phone": "01798552012",
    "whatsapp": "01798552012",
    "address": "Uttara, Dhaka",
    "courseMail": "mizan.txe@gmail.com",
    "medhaEmail": "mizan.txe@gmail.com",
    "tranId": "MD60-260928-772C6140",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19fnuE3R7D/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 30,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 30,
    "memberId": "NCM-P2-30",
    "name": "Sharmin Akhter",
    "email": "ss0458781@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:24, 03:45:14 PM",
    "phone": "01333088760",
    "whatsapp": "01347140330",
    "address": "ঢাকা মিরপুর ১০ ফল পট্টি",
    "courseMail": "mjakreaantor@gmail.com",
    "medhaEmail": "ss0458781@gmail.com",
    "tranId": "MD60-260928-E2D781AF",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1GRvACjJAV/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 31,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 31,
    "memberId": "NCM-P2-31",
    "name": "Ashikuzzaman",
    "email": "jrashik884@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:29, 03:45:14 PM",
    "phone": "01771159106",
    "whatsapp": "01771159106",
    "address": "বন্ধন ভিউ, সেলিম ভিলা, ডুয়েট, গাজীপুর সদর,গাজীপুর",
    "courseMail": "jrashik884@gmail.com",
    "medhaEmail": "jrashik884@gmail.com",
    "tranId": "MD60-260928-95EAFCB7",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CCLSUgHbw/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 32,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 32,
    "memberId": "NCM-P2-32",
    "name": "Mohammad Shamiul Haque Jony",
    "email": "shamiulhaque119@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:30, 03:45:14 PM",
    "phone": "01816666119",
    "whatsapp": "01776332050",
    "address": "1313/1,east shewrapara, mirpur",
    "courseMail": "shamiulhaque119@gmail.com",
    "medhaEmail": "shamiulhaque119@gmail.com",
    "tranId": "MD60-260928-44D6B5DC",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1H3HqYgY4h/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 33,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 33,
    "memberId": "NCM-P2-33",
    "name": "Mohammad Fayez",
    "email": "mohammadfayez424@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:31, 03:45:14 PM",
    "phone": "01939837448",
    "whatsapp": "01939837448",
    "address": "কুমিল্লা চান্দিনা গোল্লায় কমপ্লেক্স",
    "courseMail": "mdfayezmdfayez@gmail.com",
    "medhaEmail": "mohammadfayez424@gmail.com",
    "tranId": "MD60-260928-2A1EC874",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/mohammad.fayez.257725?mibextid=ZbWKwL",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 34,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 34,
    "memberId": "NCM-P2-34",
    "name": "Tanvir Khan",
    "email": "tanvirkhan22222222222222@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:32, 03:45:14 PM",
    "phone": "01613926388",
    "whatsapp": "01613926388",
    "address": "Dohar, Dhaka",
    "courseMail": "tanvirkhan22222222222222@gmail.com",
    "medhaEmail": "tanvirkhan22222222222222@gmail.com",
    "tranId": "MD60-260928-39ED9776",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19bmZbsebR/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 35,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 35,
    "memberId": "NCM-P2-35",
    "name": "Syed Shamim Arafat",
    "email": "shamim.arafatbd@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:34, 03:45:14 PM",
    "phone": "01813165231",
    "whatsapp": "01813165231",
    "address": "Chawakbazar, Chittagong",
    "courseMail": "shamim.arafatbd@gmail.com",
    "medhaEmail": "shamim.arafatbd@gmail.com",
    "tranId": "MD60-260928-A73EAC4D",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/shamim.arafat.137328",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 36,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 36,
    "memberId": "NCM-P2-36",
    "name": "Ashik Uddin",
    "email": "shonnipcpa@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:39, 03:45:14 PM",
    "phone": "01628809587",
    "whatsapp": "01628809587",
    "address": "Khilgaon, Block b , Dhaka- 1219",
    "courseMail": "shonnipcpa@gmail.com",
    "medhaEmail": "shonnipcpa@gmail.com",
    "tranId": "MD60-260928-CDE31E15",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19TCXXJoDr/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 37,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 37,
    "memberId": "NCM-P2-37",
    "name": "Md Sujon Hossen",
    "email": "aksujon143@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:40, 03:45:14 PM",
    "phone": "01717212644",
    "whatsapp": "01717212644",
    "address": "পশ্চিম মুক্তারপুর, মুন্সিগঞ্জ সদর, মুন্সিগঞ্জ",
    "courseMail": "aksujon143@gmail.com",
    "medhaEmail": "aksujon143@gmail.com",
    "tranId": "MD60-260928-4555A958",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1DuxMyJSEk/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 38,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 38,
    "memberId": "NCM-P2-38",
    "name": "MD MAJHARUL Islam",
    "email": "majharulislamakash77@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:42, 03:45:14 PM",
    "phone": "01792859871",
    "whatsapp": "01792859871",
    "address": "Uttara Dhaka",
    "courseMail": "majharulislamakash77@gmail.com",
    "medhaEmail": "majharulislamakash77@gmail.com",
    "tranId": "MD60-260928-B2298CF8",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1FY8cKzWfv/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 39,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 39,
    "memberId": "NCM-P2-39",
    "name": "Mostofa amir foysal",
    "email": "blackstonegpstracker@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:44, 03:45:14 PM",
    "phone": "01332353827",
    "whatsapp": "01909675747",
    "address": "Jibannagar, Chuadanga",
    "courseMail": "blackstonegpstracker@gmail.com",
    "medhaEmail": "blackstonegpstracker@gmail.com",
    "tranId": "MD60-260928-4FFAD79C",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1Fap6suGFn/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 40,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 40,
    "memberId": "NCM-P2-40",
    "name": "Akash Ehsan",
    "email": "akashpresenter@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:45, 03:45:14 PM",
    "phone": "01676142727",
    "whatsapp": "01676142727",
    "address": "Mirbag modhubag dhaka ,Hatirjheel thana",
    "courseMail": "akashpresenter@gmail.com",
    "medhaEmail": "akashpresenter@gmail.com",
    "tranId": "MD60-260928-3F375095",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19J6ovZTf2/?mibextid=wwXIfr",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 41,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 41,
    "memberId": "NCM-P2-41",
    "name": "Md Rofikul Islam",
    "email": "rofikulislamcnpi@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:51, 03:45:14 PM",
    "phone": "01743459883",
    "whatsapp": "01743459883",
    "address": "Durgapur Rajshahi",
    "courseMail": "rofikulislamcnpi@gmail.com",
    "medhaEmail": "rofikulislamcnpi@gmail.com",
    "tranId": "MD60-260928-AEB1240B",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1DxzPGMERf/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 42,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 42,
    "memberId": "NCM-P2-42",
    "name": "Mst Ismoti Akter Sumi Sumi",
    "email": "clothingsstaronlineshop@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:52, 03:45:14 PM",
    "phone": "01753784137",
    "whatsapp": "01753784137",
    "address": "গ্ৰাম,চর নোটাবাড়ী, থানা বড়াইগ্রাম, জেলা নাটোর, উপজেলা বনপাড়া।",
    "courseMail": "alaminbinarif@gmail.com",
    "medhaEmail": "clothingsstaronlineshop@gmail.com",
    "tranId": "MD60-260928-60D275E3",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1BfCs8NM5B/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 43,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 43,
    "memberId": "NCM-P2-43",
    "name": "Md Shahin",
    "email": "mdshahinkhan5650@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:53, 03:45:14 PM",
    "phone": "01751848538",
    "whatsapp": "01751848538",
    "address": "Kuril Baridhara Shewrapara Bazar",
    "courseMail": "mdshahinkhan5650@gmail.com",
    "medhaEmail": "mdshahinkhan5650@gmail.com",
    "tranId": "MD60-260928-834DC9D9",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/mdshahinkhan5650",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 44,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 44,
    "memberId": "NCM-P2-44",
    "name": "Akram Husan",
    "email": "akramhusan6@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:54, 03:45:14 PM",
    "phone": "01314062597",
    "whatsapp": "01314062597",
    "address": "Uttara 10, Kamarpara, Golgola Mor",
    "courseMail": "akramhusan6@gmail.com",
    "medhaEmail": "akramhusan6@gmail.com",
    "tranId": "MD60-260928-3A576870",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/akramhusans",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 45,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 45,
    "memberId": "NCM-P2-45",
    "name": "Md Faridul Islam",
    "email": "mdfaridulislam133@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:46:57, 03:45:14 PM",
    "phone": "01310075613",
    "whatsapp": "01310075613",
    "address": "Chittagong, Bangladesh",
    "courseMail": "mdfaridulislam133@gmail.com",
    "medhaEmail": "mdfaridulislam133@gmail.com",
    "tranId": "MD60-260928-57D818DB",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1ESH3ycjrb/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 46,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 46,
    "memberId": "NCM-P2-46",
    "name": "Sharmin Islam",
    "email": "shara.amin95@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:02, 03:45:14 PM",
    "phone": "01601554857",
    "whatsapp": "01601554857",
    "address": "Dhaka, Mirpur -6",
    "courseMail": "shara.amin95@gmail.com",
    "medhaEmail": "taqwafoods20@gmail.com",
    "tranId": "MD60-260928-3DA63DBF",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/17hnjr6F2a/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 47,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 47,
    "memberId": "NCM-P2-47",
    "name": "Mossarof Sharif",
    "email": "mossarofsharif@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:03, 03:45:14 PM",
    "phone": "01942742743",
    "whatsapp": "01942742743",
    "address": "180 B B Road, Chasara, Narayanganj",
    "courseMail": "mossarofsharif@gmail.com",
    "medhaEmail": "mossarofsharif@gmail.com",
    "tranId": "MD60-260928-7E026697",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/mossarofsharif",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 48,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 48,
    "memberId": "NCM-P2-48",
    "name": "Md Rabbi",
    "email": "onlinesaraponno@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:05, 03:45:14 PM",
    "phone": "01995360315",
    "whatsapp": "01995360315",
    "address": "রোড নং ১০,পূর্বাচল,উওর বাড্ডা,ঢাকা-১২১২",
    "courseMail": "onlinesaraponno@gmail.com",
    "medhaEmail": "onlinesaraponno@gmail.com",
    "tranId": "MD60-260928-55773C74",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1C8ubXdHUe/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 49,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 49,
    "memberId": "NCM-P2-49",
    "name": "Md. Akramul Haque",
    "email": "infowebbari@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:06, 03:45:14 PM",
    "phone": "01734601901",
    "whatsapp": "01734601901",
    "address": "Mirpur 10",
    "courseMail": "akramulbitm13@gmail.com",
    "medhaEmail": "infowebbari@gmail.com",
    "tranId": "MD60-260929-09528E67",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/akramuldigital",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 50,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 50,
    "memberId": "NCM-P2-50",
    "name": "Ashikur Rahman SA",
    "email": "theempireofsa@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:07, 03:45:14 PM",
    "phone": "01814542546",
    "whatsapp": "01814542546",
    "address": "Noakhali",
    "courseMail": "theempireofsa@gmail.com",
    "medhaEmail": "theempireofsa@gmail.com",
    "tranId": "MD60-260929-CD5A6607",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1MNSFcUE6D/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 51,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 51,
    "memberId": "NCM-P2-51",
    "name": "Md. Razaul Karim",
    "email": "razaul.auto@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:12, 03:45:14 PM",
    "phone": "01914346172",
    "whatsapp": "01914346172",
    "address": "644, Middle Monipur, Mirpur-2, Dhaka-1216",
    "courseMail": "razaul.auto@gmail.com",
    "medhaEmail": "razaul.auto@gmail.com",
    "tranId": "MD60-260929-5DE3DAED",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://facebook.com/razaulk05",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 52,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 52,
    "memberId": "NCM-P2-52",
    "name": "Md Neyamul",
    "email": "neyamul809@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:14, 03:45:14 PM",
    "phone": "01845240394",
    "whatsapp": "01845240394",
    "address": "Azompur, Uttara, Dhaka 1230",
    "courseMail": "neyamul809@gmail.com",
    "medhaEmail": "neyamul809@gmail.com",
    "tranId": "MD60-260929-19A35E31",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/neyamul.bhuiyan.5",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 53,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 53,
    "memberId": "NCM-P2-53",
    "name": "Asibur Rahman",
    "email": "shuvoasib@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:15, 03:45:14 PM",
    "phone": "01718726289",
    "whatsapp": "01718726289",
    "address": "Luxmikol, Rajbari Sadar Upazila, Rajbari",
    "courseMail": "shuvoasib@gmail.com",
    "medhaEmail": "shuvoasib@gmail.com",
    "tranId": "MD60-260929-88359814",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1BAmCuZfRn/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 54,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 54,
    "memberId": "NCM-P2-54",
    "name": "Akhi Akter",
    "email": "akhi210819971@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:16, 03:45:14 PM",
    "phone": "01795488294",
    "whatsapp": "01795488294",
    "address": "236/1",
    "courseMail": "akhi210819971@gmail.com",
    "medhaEmail": "akhi210819971@gmail.com",
    "tranId": "MD60-260929-5B2E7DCB",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 55,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 55,
    "memberId": "NCM-P2-55",
    "name": "Md Sirajul Islam",
    "email": "mdsiraz878@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:18, 03:45:14 PM",
    "phone": "01992774920",
    "whatsapp": "01992774920",
    "address": "নবাবগঞ্জ লালবাগ ঢাকা",
    "courseMail": "mdsiraz878@gmail.com",
    "medhaEmail": "mdsiraj878@gmail.com",
    "tranId": "MD60-260929-CC7743FF",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/14pSbo51QYD/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 56,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 56,
    "memberId": "NCM-P2-56",
    "name": "Md Sohel Rana",
    "email": "sohelrana271184@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:22, 03:45:14 PM",
    "phone": "01847401906",
    "whatsapp": "01723476888",
    "address": "196/2, East Kazipara, Kafrul, Mirpur, Dhaka-1216",
    "courseMail": "sohelrana271184@gmail.com",
    "medhaEmail": "sohelrana271184@gmail.com",
    "tranId": "MD60-260929-6A6366A4",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1C34BEKXx7/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 57,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 57,
    "memberId": "NCM-P2-57",
    "name": "Md Hasan Reza",
    "email": "mdhasanreza0@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:24, 03:45:14 PM",
    "phone": "01738253192",
    "whatsapp": "01738253192",
    "address": "Tongi Gagipur",
    "courseMail": "mdhasanreza0@gmail.com",
    "medhaEmail": "mdhasanreza0@gmail.com",
    "tranId": "MD60-260929-FE6F86A2",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/18XSsNrLEe/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 58,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 58,
    "memberId": "NCM-P2-58",
    "name": "Tazmul Alam",
    "email": "tajmulalom@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:26, 03:45:14 PM",
    "phone": "01723729590",
    "whatsapp": "01723729590",
    "address": "Rangpur,tajhat",
    "courseMail": "tajmulalom@gmail.com",
    "medhaEmail": "tajmulalom@gmail.com",
    "tranId": "MD60-260929-6E693984",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/tajmulalom.01",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 59,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 59,
    "memberId": "NCM-P2-59",
    "name": "Mojida Akter",
    "email": "lolonabutic@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:28, 03:45:14 PM",
    "phone": "01715303488",
    "whatsapp": "01715303488",
    "address": "18 zilla school road,Mymensingh",
    "courseMail": "lolonabutic@gmail.com",
    "medhaEmail": "lolonabutic@gmail.com",
    "tranId": "MD60-260929-F4FAAC2E",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/p/1HNKgT4n9v/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 60,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 60,
    "memberId": "NCM-P2-60",
    "name": "Md Shadat Hossain",
    "email": "shadatsokkhomotapcb@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:29, 03:45:14 PM",
    "phone": "01558670688",
    "whatsapp": "01558670688",
    "address": "17No Bakolia Sayed shah road Chattogram",
    "courseMail": "mdshadathossain1992@gmail.com",
    "medhaEmail": "shadatsokkhomotapcb@gmail.com",
    "tranId": "MD60-260929-6F6E31C7",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/14npoJEecyC/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 61,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 61,
    "memberId": "NCM-P2-61",
    "name": "MD. Abdur Rahim",
    "email": "abdurrahim21031185@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:34, 03:45:14 PM",
    "phone": "01321031185",
    "whatsapp": "01321031185",
    "address": "Mohakhali dhaka",
    "courseMail": "abdurrahim21031185@gmail.com",
    "medhaEmail": "abdurrahim21031185@gmail.com",
    "tranId": "MD60-260929-3A23D15E",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/A.RahimAntor",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 62,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 62,
    "memberId": "NCM-P2-62",
    "name": "Taslim Uddin",
    "email": "nhrtoshlime@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:35, 03:45:14 PM",
    "phone": "01646357030",
    "whatsapp": "01646357030",
    "address": "শিবগঞ্জ, গফরগাঁও, ময়মনসিংহ।",
    "courseMail": "nhrtoshlime@gmail.com",
    "medhaEmail": "nhrtoshlime@gmail.com",
    "tranId": "MD60-260929-5DDD2FB1",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/profile.php?id=61592487940079",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 63,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 63,
    "memberId": "NCM-P2-63",
    "name": "Sabbir Hossain",
    "email": "sb0770809@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:36, 03:45:14 PM",
    "phone": "01610425101",
    "whatsapp": "01610425101",
    "address": "Dhanmondi, Green Road",
    "courseMail": "sb0770809@gmail.com",
    "medhaEmail": "sb0770809@gmail.com",
    "tranId": "MD60-260929-7BA3EFC4",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1DnPmjd6bN/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 64,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 64,
    "memberId": "NCM-P2-64",
    "name": "Abu Hanif Noman",
    "email": "mdn137974@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:38, 03:45:14 PM",
    "phone": "01813642658",
    "whatsapp": "01813642658",
    "address": "হুজুর পাড়া কামরাঙ্গীরচর ঢাকা",
    "courseMail": "abuhanifnuman670@gmail.com",
    "medhaEmail": "mdn137974@gmail.com",
    "tranId": "MD60-260929-5CF0E787",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/14q94P15Uav/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 65,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 65,
    "memberId": "NCM-P2-65",
    "name": "Rabiul islam",
    "email": "ronydaria2@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:39, 03:45:14 PM",
    "phone": "01620113187",
    "whatsapp": "01620113187",
    "address": "292 shatabdi center lift 4 room no 4 g fakirapool motijheel dhaka 1000",
    "courseMail": "ronydaria2@gmail.com",
    "medhaEmail": "ronydaria2@gmail.com",
    "tranId": "MD60-260929-40422258",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CMqPbWomw/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 66,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 66,
    "memberId": "NCM-P2-66",
    "name": "mohmmad Sirazul",
    "email": "sirajulislammohammad6@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:44, 03:45:14 PM",
    "phone": "01812976510",
    "whatsapp": "01812976510",
    "address": "খরণা মোজাফফরাবাদ উপজেলা পটিয়া চট্টগ্রাম",
    "courseMail": "sirajulislammohammad6@gmail.com",
    "medhaEmail": "sirajulislammohammad6@gmail.com",
    "tranId": "DIT840RX2C(B-Merchant)",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1FCjscMWXG/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 67,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 67,
    "memberId": "NCM-P2-67",
    "name": "Najmul Kabir",
    "email": "nazmul.kabir194@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:46, 03:45:14 PM",
    "phone": "01827246646",
    "whatsapp": "01953957062",
    "address": "Uttara, Dhaka",
    "courseMail": "nazmul.kabir194@gmail.com",
    "medhaEmail": "najmulkabir2024@gmail.com",
    "tranId": "MD60-260929-7D987413",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/najmulkabir83",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 68,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 68,
    "memberId": "NCM-P2-68",
    "name": "Rakibul Rakhu",
    "email": "laaiq2014@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:47, 03:45:14 PM",
    "phone": "01715800235",
    "whatsapp": "01715800235",
    "address": "Uttara, Dhaka.",
    "courseMail": "laaiq2014@gmail.com",
    "medhaEmail": "laaiq2014@gmail.com",
    "tranId": "MD60-260929-65475D7C",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1EkVLLz9ix/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 69,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 69,
    "memberId": "NCM-P2-69",
    "name": "Mydul Islam",
    "email": "mdmydulislam97@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:48, 03:45:14 PM",
    "phone": "01755386562",
    "whatsapp": "01755386562",
    "address": "Valuka Mymensingh",
    "courseMail": "mdmydulislam97@gmail.com",
    "medhaEmail": "mdmydulislam97@gmail.com",
    "tranId": "MD60-260930-82F3583E",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/1CQE6Su6uh/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 70,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 70,
    "memberId": "NCM-P2-70",
    "name": "Sohel mahmud",
    "email": "mahmudsohel002@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:49, 03:45:14 PM",
    "phone": "01611042907",
    "whatsapp": "01611042907",
    "address": "Singapore",
    "courseMail": "mahmudsohel002@gmail.com",
    "medhaEmail": "mahmudsohel002@gmaip.com",
    "tranId": "MD60-260930-E1205F09",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19Z1ox7277/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 71,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 71,
    "memberId": "NCM-P2-71",
    "name": "Husain Ahmed Chowdhury",
    "email": "husain507@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:55, 03:45:14 PM",
    "phone": "01718538196",
    "whatsapp": "01718538196",
    "address": "মিতালি ৯১, রায়নগর, সিলেট",
    "courseMail": "husain507@gmail.com",
    "medhaEmail": "husain507@gmail.com",
    "tranId": "MD60-260930-1452C386",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/share/19Zb7cpTcZ/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 72,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 72,
    "memberId": "NCM-P2-72",
    "name": "Rejbi Hasan",
    "email": "shahinahmed4583@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:56, 03:45:14 PM",
    "phone": "01310346076",
    "whatsapp": "014378490458",
    "address": "Toronto, Canada",
    "courseMail": "shahinahmed4583@gmail.com",
    "medhaEmail": "shahinahmed4583@gmail.com",
    "tranId": "2358836294701814313",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/rejbi.hasan.946",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 73,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 73,
    "memberId": "NCM-P2-73",
    "name": "Mohammed Ibrahim",
    "email": "Ibrahimmohamedd535@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:57, 03:45:14 PM",
    "phone": "01819990290",
    "whatsapp": "01819990290",
    "address": "চট্টগ্রাম ফটিকছড়ি বিবিরহাট",
    "courseMail": "Ibrahimmohamedd535@gmail.com",
    "medhaEmail": "Ibrahimmohamedd535@gmail.com",
    "tranId": "DIU06NVVU4",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/mohammedIbrahim74",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 74,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 74,
    "memberId": "NCM-P2-74",
    "name": "Abbas Uddin",
    "email": "aptar8145@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:47:59, 03:45:14 PM",
    "phone": "0919775918735",
    "whatsapp": "0919775918735",
    "address": "South 24 Pargana, Kolkata, India",
    "courseMail": "aptar8145@gmail.com",
    "medhaEmail": "aptar8145@gmail.com",
    "tranId": "DIU86RGH6Q",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/abbas.uddin.mondal.146806/",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 75,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 75,
    "memberId": "NCM-P2-75",
    "name": "Hm Nazmul Islam Harun",
    "email": "hmn497900@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:00, 03:45:14 PM",
    "phone": "01604497900",
    "whatsapp": "01333101850",
    "address": "জেলা নেত্রকোনা,থানা কলমাকান্দা, ইউনিয়ন বড়খাপন, গ্রাম বিশাড়া। বর্তমান অবস্থান : গাজীপুর জেলা, শ্রীপুর উপজেলা, মাওনা ইউনিয়ন এম সি বাজার",
    "courseMail": "hmn497900@gmail.com",
    "medhaEmail": "hmn497900@gmail.com",
    "tranId": "MD60-260930-55075C23",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/hm.najmul.islam.harun",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 76,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 76,
    "memberId": "NCM-P2-76",
    "name": "Parvez Mia",
    "email": "parvezmia.uk@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:05, 03:45:14 PM",
    "phone": "0447475527224",
    "whatsapp": "0447475527223",
    "address": "79b Meikle Earnock Road, ML38AG Scotland",
    "courseMail": "parvezmia.uk@gmail.com",
    "medhaEmail": "parvezmia.uk@gmail.com",
    "tranId": "2358897529644388896",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/parvez.miia",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 77,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 77,
    "memberId": "NCM-P2-77",
    "name": "Rakib Sarker",
    "email": "rakibsarker551@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:06, 03:45:14 PM",
    "phone": "01631555566",
    "whatsapp": "01631555566",
    "address": "Besides IUT University Intertake Road, Sarker Bari, Gazipur.",
    "courseMail": "rakibsarker551@gmail.com",
    "medhaEmail": "rakibsarker551@gmail.com",
    "tranId": "DJ138GJWD5",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/prince.rakib.3956",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 78,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 78,
    "memberId": "NCM-P2-78",
    "name": "Abdullah Al Mamun",
    "email": "abdullahalmanun2day@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:08, 03:45:14 PM",
    "phone": "01966626811",
    "whatsapp": "01966626811",
    "address": "Laxmipur. Komol nogor",
    "courseMail": "abdullahalmanun2day@gmil.com",
    "medhaEmail": "abdullahalmanun2day@gmail.com",
    "tranId": "MD60-261001-3544E6D2",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/banglar.boos.31",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 79,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 79,
    "memberId": "NCM-P2-79",
    "name": "Md Atiq Mostofa",
    "email": "atiqmostofa@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:09, 03:45:14 PM",
    "phone": "01719199990",
    "whatsapp": "01719199990",
    "address": "Dinajpur",
    "courseMail": "atiqmostofa@gmail.com",
    "medhaEmail": "atiqmostofa@gmail.com",
    "tranId": "MD60-261002-EA946ED3",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/profile.php?id=61551773452543",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 80,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 80,
    "memberId": "NCM-P2-80",
    "name": "Suleman Ahmed",
    "email": "sulemanahmedddalim@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:11, 03:45:14 PM",
    "phone": "01748438087",
    "whatsapp": "01748438087",
    "address": "Hibganj, Sylhet",
    "courseMail": "sulemanahmedddalim@gmail.com",
    "medhaEmail": "sulemanahmedddalim@gmail.com",
    "tranId": "MD60-261003-6D458C9C",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/sulemanahmed.dalim",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 81,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 81,
    "memberId": "NCM-P2-81",
    "name": "Rubel Rana",
    "email": "rubelseueng096@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:16, 03:45:14 PM",
    "phone": "01748024748",
    "whatsapp": "01748024748",
    "address": "Sakhipur, Tangail",
    "courseMail": "rubelseueng096@gmail.com",
    "medhaEmail": "rubelseueng096@gmail.com",
    "tranId": "MD60-261004-CE5BF473",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/rubel.rana096",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 82,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 82,
    "memberId": "NCM-P2-82",
    "name": "MD Faisal Amin",
    "email": "faysalamin17@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:17, 03:45:14 PM",
    "phone": "01687609238",
    "whatsapp": "01780162515",
    "address": "ফতুল্লা নারায়ণগঞ্জ",
    "courseMail": "faysalamin17@gmail.com",
    "medhaEmail": "faysalamin17@gmail.com",
    "tranId": "MD60-261004-AF3A3497",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/faysal.amin.5055",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 83,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  },
  {
    "sl": 83,
    "memberId": "NCM-P2-83",
    "name": "SI Kallal",
    "email": "kollolraj23@gmail.com",
    "status": "Sent",
    "sentAt": "29-10-2026 15:48:19, 03:45:14 PM",
    "phone": "01861543144",
    "whatsapp": "01861543144",
    "address": "Silkybandha, Arulia, Bogura sodor, Bogura",
    "courseMail": "kollolraj23@gmail.com",
    "medhaEmail": "kollolraj23@gmail.com",
    "tranId": "DJ53GGFUPV",
    "plan": "Full Course",
    "team": "Lead Batch",
    "facebook": "https://www.facebook.com/kollol.raj",
    "paymentStatus": "Paid",
    "amount": 6500,
    "paymentChannel": "bKash",
    "_row": 84,
    "_tab": "Members NCM-P2",
    "_src": "Master File"
  }
];
  const demoMembers = () => [
    ...P1_MASTER_MEMBERS,
    ...BATCH01_MASTER_MEMBERS,
  ];

  /* --- Apps Script backend --- */
  const backendCall = async (action, data) => {
    const url = getBackendUrl();
    if (!url) throw new Error("No backend URL configured");
    // GAS hack: text/plain avoids CORS preflight
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...(data || {}) }),
    });
    return res.json();
  };

  /* --- localStorage persistence (instant paint on repeat visits) --- */
  const LS_KEY = "mpm.cache.members";
  const LS_TTL = 5 * 60 * 1000;   // 5 min — sheet is authoritative, this is just a fast first paint

  const readLocalCache = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.at) return null;
      if (Date.now() - parsed.at > LS_TTL) return null;
      return parsed.data;
    } catch { return null; }
  };

  const writeLocalCache = (data) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch (e) { /* quota — ignore */ }
  };
  try { const _c = readLocalCache(); if (_c) _lastFp = dataFingerprint(_c); } catch (e) {}


  /* The NCM master list is needed by Payments, Members and the profile
     drawer. It is kept in this browser as well, so a tab opens instantly
     instead of waiting for the network. */
  const MASTER_KEY = "mpm.cache.master";
  const MASTER_TTL = 6 * 60 * 60 * 1000;   /* 6 hours — the sheet rarely changes */

  const readMasterCache = () => {
    try {
      const raw = localStorage.getItem(MASTER_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !p.at || !Array.isArray(p.data)) return null;
      if (Date.now() - p.at > MASTER_TTL) return null;
      return p.data;
    } catch { return null; }
  };
  const writeMasterCache = (data) => {
    try {
      localStorage.setItem(MASTER_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch (e) { /* quota — ignore */ }
  };

  /* --- Public API --- */
  return {
    SHEET_ID,
    SHEET_TABS,
    NCM_SHEET_ID,
    BATCH01_SHEET_ID,
    NCM_TABS,
    TRACKER_COLS,
    TRACKER_GROUPS,
    getBackendUrl,

    /* ---- is this really a Web App address? ----
       A script EDIT address looks the same but returns a web page, not the
       API — that is the mistake that silently breaks everything. */
    checkBackendUrl: (url) => {
      const raw = String(url || "").trim();
      if (!raw) return { ok: false, reason: "empty", message: "Paste the Web App URL first." };
      if (!/^https?:\/\//i.test(raw)) {
        return { ok: false, reason: "format", message: "The address must start with https://" };
      }
      if (/\/edit(?:\?|#|$)/i.test(raw) || /\/home(?:\?|#|$)/i.test(raw)) {
        return {
          ok: false, reason: "edit-url",
          message: "This is the script EDIT address, not the Web App address. "
                 + "In Apps Script open Deploy → Manage deployments → copy the address that ends with /exec.",
        };
      }
      if (!/\/exec(?:\?|#|$)/i.test(raw)) {
        return {
          ok: false, reason: "not-exec",
          message: "A Web App address always ends with /exec. Open Apps Script → Deploy → "
                 + "Manage deployments and copy the address that ends with /exec.",
        };
      }
      return { ok: true, reason: "", message: "" };
    },

    /** Talk to the backend and see whether it really answers */
    pingBackend: async (url) => {
      const target = String(url || "").trim();
      const shape = Api.checkBackendUrl(target);
      if (!shape.ok) return { ok: false, message: shape.message };
      try {
        const res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "ping" }),
        });
        if (!res.ok) return { ok: false, message: "The server answered with HTTP " + res.status + "." };
        const data = await res.json();
        if (data && data.success) {
          return { ok: true, message: "Connected.", account: data.account || "", version: data.version || "" };
        }
        return { ok: false, message: (data && data.message) || "The backend did not confirm the connection." };
      } catch (e) {
        return {
          ok: false,
          message: "Could not reach the backend (" + (e && e.message ? e.message : "network error")
                 + "). Check the address, and that the deployment is set to Anyone.",
        };
      }
    },
    getConfig: () => getConfig(),
    setConfig: (cfg) => setConfig(cfg),
    setBackendUrl: (url) => {
      const u = String(url || "").trim();
      setConfig({ ...getConfig(), backendUrl: u });
      _sharedBackendUrl = u;
      cache.clear();
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      /* Persist for every device via Settings sheet */
      if (u) {
        fetch(u, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "setSharedBackendUrl", url: u }),
        }).catch(function () {});
      }
    },
    clearBackendUrl: () => {
      const current = getBackendUrl();
      setConfig({ ...getConfig(), backendUrl: "" });
      _sharedBackendUrl = "";
      cache.clear();
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      if (current) {
        fetch(current, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "clearSharedBackendUrl" }),
        }).catch(function () {});
      }
    },
    loadSharedBackendUrl,
    isBackendConfigured: () => !!getBackendUrl(),

    /**
     * Stale-while-revalidate:
     *  - cached sheet data returns instantly (no network wait)
     *  - a background refresh swaps in fresh data when it lands
     *  - the UI is never blocked on the network
     */
    getMembers: async (force = false) => {
      if (force) { cache.clear(); try { localStorage.removeItem(LS_KEY); } catch (e) {} }

      const cached = readLocalCache();
      const p2ok = (data) => {
        const p2 = (data && data["NCM PART-2"]) || [];
        if (!p2.length) return false;
        /* Master File enrichment = real profile fields (phone/address), not just email */
        const sample = p2.slice(0, 20);
        const rich = sample.filter(m => m.phone || m.address || m.whatsapp).length;
        return rich >= 3; /* at least a few rows must carry phone/address */
      };
      if (cached && p2ok(cached) && !force) {
        backgroundRefresh();
        return cached;
      }
      /* stale/incomplete cache — do not trust it for PART-2 profiles */
      if (cached && !p2ok(cached)) {
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        cache.clear();
      }

      /* Cold start: one wait for the sheet, then it is cached for next time.
         Backend list often lacks Master File phone/address — always enrich PART-2. */
      const backend = getBackendUrl();
      if (backend) {
        try {
          const r = await backendCall("getAllMembers");
          if (r && r.success && r.data) {
            let data = r.data;
            try {
              const b01 = await fetchBatch01();
              const p2old = data["NCM PART-2"] || [];
              const m = mergeBatch01(p2old, b01);
              data = buildMemberSet(
                data["NCM PART-1"] || [],
                m.p2,
                m.source || data._p2Source,
                m.note || data._p2Note,
                m.fromBatch01
              );
            } catch (enrichErr) {
              console.warn("Master File enrich failed", enrichErr);
            }
            if (p2ok(data)) {
              writeLocalCache(data);
              return data;
            }
          }
        } catch (e) { console.warn("Backend getAllMembers failed, falling back", e); }
      }
      return fetchAllMembers();
    },

    /** Called by the app when the background refresh lands, to repaint. */
    onFreshData: (cb) => { Api._freshCb = cb; },
    startAutoSync: (ms) => startAutoSync(ms),
    stopAutoSync: () => stopAutoSync(),
    backgroundRefresh: () => backgroundRefresh(),

    /* ---------- NCM Part-1 sheet (separate spreadsheet) ---------- */

    /** NCM Master File — enriched member records (phone, plan, team, payment, fees) */
    /** The stored copy — available instantly, no network */
    getNcmMasterCached: () => readMasterCache(),

    getNcmMaster: async () => {
      const key = "ncm:master";
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
      /* the browser already has it — hand it over at once, then refresh */
      const stored = readMasterCache();
      if (stored && stored.length) {
        Api.getNcmMaster().then(fresh => {
          cache.set(key, { t: Date.now(), v: fresh });
          writeMasterCache(fresh);
        }).catch(() => {});
        return stored;
      }
      try {
        const rows = gvizRows(await readGviz(NCM_SHEET_ID, NCM_TABS.master));
        const out = rows.map((r, i) => ({
          row: i + 1,
          sl: String(r[0] ?? "").trim(),
          memberId: String(r[1] ?? "").trim(),
          name: String(r[2] ?? "").trim(),
          phone: bdPhone(r[4]),
          whatsapp: bdPhone(r[5]),
          programEmail: String(r[6] ?? "").trim(),
          silverEmail: String(r[7] ?? "").trim(),
          medhaEmail: String(r[8] ?? "").trim(),
          plan: String(r[9] ?? "").trim(),
          tag: String(r[10] ?? "").trim(),
          fbProfile: String(r[11] ?? "").trim(),
          pageLink: String(r[12] ?? "").trim(),
          paymentDate: String(r[13] ?? "").trim(),
          paymentChannel: String(r[14] ?? "").trim(),
          team: String(r[15] ?? "").trim(),
          amount: String(r[16] ?? "").trim(),
          paymentStatus: String(r[17] ?? "").trim(),
          due: String(r[18] ?? "").trim(),
          julySF: String(r[19] ?? "").trim(),
          augSF: String(r[20] ?? "").trim(),
          sepSF: String(r[21] ?? "").trim(),
          octSF: String(r[22] ?? "").trim(),
        })).filter(m => m.memberId);
        cache.set(key, { v: out, t: Date.now() });
        writeMasterCache(out);
        return out;
      } catch (e) {
        console.warn("NCM master fetch failed:", e.message);
        return [];
      }
    },

    /** Monthly tracker grid (October / September / August / July) */
    getNcmTracker: async (monthTab, force = false) => {
      const tab = monthTab || NCM_TABS.trackers[0];
      const key = "ncm:tracker:" + tab;
      if (!force) {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.t < CACHE_TTL && hit.v && hit.v.length) return hit.v;
      }

      const parseTrackerRows = (rows) => (rows || []).map((r, i) => {
        const rec = { _row: i + 1 }; /* gviz index is 0-based from top of tab */
        TRACKER_COLS.forEach((spec, ci) => {
          let v = r[ci];
          if (v instanceof Date) v = v.toISOString();
          else if (v != null && typeof v === "number") v = Math.round(v * 1000) / 1000;
          rec[spec.key] = v == null ? "" : String(v).trim();
        });
        return rec;
      }).filter(r => r.memberId && r.name && /\d/.test(String(r.memberId)) && Number(r._row) >= 4);

      // Prefer backend — absolute _row matches the sheet (skips blank rows correctly)
      if (getBackendUrl()) {
        try {
          const r = await backendCall("getNcmTracker", { tab });
          const rows = (r && r.success && Array.isArray(r.rows)) ? r.rows : [];
          const ok = rows.filter(x => x && x.memberId && x.name);
          if (ok.length) {
            cache.set(key, { v: ok, t: Date.now() });
            return ok;
          }
        } catch (e) { console.warn("Backend tracker failed", e); }
      }

      // Public sheet read fallback (gviz) when backend is empty/unavailable
      try {
        const TRACKER_GIDS = { "October Tracker": "462029809" };
        const gid = TRACKER_GIDS[tab] || "";
        let data = null;
        if (gid) {
          try { data = await readGviz(NCM_SHEET_ID, gid, 0, { timeout: 12000, retries: 1 }); } catch (e1) { data = null; }
        }
        if (!data) {
          try { data = await readGviz(NCM_SHEET_ID, tab, 0, { timeout: 12000, retries: 1 }); } catch (e2) { data = null; }
        }
        if (data) {
          const out = parseTrackerRows(gvizRows(data));
          if (out.length) {
            cache.set(key, { v: out, t: Date.now() });
            return out;
          }
        }
      } catch (e) {
        console.warn("NCM tracker gviz failed:", e && e.message ? e.message : e);
      }

      return [];
    },

    /** Write one tracker cell (backend only — sheet stays the source of truth) */
    setTrackerCell: async (payload) => {
      const r = await backendCall("setNcmTrackerCell", payload);
      /* drop cached tracker so the next read sees the write (and sheet formulas) */
      try {
        for (const k of [...cache.keys()]) {
          if (String(k).startsWith("ncm:tracker:")) cache.delete(k);
        }
      } catch (e) {}
      return r;
    },

    /** Both spreadsheet links (shown in the sidebar) */
        sheetLinks: () => {
      const all = [
        {
          id: "ncm-part1",
          label: "NCM Part 1 sheet",
          sub: "Master File · Monthly trackers",
          url: "https://docs.google.com/spreadsheets/d/1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE/edit?gid=349429573#gid=349429573",
        },
        {
          id: "batch01-master",
          label: "Medha Batch-01 Master sheet",
          sub: "NCM PART-2 · Master File",
          url: "https://docs.google.com/spreadsheets/d/1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw/edit?gid=738811071#gid=738811071",
        },
        {
          id: "medha-program",
          label: "Medha Program sheet",
          sub: "Members NCM-P1 / P2 · EmailLog · Settings",
          url: "https://docs.google.com/spreadsheets/d/1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII/edit?gid=1040274874#gid=1040274874",
        },
      ];
      let hidden = [];
      try { hidden = JSON.parse(localStorage.getItem("mpm.sheets.hidden") || "[]") || []; } catch (e) {}
      return all.filter((x) => !hidden.includes(x.id));
    },
    allSheetLinks: () => ([
      {
        id: "ncm-part1",
        label: "NCM Part 1 sheet",
        sub: "Master File · Monthly trackers",
        url: "https://docs.google.com/spreadsheets/d/1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE/edit?gid=349429573#gid=349429573",
      },
      {
        id: "batch01-master",
        label: "Medha Batch-01 Master sheet",
        sub: "NCM PART-2 · Master File",
        url: "https://docs.google.com/spreadsheets/d/1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw/edit?gid=738811071#gid=738811071",
      },
      {
        id: "medha-program",
        label: "Medha Program sheet",
        sub: "Members NCM-P1 / P2 · EmailLog · Settings",
        url: "https://docs.google.com/spreadsheets/d/1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII/edit?gid=1040274874#gid=1040274874",
      },
    ]),
    hideSheetLink: (id) => {
      let hidden = [];
      try { hidden = JSON.parse(localStorage.getItem("mpm.sheets.hidden") || "[]") || []; } catch (e) {}
      if (!hidden.includes(id)) hidden.push(id);
      localStorage.setItem("mpm.sheets.hidden", JSON.stringify(hidden));
    },
    unhideSheetLink: (id) => {
      let hidden = [];
      try { hidden = JSON.parse(localStorage.getItem("mpm.sheets.hidden") || "[]") || []; } catch (e) {}
      hidden = hidden.filter((x) => x !== id);
      localStorage.setItem("mpm.sheets.hidden", JSON.stringify(hidden));
    },


    /* ---------- Medha Support (app.medha.pro) ---------- */
    SUPPORT_URL: "https://app.medha.pro/ops/support",

    checkFrameable: async (url) => {
      if (!getBackendUrl()) return { success: false, frameable: null };
      try { return await backendCall("checkFrameable", { url }); }
      catch { return { success: false, frameable: null }; }
    },

    supportStatus: async () => {
      if (!getBackendUrl()) return { success: false, connected: false };
      try { return await backendCall("supportStatus", {}); }
      catch { return { success: false, connected: false }; }
    },

    supportLogin: async () => {
      if (!getBackendUrl()) return { success: false, message: "Backend not connected" };
      return backendCall("supportLogin", {});
    },

    supportDiscover: async () => {
      if (!getBackendUrl()) return { success: false, message: "Backend not connected" };
      return backendCall("supportDiscover", {});
    },

    /** Log in + find the ticket endpoint + return normalised tickets */
    supportConnect: async () => {
      if (!getBackendUrl()) return { success: false, message: "Backend not connected" };
      return backendCall("supportConnect", {});
    },

    supportDiscoverTickets: async () => {
      if (!getBackendUrl()) return { success: false, message: "Backend not connected" };
      return backendCall("supportDiscoverTickets", {});
    },

    supportRequest: async (payload) => {
      if (!getBackendUrl()) return { success: false, message: "Backend not connected" };
      return backendCall("supportRequest", payload || {});
    },

    setSupportCredentials: async (cred) => {
      if (!getBackendUrl()) return { success: false, message: "Backend not connected" };
      return backendCall("setSupportCredentials", { cred });
    },

    /* ---------- Form registry (control any Google / HTML form) ---------- */
    _defaultForm: () => ({
      id: "APP",
      name: "Application Form",
      type: "google",
      link: "",
      open: false,
      openFrom: "",
      deadline: "",
      msgBn: "",
      msgEn: "The application period has ended.",
    }),

    getFormSettings: async () => {
      if (!getBackendUrl()) {
        let list = Api._localForms();
        if (!list.length) { list = [Api._defaultForm()]; try { localStorage.setItem("mpm.forms.local", JSON.stringify(list)); } catch (e) {} }
        return { success: true, forms: list };
      }
      try {
        const r = await backendCall("getFormSettings", {});
        if (r && r.success && r.forms && r.forms.length) return r;
        if (r && r.success) {
          // backend had nothing stored — seed the default so the panel is usable
          const seeded = await backendCall("saveFormSettings", { form: Api._defaultForm() });
          if (seeded && seeded.success) return seeded;
        }
      } catch (e) { console.warn("form settings fetch failed", e); }
      return { success: true, forms: [Api._defaultForm()] };
    },

    saveFormSettings: async (form) => {
      if (!getBackendUrl()) {
        const list = Api._localForms().filter(f => f.id !== form.id);
        list.push(form);
        try { localStorage.setItem("mpm.forms.local", JSON.stringify(list)); } catch (e) {}
        return { success: true, forms: list };
      }
      return backendCall("saveFormSettings", { form });
    },

    deleteFormSettings: async (id) => {
      if (!getBackendUrl()) {
        const list = Api._localForms().filter(f => f.id !== id);
        try { localStorage.setItem("mpm.forms.local", JSON.stringify(list)); } catch (e) {}
        return { success: true, forms: list };
      }
      return backendCall("deleteFormSettings", { id });
    },

    getFormState: async (id) => {
      if (!getBackendUrl()) {
        const f = Api._localForms().find(x => x.id === id);
        return { success: !!f, form: f || null, open: !!(f && f.open) };
      }
      return backendCall("getFormState", { id });
    },

    _localForms: () => {
      try {
        const raw = localStorage.getItem("mpm.forms.local");
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    },

    /* ---------- Agreements register ---------- */
    AGREEMENT_HEADERS: ["SL", "Member ID", "Name", "Batch", "Status", "Signed Date", "Document Link", "Notes"],
    AGREEMENT_STATUSES: ["Pending", "Signed", "Declined", "Not required"],

    getAgreements: async () => {
      // backend first (authoritative, gives absolute sheet rows)
      if (getBackendUrl()) {
        try {
          const r = await backendCall("getAgreements", {});
          if (r && r.success) return { rows: r.rows || [], exists: r.exists !== false, connected: true };
        } catch (e) { console.warn("agreements backend failed", e); }
      }
      // read-only fallback straight from the sheet
      try {
        const rows = gvizRows(await readGviz(SHEET_ID, "Agreements"));
        const first = rows[0] || [];
        const head = (first[1] || "").trim().toLowerCase();
        // the tab does not exist yet -> gviz falls back to the default sheet
        if (head !== "member id") return { rows: [], exists: false, connected: false };
        const out = rows.slice(1).map((r, i) => ({
          _row: i + 2,
          sl: String(r[0] ?? "").trim(),
          memberId: String(r[1] ?? "").trim(),
          name: String(r[2] ?? "").trim(),
          batch: String(r[3] ?? "").trim(),
          status: String(r[4] ?? "").trim(),
          signedDate: String(r[5] ?? "").trim(),
          link: String(r[6] ?? "").trim(),
          notes: String(r[7] ?? "").trim(),
        })).filter(r => r.memberId || r.name);
        return { rows: out, exists: true, connected: false };
      } catch (e) {
        return { rows: [], exists: false, connected: false, error: e.message };
      }
    },

    upsertAgreement: async (form, row) => {
      if (!getBackendUrl()) return { success: false, message: "Connect the Apps Script backend to save to the sheet." };
      return backendCall("upsertAgreement", { form, row });
    },

    deleteAgreement: async (row) => {
      if (!getBackendUrl()) return { success: false, message: "Connect the Apps Script backend to delete rows." };
      return backendCall("deleteAgreement", { row });
    },

    seedAgreements: async () => {
      if (!getBackendUrl()) return { success: false, message: "Connect the Apps Script backend to generate rows." };
      return backendCall("seedAgreements", {});
    },

    /* ---------- Results (Google Docs / email / history) ---------- */
    generateResultDocs: async (payload) => {
      if (!getBackendUrl()) return { success: false, message: "Connect the Apps Script backend to create Google Docs." };
      return backendCall("generateResultDocs", payload);
    },

    emailResults: async (payload) => {
      if (!getBackendUrl()) return { success: false, message: "Connect the Apps Script backend to send emails." };
      return backendCall("emailResults", payload);
    },

    getResults: async () => {
      if (!getBackendUrl()) return { success: true, rows: [] };
      try { return await backendCall("getResults", {}); }
      catch { return { success: true, rows: [] }; }
    },

    /* ---------- Settings / admin password gate ---------- */
    SETTINGS_PASSWORD: "2026",

    checkSettingsPassword: (pw) => {
      const want = (Api.getConfig().settingsPassword || "2026");
      return String(pw || "") === String(want);
    },

    setSettingsPassword: (pw) => {
      setConfig({ ...getConfig(), settingsPassword: pw });
    },

    FILES_KEY: "mpm.files.local",

    _localFiles: () => {
      try {
        const raw = localStorage.getItem(Api.FILES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    },
    _saveLocalFiles: (list) => {
      try { localStorage.setItem(Api.FILES_KEY, JSON.stringify(list)); } catch (e) {}
    },

    /* ---- files marked for removal stay out of the list straight away, but
       they are only really deleted when the undo window has passed ---- */
    _HIDING_KEY: "mpm.files.hiding",
    _pendingDelete: new Map(),

    _hiddenIds: () => {
      try { return JSON.parse(localStorage.getItem(Api._HIDING_KEY) || "[]"); }
      catch (e) { return []; }
    },
    _setHiddenIds: (ids) => {
      try { localStorage.setItem(Api._HIDING_KEY, JSON.stringify(ids)); } catch (e) {}
    },

    /* ---- carry the document list to another address ----------------------
       The list lives in this browser, so a new domain starts empty. These
       two helpers put the list inside the link itself, so it can travel. */
    _b64encode: (obj) => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      let bin = "";
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    _b64decode: (str) => {
      const bin = atob(String(str).replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    },

    /** the list as a small piece of text that can travel inside a link */
    exportFileList: async () => {
      const files = await Api.listFiles();
      return Api._b64encode(files.map((f) => ({
        id: f.id, name: f.name, url: f.url || "", kind: f.kind || "link",
        size: f.size || 0, mime: f.mime || "", at: f.at || Date.now(),
      })));
    },

    /** read a list back out of a shared link and keep it in this browser */
    importFileList: async (code) => {
      let list;
      try { list = Api._b64decode(code); } catch (e) { return { ok: false, count: 0 }; }
      if (!Array.isArray(list) || !list.length) return { ok: false, count: 0 };
      const cur = Api._localFiles();
      const have = {};
      cur.forEach((f) => { have[f.id] = true; });
      let added = 0;
      list.forEach((f) => {
        if (!f || !f.name || have[f.id]) return;
        cur.push({
          id: f.id, name: f.name, url: f.url || "",
          kind: f.kind || (f.url ? "link" : "doc"),
          size: f.size || 0, mime: f.mime || "", at: f.at || Date.now(),
        });
        added++;
      });
      if (added) Api._saveLocalFiles(cur);
      return { ok: true, count: added };
    },

    listFiles: async () => {
      const hiding = Api._hiddenIds();
      let files;
      if (getBackendUrl()) {
        try {
          const r = await backendCall("listFiles", {});
          if (r && r.success) files = r.files;
        } catch (e) { console.warn("Drive list failed", e); }
      }
      if (!files) files = Api._localFiles();
      return hiding.length ? files.filter(f => hiding.indexOf(f.id) === -1) : files;
    },

    /**
     * Remove a file, but keep an undo window open.
     * The file disappears from the list at once; the real delete (local list
     * or Google Drive) only happens after `delay` ms — unless it is undone.
     */
    removeFileLater: async (id, delay = 10000) => {
      Api._setHiddenIds(Api._hiddenIds().concat([id]));
      const old = Api._pendingDelete.get(id);
      if (old) clearTimeout(old);
      const timer = setTimeout(async () => {
        Api._pendingDelete.delete(id);
        try { await Api.deleteFile(id); } catch (e) { /* already gone */ }
        Api._setHiddenIds(Api._hiddenIds().filter(x => x !== id));
      }, delay);
      Api._pendingDelete.set(id, timer);
      return { ok: true, undoUntil: Date.now() + delay };
    },

    /** Undo a removal — the file comes back and the delete is cancelled */
    restoreFile: async (id) => {
      const t = Api._pendingDelete.get(id);
      if (t) { clearTimeout(t); Api._pendingDelete.delete(id); }
      Api._setHiddenIds(Api._hiddenIds().filter(x => x !== id));
      return { ok: true };
    },

    /** on a fresh page load any pending removal is forgotten — nothing was lost */
    clearPendingRemovals: () => {
      try { Api._pendingDelete.forEach(t => clearTimeout(t)); } catch (e) {}
      Api._pendingDelete.clear();
      Api._setHiddenIds([]);
    },

    addFile: async (file) => {
      if (getBackendUrl()) {
        try {
          const r = await backendCall("addFile", { file });
          if (r && r.success) return { ok: true, file: r.file, remote: true };
        } catch (e) { console.warn("Drive add failed", e); }
      }
      const list = Api._localFiles();
      const rec = {
        /* unique even when two files are added in the same millisecond */
        id: "f_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
        name: file.name || "Untitled",
        url: file.url || "",
        kind: file.kind || (file.url ? "link" : "doc"),
        size: file.size || 0,
        mime: file.mime || "",
        at: Date.now(),
      };
      list.unshift(rec);
      Api._saveLocalFiles(list);
      return { ok: true, file: rec, remote: false };
    },

    uploadFile: async (file) => {
      if (getBackendUrl()) {
        try {
          const r = await backendCall("uploadFile", { file });
          if (r && r.success) return { ok: true, file: r.file, remote: true };
        } catch (e) { console.warn("Drive upload failed", e); }
      }
      return Api.addFile(file);
    },

    updateFile: async (file) => {
      if (getBackendUrl()) {
        try {
          const r = await backendCall("updateFile", { file });
          if (r && r.success) return { ok: true, file: r.file, remote: true };
        } catch (e) { console.warn("Drive update failed", e); }
      }
      const list = Api._localFiles();
      const i = list.findIndex(f => f.id === file.id);
      if (i >= 0) { list[i] = { ...list[i], ...file, at: Date.now() }; Api._saveLocalFiles(list); }
      return { ok: i >= 0, file: list[i] };
    },

    deleteFile: async (id) => {
      if (getBackendUrl()) {
        try {
          const r = await backendCall("deleteFile", { id });
          if (r && r.success) return { ok: true, remote: true };
        } catch (e) { console.warn("Drive delete failed", e); }
      }
      const list = Api._localFiles().filter(f => f.id !== id);
      Api._saveLocalFiles(list);
      return { ok: true, remote: false };
    },

    getStats: async () => {
      const m = await Api.getMembers();
      const all = m._all || [];
      const sent = all.filter(x => x.status.toLowerCase() === "sent").length;
      return {
        total: all.length,
        p1: m["NCM PART-1"].length,
        p2: m["NCM PART-2"].length,
        sent,
        pending: all.length - sent,
      };
    },

    getMailBadge: async () => {
      if (!getBackendUrl()) return { unread: 0, items: [] };
      try {
        const r = await backendCall("getMailBadge", { withList: true });
        return r || { unread: 0, items: [] };
      } catch { return { unread: 0, items: [] }; }
    },

    /** Mark one inbox mail as read (the user opened it) */
    getMailBody: async (threadId) => {
      if (!getBackendUrl() || !threadId) return { success: false, body: "" };
      try { return await backendCall("getMailBody", { threadId }); }
      catch { return { success: false, body: "" }; }
    },

    markMailRead: async (threadId) => {
      if (!getBackendUrl() || !threadId) return { success: false };
      try { return await backendCall("markMailRead", { threadId }); }
      catch { return { success: false }; }
    },

    /** Mark every inbox mail as read (called when the user opens the inbox) */
    markMailSeen: async () => {
      if (!getBackendUrl()) return { success: false, marked: 0 };
      try { return await backendCall("markMailSeen", {}); }
      catch { return { success: false, marked: 0 }; }
    },

    /** Mark one thread as unread again */
    markMailUnread: async (threadId) => {
      if (!getBackendUrl() || !threadId) return { success: false, message: "No backend or threadId" };
      try {
        const r = await backendCall("markMailUnread", { threadId });
        return r || { success: false, message: "Empty response" };
      } catch (e) {
        return { success: false, message: String((e && e.message) || e) };
      }
    },

    /** Mark every inbox mail as unread again */
    markMailUnseen: async () => {
      if (!getBackendUrl()) return { success: false, marked: 0 };
      try { return await backendCall("markMailUnseen", {}); }
      catch { return { success: false, marked: 0 }; }
    },

    listProgramDrafts: async () => {
      try { return await backendCall("listProgramDrafts", {}); }
      catch (e) { return { success: false, drafts: [], message: String(e.message || e) }; }
    },
    saveProgramDraft: async (draft) => backendCall("saveProgramDraft", { draft }),
    loadProgramDraft: async (id) => backendCall("loadProgramDraft", { program: id, id }),
    deleteProgramDraft: async (id) => backendCall("deleteProgramDraft", { id }),

    scheduleProgramMail: async (payload) => backendCall("scheduleProgramMail", { payload }),
    listProgramSchedules: async () => {
      try {
        const r = await backendCall("listProgramSchedules", {});
        return r || { success: false, schedules: [] };
      } catch (e) { return { success: false, schedules: [], message: String(e.message || e) }; }
    },
    cancelProgramSchedule: async (id) => backendCall("cancelProgramSchedule", { id }),
    updateProgramSchedule: async (payload) => backendCall("updateProgramSchedule", { payload }),
    processDueSchedules: async () => {
      try { return await backendCall("processDueProgramSchedules", {}); }
      catch (e) { return { success: false, processed: [], message: String(e.message || e) }; }
    },
    ensureScheduleTrigger: async () => {
      try { return await backendCall("ensureProgramScheduleTrigger", {}); }
      catch (e) { return { success: false, message: String(e.message || e) }; }
    },

    sendMail: async (payload) => backendCall("sendProgramMails", { payload }),

    /* Appreciation — one Google Doc per selected member */
    createAppreciationDocs: async (payload) => {
      if (!getBackendUrl()) return { success: false, count: 0, urls: [], message: "Backend not connected" };
      try {
        const r = await backendCall("createAppreciationDocs", payload || {});
        return {
          success: !!(r && r.success),
          count: Number((r && r.count) || 0),
          urls: (r && r.urls) || [],
          message: (r && r.message) || "",
        };
      } catch (e) {
        return { success: false, count: 0, urls: [], message: String((e && e.message) || e) };
      }
    },

    getQuota: async () => {
      if (!getBackendUrl()) return { remaining: null, message: "Backend not connected" };
      try {
        let r = await backendCall("getEmailQuota", {});
        if (!r || (r.remaining == null && !r.success)) {
          try { r = await backendCall("getQuota", {}); } catch (e2) {}
        }
        if (!r) return { remaining: null, message: "Empty response from backend" };
        /* Apps Script sometimes returns {success:false, message:"Exception: ..."} */
        if (r.remaining == null && (r.message || r.error)) {
          return { remaining: null, message: String(r.message || r.error) };
        }
        if (r.remaining != null) return r;
        if (r.data && r.data.remaining != null) return Object.assign({}, r, { remaining: r.data.remaining });
        return r;
      } catch (e) {
        return { remaining: null, message: String((e && e.message) || e) };
      }
    },

    /** Email history log (from EmailLog sheet) */
    getEmailLogs: async (limit = 40) => {
      if (!getBackendUrl()) return [];
      try {
        const r = await backendCall("getEmailLogs", { limit });
        return Array.isArray(r) ? r : [];
      } catch { return []; }
    },

    /** Load the actual sent body from Gmail Sent folder */
    fetchLogMailBody: async (subject, recipient) => {
      if (!getBackendUrl()) return { success: false, body: "", message: "Backend not connected" };
      try {
        return await backendCall("fetchLogMailBody", { subject: subject || "", recipient: recipient || "" });
      } catch (e) { return { success: false, body: "", message: e.message }; }
    },

    syncGmail: async () => backendCall("syncGmailSent", {}),

    refreshCache: () => cache.clear(),
  };
})();