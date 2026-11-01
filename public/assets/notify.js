/* === Medha Program Management — notifications & in-site modals === */

/* Global HTML escaper — shared by the app shell and the modal helpers. */
window.escapeHtml = window.escapeHtml || function (s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};
/* Replaces every native alert()/prompt()/confirm() with a centred,
   on-brand overlay so nothing ever shows a raw browser dialog. */

const Notify = (() => {
  let stack = [];

  const show = (opts) => {
    const o = typeof opts === "string" ? { message: opts } : (opts || {});
    const kind = o.kind || "info";               // info | success | error | warn
    const id = "ntf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

    const icon = {
      info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    }[kind];

    const el = document.createElement("div");
    el.className = "ntf-overlay";
    el.id = id;
    el.innerHTML = `
      <div class="ntf-card ${kind}" role="alertdialog" aria-modal="true">
        <div class="ntf-ico">${icon}</div>
        <div class="ntf-body">
          ${o.title ? `<div class="ntf-title">${escapeHtml(o.title)}</div>` : ""}
          <div class="ntf-msg">${o.html ? o.message : escapeHtml(o.message || "")}</div>
          ${o.hint ? `<div class="ntf-hint">${escapeHtml(o.hint)}</div>` : ""}
          ${o.action && o.action.label ? `
            <button class="ntf-action" type="button">${escapeHtml(o.action.label)}</button>` : ""}
        </div>
        <button class="ntf-x" aria-label="Close">×</button>
      </div>
    `;
    document.body.appendChild(el);
    stack.push(el);

    requestAnimationFrame(() => el.classList.add("show"));
    const close = () => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
      stack = stack.filter(x => x !== el);
    };
    el.querySelector(".ntf-x").addEventListener("click", close);
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    const actionBtn = el.querySelector(".ntf-action");
    if (actionBtn && o.action && typeof o.action.onClick === "function") {
      actionBtn.addEventListener("click", () => {
        try { o.action.onClick(); } catch (e) { /* the toast must never break the app */ }
        close();
      });
    }
    const t = setTimeout(close, o.duration || (o.action ? 8000 : (kind === "error" ? 5200 : 3200)));
    el.addEventListener("mouseenter", () => clearTimeout(t));

    return { close, el };
  };

  return {
    show,
    ok: (m, o) => show({ ...(typeof o === "object" ? o : {}), message: m, kind: "success" }),
    err: (m, o) => show({ ...(typeof o === "object" ? o : {}), message: m, kind: "error" }),
    warn: (m, o) => show({ ...(typeof o === "object" ? o : {}), message: m, kind: "warn" }),
    info: (m, o) => show({ ...(typeof o === "object" ? o : {}), message: m, kind: "info" }),
  };
})();

/* ---------- In-site modal helpers (promise based) ---------- */
const Modal = (() => {
  /**
   * Form-style modal.
   * fields: [{ key, label, type, value, placeholder, options, hint, required }]
   * returns Promise<values|null>
   */
  const form = (opts) => new Promise((resolve) => {
    const o = opts || {};
    const fields = o.fields || [];
    const id = "mdl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

    const fieldHtml = (f) => {
      const val = f.value == null ? "" : f.value;
      let input;
      if (f.type === "select") {
        input = `<select data-k="${f.key}">${(f.options || []).map(op =>
          `<option value="${escapeHtml(op.value ?? op)}" ${String(op.value ?? op) === String(val) ? "selected" : ""}>${escapeHtml(op.label ?? op)}</option>`
        ).join("")}</select>`;
      } else if (f.type === "textarea") {
        input = `<textarea data-k="${f.key}" rows="${f.rows || 3}" placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea>`;
      } else {
        input = `<input type="${f.type || "text"}" data-k="${f.key}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" />`;
      }
      return `<div class="mdl-field ${f.wide ? "wide" : ""}">
        <label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label>
        ${input}
        ${f.hint ? `<span class="mdl-hint">${escapeHtml(f.hint)}</span>` : ""}
      </div>`;
    };

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay mdl-overlay" id="${id}">
        <div class="modal mdl-card">
          <header class="modal-head">
            <h3>${escapeHtml(o.title || "Dialog")}</h3>
            <button class="modal-close" data-close aria-label="Close">&times;</button>
          </header>
          <div class="modal-body">
            ${o.intro ? `<p class="modal-help" style="margin-top:0;">${escapeHtml(o.intro)}</p>` : ""}
            <div class="mdl-grid">${fields.map(fieldHtml).join("")}</div>
            <div class="mdl-error" data-err></div>
            <div class="modal-actions">
              <button class="btn-ghost" data-close>${escapeHtml(o.cancelText || "Cancel")}</button>
              <button class="btn-primary" data-save>${escapeHtml(o.okText || "Save")}</button>
            </div>
          </div>
        </div>
      </div>
    `);

    const root = document.getElementById(id);
    const done = (v) => {
      root.classList.remove("show");
      setTimeout(() => root.remove(), 180);
      resolve(v);
    };
    root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => done(null)));
    root.addEventListener("click", (e) => { if (e.target === root) done(null); });
    root.querySelector("[data-save]").addEventListener("click", () => {
      const vals = {};
      let bad = null;
      fields.forEach(f => {
        const el = root.querySelector(`[data-k="${f.key}"]`);
        vals[f.key] = el ? el.value : "";
        if (f.required && !String(vals[f.key]).trim()) bad = f.label;
      });
      if (bad) {
        const e = root.querySelector("[data-err]");
        e.textContent = bad + " is required.";
        e.classList.add("show");
        return;
      }
      done(vals);
    });
    root.querySelectorAll("input,textarea,select").forEach(el => {
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && el.tagName !== "TEXTAREA") {
          ev.preventDefault();
          root.querySelector("[data-save]").click();
        }
      });
    });
    requestAnimationFrame(() => root.classList.add("show"));
    setTimeout(() => {
      const first = root.querySelector("input,textarea,select");
      if (first) first.focus();
    }, 140);
  });

  /** Yes/No confirmation → Promise<boolean> */
  const confirm = (opts) => new Promise((resolve) => {
    const o = typeof opts === "string" ? { message: opts } : (opts || {});
    const id = "mdlc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay mdl-overlay" id="${id}">
        <div class="modal mdl-card" style="max-width:420px;">
          <header class="modal-head">
            <h3>${escapeHtml(o.title || "Please confirm")}</h3>
            <button class="modal-close" data-close aria-label="Close">&times;</button>
          </header>
          <div class="modal-body">
            <p style="margin:0;font-size:14px;line-height:1.6;color:var(--text);">${escapeHtml(o.message || "")}</p>
            ${o.hint ? `<p style="margin:10px 0 0;font-size:12.5px;color:var(--text-muted);">${escapeHtml(o.hint)}</p>` : ""}
            <div class="modal-actions">
              <button class="btn-ghost" data-close>${escapeHtml(o.cancelText || "Cancel")}</button>
              <button class="btn-primary ${o.danger ? "danger" : ""}" data-ok>${escapeHtml(o.okText || "Confirm")}</button>
            </div>
          </div>
        </div>
      </div>
    `);
    const root = document.getElementById(id);
    const done = (v) => {
      root.classList.remove("show");
      setTimeout(() => root.remove(), 180);
      resolve(v);
    };
    root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => done(false)));
    root.querySelector("[data-ok]").addEventListener("click", () => done(true));
    root.addEventListener("click", (e) => { if (e.target === root) done(false); });
    requestAnimationFrame(() => root.classList.add("show"));
  });

  return { form, confirm };
})();
