/* === Medha Program Management — result generation (Scores & results) === */
/*
 * Builds Word (.docx) result cards in the browser and, when the Apps Script
 * backend is connected, can also save them to Google Docs and email them.
 */

const Results = (() => {
  const MANUAL_COLS = [
    { key: "assignment20",  label: "Assignment (20)",             max: 20 },
    { key: "workshop20",    label: "Workshop (20)",               max: 20 },
    { key: "emailFeedback5",label: "Email & Feedback (5)",        max: 5 },
    { key: "monthlyExam30", label: "Monthly Exam (30)",           max: 30 },
    { key: "professional10",label: "Professional Behaviour (10)", max: 10 },
    { key: "paymentCompliance5", label: "Payment Compliance (5)",   max: 5 },
  ];



  /** "October Tracker" -> "October" (the tracker month, no year) */
  const monthName = (tab) => String(tab || "").replace(/\s*Tracker\s*$/i, "").trim();

  /** "October Tracker" -> "October 2026" (year taken from the tracker's own dates) */
  const monthLabel = (tab, rows) => {
    const name = String(tab || "").replace(/\s*Tracker\s*$/i, "").trim();
    let year = null;
    for (const r of (rows || [])) {
      const d = String(r.sentAt || "");
      const m = d.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) || d.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (m) {
        year = d.match(/^(\d{4})/) ? m[1] : m[3];
        break;
      }
    }
    if (!year) year = String(new Date().getFullYear());
    return year ? `${name} ${year}` : name;
  };

  /* ---------- live score maths (mirrors the tracker sheet formulas) ----------
     The NCM tracker sheet computes, for every member:
        K  = COUNTIF(D:J,"Punctual")
        L  = COUNTIF(D:J,"Late")
        M  = COUNTIF(D:J,"Absent")
        N  = IFERROR((K + L*0.5)/11, 0)      -> attendance %
        O  = attendance remark
        P  = N * 10                           -> Attendance (10)
        W  = SUM(P:V)                         -> Total (100)
        X  = grade from W
        Y  = authority remark from X
     We recompute the same numbers in the browser so the grid, the result card
     and the DOCX update instantly while the marks still live in the draft.
  */
  const ATTENDANCE_SESSIONS = 11;   // sheet divides by 11

  /** sheet N: (Punctual + Late*0.5) / 11 */
  const attendancePctOf = (punctual, late) => {
    const p = parseFloat(punctual) || 0;
    const l = parseFloat(late) || 0;
    const v = (p + l * 0.5) / ATTENDANCE_SESSIONS;
    return isNaN(v) ? 0 : v;
  };

  /** sheet P: attendance % * 10 */
  const attendance10Of = (punctual, late) => attendancePctOf(punctual, late) * 10;

  /** sheet X: grade from the total */
  const gradeOf = (total) => {
    const w = parseFloat(total);
    if (isNaN(w)) return "F";
    if (w >= 95) return "A+";
    if (w >= 90) return "A";
    if (w >= 85) return "B+";
    if (w >= 80) return "B";
    if (w >= 75) return "C+";
    if (w >= 70) return "C";
    if (w >= 60) return "D";
    return "F";
  };

  /** sheet Y: the authority remark that belongs to a grade */
  const REMARKS_BY_GRADE = {
    "A+": "Outstanding achievement. Your dedication and consistency are truly commendable. Keep striving for excellence.",
    "A":  "Excellent performance. Your strong understanding and consistent effort are highly appreciated. Keep progressing.",
    "B+": "Very good performance. Keep practicing consistently to reach an even higher level of achievement.",
    "B":  "Good performance. You have a solid foundation; continued practice will help you improve further.",
    "C+": "Satisfactory performance. With greater consistency and focused practice, you can achieve stronger results.",
    "C":  "Improvement is needed. Focus on your learning gaps and practice regularly to make steady progress.",
    "D":  "At-risk performance. Additional effort, regular practice, and proper guidance are strongly recommended.",
    "F":  "Performance is below the expected standard. Identify your learning gaps, seek guidance, and work consistently toward improvement.",
  };
  const remarkOf = (grade) => REMARKS_BY_GRADE[grade] || REMARKS_BY_GRADE.F;

  /** sheet W: SUM(P:V) — attendance + the six manual score columns */
  const totalOf = (attendance10, manual) => {
    const parts = [attendance10];
    MANUAL_COLS.forEach(c => {
      const v = parseFloat(manual ? manual[c.key] : "");
      parts.push(isNaN(v) ? 0 : v);
    });
    return Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
  };

  /**
   * Recompute one tracker's live values.
   * `manual` = { assignment20, workshop20, ... } with the draft values applied.
   */
  const computeLive = (m, manual) => {
    const punctual = parseFloat(m.punctualCount) || 0;
    const late = parseFloat(m.lateCount) || 0;
    const attendance10 = attendance10Of(punctual, late);
    const total = totalOf(attendance10, manual);
    const grade = gradeOf(total);
    return {
      attendancePct: attendancePctOf(punctual, late),
      attendance10: Math.round(attendance10 * 100) / 100,
      total: Math.round(total * 10) / 10,
      grade,
      remarks: remarkOf(grade),
      resultCard: remarkOf(grade),
    };
  };

  const buildRow = (m, month, rank) => {
    const num = (k) => { const v = parseFloat(m[k]); return isNaN(v) ? "" : v; };
    /* live values: recompute exactly like the sheet so the grid, the card and
       the DOCX agree with the sheet the moment a mark is entered */
    const manual = {};
    MANUAL_COLS.forEach(c => { manual[c.key] = m[c.key]; });
    const live = computeLive(m, manual);
    const total = live.total;
    // the sheet stores attendance as a fraction (0.1818) but shows 18%
    let pct = m.attendancePct || "";
    const pctNum = parseFloat(pct);
    if (!isNaN(pctNum)) {
      pct = pctNum <= 1 ? Math.round(pctNum * 100) + "%" : Math.round(pctNum) + "%";
    } else if (pct) {
      pct = String(pct);
    }
    return {
      name: m.name || "",
      memberId: m.memberId || "",
      batch: m.batch || "",
      email: m.email || "",
      phone: m.phone || "",
      fbProfile: m.fbProfile || "",
      evalMonth: m.evalMonth || "",
      month: month || "",
      monthName: m.monthName || String(month || "").replace(/\s+\d{4}\s*$/, "").trim(),
      attendancePct: pct || "0%",
      punctual: num("punctualCount") || 0,
      late: num("lateCount") || 0,
      absent: num("absentCount") || 0,
      attendance10: live.attendance10,
      assignment20: num("assignment20"),
      workshop20: num("workshop20"),
      emailFeedback5: num("emailFeedback5"),
      monthlyExam30: num("monthlyExam30"),
      professional10: num("professional10"),
      paymentCompliance5: num("paymentCompliance5"),
      total: Math.round(total * 10) / 10,
      grade: live.grade,
      percent: Math.round(total) + "%",
      remarks: live.remarks,
      resultCard: live.resultCard,
      rank: rank || "—",
      generatedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    };
  };

  /* ---------- load the docx library on demand ---------- */
  let docxLib = null;
  const loadDocx = () => {
    if (docxLib) return Promise.resolve(docxLib);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "assets/vendor/docx.min.js";
      s.onload = () => {
        docxLib = window.docx || null;
        docxLib ? resolve(docxLib) : reject(new Error("docx library did not load"));
      };
      s.onerror = () => reject(new Error("Could not load the Word library"));
      document.head.appendChild(s);
    });
  };

  /* ---------- score table rows ---------- */
  const scoreRows = (r) => [
    ["Attendance", r.attendance10 === "" ? "—" : r.attendance10, 10],
    ["Assignment", r.assignment20 === "" ? "—" : r.assignment20, 20],
    ["Workshop", r.workshop20 === "" ? "—" : r.workshop20, 20],
    ["Email & Feedback", r.emailFeedback5 === "" ? "—" : r.emailFeedback5, 5],
    ["Monthly Exam", r.monthlyExam30 === "" ? "—" : r.monthlyExam30, 30],
    ["Professional Behaviour", r.professional10 === "" ? "—" : r.professional10, 10],
    ["Payment Compliance", r.paymentCompliance5 === "" ? "—" : r.paymentCompliance5, 5],
  ];

  /* ---------- build the .docx (exact NCM Result Card format) ---------- */
  const C = {
    navy: "1D3A8A",
    orange: "FF6A34",
    gold: "B8862F",
    grey: "6B6F7A",
    black: "000000",
    cream: "FAF3E8",
    white: "FFFFFF",
    line: "D9D3C4",   // table cell borders
    ink: "222222",    // perf criteria body text
  };

  const buildDocx = async (rows, monthLabel) => {
    const D = await loadDocx();
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, WidthType, BorderStyle, ImageRun, VerticalAlign,
      TableLayoutType, ExternalHyperlink,
    } = D;

    const [otaBytes, fbBytes] = await Promise.all([
      fetch("assets/img/ota-logo-wide.png").then(r => r.arrayBuffer()).catch(() => null),
      fetch("assets/img/facebook-icon.png").then(r => r.arrayBuffer()).catch(() => null),
    ]);

    const Georgia = "Georgia";
    const Arial = "Arial";
    const TNR = "Times New Roman";

    /* ---- shared building blocks (mirrors the supplied NCM Result Card) ---- */
    const p = (text, o = {}) => new Paragraph({
      alignment: o.align || AlignmentType.CENTER,
      spacing: { before: o.before || 0, after: o.after === undefined ? 0 : o.after },
      border: o.border,
      children: [new TextRun({
        text: text, bold: !!o.bold, italics: !!o.italics, size: o.size || 20,
        color: o.color || C.black, font: o.font || Georgia,
        characterSpacing: o.cs, underline: o.underline,
      })],
    });

    /* the gold hairline under MEMBER INFORMATION / PERFORMANCE STATUS / AUTHORITY REMARKS */
    const goldRule = {
      bottom: { style: BorderStyle.SINGLE, color: C.gold, size: 6, space: 6 },
    };

    const cell = (children, o = {}) => new TableCell({
      shading: o.fill ? { fill: o.fill } : undefined,
      margins: { top: 130, bottom: 130, left: 220, right: 220 },
      borders: {
        top: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
        left: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
        bottom: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
        right: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
      },
      verticalAlign: VerticalAlign.CENTER,
      children: Array.isArray(children) ? children : [children],
    });

    const txtCell = (t, o = {}) => cell(new Paragraph({
      alignment: o.align,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({
        text: String(t), bold: !!o.bold, italics: !!o.italics, size: o.size || 20,
        color: o.color || C.black, font: o.font || Georgia,
      })],
    }), o);

    /* table borders are drawn per cell, so the table-level border stays plain */
    const tableBorders = {
      top: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
      left: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
      bottom: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
      right: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
      insideVertical: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 0 },
    };

    const children = [];

    rows.forEach((r, idx) => {
      /* ---------- header ---------- */
      if (otaBytes) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 100 },
          children: [new ImageRun({
            data: otaBytes,
            transformation: { width: 210, height: Math.round(210 * 301 / 1200) },
          })],
        }));
      }
      children.push(p("NEXT CHAPTER MASTERMIND", { bold: true, size: 44, color: C.navy, before: 140, after: 0, cs: 14 }));
      children.push(p("❖", { size: 20, color: C.gold, before: 160, after: 160, font: Arial }));
      children.push(p("MONTHLY RESULT CARD", { bold: true, italics: true, size: 26, color: C.orange, after: 60, cs: 8 }));
      children.push(p((r.monthName || r.month || monthLabel || "") + " — Evaluation Period", { italics: true, size: 20, color: C.grey, after: 320 }));

      /* ---------- MEMBER INFORMATION ---------- */
      children.push(p("MEMBER INFORMATION", { bold: true, size: 22, color: C.navy, before: 260, after: 200, cs: 14, border: goldRule }));

      const infoRows = [
        ["Member Name", r.name || "—"],
        ["Member ID", r.memberId || "—"],
        ["Email", r.email || "—"],
        ["Mobile No.", r.phone || "—"],
        ["Evaluation Month", r.evalMonth || (r.month || monthLabel || "")],
        ["Score", (r.total || 0) + "/100"],
        ["Grade", r.grade || "—"],
      ];

      const infoTable = infoRows.map((row, ri) => {
        const fill = ri % 2 === 1 ? C.cream : C.white;
        /* the supplied card keeps the identity values in Times New Roman 11pt
           and the summary values (month / score / grade) in Georgia 10pt */
        const isIdentity = ri <= 3;
        return new TableRow({ children: [
          txtCell(row[0], { fill, bold: true, color: C.navy, size: 20 }),
          txtCell(row[1], { fill, size: isIdentity ? 22 : 20, color: C.black, font: isIdentity ? TNR : Georgia }),
        ]});
      });

      children.push(new Table({
        width: { size: 9600, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.CENTER,
        columnWidths: [3600, 6000],
        borders: tableBorders,
        rows: infoTable,
      }));

      /* ---------- PERFORMANCE STATUS ---------- */
      children.push(p("PERFORMANCE STATUS", { bold: true, size: 22, color: C.navy, before: 260, after: 200, cs: 14, border: goldRule }));

      const g = (v) => (v === "" || v === undefined || v === null) ? "" : String(v);
      const sum = (a, b) => {
        const x = parseFloat(a), y = parseFloat(b);
        if (isNaN(x) && isNaN(y)) return "";
        return (isNaN(x) ? 0 : x) + (isNaN(y) ? 0 : y);
      };
      const perf = [
        ["Attendance & Assignment", sum(g(r.attendance10), g(r.assignment20)), "30"],
        ["Workshop", g(r.workshop20), "20"],
        ["Email & Feedback", g(r.emailFeedback5), "5"],
        ["Monthly Exam", g(r.monthlyExam30), "30"],
        ["Professionalism & Payment Completeness", sum(g(r.professional10), g(r.paymentCompliance5)), "15"],
      ];
      const perfRows = [
        new TableRow({ tableHeader: true, children: [
          txtCell("Criteria", { fill: C.navy, bold: true, color: C.white, size: 20 }),
          txtCell("Obtained Marks", { fill: C.navy, bold: true, color: C.white, size: 20, align: AlignmentType.CENTER }),
          txtCell("Marks", { fill: C.navy, bold: true, color: C.white, size: 20, align: AlignmentType.CENTER }),
        ]}),
        ...perf.map((row, ri) => {
          const fill = ri % 2 === 1 ? C.cream : C.white;
          return new TableRow({ children: [
            txtCell(row[0], { fill, size: 20, color: C.ink }),
            txtCell(row[1], { fill, size: 20, align: AlignmentType.CENTER }),
            txtCell(row[2], { fill, size: 20, align: AlignmentType.CENTER }),
          ]});
        }),
      ];
      children.push(new Table({
        width: { size: 9600, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.CENTER,
        columnWidths: [3980, 3080, 2540],
        borders: tableBorders,
        rows: perfRows,
      }));

      /* ---------- AUTHORITY REMARKS ---------- */
      children.push(p("AUTHORITY REMARKS", { bold: true, size: 22, color: C.navy, before: 260, after: 200, cs: 14, border: goldRule }));
      children.push(p(r.resultCard || r.remarks || "—", {
        bold: true, size: 20, color: C.black, font: Arial, before: 420, after: 120,
        border: { top: { style: BorderStyle.SINGLE, color: C.line, size: 4, space: 8 } },
      }));
      /* no manual template — the authority remark above is the only free text
         and it is produced by the same grade rule the tracker sheet uses */

      /* ---------- signature ---------- */
      children.push(p("Sirajul Islam Jony", { align: AlignmentType.LEFT, bold: true, size: 22, color: C.navy, before: 180, after: 40 }));
      children.push(p("Project Manager", { align: AlignmentType.LEFT, italics: true, size: 19, color: C.grey, after: 30 }));
      children.push(p("Online Tech Academy", { align: AlignmentType.LEFT, italics: true, size: 19, color: C.grey, after: 0 }));

      if (idx < rows.length - 1) {
        children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      }
    });

    const doc = new Document({
      creator: "Medha Program Management",
      title: (monthLabel || "") + " Result Cards",
      description: "NCM Monthly Result Card",
      styles: { default: { document: { run: { font: Georgia, size: 20 } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 11920, height: 16840 },
            margin: { top: 900, bottom: 900, left: 1000, right: 1000, header: 708, footer: 708 },
            borders: {
              pageBorders: { display: "allPages", offsetFrom: "page", zOrder: "front" },
              pageBorderTop: { style: BorderStyle.SINGLE, color: C.gold, size: 18, space: 24 },
              pageBorderBottom: { style: BorderStyle.SINGLE, color: C.gold, size: 18, space: 24 },
              pageBorderLeft: { style: BorderStyle.SINGLE, color: C.gold, size: 18, space: 24 },
              pageBorderRight: { style: BorderStyle.SINGLE, color: C.gold, size: 18, space: 24 },
            },
          },
        },
        children,
      }],
    });

    return Packer.toBlob(doc);
  };

  /* ---------- download helper ---------- */
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const slug = (s) => String(s || "result").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---------- print view (same layout as the Word card) ---------- */
  const buildPrintHtml = (rows, monthLabel) => {
    const cards = rows.map(r => {
      const g = (v) => (v === "" || v === undefined || v === null) ? "" : String(v);
      const sum = (a, b) => {
        const x = parseFloat(a), y = parseFloat(b);
        if (isNaN(x) && isNaN(y)) return "";
        return (isNaN(x) ? 0 : x) + (isNaN(y) ? 0 : y);
      };
      const perf = [
        ["Attendance & Assignment", sum(g(r.attendance10), g(r.assignment20)), "30"],
        ["Workshop", g(r.workshop20), "20"],
        ["Email & Feedback", g(r.emailFeedback5), "5"],
        ["Monthly Exam", g(r.monthlyExam30), "30"],
        ["Professionalism & Payment Completeness", sum(g(r.professional10), g(r.paymentCompliance5)), "15"],
      ];
      const info = [
        ["Member Name", r.name || "—"],
        ["Member ID", r.memberId || "—"],
        ["Email", r.email || "—"],
        ["Mobile No.", r.phone || "—"],
        ["Evaluation Month", r.evalMonth || r.month || monthLabel || ""],
        ["Score", (r.total || 0) + "/100"],
        ["Grade", r.grade || "—"],
      ];
      const infoRows = info.map((row, i) =>
        `<tr class="${i % 2 ? "c" : ""}"><th>${escapeHtml(row[0])}</th><td>${escapeHtml(row[1])}</td></tr>`).join("");

      const perfRows = perf.map((row, i) =>
        `<tr class="${i % 2 ? "c" : ""}"><th>${escapeHtml(row[0])}</th><td class="n">${escapeHtml(row[1])}</td><td class="n">${escapeHtml(row[2])}</td></tr>`).join("");

      /* fully automatic — the authority remark is the only free text */
      const extra = [];

      return `<section class="card">
        <img class="ota" src="assets/img/ota-logo-wide.png" alt="Online Tech Academy" />
        <h1>NEXT CHAPTER MASTERMIND</h1>
        <div class="dia">❖</div>
        <h2>MONTHLY RESULT CARD</h2>
        <div class="period">${escapeHtml(r.monthName || r.month || monthLabel || "")} — Evaluation Period</div>

        <h3>MEMBER INFORMATION</h3>
        <table class="info">${infoRows}</table>

        <h3>PERFORMANCE STATUS</h3>
        <table class="perf">
          <thead><tr><th>Criteria</th><th>Obtained Marks</th><th>Marks</th></tr></thead>
          <tbody>${perfRows}</tbody>
        </table>

        <h3>AUTHORITY REMARKS</h3>
        <div class="remarks">${escapeHtml(r.resultCard || r.remarks || "—")}</div>
        ${extra.map(l => `<div class="extra">${escapeHtml(l)}</div>`).join("")}

        <div class="sign">
          <div class="sign-name">Sirajul Islam Jony</div>
          <div class="sign-role">Project Manager</div>
          <div class="sign-org">Online Tech Academy</div>
        </div>
      </section>`;
    }).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(monthLabel || "")} Results</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#eef1f6;font-family:Georgia,'Times New Roman',serif;color:#000;padding:24px}
      .card{background:#fff;max-width:720px;margin:0 auto 26px;padding:36px 44px;page-break-after:always;break-after:page;
        border:2.25pt solid #b8862f}
      .card:last-child{page-break-after:auto;break-after:auto}
      .ota{display:block;width:210px;margin:0 auto 6px}
      h1{text-align:center;font-size:22pt;color:#1d3a8a;margin:12px 0 0;letter-spacing:1.2px}
      .dia{text-align:center;color:#b8862f;font-size:13pt;margin:9px 0}
      h2{text-align:center;font-size:13pt;color:#ff6a34;margin:0 0 4px;font-style:italic;letter-spacing:.8px}
      .period{text-align:center;font-size:10pt;color:#6b6f7a;margin-bottom:20px;font-style:italic}
      h3{text-align:center;font-size:11pt;color:#1d3a8a;margin:20px 0 12px;letter-spacing:1.2px;
        border-bottom:0.75pt solid #b8862f;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;font-size:10.5pt}
      th,td{border:0.5pt solid #d9d3c4;padding:7.5pt 11pt;text-align:left}
      table.info th{background:#fff;color:#1d3a8a;font-weight:700;width:37%}
      table.info td{font-family:'Times New Roman',serif}
      table.info tr.c th,table.info tr.c td{background:#faf3e8}
      table.perf thead th{background:#1d3a8a;color:#fff;font-weight:700;text-align:left}
      table.perf thead th:nth-child(2),table.perf thead th:nth-child(3){text-align:center}
      table.perf tbody th{color:#222222;font-weight:400}
      table.perf tbody td{text-align:center}
      table.perf tbody tr.c th,table.perf tbody tr.c td{background:#faf3e8}
      td.n{text-align:center}
      .remarks{text-align:center;font-family:Arial,sans-serif;font-size:10pt;font-weight:700;margin:24px 0 0;
        border-top:0.5pt solid #d9d3c4;padding-top:6px}
      .extra{text-align:center;font-family:Arial,sans-serif;font-size:9.5pt;color:#6b6f7a;margin-top:4px}
      .fb{width:14px;height:14px;vertical-align:-2px}
      table.info a{color:#1d3a8a}
      .sign{margin-top:30px}
      .sign-name{font-size:11pt;font-weight:700;color:#1d3a8a}
      .sign-role{font-size:9.5pt;color:#6b6f7a;margin-top:2px;font-style:italic}
      .sign-org{font-size:9.5pt;color:#6b6f7a;font-style:italic}
      @media print{body{background:#fff;padding:0}.card{padding:26px 34px}}
    </style></head><body>${cards}
    <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})<\/script>
    </body></html>`;
  };

  return {
    MANUAL_COLS,
    buildRow,
    buildDocx,
    buildPrintHtml,
    monthLabel,
    monthName,
    computeLive,
    gradeOf,
    remarkOf,
    attendance10Of,
    attendancePctOf,
    totalOf,
    REMARKS_BY_GRADE,
    downloadBlob,
    slug,
  };
})();
