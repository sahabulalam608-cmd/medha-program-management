/* === Medha Program Management — Appreciation (certificate) ===
   The two supplied PPTX files are the DESIGN REFERENCE only. They are never
   opened, edited or converted. The certificate is drawn in the browser
   (preview + print) and built as a Word file, the same way the Result card
   is done in results.js.
   ============================================================ */

const Appreciation = (() => {

  /* ---------------- the two built-in templates ---------------- */
  const TPL = {
    brand: {
      label: "Appreciation 1 — Brand Color",
      source: "Appreciation 1 Brand Color.pptx",
      title: "CERTIFICATE OF APPRECIATION FOR COMPLETING",
      subtitle: "ARTIFICIAL INTELLIGENCE WITH BUSINESS DEVELOPMENT",
      lead: "This certificate is proudly presented to",
      body: [
        "for successfully completing the four-month training program in",
        "Business Development with Artificial Intelligence, and Fair Use,",
        "conducted by Online Tech Academy in collaboration with Medha AI.",
      ],
      topics: [
        ["Brand Profile", "Projects", "Agents", "Skills", "Studios"],
        ["Life OS", "Ads Dashboard", "Research", "Content", "Jobs"],
      ],
    },
    regular: {
      label: "Appreciation 2 — Regular",
      source: "Appreciation 2 regular.pptx",
      title: "CERTIFICATE OF APPRECIATION FOR COMPLETING",
      subtitle: "ARTIFICIAL INTELLIGENCE WITH BUSINESS DEVELOPMENT",
      lead: "This certificate is proudly presented to",
      body: [
        "for successfully completing the four-month training program in",
        "Business Development, Artificial Intelligence, and Fair Use,",
        "conducted by Online Tech Academy in collaboration with Medha.",
      ],
      topics: [
        ["Brand Profile", "Projects", "Agents", "Skills", "Studios"],
        ["Life OS", "Ads Dashboard", "Command Center", "Jhak", "Jobs"],
      ],
    },
  };

  /* the colours, straight out of the two decks */
  const SKIN = {
    brand: {
      frameFrom: "#8451FA", frameTo: "#FF9D18", soft: "#E8DEFC", inner: "#FFFFFF",
      chipFrom: "#8B55F9", chipTo: "#FF9D18", grey: "#55555C", ink: "#000000",
    },
    regular: {
      frameFrom: "#424463", frameTo: "#424463", soft: "#B2AD98", inner: "#FFFFFF",
      chipFrom: "#2A2A33", chipTo: "#2A2A33", grey: "#55555C", ink: "#000000",
    },
  };

  const HIST_KEY = "mpm.appreciation.history";
  const LIB_KEY = "mpm.appreciation.library";

  const esc = (s) => window.escapeHtml(String(s == null ? "" : s));

  /* the certificate artwork — data images, with the plain files as a fallback */
  const ART = (typeof window !== "undefined" && window.APPR_IMG) || {};
  const imgSrc = (key, fallback) => ART[key] || fallback;
  const FALLBACK = {
    emblem: "assets/img/ota-emblem.png",
    medha: "assets/img/medha-logo-square.jpg",
    sign: "assets/img/signature.png",
  };

  const pad = (n) => String(n).padStart(2, "0");
  const todayLabel = () => {
    const d = new Date();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  const toISO = (label) => {
    const m = String(label || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const fromISO = (iso) => {
    const p = String(iso || "").split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : todayLabel();
  };

  /* Med-NCM-P1-001 / Med-NCM-P2-001 */
  const certificateIdFor = (memberId, isP2) => {
    const id = String(memberId || "").trim();
    const n = (id.replace(/\D/g, "") || "1").padStart(3, "0");
    return `Med-NCM-${isP2 ? "P2" : "P1"}-${n}`;
  };

  /* ---------------- state ---------------- */
  const blank = (tpl) => ({
    template: tpl,
    memberName: "",
    memberEmail: "",
    memberId: "",
    certificateId: "",
    title: TPL[tpl].title,
    subtitle: TPL[tpl].subtitle,
    lead: TPL[tpl].lead,
    body: [...TPL[tpl].body],
    topics: TPL[tpl].topics.map((row) => [...row]),
    issueDate: todayLabel(),
  });

  const ST = {
    ids: [],
    template: "brand",
    content: blank("brand"),
    issueDate: todayLabel(),
    tab: "all",
    q: "",
    emailOpen: false,
    emailSubject: "Your Certificate of Appreciation — Medha AI",
    emailBody:
      "Assalamu Alaikum,\n\nPlease find your Certificate of Appreciation for completing the four-month Artificial Intelligence with Business Development program.\n\nWarm regards,\nOnline Tech Academy & Medha AI",
    emailHtml:
      "<div>Assalamu Alaikum,</div><div><br></div><div>Please find your Certificate of Appreciation for completing the four-month Artificial Intelligence with Business Development program.</div><div><br></div><div>Warm regards,</div><div>Online Tech Academy &amp; Medha AI</div>",
    autoNote: true,
    bannerMode: "previous",
    customBanner: "",
    customFooter: "",
    history: [],
    library: [],
    data: null,
    container: null,
    head: "",
  };

  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  };
  const store = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  };
  ST.history = load(HIST_KEY, []);
  ST.library = load(LIB_KEY, []);

  /* ---------------- helpers ---------------- */
  const isP2 = (m) => /p2/i.test(String(m && m._tab || "")) || /part\s*-?\s*2/i.test(String(m && m.batch || ""));

  /* Test rows for mail checks — not counted in All/Part totals */
  const EX_TOP = {
    memberId: "NCM- 101 ( Example )",
    name: "Md Sahabul Alam",
    email: "sahabulota@gmail.com",
    _tab: "p1",
    _example: true,
  };
  const EX_BOT = {
    memberId: "NCM-P2-0101002 ( Example )",
    name: "Md Ahsan",
    email: "howladerahsan@gmail.com",
    _tab: "p2",
    _example: true,
  };

  const members = () => (ST.data && ST.data._all) || [];
  const realMembers = () => members().filter((m) => !m._example);
  const allMembers = () => {
    const real = realMembers();
    return [EX_TOP, ...real, EX_BOT];
  };
  const selected = () => allMembers().filter((m) => ST.ids.indexOf(m.memberId) !== -1);

  const setContent = (patch) => {
    ST.content = Object.assign({}, ST.content, patch);
    paint();
  };

  const switchTemplate = (id) => {
    ST.template = id;
    const t = TPL[id];
    const keep = (label, row) => {
      const found = (ST.content.topics[row] || []).indexOf(label);
      return found !== -1 ? label : label;
    };
    ST.content = Object.assign({}, ST.content, {
      template: id,
      title: t.title,
      subtitle: t.subtitle,
      lead: t.lead,
      body: [...t.body],
      topics: t.topics.map((row, r) => row.map((label) => keep(label, r))),
    });
    paint();
  };

  /* the content follows the first selected member */
  const syncFromSelection = () => {
    const sel = selected();
    if (!sel.length) {
      ST.content = Object.assign({}, ST.content, {
        memberName: "",
        memberEmail: "",
        memberId: "",
        certificateId: "",
      });
      return;
    }
    const m = sel[0];
    ST.content = Object.assign({}, ST.content, {
      memberName: m.name || "",
      memberEmail: m.email || "",
      memberId: m.memberId || "",
      certificateId: certificateIdFor(m.memberId, isP2(m)),
      issueDate: ST.issueDate || ST.content.issueDate,
    });
  };

  /* where every line of the certificate sits — measured on the artwork
     the portal uses, so the live text lands on the printed spot */
  const GEO = {"brand":{"title":{"fit":906.2,"c":216.1,"size":41.4,"serif":false,"bold":true,"color":"000000"},"subtitle":{"fit":913.9,"c":265.7,"size":26.5,"serif":false,"bold":true,"color":"000000"},"lead":{"fit":707.7,"c":320.3,"size":21.4,"serif":false,"bold":false,"color":"55555C"},"body":[{"fit":753.5,"c":431.4,"size":21.4},{"fit":597.7,"c":460.8,"size":21.4},{"fit":640.5,"c":489.8,"size":21.4}],"topics":{"c":534.4,"size":19.4,"color":"191919"},"id":{"fit":213.3,"c":728.8,"size":14.8,"color":"55555C","left":155.3,"w":213.3},"date":{"fit":190.9,"c":729.5,"size":14.8,"color":"55555C","left":752,"w":190.9},"chipRows":[551.2,602.4],"chipH":41.2,"chipGap":40,"chipSize":17.8,"chipW":[[135.1,108.4,109.2,110.7,120.6],[103.8,126,154.3,97.7,91.6]],"name":{"fit":700,"c":374.8,"size":38,"serif":true,"bold":true,"color":"000000","upper":true}},"regular":{"title":{"fit":906.2,"c":199.3,"size":39.2,"serif":false,"bold":true,"color":"000000"},"subtitle":{"fit":913.9,"c":248.5,"size":24.4,"serif":false,"bold":true,"color":"000000"},"lead":{"fit":707.7,"c":305.8,"size":21.4,"serif":false,"bold":false,"color":"55555C"},"body":[{"fit":753.5,"c":417.2,"size":21.4},{"fit":753.5,"c":446.3,"size":21.4},{"fit":784.1,"c":475.3,"size":21.4}],"topics":{"c":507.3,"size":19.4,"color":"191919"},"id":{"fit":251.9,"c":717.9,"size":14.5,"color":"55555C","left":135.9,"w":251.9},"date":{"fit":190.9,"c":717.9,"size":14.5,"color":"55555C","left":752,"w":190.9},"chipRows":[522.2,575.7],"chipH":42.8,"chipGap":40,"chipSize":17.6,"chipW":[[141.2,125.2,109.2,117.5,137.5],[109.9,143.5,168,109.2,103.8]],"name":{"fit":700,"c":374.0,"size":38,"serif":true,"bold":true,"color":"000000","upper":false}}};

  /* ---------------- the certificate as HTML ---------------- */
  /* The artwork carries the border, the frame, the watermark, the logos and the
     signature. Every line of text is drawn live on the spot the printed
     certificate uses, so the content editor really changes the certificate. */
  const CERT_CSS = `
.appr-cert{
  width:1120px;height:819px;box-sizing:border-box;position:relative;
  background-color:#fff;background-repeat:no-repeat;background-position:center center;
  background-size:100% 100%;overflow:hidden;
}
.appr-t{
  position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;
  text-align:center;line-height:1;z-index:20;pointer-events:none;white-space:nowrap;
  background:transparent !important;background-color:transparent !important;
  box-shadow:none !important;text-shadow:none !important;
}
.appr-t mark,.appr-t span[style*="background"],.appr-t span[style*="background-color"]{
  background:transparent !important;background-color:transparent !important;
}
.appr-fit{background:transparent !important;background-color:transparent !important;
  box-shadow:none !important;text-shadow:none !important;}
.appr-fit{display:block;transform-origin:center center;max-width:100%;}
.appr-t.display{font-family:"Montserrat","Poppins","Helvetica Neue","Segoe UI",Arial,sans-serif;
  font-weight:800;letter-spacing:-0.3px;}
.appr-t.serif{font-family:"Nimbus Roman","Nimbus Roman No9 L","Times New Roman",Times,serif;}
.appr-t.sans{font-family:Arial,Helvetica,sans-serif;}
.appr-chips-row{
  position:absolute;left:0;right:0;display:flex;justify-content:center;
  align-items:center;gap:9px;z-index:20;pointer-events:none;
}
.appr-chip{
  background:#ffffff;border:1.15px solid #696970;border-radius:21px;color:#111111;
  display:flex;align-items:center;justify-content:center;padding:0 14px;white-space:nowrap;
  box-sizing:border-box;
}
.appr-dyn-name{
  position:absolute;left:10%;right:10%;top:45.5%;transform:translateY(-50%);
  text-align:center;font-size:38px;font-weight:700;color:#111111;
  font-family:"Nimbus Roman","Times New Roman",Times,serif;z-index:20;
}
.appr-dyn-name.is-empty{visibility:hidden;}
.appr-dyn-id{position:absolute;left:7.5%;bottom:5.8%;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;z-index:20;background:#ffffff !important;padding:2px 6px;box-shadow:none;text-shadow:none;}
.appr-dyn-date{position:absolute;right:7.5%;bottom:5.8%;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;z-index:20;background:#ffffff !important;padding:2px 6px;box-shadow:none;text-shadow:none;}
.appr-stage-wrap{position:relative;overflow:hidden;}
.appr-stage{position:absolute;top:0;left:0;width:1120px;transform-origin:top left;}
.appr-print-page{page-break-after:always;break-after:page;}
.appr-print-page:last-child{page-break-after:auto;break-after:auto;}
`;

  const bgUrl = (file) => {
    try { return new URL("assets/img/" + file, window.location.href).href; }
    catch (e) { return "assets/img/" + file; }
  };

  /* the clean backgrounds travel with the page (data images) */
  const APPR_BG = (typeof window !== "undefined" && window.APPR_BG) || {};

  const resolveName = (c) => {
    if (c && c.memberName && String(c.memberName).trim()) return String(c.memberName).trim();
    try {
      const sel = selected();
      if (sel && sel[0] && sel[0].name) return String(sel[0].name).trim();
    } catch (e) {}
    return "";
  };

  /* a line of text, centred on the spot the printed certificate uses */
  const line = (o, html, extra) => {
    if (!o) return "";
    const size = Math.round((o.size || 16) * 10) / 10;
    const top = Math.round((o.c - size / 2) * 10) / 10;
    const cls = o.serif ? "serif" : (o.display ? "display" : "sans");
    const place = (o.left !== undefined)
      ? ("left:" + o.left + "px;width:" + o.w + "px;right:auto;")
      : "left:0;right:0;";
    const fitw = o.fit ? ' data-fitw="' + o.fit + '"' : "";
    const ink = o.color ? ("#" + o.color) : "#333333";
    return '<div class="appr-t ' + cls + '"' + fitw + ' style="'
      + place
      + "top:" + top + "px;height:" + size + "px;font-size:" + size + "px;"
      + (o.bold ? "font-weight:" + (o.display ? "800" : "700") + ";" : "")
      + "color:" + ink + ";background:transparent;background-color:transparent;box-shadow:none;text-shadow:none;"
      + (extra || "") + '"><span class="appr-fit" style="background:transparent;color:inherit;">' + html + "</span></div>";
  };

  /* Whatever font the visitor's computer has, the words must never run past
     the printed line — the text is squeezed to the width of the certificate. */
  const fitTexts = (root) => {
    (root || document).querySelectorAll(".appr-t[data-fitw]").forEach((el) => {
      const inner = el.firstElementChild;
      if (!inner) return;
      inner.style.transform = "";
      const target = Number(el.getAttribute("data-fitw"));
      const w = inner.offsetWidth;
      if (!w || !target) return;
      const k = Math.min(1, target / w);
      if (k < 0.999) inner.style.transform = "scaleX(" + k.toFixed(4) + ")";
    });
  };

  const chipRow = (y, labels, size, g, row) => {
    if (!labels || !labels.length) return "";
    const h = (g && g.chipH) || 41.2;
    const gap = (g && g.chipGap) || 40;
    const widths = (g && g.chipW) || [];
    return '<div class="appr-chips-row" style="top:' + y + 'px;height:' + h + 'px;gap:' + gap + 'px;">'
      + labels.map((t, i) => {
        const w = (widths[row] && widths[row][i]) ? widths[row][i] : null;
        const style = "height:" + h + "px;font-size:" + Math.round(size * 10) / 10 + "px;"
          + (w ? "min-width:" + w + "px;" : "");
        return '<span class="appr-chip" style="' + style + '">' + esc(t) + "</span>";
      }).join("")
      + "</div>";
  };

  const certificateHtml = (c) => {
    const tpl = (c && c.template === "regular") ? "regular" : "brand";
    const g = GEO[tpl] || GEO.brand;
    const bg = APPR_BG[tpl];
    const hasBg = !!bg;
    const name = resolveName(c);
    let id = (c && c.certificateId) || "";
    if (!id) {
      try {
        const sel = selected();
        if (sel && sel[0]) id = certificateIdFor(sel[0].memberId, isP2(sel[0]));
      } catch (e) {}
    }
    if (!id) id = "—";
    const date = (c && c.issueDate) || ST.issueDate || "—";
    const body = (c && c.body) || [];
    const topics = (c && c.topics) || [];

    const style = "background-image:url('" + (hasBg ? bg
      : bgUrl(tpl === "regular" ? "appr-regular-bg.png" : "appr-brand-bg.png")) + "');";

    let html = '<div class="appr-cert" style="' + style + '">';
    if (hasBg) {
      html += line(Object.assign({}, g.title, { display: true }), esc(c && c.title ? c.title : ""));
      html += line(Object.assign({}, g.subtitle, { display: true }), esc(c && c.subtitle ? c.subtitle : ""));
      html += line(g.lead, esc(c && c.lead ? c.lead : ""));
      html += line(Object.assign({}, g.name, { display: false }),
        esc(name), g.name.upper ? "text-transform:uppercase;" : "");
      (g.body || []).forEach((b, i) => {
        html += line(b, esc(body[i] || ""));
      });
      html += line(g.topics, "Topics Covered");
      (g.chipRows || []).forEach((y, r) => {
        html += chipRow(y, topics[r] || [], g.chipSize, g, r);
      });
      html += line(g.id, "Certificate ID: " + esc(id));
      html += line(g.date, "Issue Date: " + esc(date));
    } else {
      html += '<div class="appr-dyn-name' + (name ? "" : " is-empty") + '">' + esc(name) + "</div>";
      html += '<div class="appr-dyn-id">Certificate ID: ' + esc(id) + "</div>";
      html += '<div class="appr-dyn-date">Issue Date: ' + esc(date) + "</div>";
    }
    html += "</div>";
    return html;
  };

  /* ---------------- the certificate as a Word file ---------------- */
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

  const fetchBuf = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);

  /* the artwork for the Word file: the data image when there is one */
  const artBytes = (key) => {
    const src = ART[key];
    if (src && src.indexOf("data:") === 0) {
      try {
        const bin = atob(src.split(",")[1]);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return Promise.resolve(out);
      } catch (e) { /* fall through to the file */ }
    }
    return fetchBuf(FALLBACK[key]);
  };

  const buildDocx = async (c) => {
    const D = await loadDocx();
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, WidthType, BorderStyle, ImageRun, VerticalAlign, TableLayoutType,
    } = D;
    const s = SKIN[c.template] || SKIN.brand;

    const [emblem, medha, sign] = await Promise.all([
      artBytes("emblem"), artBytes("medha"), artBytes("sign"),
    ]);
    /* docx.js takes the image size in PIXELS and converts it itself */
    const px = (v) => v;
    const C = { grey: s.grey.replace("#", ""), ink: s.ink.replace("#", ""), chip: s.chipFrom.replace("#", "") };
    const none = { style: BorderStyle.NONE };
    const noB = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

    const p = (text, o = {}) => new Paragraph({
      alignment: o.align || AlignmentType.CENTER,
      spacing: { before: o.before || 0, after: 0 },
      children: [new TextRun({
        text: String(text), bold: !!o.bold, size: o.size || 22, color: o.color || C.ink, font: "Times New Roman",
      })],
    });

    const headTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: noB,
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE }, borders: noB, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ children: emblem
              ? [new ImageRun({ data: emblem, transformation: { width: px(46), height: px(46) } })]
              : [new TextRun({ text: "Online Tech Academy", bold: true, size: 24, color: "090909" })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE }, borders: noB, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ children: [new TextRun({ text: "Online Tech Academy", bold: true, size: 24, color: "090909" })] })],
          }),
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE }, borders: noB, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: medha
              ? [new ImageRun({ data: medha, transformation: { width: px(46), height: px(46) } })]
              : [new TextRun({ text: "Medha AI", bold: true, size: 26, color: "090909" })] })],
          }),
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE }, borders: noB, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Medha AI", bold: true, size: 26, color: "090909" })] })],
          }),
        ],
      })],
    });

    const chipRows = (c.topics || []).filter((r) => r && r.length).map((row) => new TableRow({
      children: row.map((t) => new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { fill: "FFFFFF" },
        margins: { top: 110, bottom: 110, left: 160, right: 160 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "696970" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "696970" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "696970" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "696970" },
        },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 20, color: "111111" })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            /* docx.js swaps the sides for landscape, so they are given portrait order */
            size: { width: 11200, height: 15300, orientation: "landscape" },
            margin: { top: 500, right: 500, bottom: 500, left: 500 },
          },
        },
        children: [
          headTable,
          p(c.title, { bold: true, size: 56, before: 420 }),
          p(c.subtitle, { bold: true, size: 30, before: 120 }),
          p(c.lead, { size: 22, color: C.grey, before: 520 }),
          p(String(c.memberName || "").toUpperCase(), { bold: true, size: 56, before: 80 }),
          ...(c.body || []).map((l) => p(l, { size: 22, color: C.grey, before: 180 })),
          p("Topics Covered", { bold: true, size: 26, before: 460 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, rows: chipRows }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { before: 460, after: 0 },
            children: sign
              ? [new ImageRun({ data: sign, transformation: { width: px(118), height: px(54) } })]
              : [new TextRun({ text: "Sirajul Islam Jony", bold: true, size: 24, color: "111111" })],
          }),
          p("Sirajul Islam Jony", { bold: true, size: 22, before: 60 }),
          p("Medha AI Project Manager", { size: 20, color: C.grey, before: 20 }),
          new Paragraph({
            spacing: { before: 360, after: 0 },
            tabStops: [{ type: "right", position: 14200 }],
            children: [
              new TextRun({ text: `Certificate ID: ${c.certificateId || "—"}`, size: 19, color: C.grey }),
              new TextRun({ text: "\t", size: 19 }),
              new TextRun({ text: `Issue Date: ${c.issueDate || "—"}`, size: 19, color: C.grey }),
            ],
          }),
        ],
      }],
    });
    return Packer.toBlob(doc);
  };

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

  /* ---------------- print / save as PDF ---------------- */
  const printCertificate = (items) => {
    const list = Array.isArray(items) ? items : [items];
    const w = window.open("", "_blank");
    if (!w) { Notify.warn("Allow pop-ups to print or save the certificate."); return; }
    const pages = list.map((c) =>
      `<div class="appr-print-page">${certificateHtml(c)}</div>`
    ).join("");
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificate</title>
<style>${CERT_CSS}
html,body{margin:0;padding:0;background:#fff;}
body{display:block;}
.appr-print-page{display:flex;justify-content:center;align-items:center;padding:8px;box-sizing:border-box;}
@page{size:A4 landscape;margin:6mm;}
@media print{
  html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .appr-print-page{padding:0;width:100%;height:100%;min-height:0;
    page-break-after:always;break-after:page;
    display:flex;align-items:center;justify-content:center;}
  .appr-print-page:last-child{page-break-after:auto;break-after:auto;}
  .appr-cert{
    width:285mm;height:208mm;max-width:100%;max-height:100%;
    box-sizing:border-box;overflow:hidden;
    background-size:100% 100% !important;}
  .appr-dyn-name{font-size:34px;}
}
@media screen{
  .appr-print-page{margin-bottom:16px;}
}
</style></head><body>${pages}</body></html>`
    );
    w.document.close();
    try { fitTexts(w.document); } catch (e) { /* ignore */ }
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 500);
  };

  /* ---------------- history ---------------- */
  /* 05/11/2026, 16:09:12 */
  const stampNow = () => {
    const d = new Date();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, `
      + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const log = (action) => {
    const sel = selected();
    const item = {
      id: "h" + Date.now(),
      at: stampNow(),
      count: sel.length,
      template: ST.template,
      issueDate: stampNow(),
      action: action,
      names: sel.map((m) => m.name).join(", ").slice(0, 180),
    };
    ST.history = [item].concat(ST.history).slice(0, 60);
    store(HIST_KEY, ST.history);
  };

  /* ---------------- the view ---------------- */
  const render = (data, head, container) => {
    ST.data = data;
    ST.head = head;
    ST.container = container;
    syncFromSelection();
    paint();
  };

  const filtered = () => {
    const q = ST.q.trim().toLowerCase();
    let real = realMembers().filter((m) => {
      if (ST.tab === "p1" && isP2(m)) return false;
      if (ST.tab === "p2" && !isP2(m)) return false;
      return true;
    });
    /* Always: example top → members → example bottom (not in 144 count) */
    let list = [EX_TOP, ...real, EX_BOT];
    if (q) {
      list = list.filter((m) =>
        `${m.name || ""} ${m.email || ""} ${m.memberId || ""}`.toLowerCase().indexOf(q) !== -1
      );
    }
    return list;
  };

  const countBy = (p2) => realMembers().filter((m) => (isP2(m) ? p2 : !p2)).length;

  const paint = () => {
    const box = ST.container;
    if (!box) return;
    const sel = selected();
    const rows = filtered();
    const c = ST.content;
    const t = TPL[ST.template];
    const allPicked = rows.length > 0 && rows.every((m) => ST.ids.indexOf(m.memberId) !== -1);

    const topicEditor = (c.topics || []).map((row, r) => `
      <div class="appr-topic-row">
        <div class="appr-topic-label">Row ${r + 1}</div>
        <div class="appr-topic-items">
          ${row.map((tp, i) => `
            <span class="appr-topic-item">
              <input type="text" value="${esc(tp)}" data-topic="${r}-${i}" />
              <button type="button" class="appr-x" data-topic-del="${r}-${i}" title="Remove">&times;</button>
            </span>`).join("")}
          <button type="button" class="btn-ghost appr-add" data-topic-add="${r}">+ Add</button>
        </div>
      </div>`).join("");

    box.innerHTML = `
      ${ST.head("Appreciation", "Certificate of Appreciation · Medha Program Management")}

      <div class="appr-head-card">
        <div>
          <div class="appr-head-title">Appreciation</div>
          <div class="appr-head-sub">${sel.length} member${sel.length === 1 ? "" : "s"} selected</div>
        </div>
        <label class="appr-tpl-pick">
          <span>Template</span>
          <select id="apprTemplate">
            <option value="brand"${ST.template === "brand" ? " selected" : ""}>Appreciation 1 — Brand Color</option>
            <option value="regular"${ST.template === "regular" ? " selected" : ""}>Appreciation 2 — Regular</option>
          </select>
        </label>
      </div>

      <!-- 1 · choose the members -->
      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Choose the members</h2>
          <span class="panel-link" style="cursor:default;">${sel.length} selected</span>
        </header>
        <div class="tabs">
          <button class="tab-pill${ST.tab === "all" ? " active" : ""}" data-atab="all">All (${realMembers().length})</button>
          <button class="tab-pill${ST.tab === "p1" ? " active" : ""}" data-atab="p1">NCM PART-1 (${countBy(false)})</button>
          <button class="tab-pill${ST.tab === "p2" ? " active" : ""}" data-atab="p2">NCM PART-2 (${countBy(true)})</button>
        </div>
        <div class="toolbar">
          <input type="search" id="apprSearch" placeholder="Search name, email or ID" value="${esc(ST.q)}" />
          <button class="btn-ghost" id="apprClear">Clear selection</button>
          <span class="count">${rows.length} shown</span>
        </div>
        <div style="overflow-x:auto;max-height:52vh;">
          <table class="tbl">
            <thead><tr>
              <th style="width:42px;"><input type="checkbox" id="apprAll" ${allPicked ? "checked" : ""} aria-label="Select all shown" /></th>
              <th>Member ID</th><th>Name</th><th>Email</th><th>Batch</th>
            </tr></thead>
            <tbody>
              ${rows.length ? rows.map((m) => {
                const on = ST.ids.indexOf(m.memberId) !== -1;
                return `<tr class="appr-row${on ? " on" : ""}${m._example ? " appr-ex" : ""}" data-pick="${esc(m.memberId)}">
                  <td><input type="checkbox" ${on ? "checked" : ""} aria-label="Select ${esc(m.name)}" /></td>
                  <td class="mono">${esc(m.memberId)}</td>
                  <td><b>${esc(m.name)}</b>${m._example ? '<span class="appr-tag">Example</span>' : ""}${on ? '<span class="appr-tag">Selected</span>' : ""}</td>
                  <td class="mono dim">${esc(m.email)}</td>
                  <td class="dim">${m._example ? (isP2(m) ? "Example · P2" : "Example · P1") : (isP2(m) ? "Part 2" : "Part 1")}</td>
                </tr>`;
              }).join("") : `<tr><td colspan="5" class="appr-empty">No member matches.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <!-- 2 · the certificate content -->
      <section class="panel">
        <header class="panel-head"><h2 class="panel-title">Certificate content</h2></header>
        <div class="appr-grid">
          <div class="appr-fields">
            <label class="appr-field"><span>Title</span>
              <input type="text" id="apprTitle" value="${esc(c.title)}" /></label>
            <label class="appr-field"><span>Subtitle</span>
              <input type="text" id="apprSubtitle" value="${esc(c.subtitle)}" /></label>
            <label class="appr-field"><span>Lead line</span>
              <input type="text" id="apprLead" value="${esc(c.lead)}" /></label>
            <label class="appr-field"><span>Name on the certificate</span>
              <input type="text" id="apprName" value="${esc(c.memberName)}" placeholder="Member name" /></label>
            <div class="appr-field"><span>Description</span>
              ${(c.body || []).map((l, i) => `<input type="text" data-body="${i}" value="${esc(l)}" />`).join("")}
            </div>
            <div class="appr-two">
              <label class="appr-field"><span>Certificate ID</span>
                <input type="text" id="apprCertId" value="${esc(c.certificateId)}" /></label>
              <label class="appr-field"><span>Issue date</span>
                <input type="date" id="apprIssue" value="${toISO(ST.issueDate)}" /></label>
            </div>
            <div class="appr-brand-note">Brand block — <b>Online Tech Academy</b> &amp; <b>Medha AI</b> · signed by
              <b> Sirajul Islam Jony</b>, Medha AI Project Manager</div>
          </div>
          <div class="appr-topics">
            <div class="appr-field"><span>Topics Covered</span>
              <div class="appr-topic-hint">edit · add · remove</div>
            </div>
            ${topicEditor}
          </div>
        </div>
        <div class="appr-preview-box">
          <div class="appr-preview-head"><span>Live preview</span><span>${esc(t.label)}</span></div>
          <div class="appr-stage-wrap"><div class="appr-stage">${certificateHtml(c)}</div></div>
        </div>
      </section>

      <!-- 3 · actions -->
      <section class="panel">
        <header class="panel-head"><h2 class="panel-title">Actions</h2></header>
        <div class="appr-actions">
          <button class="btn-primary" id="apprDocx" ${sel.length ? "" : "disabled"}>Download DOCX</button>
          <button class="btn-ghost" id="apprPrint" ${sel.length ? "" : "disabled"}>Print / Save as PDF</button>
          <button class="btn-ghost" id="apprDocs" ${sel.length ? "" : "disabled"}>Save to Google Docs</button>
          <button class="btn-ghost" id="apprEmail" ${sel.length ? "" : "disabled"}>Email to members</button>
          <button class="btn-ghost" id="apprPreview" ${sel.length ? "" : "disabled"}>Preview all</button>
          ${sel.length ? "" : '<span class="appr-hint">Pick at least one member</span>'}
        </div>
      </section>

      <!-- email panel -->
      ${ST.emailOpen ? `
      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Email to ${sel.length} member${sel.length === 1 ? "" : "s"}</h2>
        </header>
        <label class="appr-field"><span>Subject</span>
          <input type="text" id="apprMailSubject" value="${esc(ST.emailSubject)}" /></label>
        <label class="appr-field"><span>Message</span>
          <div class="appr-mail-toolbar" id="apprMailTb">
            <button type="button" data-fmt="bold" title="Bold"><b>B</b></button>
            <button type="button" data-fmt="italic" title="Italic"><i>I</i></button>
            <button type="button" data-fmt="underline" title="Underline"><u>U</u></button>
            <button type="button" data-fmt="insertUnorderedList" title="Bullet list">• List</button>
            <button type="button" data-fmt="insertOrderedList" title="Numbered list">1. List</button>
            <label class="appr-tb-color">Color <input type="color" id="apprMailColor" value="#312e81" /></label>
            <select id="apprMailFont" title="Font">
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Tahoma">Tahoma</option>
              <option value="Verdana">Verdana</option>
            </select>
            <select id="apprMailSize" title="Size">
              <option value="2">Small</option>
              <option value="3" selected>Normal</option>
              <option value="4">Large</option>
              <option value="5">X-Large</option>
            </select>
          </div>
          <div id="apprMailBody" class="appr-mail-editor" contenteditable="true" data-placeholder="Write the email message…">${ST.emailHtml || ""}</div>
        </label>
        <label class="appr-check">
          <input type="checkbox" id="apprAutoNote" ${ST.autoNote ? "checked" : ""} />
          Include line: “This is an automated email. Please do not reply.”
        </label>
        <div class="appr-field" style="margin-top:10px;">
          <span style="font-size:12.5px;font-weight:700;color:var(--text-muted);">Banner &amp; Footer</span>
          <div class="appr-banner-opts">
            <label><input type="radio" name="apprBanner" value="previous" ${ST.bannerMode === "previous" ? "checked" : ""} /> Previous (portal default)</label>
            <label><input type="radio" name="apprBanner" value="custom" ${ST.bannerMode === "custom" ? "checked" : ""} /> New (links below)</label>
            <label><input type="radio" name="apprBanner" value="none" ${ST.bannerMode === "none" ? "checked" : ""} /> No banner/footer</label>
          </div>
          <div id="apprCustomBannerWrap" style="display:${ST.bannerMode === "custom" ? "block" : "none"};margin-top:8px;">
            <input type="text" id="apprCustomBanner" placeholder="Banner image URL (optional)" value="${esc(ST.customBanner || "")}" style="width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid #e0e7ff;margin-bottom:6px;font:inherit;font-size:12.5px;" />
            <input type="text" id="apprCustomFooter" placeholder="Footer image URL (optional)" value="${esc(ST.customFooter || "")}" style="width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid #e0e7ff;font:inherit;font-size:12.5px;" />
          </div>
        </div>
        <div class="appr-actions" style="margin-top:12px;">
          <button class="btn-primary" id="apprSend">Send to the selected members</button>
          <button class="btn-ghost" id="apprEmailClose">Close</button>
        </div>
        <div class="appr-hint">Only the selected members receive this email.</div>
      </section>` : ""}

      <!-- history -->
      <section class="panel">
        <header class="panel-head"><h2 class="panel-title">Appreciation history</h2></header>
        ${ST.history.length ? `
        <div style="overflow-x:auto;">
          <table class="tbl">
            <thead><tr><th>Members</th><th>Template</th><th>Issue date</th><th>Action</th></tr></thead>
            <tbody>${ST.history.map((h) => `<tr>
              <td><b>${h.count}</b> <span class="dim">${esc(h.names)}</span></td>
              <td class="dim">${esc(TPL[h.template] ? TPL[h.template].label : h.template)}</td>
              <td class="dim">${esc(h.issueDate)}</td>
              <td><span class="appr-tag">${esc(h.action)}</span></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>` : '<div class="appr-empty">Nothing generated yet.</div>'}
      </section>

      <!-- template library -->
      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Template library</h2>
          <span class="panel-link" style="cursor:default;">
            <button class="btn-ghost" id="apprUpload">+ Upload template</button>
            <button class="btn-ghost" id="apprAddLink">+ Add link</button>
          </span>
        </header>
        <input type="file" id="apprFile" accept=".pptx,.docx,.doc,.pdf" class="appr-hidden" />
        ${ST.library.length ? `<div class="appr-lib">${ST.library.map((it) => `
          <div class="appr-lib-item">
            <span class="appr-tag">${esc(it.kind)}</span>
            <span class="appr-lib-name">${esc(it.name)}</span>
            <span class="dim">${Math.round((it.size || 0) / 1024)} KB · ${esc(it.at)}</span>
            ${it.url ? `<a class="appr-lib-link" href="${esc(it.url)}" target="_blank" rel="noopener">Open</a>`
                     : `<a class="appr-lib-link" href="${esc(it.dataUrl)}" download="${esc(it.name)}">Download</a>`}
            <button class="appr-lib-del" data-lib-del="${esc(it.id)}">Delete</button>
          </div>`).join("")}</div>`
          : '<div class="appr-empty">No uploaded templates yet. The two built-in ones are always available above.</div>'}
      </section>
    `;

    fitAllStages(box);
    fitTexts(box);

    if (!document.getElementById("apprStyle")) {
      const st = document.createElement("style");
      st.id = "apprStyle";
      st.textContent = CERT_CSS + APPR_CSS;
      document.head.appendChild(st);
    }

    bind(box);
  };

  /* the preview always fits the space it is given */
  const fitStage = (wrap) => {
    if (!wrap) return;
    const stage = wrap.querySelector(".appr-stage");
    if (!stage) return;
    const avail = wrap.clientWidth || 1120;
    const scale = Math.max(0.2, Math.min(0.98, avail / 1120));
    stage.style.transform = "scale(" + scale + ")";
    wrap.style.height = Math.ceil(820 * scale) + "px";
  };

  const fitAllStages = (root) => {
    (root || document).querySelectorAll(".appr-stage-wrap").forEach(fitStage);
  };

  /* ---------------- CSS for the portal page ---------------- */
  const APPR_CSS = `
.appr-head-card{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  padding:16px 20px;border-radius:var(--radius-lg);color:#fff;margin-bottom:16px;
  background:linear-gradient(100deg,#5b21b6 0%,#6d28d9 55%,#ea580c 100%);box-shadow:var(--shadow-lg);}
.appr-head-title{font-size:20px;font-weight:800;letter-spacing:-.2px;}
.appr-head-sub{font-size:12px;opacity:.85;margin-top:2px;}
.appr-tpl-pick{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;opacity:.95;}
.appr-tpl-pick select{font-size:12px;font-weight:700;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);
  background:#fff;color:#1e1b4b;}
.appr-row{cursor:pointer;transition:background .12s;}
.appr-row:hover{background:var(--primary-bg);}
.appr-row.on{background:var(--primary-soft);}
.appr-row td.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--primary);font-weight:700;}
.appr-row td.dim,.appr-row .dim{color:var(--text-muted);}
.appr-tag{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;
  background:var(--primary-soft);color:var(--primary);}
.appr-empty{padding:26px;text-align:center;color:var(--text-dim);font-size:12.5px;}
.appr-grid{display:grid;grid-template-columns:1fr;gap:18px;}
@media (min-width:980px){.appr-grid{grid-template-columns:1.15fr .85fr;}}
.appr-fields{display:flex;flex-direction:column;gap:10px;}
.appr-field{display:flex;flex-direction:column;gap:5px;}
.appr-field>span{font-size:11px;font-weight:800;color:var(--text-muted);letter-spacing:.02em;}
.appr-field input,.appr-field textarea{padding:9px 11px;border:1px solid var(--border-2);border-radius:10px;font-size:12.5px;
  background:var(--bg-soft);color:var(--text);width:100%;font-family:inherit;}
.appr-field input:focus,.appr-field textarea:focus{outline:none;border-color:var(--primary-2);box-shadow:0 0 0 3px rgba(124,58,237,.12);}
.appr-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.appr-brand-note{font-size:11.5px;color:var(--text-muted);background:var(--primary-bg);border:1px solid var(--primary-soft);
  border-radius:10px;padding:9px 11px;}
.appr-topic-hint{font-size:10.5px;color:var(--text-dim);}
.appr-topic-row{margin-top:10px;}
.appr-topic-label{font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;margin-bottom:5px;}
.appr-topic-items{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.appr-topic-item{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--border-2);border-radius:999px;
  padding:2px 4px 2px 10px;background:#fff;}
.appr-topic-item input{border:none;outline:none;font-size:11.5px;font-weight:700;color:var(--text);width:104px;background:transparent;}
.appr-x{border:none;background:transparent;color:var(--text-dim);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:999px;}
.appr-x:hover{color:var(--danger);background:var(--danger-soft,#fee2e2);}
.appr-add{font-size:11px;padding:5px 10px;}
.appr-preview-box{margin-top:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-soft);padding:12px;}
.appr-preview-head{display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:8px;}
.appr-preview-box .appr-stage-wrap{height:520px;}
.appr-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.appr-actions .btn-primary,.appr-actions .btn-ghost{font-size:12.5px;}
.appr-actions button[disabled]{opacity:.42;cursor:not-allowed;}
.appr-hint{font-size:11.5px;font-weight:700;color:var(--warning);}
.appr-check{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--text-muted);margin:10px 0;}
.appr-lib{display:flex;flex-direction:column;gap:6px;}
.appr-lib-item{display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid var(--border);border-radius:12px;
  background:var(--bg-soft);font-size:12px;}
.appr-lib-name{flex:1;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.appr-lib-link{font-size:11.5px;font-weight:800;color:var(--primary);text-decoration:none;}
.appr-lib-del{border:none;background:transparent;color:var(--danger);font-size:11.5px;font-weight:800;cursor:pointer;}
.appr-hidden{display:none;}
.appr-modal{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:18px;}
.appr-modal-bg{position:absolute;inset:0;background:rgba(30,27,75,.34);backdrop-filter:blur(2px);}
.appr-modal-card{position:relative;width:100%;max-width:560px;background:#fff;border-radius:var(--radius-xl);
  box-shadow:0 24px 60px rgba(15,23,42,.22);border:1px solid var(--border);overflow:hidden;max-height:90vh;display:flex;flex-direction:column;}
.appr-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);}
.appr-modal-head h3{margin:0;font-size:14px;font-weight:800;color:var(--text);}
.appr-modal-x{border:none;background:transparent;font-size:20px;line-height:1;color:var(--text-dim);cursor:pointer;}
.appr-modal-body{padding:18px;overflow:auto;}
.appr-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--border);background:var(--bg-soft);}
.appr-modal-preview{border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-soft);padding:10px;margin-top:14px;overflow:hidden;}
.appr-modal-preview .appr-stage-wrap{height:300px;}
.appr-pin{letter-spacing:.35em;text-align:center;font-size:15px;}

.appr-ex td{opacity:.95;}.appr-mail-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;padding:8px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;}
.appr-mail-toolbar button{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:5px 10px;font-size:12.5px;cursor:pointer;font-family:inherit;}
.appr-mail-toolbar button:hover{background:#eef2ff;border-color:#c7d2fe;}
.appr-mail-toolbar select{border:1px solid #e2e8f0;border-radius:8px;padding:5px 8px;font-size:12.5px;background:#fff;}
.appr-tb-color{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#64748b;}
.appr-tb-color input{width:28px;height:28px;border:none;padding:0;background:transparent;cursor:pointer;}
.appr-mail-editor{min-height:140px;max-height:320px;overflow:auto;padding:12px 14px;border:1.5px solid #e0e7ff;border-radius:10px;background:#fff;font-size:13.5px;line-height:1.55;outline:none;}
.appr-mail-editor:empty:before{content:attr(data-placeholder);color:#94a3b8;}
.appr-banner-opts{display:flex;flex-wrap:wrap;gap:12px 18px;margin-top:8px;font-size:12.5px;}
.appr-banner-opts label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;}
.appr-pin-row{display:flex;gap:8px;justify-content:center;margin:14px 0 4px;}
.appr-pin-key{width:44px;height:44px;border-radius:12px;border:1px solid var(--border-2);background:var(--bg-soft);
  font-size:16px;font-weight:800;color:var(--text);cursor:pointer;}
.appr-pin-key:hover{border-color:var(--primary-2);color:var(--primary);background:var(--primary-bg);}
`;

  /* ---------------- events ---------------- */
  let fitTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => fitAllStages(document), 120);
  });

  const bind = (box) => {
    const on = (id, ev, fn) => { const el = box.querySelector(id); if (el) el.addEventListener(ev, fn); };

    on("#apprTemplate", "change", (e) => switchTemplate(e.target.value));

    box.querySelectorAll("[data-atab]").forEach((b) => b.addEventListener("click", () => {
      ST.tab = b.dataset.atab; paint();
    }));

    let t = null;
    on("#apprSearch", "input", (e) => {
      clearTimeout(t);
      const v = e.target.value;
      t = setTimeout(() => {
        ST.q = v;
        paint();
        const s = ST.container.querySelector("#apprSearch");
        if (s) { s.focus(); s.setSelectionRange(v.length, v.length); }
      }, 220);
    });

    on("#apprClear", "click", () => { ST.ids = []; syncFromSelection(); paint(); });

    on("#apprAll", "change", (e) => {
      const rows = filtered();
      if (e.target.checked) {
        rows.forEach((m) => { if (ST.ids.indexOf(m.memberId) === -1) ST.ids.push(m.memberId); });
      } else {
        const ids = rows.map((m) => m.memberId);
        ST.ids = ST.ids.filter((x) => ids.indexOf(x) === -1);
      }
      syncFromSelection(); paint();
    });

    box.querySelectorAll("[data-pick]").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      const id = tr.dataset.pick;
      ST.ids = ST.ids.indexOf(id) === -1 ? ST.ids.concat([id]) : ST.ids.filter((x) => x !== id);
      syncFromSelection(); paint();
    }));
    box.querySelectorAll("tbody tr[data-pick] input[type=checkbox]").forEach((cb) =>
      cb.addEventListener("change", (e) => {
        e.stopPropagation();
        const id = cb.closest("tr").dataset.pick;
        ST.ids = ST.ids.indexOf(id) === -1 ? ST.ids.concat([id]) : ST.ids.filter((x) => x !== id);
        syncFromSelection(); paint();
      })
    );

    const live = (id, key) => on(id, "input", (e) => setContent({ [key]: e.target.value }));
    live("#apprTitle", "title");
    live("#apprSubtitle", "subtitle");
    live("#apprLead", "lead");
    live("#apprName", "memberName");
    live("#apprCertId", "certificateId");

    box.querySelectorAll("[data-body]").forEach((el) => el.addEventListener("input", (e) => {
      const i = Number(el.dataset.body);
      const body = [...ST.content.body];
      body[i] = e.target.value;
      ST.content = Object.assign({}, ST.content, { body });
      refreshPreview();
    }));

    box.querySelectorAll("[data-topic]").forEach((el) => el.addEventListener("input", (e) => {
      const [r, i] = el.dataset.topic.split("-").map(Number);
      const topics = ST.content.topics.map((row) => [...row]);
      topics[r][i] = e.target.value;
      ST.content = Object.assign({}, ST.content, { topics });
      refreshPreview();
    }));
    box.querySelectorAll("[data-topic-add]").forEach((b) => b.addEventListener("click", () => {
      const r = Number(b.dataset.topicAdd);
      const topics = ST.content.topics.map((row) => [...row]);
      topics[r].push("New topic");
      ST.content = Object.assign({}, ST.content, { topics });
      paint();
    }));
    box.querySelectorAll("[data-topic-del]").forEach((b) => b.addEventListener("click", () => {
      const [r, i] = b.dataset.topicDel.split("-").map(Number);
      const topics = ST.content.topics.map((row) => [...row]);
      topics[r].splice(i, 1);
      ST.content = Object.assign({}, ST.content, { topics });
      paint();
    }));

    on("#apprIssue", "change", (e) => {
      const v = fromISO(e.target.value);
      ST.issueDate = v;
      ST.content = Object.assign({}, ST.content, { issueDate: v });
      paint();
    });

    on("#apprDocx", "click", () => confirmThen("docx"));
    on("#apprPrint", "click", () => confirmThen("pdf"));
    on("#apprDocs", "click", () => confirmThen("docs"));
    on("#apprEmail", "click", () => confirmThen("email"));
    on("#apprPreview", "click", () => previewAll());

    on("#apprMailSubject", "input", (e) => { ST.emailSubject = e.target.value; });
    const ed = box.querySelector("#apprMailBody");
    if (ed) {
      const syncEd = () => {
        ST.emailHtml = ed.innerHTML;
        ST.emailBody = (ed.innerText || "").trim();
      };
      ed.addEventListener("input", syncEd);
      ed.addEventListener("blur", syncEd);
    }
    box.querySelectorAll("#apprMailTb button[data-fmt]").forEach((b) => {
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        const el = box.querySelector("#apprMailBody");
        if (el) el.focus();
        document.execCommand(b.dataset.fmt, false, null);
        if (el) { ST.emailHtml = el.innerHTML; ST.emailBody = (el.innerText || "").trim(); }
      });
    });
    const col = box.querySelector("#apprMailColor");
    if (col) col.addEventListener("input", () => {
      const el = box.querySelector("#apprMailBody");
      if (el) el.focus();
      document.execCommand("foreColor", false, col.value);
      if (el) { ST.emailHtml = el.innerHTML; ST.emailBody = (el.innerText || "").trim(); }
    });
    const font = box.querySelector("#apprMailFont");
    if (font) font.addEventListener("change", () => {
      const el = box.querySelector("#apprMailBody");
      if (el) el.focus();
      document.execCommand("fontName", false, font.value);
    });
    const size = box.querySelector("#apprMailSize");
    if (size) size.addEventListener("change", () => {
      const el = box.querySelector("#apprMailBody");
      if (el) el.focus();
      document.execCommand("fontSize", false, size.value);
    });
    on("#apprAutoNote", "change", (e) => { ST.autoNote = e.target.checked; });
    box.querySelectorAll('input[name="apprBanner"]').forEach((r) => {
      r.addEventListener("change", () => {
        if (!r.checked) return;
        ST.bannerMode = r.value;
        const w = box.querySelector("#apprCustomBannerWrap");
        if (w) w.style.display = r.value === "custom" ? "block" : "none";
      });
    });
    on("#apprCustomBanner", "input", (e) => { ST.customBanner = e.target.value; });
    on("#apprCustomFooter", "input", (e) => { ST.customFooter = e.target.value; });
    on("#apprEmailClose", "click", () => { ST.emailOpen = false; paint(); });
    on("#apprSend", "click", sendMail);

    on("#apprUpload", "click", () => { const f = box.querySelector("#apprFile"); if (f) f.click(); });
    on("#apprFile", "change", (e) => uploadFile(e.target.files, box));
    on("#apprAddLink", "click", addLink);

    box.querySelectorAll("[data-lib-del]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.libDel;
      pinPrompt().then((ok) => {
        if (!ok) return;
        ST.library = ST.library.filter((x) => x.id !== id);
        store(LIB_KEY, ST.library);
        paint();
        Notify.ok("Template removed");
      });
    }));
  };

  /* only the preview is repainted while typing — the page must not jump */
  const refreshPreview = () => {
    const box = ST.container;
    if (!box) return;
    const stage = box.querySelector(".appr-preview-box .appr-stage");
    if (stage) stage.innerHTML = certificateHtml(ST.content);
  };

  /* ---------------- confirm popup ---------------- */
  const confirmThen = (action) => {
    const sel = selected();
    if (!sel.length) { Notify.warn("Pick at least one member first."); return; }
    const id = "apprc_" + Date.now();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="appr-modal" id="${id}">
        <div class="appr-modal-bg" data-appr-close></div>
        <div class="appr-modal-card">
          <header class="appr-modal-head">
            <h3>Confirm</h3>
            <button class="appr-modal-x" data-appr-close>&times;</button>
          </header>
          <div class="appr-modal-body">
            <div class="appr-two">
              <label class="appr-field"><span>Issue date</span>
                <input type="date" id="${id}_date" value="${toISO(ST.issueDate)}" /></label>
              <label class="appr-field"><span>Template</span>
                <select id="${id}_tpl">
                  <option value="brand"${ST.template === "brand" ? " selected" : ""}>Appreciation 1 — Brand Color</option>
                  <option value="regular"${ST.template === "regular" ? " selected" : ""}>Appreciation 2 — Regular</option>
                </select></label>
            </div>
            <div class="appr-modal-preview">
              <div class="appr-preview-head"><span>Preview — ${sel.length} member${sel.length === 1 ? "" : "s"}</span></div>
              <div class="appr-stage-wrap"><div class="appr-stage">${certificateHtml(ST.content)}</div></div>
            </div>
          </div>
          <footer class="appr-modal-foot">
            <button class="btn-ghost" data-appr-close>Cancel</button>
            <button class="btn-primary" id="${id}_ok">Confirm</button>
          </footer>
        </div>
      </div>`);

    const root = document.getElementById(id);
    fitAllStages(root);
    fitTexts(root);
    const close = () => { root.remove(); };
    root.querySelectorAll("[data-appr-close]").forEach((b) => b.addEventListener("click", close));
    root.querySelector(`#${id}_date`).addEventListener("change", (e) => {
      ST.issueDate = fromISO(e.target.value);
      ST.content = Object.assign({}, ST.content, { issueDate: ST.issueDate });
    });
    root.querySelector(`#${id}_tpl`).addEventListener("change", (e) => {
      switchTemplate(e.target.value);
      const stage = root.querySelector(".appr-stage");
      if (stage) stage.innerHTML = certificateHtml(ST.content);
    });
    root.querySelector(`#${id}_ok`).addEventListener("click", () => {
      close();
      if (action === "docx") doDocx();
      else if (action === "pdf") {
        const sel = selected();
        const items = (sel.length ? sel : [null]).map((m) => {
          if (!m) return ST.content;
          return Object.assign({}, ST.content, {
            memberName: m.name, memberEmail: m.email, memberId: m.memberId,
            certificateId: certificateIdFor(m.memberId, isP2(m)),
            issueDate: ST.issueDate || ST.content.issueDate,
          });
        });
        printCertificate(items);
        log("PDF");
        Notify.ok("Print window opened — A4 landscape. Choose “Save as PDF” if needed.");
      }
      else if (action === "docs") doDocs();
      else { ST.emailOpen = true; paint(); }
    });
    requestAnimationFrame(() => root.classList.add("show"));
  };

  /* ---------------- preview all ---------------- */
  const previewAll = () => {
    const sel = selected();
    if (!sel.length) return;
    const id = "apprp_" + Date.now();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="appr-modal" id="${id}">
        <div class="appr-modal-bg" data-appr-close></div>
        <div class="appr-modal-card" style="max-width:980px;">
          <header class="appr-modal-head">
            <h3>Preview — ${sel.length} certificate${sel.length === 1 ? "" : "s"}</h3>
            <button class="appr-modal-x" data-appr-close>&times;</button>
          </header>
          <div class="appr-modal-body">
            ${sel.map((m, i) => `
              <div style="margin-bottom:22px;">
                <div class="appr-preview-head"><span>${i + 1}. ${esc(m.memberId)} — ${esc(m.name)}</span></div>
                <div class="appr-stage-wrap" style="height:520px;"><div class="appr-stage">${certificateHtml(
                  Object.assign({}, ST.content, { memberName: m.name, memberId: m.memberId })
                )}</div></div>
              </div>`).join("")}
          </div>
          <footer class="appr-modal-foot"><button class="btn-ghost" data-appr-close>Close</button></footer>
        </div>
      </div>`);
    const root = document.getElementById(id);
    fitAllStages(root);
    fitTexts(root);
    root.querySelectorAll("[data-appr-close]").forEach((b) => b.addEventListener("click", () => root.remove()));
    requestAnimationFrame(() => root.classList.add("show"));
  };

  /* ---------------- actions ---------------- */
  const doDocx = async () => {
    const sel = selected();
    const btn = ST.container.querySelector("#apprDocx");
    if (btn) { btn.disabled = true; btn.textContent = "Building…"; }
    try {
      for (let i = 0; i < sel.length; i++) {
        const m = sel[i];
        const c = Object.assign({}, ST.content, {
          memberName: m.name, memberEmail: m.email, memberId: m.memberId,
          certificateId: certificateIdFor(m.memberId, isP2(m)),
        });
        const blob = await buildDocx(c);
        downloadBlob(blob, `${m.memberId}.docx`);
        await new Promise((r) => setTimeout(r, 400));
      }
      log("DOCX");
      Notify.ok(`Downloaded ${sel.length} Word file${sel.length === 1 ? "" : "s"}.`);
    } catch (e) {
      Notify.err("Could not build the Word file: " + (e && e.message ? e.message : "unknown error"));
    }
    paint();
  };

  const doDocs = async () => {
    const sel = selected();
    try {
      const members = sel.map((m) => ({
        name: m.name, memberId: m.memberId, email: m.email,
        title: ST.content.title, subtitle: ST.content.subtitle, lead: ST.content.lead,
        bodyLines: ST.content.body,
        topics: ST.content.topics.map((row) => row.join(" · ")),
        certificateId: certificateIdFor(m.memberId, isP2(m)),
        issueDate: ST.issueDate || ST.content.issueDate,
      }));
      if (!window.Api || typeof Api.createAppreciationDocs !== "function") {
        Notify.warn("Backend is not connected — connect Apps Script, then Deploy a new version.");
        return;
      }
      const r = await Api.createAppreciationDocs({ members });
      if (r && r.success && r.urls && r.urls.length) {
        window.open(r.urls[0], "_blank", "noopener");
        log("Google Docs");
        Notify.ok(r.message || (`Created ${r.count} Google Doc${r.count === 1 ? "" : "s"}.`));
      } else {
        Notify.warn((r && r.message) || "Google Docs failed — open Apps Script → Deploy → New version (Anyone).");
      }
    } catch (e) {
      Notify.warn("Google Docs is not available yet — re-deploy the Apps Script backend.");
    }
  };

  const sendMail = async () => {
    const sel = selected();
    if (!sel.length) return;
    const ed = ST.container && ST.container.querySelector("#apprMailBody");
    if (ed) {
      ST.emailHtml = ed.innerHTML;
      ST.emailBody = (ed.innerText || "").trim();
    }
    const btn = ST.container.querySelector("#apprSend");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    try {
      const recipients = sel.map((m) => ({ email: m.email, name: m.name, memberId: m.memberId })).filter((x) => x.email);
      if (!recipients.length) throw new Error("No email addresses on the selected members");
      const bodyHtml = ST.emailHtml || String(ST.emailBody || "").replace(/\n/g, "<br>");
      const r = await Api.sendMail({
        program: "Appreciation",
        subject: ST.emailSubject,
        bodyHtml,
        recipients,
        includeAutoNote: ST.autoNote,
        bannerMode: ST.bannerMode || "previous",
        bannerUrl: ST.customBanner || "",
        footerUrl: ST.customFooter || "",
        customBannerUrl: ST.customBanner || "",
        customFooterUrl: ST.customFooter || "",
      });
      log("Email");
      Notify.ok(`Sent to ${r && r.sent != null ? r.sent : recipients.length} member(s).`);
    } catch (e) {
      Notify.err("Could not send: " + (e && e.message ? e.message : "unknown error"));
    }
    paint();
  };

  /* ---------------- library ---------------- */
  const uploadFile = (files) => {
    if (!files || !files.length) return;
    const f = files[0];
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const kind = ext === "pptx" ? "PPTX" : (ext === "docx" || ext === "doc") ? "Word" : ext === "pdf" ? "PDF" : null;
    if (!kind) { Notify.warn("Upload a PPTX, Word or PDF file."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      ST.library = [{
        id: "lib" + Date.now(), name: f.name, kind, size: f.size,
        at: new Date().toLocaleString("en-GB"), dataUrl: String(reader.result || ""),
      }].concat(ST.library);
      store(LIB_KEY, ST.library);
      paint();
      Notify.ok("Template added");
    };
    reader.readAsDataURL(f);
  };

  const addLink = () => {
    Modal.form({
      title: "Add a template link",
      fields: [{ key: "url", label: "Google Doc / Drive link", type: "text", required: true, wide: true }],
      okText: "Add",
    }).then((vals) => {
      if (!vals || !vals.url) return;
      ST.library = [{
        id: "lib" + Date.now(), name: vals.url.split("/").pop() || "Google Doc", kind: "Link",
        size: 0, at: new Date().toLocaleString("en-GB"), url: vals.url,
      }].concat(ST.library);
      store(LIB_KEY, ST.library);
      paint();
    }).catch(() => {});
  };

  /* ---------------- PIN (2026) ---------------- */
  const pinPrompt = () => new Promise((resolve) => {
    const id = "apprp_" + Date.now();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="appr-modal" id="${id}">
        <div class="appr-modal-bg" data-appr-close></div>
        <div class="appr-modal-card" style="max-width:360px;">
          <header class="appr-modal-head">
            <h3>Confirm delete</h3>
            <button class="appr-modal-x" data-appr-close>&times;</button>
          </header>
          <div class="appr-modal-body">
            <div style="font-size:12.5px;color:var(--text-muted);text-align:center;">Enter the master code to remove this template.</div>
            <div class="appr-pin-row">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="appr-pin-key" data-k="${n}">${n}</button>`).join("")}
              <button class="appr-pin-key" data-k="clear">×</button>
              <button class="appr-pin-key" data-k="0">0</button>
            </div>
            <input type="password" inputmode="numeric" maxlength="4" id="${id}_pin" class="appr-pin" />
            <div id="${id}_err" class="appr-hint" style="text-align:center;margin-top:8px;"></div>
          </div>
          <footer class="appr-modal-foot">
            <button class="btn-ghost" data-appr-close>Cancel</button>
            <button class="btn-primary" id="${id}_ok">Confirm Delete</button>
          </footer>
        </div>
      </div>`);
    const root = document.getElementById(id);
    const pin = root.querySelector(`#${id}_pin`);
    const err = root.querySelector(`#${id}_err`);
    const close = (v) => { root.remove(); resolve(v); };
    root.querySelectorAll("[data-appr-close]").forEach((b) => b.addEventListener("click", () => close(false)));
    root.querySelectorAll(".appr-pin-key").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k;
      if (k === "clear") pin.value = "";
      else if (pin.value.length < 4) pin.value += k;
    }));
    root.querySelector(`#${id}_ok`).addEventListener("click", () => {
      if (pin.value === "2026") close(true);
      else { err.textContent = "Wrong code."; pin.value = ""; }
    });
    setTimeout(() => pin.focus(), 120);
  });

  return {
    render,
    TPL,
    certificateHtml,
    buildDocx,
    downloadBlob,
  };
})();
