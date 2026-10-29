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

  const getBackendUrl = () => getConfig().backendUrl || "";

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
    let s = String(v == null ? "" : v).trim();
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

    const data = await jsonp(tab);
    const out = gvizToMembers(data, tab);
    cache.set(key, { v: out, t: Date.now() });
    return out;
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
    { gid: "738811071", name: "Master File" },
    { gid: "2071651608", name: "Members Serial" },
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
    for (const p of priority) {
      const i = cols.findIndex(c => normLabel(c) === p);
      if (i >= 0) return i;
    }
    if (exactOnly) return -1;
    for (const p of priority) {
      const i = cols.findIndex(c => normLabel(c).indexOf(p) !== -1);
      if (i >= 0) return i;
    }
    if (loose) {
      const i = cols.findIndex(c => loose.some(f => normLabel(c).indexOf(f) !== -1));
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
    const gid = "738811071";
    const url = `https://docs.google.com/spreadsheets/d/${BATCH01_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) throw new Error("CSV " + res.status);
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error("CSV empty");
      /* naive CSV split that handles quotes */
      const split = (line) => {
        const out = []; let cur = ""; let q = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { q = !q; continue; }
          if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
          cur += ch;
        }
        out.push(cur);
        return out.map(s => s.trim());
      };
      const headers = split(lines[0]).map(h => h.replace(/^"|"$/g, "").trim());
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
      const rows = [];
      for (let r = 1; r < lines.length; r++) {
        const cols = split(lines[r]).map(c => c.replace(/^"|"$/g, "").trim());
        const name = iName >= 0 ? cols[iName] || "" : "";
        const email = iEmail >= 0 ? cols[iEmail] || "" : "";
        if (!name && !email) continue;
        const n = String(r);
        rows.push({
          sl: cols[0] || String(r),
          memberId: "NCM-P2-" + (n.length < 2 ? "0" + n : n),
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
      return { ok: false, rows: null, error: String(e.message || e), at: Date.now() };
    }
  };

  /** Find the right tab in the Batch-01 spreadsheet and read the list */
  const fetchBatch01 = async () => {
    const key = "sheet:batch01";
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;

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

  const demoMembers = () => [
    { sl: 1, memberId: "NCM-01", name: "Israt Jahan", email: "isratjahan348065@gmail.com", status: "", sentAt: "", _row: 2, _tab: "Members NCM-P1" },
    { sl: 2, memberId: "NCM-02", name: "Omar shah", email: "omarshah77@gmail.com", status: "", sentAt: "", _row: 3, _tab: "Members NCM-P1" },
    { sl: 3, memberId: "NCM-03", name: "Redwan Safi", email: "sherminahasan5@gmail.com", status: "", sentAt: "", _row: 4, _tab: "Members NCM-P1" },
    { sl: 4, memberId: "NCM-04", name: "Sk Mesbah", email: "skmesbah30@gmail.com", status: "", sentAt: "", _row: 5, _tab: "Members NCM-P1" },
    { sl: 5, memberId: "NCM-05", name: "MD Tawhid Islam", email: "tawid466@gmail.com", status: "", sentAt: "", _row: 6, _tab: "Members NCM-P1" },
    { sl: 6, memberId: "NCM-06", name: "Mokter Hossain", email: "moktarsafiz@gmail.com", status: "", sentAt: "", _row: 7, _tab: "Members NCM-P1" },
    { sl: 7, memberId: "NCM-10", name: "Md Musa mia", email: "mdmusamiabd@gmail.com", status: "Sent", sentAt: "2026-10-19 14:44:10", _row: 11, _tab: "Members NCM-P1" },
    { sl: 8, memberId: "NCM-13", name: "Asiful Islam Chowdhury Fahim", email: "fahimasiful@gmail.com", status: "Sent", sentAt: "2026-10-19 14:44:11", _row: 14, _tab: "Members NCM-P1" },
    { sl: 9, memberId: "NCM-16", name: "Emran", email: "emranhosse295@gmail.com", status: "Sent", sentAt: "2026-10-13 17:18:47", _row: 17, _tab: "Members NCM-P1" },
    { sl: 10, memberId: "NCM-35", name: "Humayun Islam", email: "humayunislam2000@gmail.com", status: "Sent", sentAt: "2026-10-19 14:44:12", _row: 36, _tab: "Members NCM-P1" },
    { sl: 1, memberId: "NCM-P2-01", name: "Sohel Razzak", email: "to.rubai@gmail.com", status: "Sent", sentAt: "10-10-2026 13:27:35", _row: 2, _tab: "Members NCM-P2" },
    { sl: 2, memberId: "NCM-P2-02", name: "Saleh Ahmed Hemel", email: "hemelahmed1995@gmail.com", status: "Sent", sentAt: "10-10-2026 13:27:38", _row: 3, _tab: "Members NCM-P2" },
    { sl: 3, memberId: "NCM-P2-03", name: "Hafiz Mohammed Iqbal", email: "rahathossain0991@gmail.com", status: "Sent", sentAt: "10-10-2026 13:27:42", _row: 4, _tab: "Members NCM-P2" },
    { sl: 4, memberId: "NCM-P2-04", name: "MD. RASEL AHMED", email: "rasel.spmss@gmail.com", status: "Sent", sentAt: "10-10-2026 13:27:45", _row: 5, _tab: "Members NCM-P2" },
    { sl: 5, memberId: "NCM-P2-05", name: "Foysal Islam", email: "fishimul@gmail.com", status: "Sent", sentAt: "14-10-2026 14:57:41", _row: 6, _tab: "Members NCM-P2" },
    { sl: 6, memberId: "NCM-P2-06", name: "SM Shopon Ahamed", email: "smshopon6170@gmail.com", status: "Sent", sentAt: "10-10-2026 13:27:56", _row: 7, _tab: "Members NCM-P2" },
    { sl: 7, memberId: "NCM-P2-07", name: "Abul Kashem khandany", email: "kashemkhandany89@gmail.com", status: "Sent", sentAt: "10-10-2026 13:28:02", _row: 8, _tab: "Members NCM-P2" },
    { sl: 8, memberId: "NCM-P2-10", name: "Nusrat Jahan", email: "tanny.nusrat21@gmail.com", status: "Sent", sentAt: "10-10-2026 13:28:16", _row: 11, _tab: "Members NCM-P2" },
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
      setConfig({ ...getConfig(), backendUrl: url });
      cache.clear();
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
    },
    isBackendConfigured: () => !!getBackendUrl(),

    /**
     * Stale-while-revalidate:
     *  - cached sheet data returns instantly (no network wait)
     *  - a background refresh swaps in fresh data when it lands
     *  - the UI is never blocked on the network
     */
    getMembers: async (force = false) => {
      if (force) { cache.clear(); try { localStorage.removeItem(LS_KEY); } catch (e) {} }

      /* Whatever this browser already has is shown straight away — the page
         must never wait for the network. The refresh happens behind it. */
      const cached = readLocalCache();
      if (cached) {
        backgroundRefresh();      // refresh in background — UI already painted
        return cached;
      }

      /* Cold start: one wait for the sheet, then it is cached for next time */
      const backend = getBackendUrl();
      if (backend) {
        try {
          const r = await backendCall("getAllMembers");
          if (r && r.success) { writeLocalCache(r.data); return r.data; }
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
        if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
      }

      // Backend connected → use it (absolute sheet row numbers, exact values)
      if (getBackendUrl()) {
        try {
          const r = await backendCall("getNcmTracker", { tab });
          if (r && r.success && r.rows) {
            cache.set(key, { v: r.rows, t: Date.now() });
            return r.rows;
          }
        } catch (e) { console.warn("Backend tracker failed, falling back", e); }
      }

      try {
        const rows = gvizRows(await readGviz(NCM_SHEET_ID, tab));
        const out = rows.map((r, i) => {
          // gviz rows start at the first data row (sheet row 4) → absolute row = i + 4
          const rec = { _row: i + 4 };
          TRACKER_COLS.forEach((spec, ci) => {
            let v = r[ci];
            if (v instanceof Date) v = v.toISOString();
            else if (v != null && typeof v === "number") v = Math.round(v * 1000) / 1000;
            rec[spec.key] = v == null ? "" : String(v).trim();
          });
          return rec;
        }).filter(r => r.memberId && r.name && /\d/.test(r.memberId));
        cache.set(key, { v: out, t: Date.now() });
        return out;
      } catch (e) {
        console.warn("NCM tracker fetch failed:", e.message);
        return [];
      }
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

    sendMail: async (payload) => backendCall("sendProgramMails", { payload }),

    getQuota: async () => {
      if (!getBackendUrl()) return { remaining: null };
      try { return await backendCall("getEmailQuota", {}); }
      catch { return { remaining: null }; }
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