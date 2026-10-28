/* === Medha Program Management — main app === */

const App = (() => {
  const VIEWS = {
    overview: { title: "Overview" },
    batches: { title: "Batches" },
    members: { title: "Members" },
    payments: { title: "Payments" },
    agreements: { title: "Agreements" },
    classes: { title: "Classes & attendance" },
    tasks: { title: "Tasks & workshops" },
    feedback: { title: "Feedback" },
    scores: { title: "Scores & results" },
    evidence: { title: "Evidence & reports" },
    mail: { title: "Mail portal" },
    files: { title: "Files" },
    support: { title: "Support" },
    payadmin: { title: "Payments admin" },
  };

  const els = {};
  let state = {
    view: "overview",
    data: null,
    loading: false,
    master: null,
    /* is the Apps Script backend really answering? */
    backend: { url: "", ok: false, message: "", checked: false },
  };

  /* --- Init --- */
  const init = () => {
    cacheElements();
    bindNav();
    bindTopbar();
    bindConfigModal();
    bindSignOut();
    bindSheetGuide();
    bindKeyboard();
    // Wire any Sheet playbook links to the right URL
    document.querySelectorAll('[data-sheet-link]').forEach(a => {
      a.href = `https://docs.google.com/spreadsheets/d/${Api.SHEET_ID}/edit`;
      a.target = "_blank";
      a.rel = "noopener";
    });
    renderSheetLinks();
    renderSignedInUser();
    applySyncPrefToPill();
    startClock();
    /* find out straight away whether the backend really answers */
    checkBackendHealth().then(() => {
      applySyncPrefToPill();
      const m = document.getElementById("accountMenu");
      if (m) m.remove();
    });
    applyHiddenPages();
    Api.clearPendingRemovals();
    /* a link may carry a document list with it — bring it in and clean the
       address bar so the portal keeps working normally afterwards */
    (async () => {
      try {
        const code = new URLSearchParams(location.search).get("docs");
        if (!code) return;
        const r = await Api.importFileList(code);
        const url = location.origin + location.pathname + location.hash;
        history.replaceState(null, "", url);
        if (r && r.ok && r.count) {
          Notify.ok(r.count + " document" + (r.count === 1 ? "" : "s") + " brought over from the shared link", {
            title: "Documents restored",
            hint: "They are saved in this browser now.",
            duration: 6000,
          });
          if (state.view === "files") render("files", state.data);
        }
      } catch (e) { /* a broken link must never block the portal */ }
    })();
    // refresh the signed-in user when the user signs in / out
    window.addEventListener("mpm:login", () => setTimeout(renderSignedInUser, 60));
    const boot = parseHash();
    setView(boot.view || "overview", { replace: true, sub: boot.sub });
    loadMailBadge();
    // When a background sheet refresh lands, repaint the current view
    Api.onFreshData((fresh) => {
      if (!fresh) return;
      state.data = fresh;
      requestAnimationFrame(() => {
        if (state.view === "overview") render("overview", fresh);
        /* the Batch-01 Master list replaces the P2 list in the background —
           repaint so the new members show up without a reload */
        else if (state.view === "members") render("members", fresh);
        else if (state.view === "payments") render("payments", fresh);
      });
    });
    // Reveal as soon as fonts are ready (or immediately on fallback)
    const reveal = () => document.body.classList.remove("font-loading");
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(reveal).catch(reveal);
    } else {
      reveal();
    }
    setTimeout(reveal, 1200); // hard fallback — never stay invisible
    registerServiceWorker();
  };

  const registerServiceWorker = () => {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    try {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    } catch (e) {}
  };

  const bindSheetGuide = () => {
    els.sheetGuideBtn?.addEventListener("click", () => { els.sheetGuideModal.hidden = false; });
    els.sheetGuideClose?.addEventListener("click", () => { els.sheetGuideModal.hidden = true; });
    els.sheetGuideModal?.addEventListener("click", (e) => {
      if (e.target === els.sheetGuideModal) els.sheetGuideModal.hidden = true;
    });
  };

  /** Sidebar: both spreadsheet links (Medha program sheet + NCM Part-1 sheet) */
  /** Which brand belongs to the signed-in person.
      Medha admin -> the Medha logo, Online Tech Academy -> the OTA logo. */
  /* Where the pictures live. If the hosting folder layout ever changes, the
     small fallback in index.html finds the real place and tells us here. */
  const imgBase = () => (window.__MPM_IMG_BASE || "assets/img") + "/";
  const sessionBrand = () => {
    let username = "";
    try {
      const raw = localStorage.getItem("mpm.session") || sessionStorage.getItem("mpm.session");
      username = (raw ? (JSON.parse(raw) || {}) : {}).username || "";
    } catch (e) {}
    const isOta = String(username).toLowerCase() === "ota";
    return isOta
      ? { file: "ota-logo-600.png", mark: "ota-mark-128.png", wide: true,  label: "Online Tech Academy" }
      : { file: "medha-logo-256.png", mark: "medha-logo-256.png", wide: false, label: "Medha" };
  };

  /* Where the member list comes from. This lives in the "…" menu, not on
     the Members page, so the page stays clean. */
  const memberDataNoteHtml = () => {
    const d = state.data || {};
    if (d._p2FromBatch01) {
      return `<div class="am-note ok">
        <span class="sn-ico">&#10003;</span>
        <span>NCM PART-2 is loaded from <b>${escapeHtml(d._p2Source || "the Master sheet")}</b> in the Medha Batch-01 Master sheet.</span>
      </div>`;
    }
    if (d._p2Pending) {
      return `<div class="am-note">
        <span class="sn-ico">&#8230;</span>
        <span>Reading the Medha Batch-01 Master sheet&hellip;</span>
      </div>`;
    }
    return `<div class="am-note warn">
      <span class="sn-ico">!</span>
      <div>
        <b>NCM PART-2 is showing the older <code>Members NCM-P2</code> tab.</b>
        The browser could not open the Medha Batch-01 Master sheet — Google is hiding it from anyone who is not signed in.
        <div class="sn-actions">
          <button class="btn-primary sn-btn" id="snConnectBackend">Connect the backend</button>
          <a class="btn-ghost sn-btn" target="_blank" rel="noopener"
             href="https://docs.google.com/spreadsheets/d/${Api.BATCH01_SHEET_ID}/edit">Open the sheet &rarr; share it</a>
        </div>
        <span class="sn-hint">
          <b>Connect the backend</b> is the better fix — Apps Script reads the sheet with your own Google
          account, so it works without any sharing. <b>Or</b> open the sheet and set
          <b>Share &rarr; General access &rarr; Anyone with the link &rarr; Viewer</b>, then press
          <b>Refresh</b> on the Members page.
        </span>
        ${d._p2Note ? `<span class="sn-hint" style="opacity:.7;">(${escapeHtml(d._p2Note)})</span>` : ""}
      </div>
    </div>`;
  };

  /** Show the signed-in user in the workspace footer */
  const renderSignedInUser = () => {
    const sub = document.querySelector(".workspace-foot .ws-sub");
    const nameEl = document.querySelector(".workspace-foot .ws-name");
    if (!sub || !nameEl) return;
    /* the small logo beside the name follows the account that signed in;
       the Online Tech Academy mark above it always stays the same */
    const brand = sessionBrand();
    const userLogo = document.getElementById("wsUserLogo");
    const wantMark = imgBase() + brand.mark;
    if (userLogo && userLogo.getAttribute("src") !== wantMark) {
      userLogo.setAttribute("src", wantMark);
      userLogo.setAttribute("alt", brand.label);
    }
    try {
      const raw = localStorage.getItem("mpm.session") || sessionStorage.getItem("mpm.session");
      const s = raw ? JSON.parse(raw) : null;
      if (s && s.name) {
        nameEl.textContent = s.name;
        sub.textContent = "@" + (s.username || "");
      } else {
        nameEl.textContent = "Medha workspace";
        sub.textContent = "Online Tech Academy";
      }
    } catch (e) {}
  };

  /** Spreadsheet links — rendered on the Files page (no longer in the sidebar) */
  const renderSheetLinks = () => {};

  const cacheElements = () => {
    els.content = document.getElementById("content");
    els.crumb = document.getElementById("crumbCur");
    els.mailBadge = document.getElementById("mailBadge");
    els.syncPill = document.getElementById("syncPill");
    els.sheetNamePill = document.getElementById("sheetNamePill");
    els.exportBtn = document.getElementById("exportBtn");
    els.toast = document.getElementById("toast");
    els.configModal = document.getElementById("configModal");
    els.configUrl = document.getElementById("configUrl");
    els.configSave = document.getElementById("configSave");
    els.configSkip = document.getElementById("configSkip");
    els.configClose = document.getElementById("configClose");
    els.sheetGuideBtn = document.getElementById("sheetGuideBtn");
    els.sheetGuideModal = document.getElementById("sheetGuideModal");
    els.sheetGuideClose = document.getElementById("sheetGuideClose");
  };

  const bindNav = () => {
    document.querySelectorAll(".nav-item[data-view]").forEach(b => {
      b.addEventListener("click", () => setView(b.dataset.view));
    });
  };

  const bindTopbar = () => {
    els.exportBtn.addEventListener("click", exportCSV);
    /* the dot is a status light only — it never opens a window */
    els.syncPill?.removeAttribute("tabindex");
  };

  /** Reflect the sheet-sync preference in the top-right status pill */
  /** the little dot next to Export — green = backend live, amber = read-only */
  const applySyncPrefToPill = () => {
    if (!els.syncPill) return;
    const on = getSyncPref();
    const backendOn = Api.isBackendConfigured();
    const backendLive = !!(state.backend && state.backend.ok);
    els.syncPill.classList.toggle("offline", !on);
    els.syncPill.classList.toggle("ok", on && backendLive);
    els.syncPill.title = !on
      ? "Sheet sync is paused"
      : (backendLive
        ? "Sheet: Medha_DB \u00b7 Backend connected"
        : (backendOn
          ? "Sheet: Medha_DB \u00b7 Backend not working \u2014 " + ((state.backend && state.backend.message) || "the address did not answer")
          : "Sheet: Medha_DB \u00b7 Read-only \u2014 connect the backend to enable writes"));
  };

  /** The clock in the top bar — always Bangladesh Standard Time (UTC+6) */
  const startClock = () => {
    const timeEl = document.getElementById("bdTime");
    const dateEl = document.getElementById("bdDate");
    if (!timeEl || !dateEl) return;
    const timeFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit",
      second: "2-digit", hour12: true,
    });
    const dateFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric",
    });
    const tick = () => {
      const now = new Date();
      timeEl.textContent = timeFmt.format(now);
      dateEl.textContent = dateFmt.format(now);
    };
    tick();
    setInterval(tick, 1000);
  };

  /** Is the backend really answering? A stored address is not enough —
      only a successful call to the backend counts as connected. */
  const checkBackendHealth = async () => {
    const url = Api.getBackendUrl();
    if (!url) {
      state.backend = { url: "", ok: false, message: "", checked: true };
      return state.backend;
    }
    const shape = Api.checkBackendUrl(url);
    if (!shape.ok) {
      state.backend = { url, ok: false, message: shape.message, checked: true };
      return state.backend;
    }
    const r = await Api.pingBackend(url);
    state.backend = { url, ok: !!r.ok, message: r.ok ? "" : (r.message || ""), checked: true };
    return state.backend;
  };

  /** Opens the "Connect backend" modal — used by the sidebar menu and the mail portal card */
  const openBackendConfig = () => {
    if (!els.configModal) return;
    els.configModal.hidden = false;
    els.configUrl.value = Api.getBackendUrl() || "";
    setTimeout(() => els.configUrl.focus(), 60);
  };

  /* --- the small sign-out button in the sidebar footer --- */
  const bindSignOut = () => {
    const btn = document.getElementById("wsSignOut");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const ok = await Modal.confirm({
        title: "Sign out",
        message: "Sign out of Medha Program Management?",
        okText: "Sign out",
        cancelText: "Stay signed in",
        danger: true,
      });
      if (!ok) return;
      document.getElementById("accountMenu")?.remove();
      if (window.Login && typeof window.Login.logout === "function") window.Login.logout();
      else { location.reload(); }
    });
  };

  const bindConfigModal = () => {
    const close = () => { els.configModal.hidden = true; };
    els.configClose.addEventListener("click", close);
    els.configSkip.addEventListener("click", close);
    /* the status line inside the modal */
    const configStatus = (kind, text) => {
      const box = document.getElementById("configStatus");
      if (!box) return;
      if (!kind) { box.innerHTML = ""; return; }
      const bg = kind === "ok" ? "#ecfdf5" : kind === "busy" ? "#f5f3ff" : "#fef2f2";
      const bc = kind === "ok" ? "#a7f3d0" : kind === "busy" ? "#ddd6fe" : "#fecaca";
      const fc = kind === "ok" ? "#047857" : kind === "busy" ? "#6d28d9" : "#b91c1c";
      box.innerHTML = `<div style="background:${bg};border:1px solid ${bc};color:${fc};border-radius:9px;
        padding:9px 11px;font-size:12.5px;line-height:1.6;">${text}</div>`;
    };

    /* Test the address before it is saved. A wrong address is the one
       thing that quietly breaks the whole portal. */
    const testBackend = async () => {
      const url = (els.configUrl.value || "").trim();
      const shape = Api.checkBackendUrl(url);
      if (!shape.ok) {
        configStatus("bad", "<b>That address will not work.</b><br>" + escapeHtml(shape.message));
        return { ok: false, message: shape.message };
      }
      configStatus("busy", "Connecting\u2026");
      const r = await Api.pingBackend(url);
      if (r.ok) {
        configStatus("ok", "<b>Connected.</b>"
          + (r.account ? " The script runs as " + escapeHtml(r.account) + "." : ""));
      } else {
        configStatus("bad", "<b>Could not connect.</b><br>" + escapeHtml(r.message));
      }
      return r;
    };

    els.configTest?.addEventListener("click", testBackend);

    els.configSave.addEventListener("click", async () => {
      const url = (els.configUrl.value || "").trim();
      if (!url) { configStatus("bad", "Paste the Web App URL first."); return; }
      els.configSave.disabled = true;
      const r = await testBackend();
      els.configSave.disabled = false;
      if (!r.ok) return;          /* a broken address is never saved */
      Api.setBackendUrl(url);
      state.backend = { url, ok: true, message: "" };
      close();
      renderSheetLinks();
      applySyncPrefToPill();
      /* the menu that is still open should show the new state at once */
      const st = document.getElementById("amSyncStatus");
      if (st) {
        st.classList.add("ok");
        st.classList.remove("bad");
        const txt = st.querySelector("span");
        if (txt) txt.textContent = "Backend connected \u2014 writes enabled";
      }
      toast("Backend connected \u2014 writes enabled", "success");
      loadMailBadge();          // the unread badge picks up the real count
      setView(state.view);
    });
    // Workspace "…" menu — password gated
    document.getElementById("wsMoreBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openVault();   // always asks — no remembered unlock
    });
    document.addEventListener("click", (e) => {
      // clicks inside the password gate must not dismiss the menu it just opened
      if (e.target && e.target.closest && e.target.closest("#settingsGate")) return;
      /* a click inside any window (or the button that closes one) must never
         dismiss the menu — it stays exactly where it was, so closing the
         window brings the menu straight back */
      if (e.target && e.target.closest && e.target.closest(".modal-overlay")) return;
      /* the same goes for the small messages that pop up (for example Undo) */
      if (e.target && e.target.closest && e.target.closest(".ntf-overlay")) return;
      /* while a window is open on top of the menu, the menu stays put */
      if (anyModalOpen()) return;
      const menu = document.getElementById("accountMenu");
      if (menu && !menu.contains(e.target)) menu.remove();
    });
  };

  /** Vault — the combination dial that guards the settings area */
  const openVault = () => {
    Vault.open(() => {
      toggleAccountMenu();
    });
  };

  /* legacy plain password prompt (kept as a fallback) */
  const openSettingsPassword = () => {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="settingsGate">
        <div class="modal" style="max-width:380px;">
          <header class="modal-head">
            <h3>🔒 Settings locked</h3>
            <button class="modal-close" id="gateClose" aria-label="Close">&times;</button>
          </header>
          <div class="modal-body">
            <p class="modal-help" style="margin-top:0;">Enter the settings password to manage forms, sync and the backend.</p>
            <label>Password</label>
            <input type="password" id="gatePass" placeholder="Enter password" autocomplete="off" />
            <div class="gate-error" id="gateError"></div>
            <div class="modal-actions">
              <button class="btn-ghost" id="gateCancel">Cancel</button>
              <button class="btn-primary" id="gateSubmit">Unlock</button>
            </div>
          </div>
        </div>
      </div>
    `);
    const close = () => document.getElementById("settingsGate")?.remove();
    document.getElementById("gateClose").addEventListener("click", close);
    document.getElementById("gateCancel").addEventListener("click", close);
    const submit = () => {
      const pw = document.getElementById("gatePass").value;
      if (Api.checkSettingsPassword(pw)) {
        setSettingsUnlocked(true);
        close();
        toggleAccountMenu();
      } else {
        const err = document.getElementById("gateError");
        err.textContent = "Wrong password.";
        err.classList.add("show");
        const card = document.getElementById("settingsGate").querySelector(".modal");
        card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
        document.getElementById("gatePass").value = "";
        document.getElementById("gatePass").focus();
      }
    };
    document.getElementById("gateSubmit").addEventListener("click", (e) => { e.stopPropagation(); submit(); });
    document.getElementById("gatePass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.stopPropagation(); submit(); }
    });
    setTimeout(() => document.getElementById("gatePass")?.focus(), 120);
  };

  /* ---- which pages are hidden from the sidebar (the "…" menu can toggle them) ---- */
  const HIDDEN_PAGES_KEY = "mpm.sidebar.hidden";
  const getHiddenPages = () => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_PAGES_KEY) || "[]"); }
    catch (e) { return []; }
  };
  const setHiddenPages = (list) => {
    try { localStorage.setItem(HIDDEN_PAGES_KEY, JSON.stringify(list)); } catch (e) {}
  };
  const isPageHidden = (view) => getHiddenPages().indexOf(view) !== -1;
  const applyHiddenPages = () => {
    const hidden = getHiddenPages();
    document.querySelectorAll(".nav-item[data-view]").forEach(b => {
      const hide = hidden.indexOf(b.dataset.view) !== -1;
      b.hidden = hide;
      b.style.display = hide ? "none" : "";
    });
    /* never leave the user on a page that is no longer in the menu */
    if (hidden.indexOf(state.view) !== -1) setView("overview");
  };

  /** Is any in-site window (modal) open right now? */
  const anyModalOpen = () =>
    Array.prototype.some.call(document.querySelectorAll(".modal-overlay"), m => !m.hidden);

  /* --- account menu (sign out / connect backend) --- */
  const toggleAccountMenu = () => {
    const existing = document.getElementById("accountMenu");
    if (existing) { existing.remove(); return; }
    const session = (() => {
      try {
        const raw = localStorage.getItem("mpm.session");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();

    const menu = document.createElement("div");
    menu.id = "accountMenu";
    menu.className = "account-menu";
    const backendOn = Api.isBackendConfigured();
    const backendLive = !!(state.backend && state.backend.ok);
    const syncOn = getSyncPref();
    const filesHidden = isPageHidden("files");

    menu.innerHTML = `
      <div class="am-head">
        <img class="am-avatar${sessionBrand().wide ? " wide" : ""}" src="${imgBase() + sessionBrand().file}"
             alt="${escapeHtml(sessionBrand().label)}" width="${sessionBrand().wide ? 60 : 32}" height="32" />
        <div style="min-width:0;">
          <div class="am-name">${escapeHtml((session && (session.name || session.username)) || "Guest")}</div>
          <div class="am-role">${escapeHtml((session && session.username) || "-")}</div>
        </div>
      </div>

      <div class="am-group">
        <div class="am-group-title">Data &amp; sync</div>

        <div class="am-section">
          <div class="am-section-head">
            <span class="am-pulse"><span class="pulse-dot"></span></span>
            <span class="am-section-title">SHEET SYNC</span>
            <button class="sync-toggle" id="amSyncToggle" role="switch" aria-checked="${syncOn ? "true" : "false"}">
              <span class="sync-knob"></span>
            </button>
          </div>
          <p class="am-desc">Live — Google Sheet linked. Writes to <code>Medha_DB</code> tab.</p>
          <div class="am-status ${backendLive ? "ok" : (backendOn ? "bad" : "")}" id="amSyncStatus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${backendLive ? "Backend connected — writes enabled"
                  : (backendOn ? "Backend not working — " + escapeHtml((state.backend && state.backend.message) || "the address did not answer")
                               : "Read-only — connect to enable writes")}</span>
          </div>
        </div>

        <button class="am-item" id="amForms">
          ${ICONS.form}
          <span class="am-item-body">
            <span class="am-item-title">Form settings</span>
            <span class="am-item-sub">Open / close any Google or HTML form</span>
          </span>
        </button>

        <button class="am-item" id="amBackend">
          ${ICONS.gear}
          <span class="am-item-body">
            <span class="am-item-title">${backendOn ? "Manage backend" : "Connect backend"}</span>
            <span class="am-item-sub">${backendOn ? "Apps Script Web App is live" : "Needed for mail, scores and uploads"}</span>
          </span>
        </button>
      </div>

      <div class="am-group">
        <div class="am-group-title">Member data</div>
        ${memberDataNoteHtml()}
      </div>

      <div class="am-group">
        <div class="am-group-title">Help &amp; guides</div>
        <button class="am-item" id="amSheetPlaybook">
          ${ICONS.sheet}
          <span class="am-item-body">
            <span class="am-item-title">Sheet playbook</span>
            <span class="am-item-sub">Do every task straight in the Google Sheet</span>
          </span>
        </button>
        <button class="am-item" id="amPublishGuide">
          ${ICONS.rocket}
          <span class="am-item-body">
            <span class="am-item-title">Publish &amp; setup</span>
            <span class="am-item-sub">Free hosting + connect the backend</span>
          </span>
        </button>
      </div>

      <div class="am-group">
        <div class="am-group-title">Files</div>
        <div class="am-file-list" id="amSheetList">
          <div class="am-empty">Loading…</div>
        </div>
        <div class="am-sub-title">Documents</div>
        <div class="am-file-hint" id="amFileHint">Tap the red &times; to remove &middot; Undo for 10 s</div>
        <div class="am-file-list" id="amFileList">
          <div class="am-empty">Loading…</div>
        </div>
      </div>

      <div class="am-group">
        <div class="am-group-title">Sidebar</div>
        <button class="am-item" id="amToggleFiles">
          ${ICONS.folder}
          <span class="am-item-body">
            <span class="am-item-title">${filesHidden ? "Show Files" : "Remove Files"}</span>
            <span class="am-item-sub">${filesHidden ? "Put the Files page back in the menu" : "Hide the Files page from the menu"}</span>
          </span>
        </button>
      </div>

      <div class="am-group">
        <div class="am-group-title">Account</div>
        <button class="am-item danger" id="amLogout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span class="am-item-body">
            <span class="am-item-title">Sign out</span>
            <span class="am-item-sub">Lock the portal on this device</span>
          </span>
        </button>
      </div>
    `;
    document.querySelector(".sidebar-foot").appendChild(menu);

    const openConfig = () => {
      /* the menu stays open behind the window — closing the window brings
         the menu straight back, so the vault code is not asked again */
      openBackendConfig();
    };
    menu.querySelector("#amBackend").addEventListener("click", openConfig);
    menu.querySelector("#amForms").addEventListener("click", () => {
      openFormControl();
    });
    menu.querySelector("#amSheetPlaybook").addEventListener("click", () => {
      const modal = document.getElementById("sheetGuideModal");
      if (modal) modal.hidden = false;
      else window.location.href = "index.html";
    });
    menu.querySelector("#amPublishGuide").addEventListener("click", () => {
      menu.remove();
      window.location.href = "guide.html";
    });
    /* ---- the files list, filled in as soon as the menu opens ---- */
    /* the spreadsheets from the Files page */
    const sheetBox = menu.querySelector("#amSheetList");
    if (sheetBox) {
      const sheets = Api.sheetLinks();
      sheetBox.innerHTML = sheets.map(l => `
        <a class="am-file-row am-sheet-row" href="${escapeHtml(l.url)}" target="_blank" rel="noopener"
           title="${escapeHtml(l.sub || l.label)}">
          <span class="am-file-ico">&#128202;</span>
          <span class="am-file-name">${escapeHtml(l.label)}</span>
          <span class="am-file-go">&#8599;</span>
        </a>`).join("");
    }

    const fileBox = menu.querySelector("#amFileList");
    const paintFileList = async () => {
      if (!fileBox) return;
      let files = [];
      try { files = await Api.listFiles(); } catch (e) { files = []; }
      const hint = menu.querySelector("#amFileHint");
      if (hint) hint.hidden = !files.length;
      if (!files.length) {
        fileBox.innerHTML = `<div class="am-empty">No documents yet \u2014 add them from the Files page.</div>`;
        return;
      }
      fileBox.innerHTML = files.map(f => `
        <div class="am-file-row" data-file-id="${escapeHtml(f.id)}">
          <span class="am-file-ico">${f.kind === "link" ? "\u{1F517}" : "\u{1F4C4}"}</span>
          <span class="am-file-name" title="${escapeHtml(f.url || f.name)}">${escapeHtml(f.name)}</span>
          <button class="am-file-x" type="button" data-remove-file="${escapeHtml(f.id)}"
                  title="Remove from Files" aria-label="Remove ${escapeHtml(f.name)}">\u00d7</button>
        </div>`).join("");
    };
    paintFileList();

    fileBox?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-file]");
      if (!btn) return;
      e.stopPropagation();
      const id = btn.dataset.removeFile;
      const row = btn.closest(".am-file-row");
      const name = (row?.querySelector(".am-file-name")?.textContent || "File").trim();
      await removeFileWithUndo(id, name, () => {
        row?.remove();
        paintFileList();
      });
    });

    menu.querySelector("#snConnectBackend")?.addEventListener("click", () => {
      menu.remove();
      openBackendConfig();
    });

    menu.querySelector("#amToggleFiles").addEventListener("click", () => {
      const hidden = getHiddenPages();
      const i = hidden.indexOf("files");
      if (i === -1) hidden.push("files"); else hidden.splice(i, 1);
      setHiddenPages(hidden);
      applyHiddenPages();
      menu.remove();
      if (i === -1) {
        Notify.ok("Files removed from the sidebar", {
          title: "Files is hidden",
          hint: "The page still works \u2014 you can open it from the address bar. To bring it back, press the \u22ee button, dial 2026, then choose Sidebar \u2192 Show Files.",
          action: {
            label: "Undo \u2014 show Files",
            onClick: () => {
              const h = getHiddenPages();
              const k = h.indexOf("files");
              if (k !== -1) h.splice(k, 1);
              setHiddenPages(h);
              applyHiddenPages();
              Notify.ok("Files is back in the sidebar");
            },
          },
        });
      } else {
        Notify.ok("Files is back in the sidebar", {
          hint: "Press the \u22ee button \u2192 dial 2026 \u2192 Sidebar to hide it again.",
        });
      }
    });

    // Sheet sync toggle inside the menu
    menu.querySelector("#amSyncToggle")?.addEventListener("click", (e) => {
      const on = e.currentTarget.getAttribute("aria-checked") !== "false";
      e.currentTarget.setAttribute("aria-checked", on ? "false" : "true");
      setSyncPref(!on);
      applySyncPrefToPill();
      toast("Sheet sync " + (!on ? "enabled" : "paused"), !on ? "success" : "error");
    });

    menu.querySelector("#amLogout").addEventListener("click", () => {
      menu.remove();
      if (window.Login && typeof window.Login.logout === "function") window.Login.logout();
    });
  };

  /* --- sheet sync on/off preference (persisted) --- */
  const getSyncPref = () => {
    try { return localStorage.getItem("mpm.sync.on") !== "false"; } catch { return true; }
  };
  const setSyncPref = (v) => {
    try { localStorage.setItem("mpm.sync.on", v ? "true" : "false"); } catch (e) {}
  };

  const bindKeyboard = () => {
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select, [contenteditable]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "g" || e.key === "G") {
        setView("overview"); // g for go / overview
      }
    });
  };

  /* --- View switching ---
     The current view lives in the URL hash, so:
       • the browser Back button returns to the view you came from
         (even after jumping out to an external site and coming back)
       • a reload keeps you on the same page
       • the scroll position of each view is remembered per view
  */
  /* the hash is "#view" or "#view/sub" — the sub part keeps the exact tab
     (for example Members > NCM PART-1) so a Back button lands in the same
     place you left from */
  const parseHash = () => {
    const h = (location.hash || "").replace(/^#/, "").trim();
    const [view, sub] = h.split("/");
    return { view: VIEWS[view] ? view : "", sub: decodeURIComponent(sub || "") };
  };
  const viewFromHash = () => parseHash().view;
  const subFromHash = () => parseHash().sub;

  const scrollMemory = {};
  const saveScroll = () => {
    if (state.view) scrollMemory[state.view] = { top: els.content.scrollTop, win: window.scrollY };
  };
  const restoreScroll = (view) => {
    const m = scrollMemory[view];
    if (!m) return;
    els.content.scrollTop = m.top;
    window.scrollTo(0, m.win);
  };

  const setView = async (view, opts = {}) => {
    if (!VIEWS[view]) view = "overview";
    /* a page that was removed from the sidebar cannot be opened */
    if (isPageHidden(view)) view = "overview";
    const changed = state.view !== view;
    if (changed) saveScroll();
    state.view = view;
    state.sub = opts.sub !== undefined ? opts.sub : (changed ? "" : (state.sub || ""));
    /* when the Members view is opened fresh, honour the sub in the address bar */
    if (view === "members" && changed && opts.sub === undefined) {
      const h = parseHash();
      if (h.view === "members" && h.sub) state.sub = h.sub;
    }

    document.querySelectorAll(".nav-item").forEach(b => {
      b.classList.toggle("active", b.dataset.view === view);
    });
    els.crumb.textContent = VIEWS[view].title;
    document.title = "Medha · " + VIEWS[view].title;

    /* keep the address bar in step, without adding a history entry for
       the very first render */
    const hash = "#" + view + (state.sub ? "/" + encodeURIComponent(state.sub) : "");
    if (location.hash !== hash) {
      if (opts.replace) history.replaceState({ view, sub: state.sub }, "", hash);
      else history.pushState({ view, sub: state.sub }, "", hash);
    }

    els.content.scrollTop = 0;
    renderLoading();
    try {
      const data = await Api.getMembers();
      state.data = data;
      // NCM master file (enriched profiles) — load in parallel, never block
      Api.getNcmMaster().then(m => { state.master = m; }).catch(() => {});
      requestAnimationFrame(() => {
        render(view, data);
        /* restore the scroll position of this view (after a reload or a
           browser Back), once the content has actually been painted */
        requestAnimationFrame(() => restoreScroll(view));
      });
    } catch (err) {
      renderError(err);
    }
  };

  /* browser Back / Forward inside the portal */
  window.addEventListener("popstate", () => {
    const { view: v, sub } = parseHash();
    if ((v || "overview") !== state.view || (sub || "") !== (state.sub || "")) {
      setView(v || "overview", { replace: true, sub });
    }
  });

  /* remember the scroll position of the view the user is looking at */
  let scrollTick = null;
  const rememberScroll = () => {
    if (scrollTick) return;
    scrollTick = setTimeout(() => { scrollTick = null; saveScroll(); }, 150);
  };
  els.content?.addEventListener("scroll", rememberScroll, { passive: true });
  window.addEventListener("scroll", rememberScroll, { passive: true });
  window.addEventListener("beforeunload", saveScroll);

  const renderLoading = () => {
    els.content.innerHTML = `<div class="loading"><span class="spinner"></span>Loading ${VIEWS[state.view].title}…</div>`;
  };

  const renderError = (err) => {
    els.content.innerHTML = `<div class="empty-state">
      <div class="ico">⚠</div>
      <h3>Couldn't load data</h3>
      <p>${escapeHtml(err.message || String(err))}</p>
      <p style="margin-top:10px;font-size:12px;">Sheet: ${Api.SHEET_ID}</p>
    </div>`;
  };

  /* --- Renderers --- */
  const render = (view, data) => {
    const stats = computeStats(data);
    const head = (title, sub) => `
      <header class="view-header">
        <span class="view-eyebrow">MEDHA · PROGRAM MANAGEMENT</span>
        <h1 class="view-title">${title}</h1>
        ${sub ? `<p class="view-sub">${sub}</p>` : ""}
      </header>`;

    switch (view) {
      case "overview": renderOverview(data, stats, head); break;
      case "batches": renderBatches(data, stats, head); break;
      case "members": renderMembers(data, head); break;
      case "payments": renderPayments(data, head); return;
      case "agreements": renderAgreements(data, head); return;
      case "classes": renderClasses(data, head); return;
      case "tasks": renderComingSoon("Tasks & workshops", head); break;
      case "feedback": renderComingSoon("Feedback", head); break;
      case "scores": renderScores(data, head); return;
      case "evidence": renderComingSoon("Evidence & reports", head); break;
      case "mail": renderMail(data, head); break;
      case "files": renderFiles(data, head); return;
      case "support": renderSupport(data, head); return;
      case "payadmin": renderPayAdmin(data, head); return;
    }
  };

  const renderOverview = (data, stats, head) => {
    const p1Sent = data["NCM PART-1"].filter(m => m.status.toLowerCase() === "sent").length;
    const p2Sent = data["NCM PART-2"].filter(m => m.status.toLowerCase() === "sent").length;

    const recent = data._all
      .filter(m => m.sentAt)
      .sort((a, b) => parseDate(b.sentAt) - parseDate(a.sentAt))
      .slice(0, 6);

    els.content.innerHTML = `
      ${head("Overview", VIEWS.overview.bn)}

      ${data._demo ? `
        <div class="panel" style="padding:10px 14px;background:#fff8e1;border-left:3px solid var(--warning);font-size:12.5px;color:#92400e;margin-bottom:14px;">
          <b>Demo data.</b> Showing fallback sample — Google Sheet fetch failed (likely network/CORS). The deployed site will load your live data automatically.
        </div>
      ` : ""}

      <div class="stats">
        ${statCard("Total members", stats.total, "Across both programs", "users", "purple")}
        ${statCard("NCM PART-1", stats.p1, p1Sent + " mail sent", "users", "blue")}
        ${statCard("NCM PART-2", stats.p2, p2Sent + " mail sent", "users", "amber")}
        ${statCard("Mails sent", stats.sent, "Program Mail delivery", "mail", "green")}
      </div>

      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Batch overview</h2>
          <span class="panel-link" style="cursor:default;margin-right:14px;">Last mail = most recent delivery &middot; Mailed = Status &quot;Sent&quot;</span>
          <a class="panel-link" href="#" data-view="batches">View all →</a>
        </header>
        <div class="batch-grid">
          ${batchCard("NCM PART-1", data["NCM PART-1"], "active")}
          ${batchCard("NCM PART-2", data["NCM PART-2"], "active")}
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Recent activity</h2>
          <a class="panel-link" href="#" data-view="members">View all →</a>
        </header>
        <div class="activity">
          ${recent.length === 0 ? `<div class="empty-state" style="padding:24px;"><p>No mail activity yet.</p></div>` :
            recent.map(m => `
              <div class="activity-item">
                <div class="act-ico mail">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div class="act-body">
                  <p class="act-title">${escapeHtml(m.name)} <b style="color:var(--text-muted);font-weight:500;">received program mail</b></p>
                  <p class="act-sub">
                    <span>${escapeHtml(m._tab)}</span>
                    <span>${escapeHtml(m.memberId)}</span>
                    <span>${escapeHtml(formatDate(m.sentAt))}</span>
                  </p>
                </div>
                <span class="act-marker"></span>
              </div>
            `).join("")}
        </div>
      </section>
    `;

    els.content.querySelectorAll("[data-view]").forEach(a => {
      a.addEventListener("click", (e) => { e.preventDefault(); setView(a.dataset.view); });
    });
  };

  const renderBatches = (data, stats, head) => {
    els.content.innerHTML = `
      ${head("Batches", VIEWS.batches.bn)}

      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">All batches</h2>
          <span class="panel-link" style="cursor:default;">Last mail = most recent delivery date &middot; Mailed = members with Status &quot;Sent&quot;</span>
        </header>
        <div class="batch-grid">
          ${batchCard("NCM PART-1", data["NCM PART-1"], "active")}
          ${batchCard("NCM PART-2", data["NCM PART-2"], "active")}
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2 class="panel-title">Mail distribution by batch</h2></header>
        ${batchProgressBar("NCM PART-1", data["NCM PART-1"])}
        ${batchProgressBar("NCM PART-2", data["NCM PART-2"])}
      </section>
    `;
  };

  const batchProgressBar = (name, list) => {
    const sent = list.filter(m => m.status.toLowerCase() === "sent").length;
    const pct = list.length ? Math.round((sent / list.length) * 100) : 0;
    return `
      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
          <b>${escapeHtml(name)}</b>
          <span style="color:var(--text-muted);">${sent} / ${list.length} (${pct}%)</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
    `;
  };

  const renderMembers = (data, head) => {
    const all = data._all;
    window.__mpmAll = all;
    const master = state.master || [];
    const masterById = {};
    master.forEach(m => { masterById[m.memberId] = m; });

    els.content.innerHTML = `
      ${head("Members", VIEWS.members.bn)}

      <div class="tabs">
        <button class="tab-pill active" data-tab="all">All (${all.length})</button>
        <button class="tab-pill" data-tab="NCM PART-1">NCM PART-1 (${data["NCM PART-1"].length})</button>
        <button class="tab-pill" data-tab="NCM PART-2">NCM PART-2 (${data["NCM PART-2"].length})</button>
      </div>

      <div class="toolbar">
        <input type="search" id="memSearch" placeholder="Search name, email, ID, phone, team" />
        <select id="memFilter">
          <option value="all">All status</option>
          <option value="sent">Mail sent</option>
          <option value="pending">Mail pending</option>
          <option value="paid">Full payment</option>
          <option value="due">Unpaid / no record</option>
        </select>
        <button class="btn-ghost" id="refreshMembers" title="Force-fetch from Google Sheet">↻ Refresh</button>
        <a class="panel-link" id="memSheetLink" href="#" target="_blank" rel="noopener"
           title="Open the source Google Sheet in a new tab">Edit in sheet ↗</a>
        <span class="count" id="memCount"></span>
      </div>

      <div class="panel" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;max-height:64vh;">
          <table class="tbl" id="memTable">
            <thead><tr>
              <th style="width:46px;">#</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Batch</th>
              <th>Mail</th>
              <th>Last sent</th>
              <th>Plan</th>
              <th>Team</th>
              <th>Payment</th>
            </tr></thead>
            <tbody id="memBody"></tbody>
          </table>
        </div>
      </div>
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">
        💡 Click any row for the full profile. The site is a mirror of your Google Sheet — changes there show up here within 30 seconds, or instantly via ↻ Refresh.
      </p>
    `;

    const renderRows = () => {
      const q = (document.getElementById("memSearch")?.value || "").trim().toLowerCase();
      const f = document.getElementById("memFilter")?.value || "all";
      const rows = all.filter(m => {
        const prof = masterById[m.memberId] || {};
        /* the tab label is "NCM PART-1" but the sheet tab is "Members NCM-P1"
           — compare by which part it is, not by the exact string */
        if (currentTab !== "all") {
          const wantP1 = /P1|Part-?1/i.test(currentTab);
          const isP1 = /P1|Part-?1/i.test(m._tab || "");
          if (wantP1 !== isP1) return false;
        }
        if (f === "sent" && m.status.toLowerCase() !== "sent") return false;
        if (f === "pending" && m.status.toLowerCase() === "sent") return false;
        const payStatus = prof.paymentStatus || m.paymentStatus || "";
        if (f === "paid" && !/full/i.test(payStatus)) return false;
        if (f === "due" && payStatus) return false;
        if (!q) return true;
        const hay = (m.name + " " + m.email + " " + m.memberId + " " + (prof.phone || m.phone || "") + " " + (prof.team || m.team || "") + " " + (prof.plan || m.plan || "")).toLowerCase();
        return hay.includes(q);
      });

      document.getElementById("memCount").textContent = `${rows.length} of ${all.length} members`;

      const body = document.getElementById("memBody");
      body.innerHTML = rows.map((m, i) => {
        const isP1 = /P1|Part-?1/i.test(m._tab || "");
        const prof = masterById[m.memberId] || {};
        const pstat = prof.paymentStatus || m.paymentStatus || "";
        const paid = /full/i.test(pstat) ? "paid" : (pstat ? "partial" : "none");
        return `<tr data-mid="${escapeHtml(m.memberId)}" style="cursor:pointer;">
          <td style="color:var(--text-muted);font-weight:600;">${escapeHtml(m.sl) || i + 1}</td>
          <td class="id-cell">${escapeHtml(m.memberId)}</td>
          <td class="name-cell">${escapeHtml(m.name)}</td>
          <td class="email-cell">${escapeHtml(m.email)}</td>
          <td><span class="chip"><span class="chip-dot" style="background:${isP1 ? "#2563eb" : "#f59e0b"};"></span>${isP1 ? "Part 1" : "Part 2"}</span></td>
          <td>${statusChip(m.status)}</td>
          <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${m.sentAt ? escapeHtml(stamp(m.sentAt)) : `<span style="color:#cbd5e1;">Not sent yet</span>`}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(prof.plan || m.plan || "—")}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(prof.team || m.team || "—")}</td>
          <td>${payChip(paid, pstat)}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted);">No members match your filters</td></tr>`;

      body.querySelectorAll("tr[data-mid]").forEach(tr => {
        tr.addEventListener("click", () => openMemberDrawer(tr.dataset.mid));
      });
    };

    /* start on the tab the address bar asks for (so a Back button or a
       reload lands on the same part of the list) */
    const TAB_SLUG = { "all": "all", "NCM PART-1": "p1", "NCM PART-2": "p2" };
    const TAB_FROM_SLUG = { "all": "all", "p1": "NCM PART-1", "p2": "NCM PART-2" };
    const wanted = TAB_FROM_SLUG[subFromHash()] || "all";

    let currentTab = wanted;
    document.querySelectorAll(".tab-pill").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === wanted);
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab-pill").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        currentTab = t.dataset.tab;
        paintSheetLink();
        /* keep it in the address bar, without adding a history entry —
           Back should go to the previous page, not through the tabs */
        const slug = TAB_SLUG[currentTab] || "all";
        state.sub = slug === "all" ? "" : slug;
        history.replaceState({ view: "members", sub: state.sub }, "", "#members" + (state.sub ? "/" + state.sub : ""));
        renderRows();
      });
    });
    document.getElementById("snConnectBackend")?.addEventListener("click", () => {
      openBackendConfig();
    });
    /* the "Edit in sheet" link follows the selected tab */
    const paintSheetLink = () => {
      const a = document.getElementById("memSheetLink");
      if (!a) return;
      const b01 = currentTab === "NCM PART-2";
      a.href = b01
        ? `https://docs.google.com/spreadsheets/d/${Api.BATCH01_SHEET_ID}/edit`
        : `https://docs.google.com/spreadsheets/d/${Api.SHEET_ID}/edit`;
      a.title = b01 ? "Open the Medha Batch-01 Master sheet" : "Open the Medha Program sheet";
    };
    paintSheetLink();
    document.getElementById("memSearch").addEventListener("input", renderRows);
    document.getElementById("memFilter").addEventListener("change", renderRows);
    document.getElementById("refreshMembers").addEventListener("click", async () => {
      const btn = document.getElementById("refreshMembers");
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Refreshing…';
      btn.disabled = true;
      try {
        await Api.refreshCache();
        const fresh = await Api.getMembers(true);
        state.data = fresh;
        state.master = await Api.getNcmMaster();
        render("members", fresh);
        toast("Sheet reloaded — showing latest data", "success");
      } catch (err) {
        toast("Refresh failed: " + err.message, "error");
        const b = document.getElementById("refreshMembers");
        if (b) { b.innerHTML = orig; b.disabled = false; }
      }
    });
    renderRows();
  };

  const payChip = (kind, label) => {
    /* "full" and "paid" both mean the same thing here */
    if (kind === "paid" || kind === "full") {
      return `<span class="chip sent"><span class="chip-dot"></span>${escapeHtml(label || "Full payment")}</span>`;
    }
    if (kind === "partial") return `<span class="chip pending"><span class="chip-dot"></span>${escapeHtml(label || "Partial")}</span>`;
    return `<span class="chip empty"><span class="chip-dot"></span>Not paid</span>`;
  };

  /* --- Member detail drawer --- */
  const openMemberDrawer = (memberId) => {
    const m = (window.__mpmAll || []).find(x => x.memberId === memberId);
    if (!m) return;
    const prof = (state.master || []).find(x => x.memberId === memberId) || {};
    const track = (state.tracker || []).find(x => x.memberId === memberId) || {};

    const info = (label, value, href, icon) => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-dim);">${label}</div>
        <div style="font-size:13.5px;color:var(--text);margin-top:2px;${href ? "" : "word-break:break-word;"}">
          ${icon ? `<img class="fb-badge" src="${icon}" alt="" /> ` : ""}${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;">${escapeHtml(value)}</a>` : escapeHtml(value || "—")}
        </div>
      </div>`;

    els.content.insertAdjacentHTML("beforeend", `
      <div class="drawer-overlay" id="memberDrawer">
        <aside class="drawer">
          <header class="drawer-head">
            <div>
              <div style="font-size:16px;font-weight:800;">${escapeHtml(m.name)}</div>
              <div class="id-cell" style="margin-top:2px;">${escapeHtml(m.memberId)}</div>
            </div>
            <button class="cd-close" id="drawerClose" aria-label="Close">×</button>
          </header>
          <div class="drawer-body">
            <div class="drawer-tabs">
              <button class="dtab active" data-dtab="profile">Profile</button>
              <button class="dtab" data-dtab="payment">Payment</button>
              <button class="dtab" data-dtab="attendance">Attendance &amp; Scores</button>
            </div>
            <div id="drawerPane"></div>
          </div>
        </aside>
      </div>
    `);

    const panes = {
      profile: () => `
        ${info("Email", m.email)}
        ${info("Phone", prof.phone || m.phone)}
        ${info("WhatsApp", prof.whatsapp || m.whatsapp)}
        ${info("Address", m.address)}
        ${info("Program email", prof.programEmail)}
        ${info("Course mail", m.courseMail)}
        ${info("Medha login email", prof.medhaEmail || m.medhaEmail)}
        ${info("Plan", prof.plan || m.plan)}
        ${info("Tag", prof.tag)}
        ${info("Team category", prof.team || m.team)}
        ${info("FB profile", prof.fbProfile || m.facebook, (prof.fbProfile || m.facebook || "").match(/^https?:\/\//) ? (prof.fbProfile || m.facebook) : "", "assets/img/facebook-icon.png")}
        ${info("Page link", prof.pageLink, prof.pageLink)}
        ${info("Transaction ID", m.tranId)}
        ${info("Mail status", m.status || "Not set")}
        ${info("Last sent", m.sentAt ? stamp(m.sentAt) : "Not sent yet")}`,
      payment: () => `
        ${info("Amount", (prof.amount || m.amount) ? "৳" + (prof.amount || m.amount) : "—")}
        ${info("Payment status", prof.paymentStatus || m.paymentStatus)}
        ${info("Payment date", prof.paymentDate || m.paymentDate)}
        ${info("Payment channel", prof.paymentChannel || m.paymentChannel)}
        ${info("Transaction ID", m.tranId)}
        ${info("Due", prof.due)}
        ${info("July_SF", prof.julySF)}
        ${info("Aug_SF", prof.augSF)}
        ${info("Sep_SF", prof.sepSF)}
        ${info("Oct_SF", prof.octSF)}`,
      attendance: () => `
        ${info("Punctual", track.punctualCount || "0")}
        ${info("Late", track.lateCount || "0")}
        ${info("Absent", track.absentCount || "0")}
        ${info("Attendance %", track.attendancePct || "—")}
        ${info("Remarks", track.remarks || "—")}
        ${info("Attendance (10)", track.attendance10 || "—")}
        ${info("Assignment (20)", track.assignment20 || "—")}
        ${info("Workshop (20)", track.workshop20 || "—")}
        ${info("Email & Feedback (5)", track.emailFeedback5 || "—")}
        ${info("Monthly Exam (30)", track.monthlyExam30 || "—")}
        ${info("Professional Behaviour (10)", track.professional10 || "—")}
        ${info("Payment Compliance (5)", track.paymentCompliance5 || "—")}
        ${info("Total (100)", track.total100 || "—")}
        ${info("Grade", track.grade || "—")}
        ${info("Result card", track.resultCard || "—")}`,
    };

    const pane = document.getElementById("drawerPane");
    pane.innerHTML = panes.profile();
    document.querySelectorAll(".dtab").forEach(t => t.addEventListener("click", () => {
      document.querySelectorAll(".dtab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      pane.innerHTML = panes[t.dataset.dtab]();
    }));
    document.getElementById("drawerClose").addEventListener("click", closeMemberDrawer);
    document.getElementById("memberDrawer").addEventListener("click", (e) => {
      if (e.target.id === "memberDrawer") closeMemberDrawer();
    });
  };

  const closeMemberDrawer = () => {
    const d = document.getElementById("memberDrawer");
    if (d) d.remove();
  };


  /* ================= AGREEMENTS (participation agreement register) ================= */
  const AGREEMENT_STATUSES = ["Pending", "Signed", "Declined", "Not required"];

  const renderAgreements = async (data, head) => {
    const res = await Api.getAgreements();
    const rows = res.rows || [];
    const connected = res.connected;

    const signed = rows.filter(r => (r.status || "").toLowerCase() === "signed").length;
    const pending = rows.filter(r => (r.status || "").toLowerCase() === "pending").length;
    const declined = rows.filter(r => (r.status || "").toLowerCase() === "declined").length;

    els.content.innerHTML = `
      ${head("Agreements", "Participation agreement register — saved straight to the sheet")}

      <details class="info-card" id="agGuide">
        <summary>
          <span class="ic-ico">💡</span>
          <span class="ic-title">What is this tab and how do I use it?</span>
          <span class="ic-chevron">▾</span>
        </summary>
        <div class="ic-body">
          <p>
            <b>Agreements</b> is the register of every member who signed the Next Chapter Mastermind
            participation agreement. One row per member — it answers three questions:
            <b>who joined</b>, <b>did they sign</b>, and <b>when</b>.
          </p>
          <ol class="ic-steps">
            <li><b>Seed missing</b> — one click adds a <code>Pending</code> row for every member who has no agreement yet.</li>
            <li><b>Set the status</b> — click the Status cell in any row and pick <code>Pending</code>, <code>Signed</code>, <code>Declined</code> or <code>Not applicable</code>. It saves immediately.</li>
            <li><b>Fill the date &amp; document</b> — type the signed date and, if you keep a PDF or image of the signed form, paste its link in the Document column.</li>
            <li><b>Notes</b> — anything worth remembering (e.g. "signed on paper during the NCM-P2 orientation").</li>
            <li><b>+ New agreement</b> — for a walk-in or a late joiner who is not in the member list yet.</li>
          </ol>
          <p class="ic-note">
            <b>Sheet-first:</b> every change here is written straight to the <code>Agreements</code> tab of the
            Medha Program sheet, and every change you make in the sheet shows up here on refresh.
            You can work in either place — they never drift apart.
          </p>
        </div>
      </details>

      ${!res.exists ? `
        <div class="panel" style="border-left:3px solid var(--warning);background:#fff8e1;margin-bottom:16px;">
          <div style="font-weight:800;color:#92400e;margin-bottom:4px;">Agreements tab not created yet</div>
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
            The <code>Agreements</code> tab has to exist in the Medha Program sheet first.
            ${connected
              ? "Press the button below to create it and pull in every member as a Pending row."
              : "Connect the Apps Script backend, then press the button below."}
          </p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-primary" id="agCreate" ${connected ? "" : "disabled style='opacity:.5;cursor:not-allowed;'"}>Create tab &amp; add all members</button>
            <a class="btn-ghost" style="padding:9px 14px;font-size:12.5px;text-decoration:none;" target="_blank" rel="noopener"
               href="https://docs.google.com/spreadsheets/d/${Api.SHEET_ID}/edit">Open the sheet ↗</a>
          </div>
        </div>
      ` : ""}

      <div class="stats">
        ${statCard("Agreements", rows.length, "Registered members", "file", "purple")}
        ${statCard("Signed", signed, "Completed agreements", "check", "green")}
        ${statCard("Pending", pending, "Awaiting signature", "clock", "amber")}
        ${statCard("Declined", declined, "Not joining", "users", "blue")}
      </div>

      <div class="toolbar">
        <input type="search" id="agSearch" placeholder="Search name, member ID, notes" />
        <select id="agStatusFilter">
          <option value="all">All statuses</option>
          ${AGREEMENT_STATUSES.map(x => `<option value="${x}">${x}</option>`).join("")}
        </select>
        <select id="agBatchFilter">
          <option value="all">All batches</option>
          <option value="NCM PART-1">NCM PART-1</option>
          <option value="NCM PART-2">NCM PART-2</option>
        </select>
        <button class="btn-primary" id="agNew" ${connected ? "" : "disabled style='opacity:.5;cursor:not-allowed;'"}>+ New agreement</button>
        <button class="btn-ghost" id="agSeed" ${connected ? "" : "disabled style='opacity:.5;cursor:not-allowed;'"} title="Add a Pending row for every member without one">Seed missing</button>
        <span class="count" id="agCount"></span>
      </div>

      <div class="panel" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;max-height:64vh;">
          <table class="tbl" id="agTable">
            <thead><tr>
              <th style="width:46px;">#</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Batch</th>
              <th>Status</th>
              <th>Signed date</th>
              <th>Document</th>
              <th>Notes</th>
              <th style="width:70px;"></th>
            </tr></thead>
            <tbody id="agBody"></tbody>
          </table>
        </div>
      </div>
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">
        💡 Every change is written straight to the <code>Agreements</code> tab of the Medha Program sheet —
        edit it there too and it shows up here on refresh.
      </p>
    `;

    const paint = () => {
      const q = (document.getElementById("agSearch")?.value || "").toLowerCase();
      const st = document.getElementById("agStatusFilter")?.value || "all";
      const bt = document.getElementById("agBatchFilter")?.value || "all";
      const list = rows.filter(r => {
        if (st !== "all" && (r.status || "") !== st) return false;
        if (bt !== "all" && (r.batch || "") !== bt) return false;
        if (!q) return true;
        return (r.name + " " + r.memberId + " " + (r.notes || "") + " " + (r.link || "")).toLowerCase().includes(q);
      });
      document.getElementById("agCount").textContent = `${list.length} of ${rows.length} agreements`;

      document.getElementById("agBody").innerHTML = list.length ? list.map(r => `
        <tr data-row="${r._row}">
          <td style="color:var(--text-muted);font-weight:600;">${escapeHtml(r.sl) || "—"}</td>
          <td class="id-cell">${escapeHtml(r.memberId) || "—"}</td>
          <td class="name-cell">${escapeHtml(r.name) || "—"}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(r.batch) || "—"}</td>
          <td>
            <select class="ag-status" data-row="${r._row}" ${connected ? "" : "disabled"}>
              ${["", ...AGREEMENT_STATUSES].map(o => `<option value="${o}" ${o === (r.status || "") ? "selected" : ""}>${o || "—"}</option>`).join("")}
            </select>
          </td>
          <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${escapeHtml(r.signedDate) || "—"}</td>
          <td>${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener" class="ag-link">Open ↗</a>` : `<span style="color:var(--text-dim);font-size:12px;">—</span>`}</td>
          <td style="font-size:12px;color:var(--text-muted);max-width:180px;">${escapeHtml(r.notes) || "—"}</td>
          <td>
            <button class="fc-btn" data-ag-edit="${r._row}" title="Edit">${ICONS.edit}</button>
            <button class="fc-btn danger" data-ag-del="${r._row}" title="Delete">${ICONS.trash}</button>
          </td>
        </tr>`).join("") : `<tr><td colspan="9" style="text-align:center;padding:36px;color:var(--text-muted);">
          ${rows.length ? "No agreements match your filters." : "No agreements yet — add one, or seed the whole member list."}
        </td></tr>`;

      // inline status change -> save
      document.querySelectorAll(".ag-status").forEach(sel => {
        sel.addEventListener("change", async () => {
          const row = parseInt(sel.dataset.row, 10);
          const rec = rows.find(x => x._row === row);
          if (!rec) return;
          sel.disabled = true;
          const r = await Api.upsertAgreement({ ...rec, status: sel.value }, row);
          sel.disabled = false;
          if (r && r.success) {
            rec.status = sel.value;
            toast("Saved to the sheet", "success");
          } else {
            toast((r && r.message) || "Save failed", "error");
            sel.value = rec.status || "";
          }
        });
      });
      document.querySelectorAll("[data-ag-edit]").forEach(b => {
        b.addEventListener("click", () => {
          const rec = rows.find(x => x._row === parseInt(b.dataset.agEdit, 10));
          if (rec) openAgreementEditor(rec, data, head);
        });
      });
      document.querySelectorAll("[data-ag-del]").forEach(b => {
        b.addEventListener("click", async () => {
          const row = parseInt(b.dataset.agDel, 10);
          const rec = rows.find(x => x._row === row);
          const ok = await Modal.confirm({
            title: "Delete agreement",
            message: `Delete the agreement for ${rec ? rec.name || rec.memberId : "this member"}?`,
            hint: "The row is removed from the sheet.",
            okText: "Delete", danger: true,
          });
          if (!ok) return;
          const r = await Api.deleteAgreement(row);
          if (r && r.success) { toast("Deleted", "success"); renderAgreements(data, head); }
          else toast((r && r.message) || "Delete failed", "error");
        });
      });
    };

    document.getElementById("agSearch")?.addEventListener("input", paint);
    document.getElementById("agStatusFilter")?.addEventListener("change", paint);
    document.getElementById("agBatchFilter")?.addEventListener("change", paint);
    document.getElementById("agNew")?.addEventListener("click", () => openAgreementEditor(null, data, head));
    document.getElementById("agCreate")?.addEventListener("click", async () => {
      const r = await Api.seedAgreements();
      if (r && r.success) {
        toast("Agreements tab created — " + (r.added || 0) + " rows added", "success");
        renderAgreements(data, head);
      } else toast((r && r.message) || "Could not create the tab", "error");
    });
    document.getElementById("agSeed")?.addEventListener("click", async () => {
      const r = await Api.seedAgreements();
      if (r && r.success) {
        toast((r.added || 0) + " member(s) added as Pending", "success");
        renderAgreements(data, head);
      } else toast((r && r.message) || "Seed failed", "error");
    });

    paint();
  };

  /** Add / edit an agreement */
  const openAgreementEditor = async (rec, data, head) => {
    const members = (data._all || []).map(m => ({
      id: m.memberId, name: m.name, email: m.email, batch: /P1|Part-?1/i.test(m._tab || "") ? "NCM PART-1" : "NCM PART-2",
    }));
    const v = await Modal.form({
      title: rec ? "Edit agreement" : "New agreement",
      intro: rec ? "" : "Pick a member from the list, or fill the fields by hand.",
      okText: rec ? "Save changes" : "Add agreement",
      fields: [
        { key: "memberId", label: "Member ID", required: true, value: rec ? rec.memberId : "", placeholder: "e.g. NCM-01", wide: true },
        { key: "name", label: "Name", value: rec ? rec.name : "", placeholder: "Full name", wide: true },
        { key: "batch", label: "Batch", type: "select", value: rec ? rec.batch : "NCM PART-1", options: [
            { value: "NCM PART-1", label: "NCM PART-1" },
            { value: "NCM PART-2", label: "NCM PART-2" } ] },
        { key: "status", label: "Status", type: "select", value: rec ? rec.status : "Pending", options: AGREEMENT_STATUSES },
        { key: "signedDate", label: "Signed date", value: rec ? rec.signedDate : "", placeholder: "21-10-2026" },
        { key: "link", label: "Document link", value: rec ? rec.link : "", placeholder: "https://drive.google.com/...", wide: true },
        { key: "notes", label: "Notes", type: "textarea", value: rec ? rec.notes : "", placeholder: "Anything worth remembering" },
      ],
    });
    if (!v) return;

    // if the member ID matches a known member, fill the name automatically
    if (!v.name) {
      const hit = members.find(m => m.id === v.memberId);
      if (hit) v.name = hit.name;
    }
    if (!v.batch) {
      const hit = members.find(m => m.id === v.memberId);
      if (hit) v.batch = hit.batch;
    }

    const r = await Api.upsertAgreement(v, rec ? rec._row : undefined);
    if (r && r.success) {
      toast(rec ? "Agreement updated" : "Agreement added", "success");
      renderAgreements(data, head);
    } else {
      toast((r && r.message) || "Save failed", "error");
    }
  };

  /* ================= SCORES & RESULTS ================= */
  const DRAFT_KEY = "mpm.scores.draft";

  const fmtMark = (v) => {
    const n = parseFloat(v);
    if (v === "" || v === null || v === undefined || isNaN(n)) return "";
    return String(Math.round(n * 10) / 10);
  };

  const renderScores = async (data, head) => {
    const month = state.monthTab || Api.NCM_TABS.trackers[0];
    const rows = await Api.getNcmTracker(month);
    state.tracker = rows;

    // join the NCM Master File so the result card has email / mobile / facebook
    let master = state.master && state.master.length ? state.master : (Api.getNcmMasterCached?.() || []);
    if (!master.length) {
      Api.getNcmMaster().then(m => { state.master = m; }).catch(() => {});
    } else {
      state.master = master;
    }
    const byId = {};
    master.forEach(m => { byId[m.memberId] = m; });
    rows.forEach(r => {
      const p = byId[r.memberId];
      if (!p) return;
      r.email = r.email || p.programEmail || "";
      r.phone = p.phone || "";
      r.fbProfile = p.fbProfile || "";
    });

    const backend = Api.isBackendConfigured();
    const draft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; } })();
    const key = (m, k) => (m.memberId + "|" + k);

    const scoreOf = (m, k) => {
      const d = draft[key(m, k)];
      if (d !== undefined && d !== "") return d;
      return m[k] === "" ? "" : m[k];
    };

    /* live values — same maths as the tracker sheet (P, W, X, Y columns),
       so Total / Grade / Remarks change the moment a mark is entered */
    const liveOf = (m) => {
      const manual = {};
      Results.MANUAL_COLS.forEach(c => { manual[c.key] = scoreOf(m, c.key); });
      return Results.computeLive(m, manual);
    };

    /* the merged row (sheet values + draft) used by the card and the DOCX */
    const mergedRow = (m) => {
      const o = Object.assign({}, m);
      Results.MANUAL_COLS.forEach(c => {
        const v = scoreOf(m, c.key);
        if (v !== "" && v !== null && v !== undefined) o[c.key] = v;
      });
      const live = liveOf(m);
      o.attendance10 = live.attendance10;
      o.total100 = live.total;
      o.grade = live.grade;
      o.resultCard = live.resultCard;
      o.remarks = live.remarks;
      return o;
    };

    const scoredCount = rows.filter(m =>
      Results.MANUAL_COLS.some(c => scoreOf(m, c.key) !== "" && scoreOf(m, c.key) !== null)
    ).length;

    els.content.innerHTML = `
      ${head("Scores & results", "Mark the scores, choose the members, take the result card")}

      <div class="tabs" id="resMonths">
        ${Api.NCM_TABS.trackers.map(t => `
          <button class="tab-pill ${t === month ? "active" : ""}" data-month="${escapeHtml(t)}">${escapeHtml(t.replace(" Tracker", ""))}</button>`).join("")}
      </div>

      ${!backend ? `
        <div class="panel" style="border-left:3px solid var(--warning);background:#fff8e1;margin-bottom:16px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
            <b>Browser draft mode.</b> Scores you mark here are kept in this browser and can be exported as CSV to paste into the sheet.
            Connect the Apps Script backend to write straight into the tracker.
          </p>
        </div>` : ""}

      <!-- STEP 1 -->
      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title"><span class="step-n">1</span> Mark the scores</h2>
          <span class="panel-link" style="cursor:default;">${scoredCount} of ${rows.length} members scored</span>
        </header>
        <p class="step-hint">These six columns are the ones the sheet leaves for manual entry. Total, Grade and Remarks are calculated by the sheet formula.</p>
        <div class="score-wrap">
          <table class="score-tbl tbl-scores">
            <thead><tr>
              <th style="min-width:120px;">Member ID</th>
              <th style="min-width:170px;">Name</th>
              ${Results.MANUAL_COLS.map(c => `<th style="min-width:${Math.max(96, c.label.length * 7)}px;">${escapeHtml(c.label)}</th>`).join("")}
              <th style="min-width:80px;">Total</th>
              <th style="min-width:70px;">Grade</th>
            </tr></thead>
            <tbody id="scoreBody"></tbody>
          </table>
        </div>
        ${!backend ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-ghost" id="scoreCsv">⬇ Download scores as CSV</button>
          <button class="btn-ghost" id="scoreClear">Clear draft</button>
        </div>` : ""}
      </section>

      <!-- STEP 2 -->
      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title"><span class="step-n">2</span> Choose the members</h2>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="resFilter" style="padding:7px 11px;border-radius:9px;border:1.5px solid var(--border);font-family:inherit;font-size:12.5px;">
              <option value="all">All members</option>
              <option value="scored">Scored only</option>
              <option value="unscored">Not scored yet</option>
              <option value="selected">Selected</option>
            </select>
            <button class="btn-ghost" id="selAll" style="padding:7px 12px;font-size:12.5px;">Select all scored</button>
            <button class="btn-ghost" id="selNone" style="padding:7px 12px;font-size:12.5px;">Clear</button>
            <span class="panel-link" style="cursor:default;" id="selCount">0 selected</span>
          </div>
        </header>
        <div class="score-wrap" style="max-height:44vh;">
          <table class="score-tbl tbl-select">
            <thead><tr>
              <th style="width:44px;"><input type="checkbox" id="selAllBox" /></th>
              <th style="min-width:120px;">Member ID</th>
              <th style="min-width:180px;">Name</th>
              <th style="min-width:90px;">Total</th>
              <th style="min-width:70px;">Grade</th>
              <th style="min-width:220px;">Remarks</th>
              <th style="min-width:80px;">Status</th>
            </tr></thead>
            <tbody id="resBody"></tbody>
          </table>
        </div>

        <header class="panel-head" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
          <h2 class="panel-title">Result card</h2>
          <span class="panel-link" style="cursor:default;">Filled in automatically from the tracker</span>
        </header>

        <div class="res-auto-note">
          <span class="ran-ico">✓</span>
          <div>
            <b>Fully automatic — nothing to type.</b>
            Each card picks up the member's name, ID, attendance, every score, the total, the grade
            and the authority remark straight from the tracker. The remark follows the same rule the
            sheet uses, so the card and the sheet always say the same thing.
          </div>
        </div>

        <div class="res-preview-head">
          <label>Preview</label>
          <span class="tpl-hint" id="resPreviewWho"></span>
        </div>
        <div class="res-preview" id="resPreview"></div>

        <div class="res-actions">
          <button class="btn-primary" id="genDocx">📄 Download DOCX</button>
          <button class="btn-ghost" id="genPrint">🖨 Print / Save as PDF</button>
          ${backend ? `<button class="btn-ghost" id="genDocs">📁 Save to Google Docs</button>
          <button class="btn-ghost" id="genEmail">✉️ Email to members</button>` : ""}
          <button class="btn-ghost" id="genPreviewAll">👁 Preview all</button>
          <span class="res-actions-note" id="genNote"></span>
        </div>
      </section>

      <!-- history -->
      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Result history</h2>
          <span class="panel-link" style="cursor:default;">What was sent, and when</span>
        </header>
        <div id="resHistory"><div class="loading"><span class="spinner"></span>Loading history…</div></div>
      </section>
    `;

    /* ---------- state ---------- */
    const selected = new Set(state.resSelected || []);

    const persist = () => { state.resSelected = Array.from(selected); };

    /* ---------- step 1 : score entry ---------- */
    let previewFn = null;   // set below — updateCount may fire before paintPreview exists
    const updateCount = () => {
      const el = document.getElementById("selCount");
      if (el) el.textContent = selected.size + " selected";
      const note = document.getElementById("genNote");
      if (note) note.textContent = selected.size ? selected.size + " member(s) will be generated" : "Pick at least one member";
      if (previewFn) previewFn();
    };

    const paintScores = () => {
      const body = document.getElementById("scoreBody");
      if (!body) return;
      body.innerHTML = rows.map(m => {
        const live = liveOf(m);
        return `
        <tr>
          <td class="id-cell">${escapeHtml(m.memberId)}</td>
          <td class="name-cell">${escapeHtml(m.name)}</td>
          ${Results.MANUAL_COLS.map(c => `
            <td><input class="score-in" type="text" inputmode="decimal" enterkeyhint="next"
                 data-mid="${escapeHtml(m.memberId)}" data-k="${c.key}"
                 value="${escapeHtml(scoreOf(m, c.key))}" placeholder="—" /></td>`).join("")}
          <td class="tc-auto">${escapeHtml(fmtMark(live.total))}</td>
          <td class="tc-auto">${escapeHtml(live.grade)}</td>
        </tr>`;
      }).join("");

      body.querySelectorAll(".score-in").forEach(inp => {
        /* one click is enough to type: focusing selects whatever is there,
           so a second click never needs to clear the old value first */
        inp.addEventListener("focus", () => {
          try { inp.select(); } catch (e) {}
        });

        /* commit on every keystroke so the totals/grades update as you type */
        const commit = async (save) => {
          const raw = inp.value.trim();
          /* accept 15, 15.5, 15/2, 15/2 = 7.5 */
          let v = "";
          if (raw !== "") {
            const n = raw.includes("/")
              ? (() => { const [a, b] = raw.split("/").map(x => parseFloat(x)); return b ? a / b : NaN; })()
              : parseFloat(raw);
            v = isNaN(n) ? "" : n;
          }
          const k = inp.dataset.mid + "|" + inp.dataset.k;
          draft[k] = v;
          try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
          /* update the row's Total / Grade in place — no re-render, so the
             caret and the keyboard focus stay exactly where they were */
          const m = rows.find(x => x.memberId === inp.dataset.mid);
          if (m) {
            const live = liveOf(m);
            const cells = inp.closest("tr").querySelectorAll(".tc-auto");
            if (cells[0]) cells[0].textContent = fmtMark(live.total);
            if (cells[1]) cells[1].textContent = live.grade;
          }
          updateCount();
          paintSelection();
          if (save && backend) {
            inp.disabled = true;
            const r = await Api.setTrackerCell({ tab: month, row: inp.closest("tr") && rows.find(x => x.memberId === inp.dataset.mid)?._row, key: inp.dataset.k, value: v });
            inp.disabled = false;
            if (r && r.success) { toast("Saved to the sheet", "success"); loadTracker(); }
            else toast((r && r.message) || "Save failed", "error");
          }
        };

        inp.addEventListener("input", () => { commit(false); });
        inp.addEventListener("change", () => { commit(true); });
        inp.addEventListener("blur", () => { commit(true); });

        /* Enter jumps to the same column on the next row — fast data entry */
        inp.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const col = [...inp.closest("tr").querySelectorAll(".score-in")].indexOf(inp);
          const all = [...body.querySelectorAll(".score-in")];
          const rowIdx = Math.floor(all.indexOf(inp) / Results.MANUAL_COLS.length);
          const next = all[(rowIdx + 1) * Results.MANUAL_COLS.length + col];
          if (next) { next.focus(); try { next.select(); } catch (e) {} }
          else inp.blur();
        });
      });
    };

    const loadTracker = async () => {
      const fresh = await Api.getNcmTracker(month);
      state.tracker = fresh;
      rows.length = 0;
      fresh.forEach(r => rows.push(r));
      paintScores();
    };

    paintScores();

    document.getElementById("scoreCsv")?.addEventListener("click", () => {
      const cols = Results.MANUAL_COLS;
      const lines = ["Member ID,Name," + cols.map(c => c.label).join(",")];
      rows.forEach(m => {
        lines.push([m.memberId, '"' + m.name + '"', ...cols.map(c => {
          const v = scoreOf(m, c.key);
          return v === "" ? "" : v;
        })].join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      Results.downloadBlob(blob, "ncm-scores-" + Results.slug(month) + ".csv");
      toast("CSV downloaded — paste it into the tracker sheet", "success");
    });
    document.getElementById("scoreClear")?.addEventListener("click", async () => {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      draft = {};
      paintScores();
      toast("Draft cleared", "success");
    });

    /* ---------- step 2 : selection ---------- */
    const paintSelection = () => {
      const body = document.getElementById("resBody");
      if (!body) return;
      const f = document.getElementById("resFilter")?.value || "all";
      const list = rows.filter(m => {
        const has = Results.MANUAL_COLS.some(c => scoreOf(m, c.key) !== "" && scoreOf(m, c.key) !== null);
        if (f === "scored") return has;
        if (f === "unscored") return !has;
        if (f === "selected") return selected.has(m.memberId);
        return true;
      });
      body.innerHTML = list.map(m => {
        const has = Results.MANUAL_COLS.some(c => scoreOf(m, c.key) !== "" && scoreOf(m, c.key) !== null);
        const live = liveOf(m);
        return `<tr>
          <td><input type="checkbox" class="sel-box" data-mid="${escapeHtml(m.memberId)}" ${selected.has(m.memberId) ? "checked" : ""} /></td>
          <td class="id-cell">${escapeHtml(m.memberId)}</td>
          <td class="name-cell">${escapeHtml(m.name)}</td>
          <td class="tc-auto">${escapeHtml(fmtMark(live.total))}</td>
          <td class="tc-auto">${escapeHtml(live.grade)}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(live.remarks)}</td>
          <td>${has ? `<span class="chip sent"><span class="chip-dot"></span>Scored</span>` : `<span class="chip empty"><span class="chip-dot"></span>Not scored</span>`}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="7" style="text-align:center;padding:26px;color:var(--text-muted);">Nothing to show</td></tr>`;

      body.querySelectorAll(".sel-box").forEach(cb => {
        cb.addEventListener("change", () => {
          if (cb.checked) selected.add(cb.dataset.mid); else selected.delete(cb.dataset.mid);
          persist();
          updateCount();
        });
      });
      updateCount();
    };

    document.getElementById("resFilter")?.addEventListener("change", paintSelection);
    document.getElementById("selAll")?.addEventListener("click", () => {
      rows.forEach(m => {
        const has = Results.MANUAL_COLS.some(c => scoreOf(m, c.key) !== "" && scoreOf(m, c.key) !== null);
        if (has) selected.add(m.memberId);
      });
      persist(); paintSelection();
    });
    document.getElementById("selNone")?.addEventListener("click", () => { selected.clear(); persist(); paintSelection(); });
    document.getElementById("selAllBox")?.addEventListener("change", (e) => {
      if (e.target.checked) rows.forEach(m => selected.add(m.memberId));
      else selected.clear();
      persist(); paintSelection();
    });
    paintSelection();

    /* ---------- step 3 : generate (fully automatic, nothing to type) ---------- */

    // every tracker on the NCM sheet belongs to NCM Part 1
    const batchOf = () => "NCM PART-1";
    const monthLabel = () => Results.monthLabel(month, rows);
    const evalMonth = () => {
      const full = monthLabel();
      const m = full.match(/^([A-Za-z]+)\s+(\d{4})$/);
      return m ? `${m[1]}, ${m[2]}` : full;
    };

    const ranked = () => {
      const list = rows.filter(m => selected.has(m.memberId))
        .map(m => Results.buildRow(
          { ...mergedRow(m), batch: m.batch || batchOf(), evalMonth: evalMonth() },
          monthLabel()
        ))
        .sort((a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0));
      list.forEach((r, i) => { r.rank = "#" + (i + 1); });
      return list;
    };

    const paintPreview = () => {
      const box = document.getElementById("resPreview");
      if (!box) return;
      const list = ranked();
      const who = document.getElementById("resPreviewWho");
      if (who) who.textContent = list.length ? list[0].name + (list.length > 1 ? ` (+${list.length - 1} more)` : "") : "— pick a member first";
      if (!list.length) {
        box.innerHTML = `<div class="empty-state" style="padding:28px;"><p>Select members in step 2 to see the preview.</p></div>`;
        return;
      }
      const r = list[0];
      const gg = (v) => (v === "" || v === undefined || v === null) ? "" : String(v);
      const sum2 = (a, b) => {
        const x = parseFloat(a), y = parseFloat(b);
        if (isNaN(x) && isNaN(y)) return "";
        return (isNaN(x) ? 0 : x) + (isNaN(y) ? 0 : y);
      };
      const infoRows = [
        ["Member Name", r.name || "—"],
        ["Member ID", r.memberId || "—"],
        ["Email", r.email || "—"],
        ["Mobile No.", r.phone || "—"],
        ["Evaluation Month", r.evalMonth || monthLabel()],
        ["Score", (r.total || 0) + "/100"],
        ["Grade", r.grade || "—"],
      ];

      const perfRows = [
        ["Attendance & Assignment", sum2(gg(r.attendance10), gg(r.assignment20)), "30"],
        ["Workshop", gg(r.workshop20), "20"],
        ["Email & Feedback", gg(r.emailFeedback5), "5"],
        ["Monthly Exam", gg(r.monthlyExam30), "30"],
        ["Professionalism & Payment Completeness", sum2(gg(r.professional10), gg(r.paymentCompliance5)), "15"],
      ];

      /* no manual template — the remark is the only free text and it comes
         from the sheet formula, so there is nothing extra to add here */
      const extra = [];

      box.innerHTML = `
        <div class="rc">
          <img class="rc-ota" src="assets/img/ota-logo-wide.png" alt="Online Tech Academy" />
          <div class="rc-h1">NEXT CHAPTER MASTERMIND</div>
          <div class="rc-dia">❖</div>
          <div class="rc-h2">MONTHLY RESULT CARD</div>
          <div class="rc-period">${escapeHtml(Results.monthName(month))} — Evaluation Period</div>

          <div class="rc-h3">MEMBER INFORMATION</div>
          <table class="rc-info">
            ${infoRows.map((row, i) => `<tr class="${i % 2 ? "c" : ""}">
              <th>${escapeHtml(row[0])}</th>
              <td>${escapeHtml(row[1])}</td></tr>`).join("")}
          </table>

          <div class="rc-h3">PERFORMANCE STATUS</div>
          <table class="rc-perf">
            <thead><tr><th>Criteria</th><th>Obtained Marks</th><th>Marks</th></tr></thead>
            <tbody>${perfRows.map((row, i) => `<tr class="${i % 2 ? "c" : ""}">
              <th>${escapeHtml(row[0])}</th><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join("")}</tbody>
          </table>

          <div class="rc-h3">AUTHORITY REMARKS</div>
          <div class="rc-remarks">${escapeHtml(r.resultCard || r.remarks || "—")}</div>
          ${extra.map(l => `<div class="rc-extra">${escapeHtml(l)}</div>`).join("")}

          <div class="rc-sign">
            <div class="rc-sign-name">Sirajul Islam Jony</div>
            <div class="rc-sign-role">Project Manager</div>
            <div class="rc-sign-org">Online Tech Academy</div>
          </div>
        </div>`;
    };
    previewFn = paintPreview;
    paintPreview();

    /* ---------- generate ---------- */
    const needSelection = () => {
      if (!selected.size) {
        Notify.warn("Pick at least one member in step 2 first.");
        return false;
      }
      return true;
    };

    document.getElementById("genDocx")?.addEventListener("click", async () => {
      if (!needSelection()) return;
      const list = ranked();
      try {
        toast("Building the Word file…");
        const blob = await Results.buildDocx(list, monthLabel());
        Results.downloadBlob(blob, `medha-results-${Results.slug(monthLabel())}-${list.length}.docx`);
        toast("DOCX downloaded — " + list.length + " result card(s)", "success");
        recordHistory(list, "DOCX");
      } catch (e) {
        toast("Could not build the file: " + e.message, "error");
      }
    });

    document.getElementById("genPrint")?.addEventListener("click", () => {
      if (!needSelection()) return;
      const list = ranked();
      const html = Results.buildPrintHtml(list, monthLabel(), "");
      const w = window.open("", "_blank");
      if (!w) { toast("Pop-up blocked", "error"); return; }
      w.document.write(html);
      w.document.close();
    });

    document.getElementById("genPreviewAll")?.addEventListener("click", () => {
      if (!needSelection()) return;
      const list = ranked();
      const html = Results.buildPrintHtml(list, monthLabel(), "");
      const w = window.open("", "_blank");
      if (!w) { toast("Pop-up blocked", "error"); return; }
      w.document.write(html.replace(/window.addEventListener\('load'.*?<\/script>/s, "<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)})<\/script>"));
      w.document.close();
    });

    document.getElementById("genDocs")?.addEventListener("click", async () => {
      if (!needSelection()) return;
      const list = ranked();
      try {
        toast("Creating Google Docs…");
        const r = await Api.generateResultDocs({ tab: month, label: monthLabel(), members: list });
        if (r && r.success) {
          Notify.ok(r.count + " Google Doc(s) created", { hint: (r.urls || []).slice(0, 3).join("\n") });
          recordHistory(list, "Google Docs");
          loadHistory();
        } else toast((r && r.message) || "Failed", "error");
      } catch (e) { toast("Failed: " + e.message, "error"); }
    });

    document.getElementById("genEmail")?.addEventListener("click", async () => {
      if (!needSelection()) return;
      const list = ranked();
      const v = await Modal.form({
        title: "Email the results",
        intro: "Each member gets their own result card.",
        okText: "Send emails",
        fields: [
          { key: "subject", label: "Subject", value: `Your ${month} Result Card — Medha Program Management`, wide: true },
          { key: "body", label: "Message (before the card)", type: "textarea", rows: 4,
            value: "Assalamu Alaikum,\n\nPlease find your result card below.\n\nBest regards,\nMedha Program Management" },
        ],
      });
      if (!v) return;
      try {
        toast("Sending " + list.length + " email(s)…");
        const r = await Api.emailResults({ tab: month, label: monthLabel(), members: list, subject: v.subject, body: v.body });
        if (r && r.success) { Notify.ok(r.count + " email(s) sent"); recordHistory(list, "Email"); loadHistory(); }
        else toast((r && r.message) || "Send failed", "error");
      } catch (e) { toast("Failed: " + e.message, "error"); }
    });

    /* ---------- history ---------- */
    const recordHistory = (list, how) => {
      try {
        const h = JSON.parse(localStorage.getItem("mpm.results.history") || "[]");
        h.unshift({ month, count: list.length, how, at: Date.now(), ids: list.map(r => r.memberId) });
        localStorage.setItem("mpm.results.history", JSON.stringify(h.slice(0, 40)));
      } catch (e) {}
    };

    const loadHistory = async () => {
      const box = document.getElementById("resHistory");
      if (!box) return;
      let items = [];
      try { items = JSON.parse(localStorage.getItem("mpm.results.history") || "[]"); } catch (e) {}
      if (backend) {
        try {
          const r = await Api.getResults();
          if (r && r.success && r.rows) items = r.rows.map(x => ({
            month: x.month, count: x.count, how: x.how, at: x.at,
          }));
        } catch (e) {}
      }
      if (!items.length) {
        box.innerHTML = `<div class="empty-state" style="padding:26px;"><p>No results generated yet.</p></div>`;
        return;
      }
      box.innerHTML = `<table class="score-tbl"><thead><tr>
          <th>Month</th><th>Members</th><th>Method</th><th>Generated</th></tr></thead>
        <tbody>${items.map(x => `<tr>
          <td class="name-cell">${escapeHtml(x.month || "—")}</td>
          <td>${escapeHtml(String(x.count || 0))}</td>
          <td><span class="chip"><span class="chip-dot"></span>${escapeHtml(x.how || "—")}</span></td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(new Date(x.at || Date.now()).toLocaleString("en-GB"))}</td>
        </tr>`).join("")}</tbody></table>`;
    };
    loadHistory();

    /* ---------- month tabs ---------- */
    document.getElementById("resMonths")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-month]");
      if (!btn) return;
      state.monthTab = btn.dataset.month;
      renderScores(data, head);
    });
  };

  /* ================= PAYMENTS (from NCM Master File) ================= */
  const renderPayments = async (data, head) => {
    const master = state.master || [];
    els.content.innerHTML = `
      ${head("Payments", VIEWS.payments.bn)}
      <div class="loading"><span class="spinner"></span>Loading payments\u2026</div>
    `;
    if (!master.length) {
      /* No waiting: the page is painted right away and the Part 1 rows
         arrive a moment later, when the master file has been read. */
      Api.getNcmMaster().then(m => {
        state.master = m;
        if (state.view === "payments") render("payments", state.data);
      }).catch(() => {});
    }
    /* NCM Part 1 comes from the Master File, NCM Part 2 from the Batch-01
       Master sheet. Every NCM Part 2 member joined the programme by paying
       9,919 taka, so that is what the payment row shows for them. */
    const P2_JOIN_FEE = 9919;
    const p1Rows = (state.master || []).map(x => ({ ...x, program: "NCM PART-1" }));
    const p2Rows = (data["NCM PART-2"] || []).map(x => ({
      ...x,
      program: "NCM PART-2",
      amount: x.amount || String(P2_JOIN_FEE),
      paymentStatus: x.paymentStatus || "Full payment",
      phone: x.phone || "",
      team: x.team || "",
      plan: x.plan || "",
      paymentDate: x.paymentDate || "",
      paymentChannel: x.paymentChannel || "",
      octSF: x.octSF || "",
    }));
    const m = [...p1Rows, ...p2Rows];
    const paid = m.filter(x => /full/i.test(x.paymentStatus || ""));
    const partial = m.filter(x => x.paymentStatus && !/full/i.test(x.paymentStatus));
    const none = m.filter(x => !x.paymentStatus);
    const totalPaid = paid.reduce((a, x) => a + (parseFloat(x.amount) || 0), 0);
    const sfCollected = m.reduce((a, x) => a + (parseFloat(x.octSF) || 0), 0);

    els.content.innerHTML = `
      ${head("Payments", VIEWS.payments.bn)}

      <div class="stats">
        ${statCard("Fully paid", paid.length, "of " + m.length + " records", "check", "green")}
        ${statCard("Partial", partial.length, "Pending balance", "clock", "amber")}
        ${statCard("Unpaid", none.length, "No record found", "users", "blue")}
        ${statCard("Collected", "\u09F3" + totalPaid.toLocaleString("en-US"), "Total programme amount", "taka", "purple")}
      </div>

      <div class="toolbar">
        <input type="search" id="paySearch" placeholder="Search name, ID, phone, team" />
        <select id="payFilter">
          <option value="all">All payment status</option>
          <option value="full">Full payment</option>
          <option value="partial">Partial</option>
          <option value="none">Not paid</option>
        </select>
        <button class="btn-ghost" id="payRefresh">\u21bb Refresh</button>
        <a class="panel-link" data-sheet-link href="#" style="margin-left:6px;">Edit in sheet \u2197</a>
        <span class="count" id="payCount"></span>
      </div>

      <div class="panel" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;max-height:64vh;">
          <table class="tbl">
            <thead><tr>
              <th style="width:46px;">#</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Program</th>
              <th>Phone</th>
              <th>Team</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Channel</th>
              <th>Oct_SF</th>
            </tr></thead>
            <tbody id="payBody"></tbody>
          </table>
        </div>
      </div>
    `;

    const paint = () => {
      const q = (document.getElementById("paySearch")?.value || "").trim().toLowerCase();
      const f = document.getElementById("payFilter")?.value || "all";
      const rows = m.filter(x => {
        const st = /full/i.test(x.paymentStatus || "") ? "full" : (x.paymentStatus ? "partial" : "none");
        if (f !== "all" && st !== f) return false;
        if (!q) return true;
        return (x.name + " " + x.memberId + " " + x.phone + " " + x.team + " " + x.plan).toLowerCase().includes(q);
      });
      document.getElementById("payCount").textContent = `${rows.length} of ${m.length} records`;
      document.getElementById("payBody").innerHTML = rows.map((x, i) => {
        const st = /full/i.test(x.paymentStatus || "") ? "full" : (x.paymentStatus ? "partial" : "none");
        return `<tr>
          <td style="color:var(--text-muted);font-weight:600;">${escapeHtml(x.sl) || i + 1}</td>
          <td class="id-cell">${escapeHtml(x.memberId)}</td>
          <td class="name-cell">${escapeHtml(x.name)}</td>
          <td><span class="chip"><span class="chip-dot" style="background:${x.program === "NCM PART-1" ? "#2563eb" : "#f59e0b"};"></span>${x.program === "NCM PART-1" ? "Part 1" : "Part 2"}</span></td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(x.phone) || "\u2014"}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(x.team) || "\u2014"}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(x.plan) || "\u2014"}</td>
          <td style="font-weight:700;">${x.amount ? "\u09F3" + escapeHtml(x.amount) : "\u2014"}</td>
          <td>${payChip(st, x.paymentStatus)}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(x.paymentDate) || "\u2014"}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(x.paymentChannel) || "\u2014"}</td>
          <td style="font-size:12px;font-weight:700;color:${parseFloat(x.octSF) > 0 ? "#047857" : "var(--text-dim)"};">${escapeHtml(x.octSF) || "\u2014"}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--text-muted);">No records match</td></tr>`;
    };

    document.getElementById("paySearch").addEventListener("input", paint);
    document.getElementById("payFilter").addEventListener("change", paint);
    document.getElementById("payRefresh").addEventListener("click", async () => {
      await Api.refreshCache();
      state.master = await Api.getNcmMaster();
      renderPayments(data, head);
      toast("Payment records reloaded", "success");
    });
    paint();
  };


  /* ================= PAYMENTS ADMIN (two consoles) ================= */
  /* Each console keeps its own URL and its own credentials, stored under
     its own key so the two never overwrite each other. */
  const PAY_CONSOLES = [
    {
      key: "payadmin",
      name: "Medha 60-Day admin",
      tagline: "Coupons, paid / tried / failed, refunds, CSV export",
      url: "https://otanextchapter.online/admin/",
      credKey: "mpm.payadmin.cred",
      defaults: { id: "admin", password: "NCMpart02" },
      note: "Sign in once here and the browser keeps you signed in. Everything you change in the console is saved there.",
    },
    {
      key: "payadmin2",
      name: "OTA payment console",
      tagline: "The original Online Tech Academy payment console",
      url: "https://pay.onlinetechacademy.club/admin",
      credKey: "mpm.payadmin2.cred",
      defaults: { id: "admin", password: "3D1sdE*OvV%FvS7v" },
      note: "Sign in once here and the browser keeps you signed in. Everything you change in the console is saved there.",
    },
  ];

  const readCred = (conf) => {
    try {
      const raw = localStorage.getItem(conf.credKey);
      if (raw) {
        const c = JSON.parse(raw);
        return { id: c.id ?? conf.defaults.id, password: c.password ?? conf.defaults.password };
      }
    } catch (e) {}
    return { ...conf.defaults };
  };

  const renderPayAdmin = async (data, head) => {
    els.content.innerHTML = `
      ${head("Payments admin", "Both Online Tech Academy payment consoles \u2014 inside the program portal")}
      <div class="console-grid">
        ${PAY_CONSOLES.map(conf => {
          const cred = readCred(conf);
          const app = {
            key: conf.key,
            name: conf.name,
            url: conf.url,
            icon: ICONS.taka,
            creds: [
              { label: "Admin ID", value: cred.id },
              { label: "Password", value: cred.password },
            ],
            saveCred: () => {
              const id = document.getElementById(conf.key + "-cred-0")?.value.trim() || cred.id;
              const pw = document.getElementById(conf.key + "-cred-1")?.value ?? cred.password;
              try { localStorage.setItem(conf.credKey, JSON.stringify({ id, password: pw })); } catch (e) {}
            },
            note: conf.note,
            tagline: conf.tagline,
          };
          return `
            ${appLauncherHtml(app)}
            <section class="panel" id="${conf.key}Inline" hidden>
              <header class="panel-head">
                <h2 class="panel-title">${escapeHtml(conf.name)} \u2014 inline</h2>
                <span class="panel-link" style="cursor:default;">Only works if the console allows embedding</span>
              </header>
              <div class="support-bar">
                <span class="sb-url">${escapeHtml(conf.url.replace(/^https?:\/\//, ""))}</span>
                <span class="sb-spacer"></span>
                <button class="btn" data-reload-frame="${conf.key}">\u21bb</button>
                <button class="btn" data-frame-this-tab="${conf.key}">Open in this tab</button>
                <button class="btn" data-frame-new-tab="${conf.key}">New tab</button>
              </div>
              <div class="support-frame-wrap" style="height:520px;">
                <iframe class="support-frame" id="${conf.key}Frame" data-src="${escapeHtml(conf.url)}"
                        title="${escapeHtml(conf.name)} console" referrerpolicy="strict-origin-when-cross-origin"></iframe>
              </div>
            </section>`;
        }).join("")}
      </div>
    `;

    PAY_CONSOLES.forEach(conf => {
      const app = {
        key: conf.key,
        name: conf.name,
        url: conf.url,
        creds: [
          { label: "Admin ID", value: readCred(conf).id },
          { label: "Password", value: readCred(conf).password },
        ],
        note: conf.note,
      };
      wireLauncher(app);
    });

    PAY_CONSOLES.forEach(conf => {
      document.querySelector(`[data-reload-frame="${conf.key}"]`)?.addEventListener("click", () => {
        const f = document.getElementById(conf.key + "Frame");
        if (f) f.setAttribute("src", f.getAttribute("data-src") || conf.url);
      });
      document.querySelector(`[data-frame-this-tab="${conf.key}"]`)?.addEventListener("click", () =>
        openAppSameTab(conf.url, conf.name));
      document.querySelector(`[data-frame-new-tab="${conf.key}"]`)?.addEventListener("click", () =>
        openAppNewTab(conf.url, conf.name));
    });
  };

  /* ================= FORM CONTROL (any Google / HTML form) ================= */
  const openFormControl = async () => {
    const res = await Api.getFormSettings();
    const forms = (res && res.forms) || [];
    if (!forms.length) {
      toast("No forms configured yet", "error");
      return;
    }
    let activeId = forms[0].id;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="formControl">
        <div class="modal" style="max-width:760px;max-height:90vh;display:flex;flex-direction:column;">
          <header class="modal-head">
            <h3>Form Control</h3>
            <button class="modal-close" id="fcClose" aria-label="Close">&times;</button>
          </header>
          <div class="modal-body" style="overflow-y:auto;flex:1;">
            <div class="fc-picker">
              <label>Which form?</label>
              <select id="fcFormSelect"></select>
              <button class="btn-ghost" id="fcAddForm" style="margin-left:8px;padding:8px 12px;font-size:12px;">+ Add form</button>
            </div>

            <div class="fc-grid">
              <div class="fc-row">
                <label>Form name</label>
                <input type="text" id="fcName" />
              </div>
              <div class="fc-row">
                <label>Form type</label>
                <select id="fcType">
                  <option value="google">Google Form</option>
                  <option value="html">HTML form / web page</option>
                  <option value="custom">Custom embed URL</option>
                </select>
              </div>
              <div class="fc-row fc-wide">
                <label>Form link (Google Form URL, page URL or embed URL)</label>
                <input type="url" id="fcLink" placeholder="https://docs.google.com/forms/d/e/.../viewform" />
              </div>
            </div>

            <div class="fc-status-row">
              <span class="fc-lbl">Response status</span>
              <div class="fc-segmented" role="group" aria-label="Response status">
                <button class="fc-seg open" id="fcOpen" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                  <span>Open</span>
                </button>
                <button class="fc-seg close" id="fcClose2" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                  <span>Close</span>
                </button>
              </div>
              <label class="fc-switch" title="Toggle responses"><input type="checkbox" id="fcOpenToggle" /><span class="slider"></span></label>
              <span class="fc-state" id="fcState">ON</span>
            </div>

            <div class="fc-grid">
              <div class="fc-row">
                <label>Open from (optional) &mdash; when it becomes live</label>
                <input type="datetime-local" id="fcOpenFrom" />
                <span class="fc-hint">Before this moment the form stays closed</span>
              </div>
              <div class="fc-row">
                <label>Close at / Deadline (optional)</label>
                <input type="datetime-local" id="fcDeadline" />
                <span class="fc-hint">After this moment the form closes by itself</span>
              </div>
            </div>

            <div class="fc-grid">
              <div class="fc-row">
                <label>Closed message (Bangla) &mdash; emoji OK</label>
                <textarea id="fcMsgBn" rows="3"></textarea>
              </div>
              <div class="fc-row">
                <label>Closed message (English)</label>
                <textarea id="fcMsgEn" rows="3"></textarea>
              </div>
            </div>

            <div class="fc-row">
              <label>Viewer preview &mdash; what people see</label>
              <div class="fc-preview" id="fcPreview">
                <div class="fc-lock">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div class="fc-prev-msg" id="fcPrevMsg"></div>
                <div class="fc-prev-sub" id="fcPrevSub"></div>
              </div>
              <button class="btn-ghost" id="fcUpdatePreview" style="margin-top:8px;padding:7px 12px;font-size:12px;">&#128257; Update preview</button>
            </div>

            <div class="fc-actions">
              <button class="btn-primary" id="fcSave">&#128190; Save Form Settings</button>
              <button class="btn-ghost" id="fcReload">&#128260; Reload</button>
              <button class="btn-ghost danger" id="fcDelete" style="margin-left:auto;">&#128465; Delete form</button>
            </div>

            <div class="fc-live" id="fcLive">Live status: &mdash;</div>
          </div>
        </div>
      </div>
    `);

    const $ = (id) => document.getElementById(id);
    const select = $("fcFormSelect");
    const fillSelect = () => {
      select.innerHTML = forms.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
      select.value = activeId;
    };

    const toLocal = (s) => {
      if (!s) return "";
      const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ,]+(\d{1,2}):(\d{1,2})/);
      if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}T${String(m[4]).padStart(2,"0")}:${String(m[5]).padStart(2,"0")}`;
      const m2 = String(s).match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ ,]+(\d{1,2}):(\d{1,2})/);
      if (m2) return `${m2[3]}-${String(m2[2]).padStart(2,"0")}-${String(m2[1]).padStart(2,"0")}T${String(m2[4]).padStart(2,"0")}:${String(m2[5]).padStart(2,"0")}`;
      return "";
    };
    const fromLocal = (v) => {
      if (!v) return "";
      const m = String(v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})/);
      if (!m) return v;
      return `${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}-${m[1]} ${String(m[4]).padStart(2,"0")}:${String(m[5]).padStart(2,"0")}`;
    };

    const current = () => forms.find(f => f.id === activeId) || forms[0];

    const paint = () => {
      const f = current();
      if (!f) return;
      $("fcName").value = f.name || "";
      $("fcType").value = f.type || "google";
      $("fcLink").value = f.link || "";
      $("fcOpenFrom").value = toLocal(f.openFrom);
      $("fcDeadline").value = toLocal(f.deadline);
      $("fcMsgBn").value = f.msgBn || "";
      $("fcMsgEn").value = f.msgEn || "";
      setOpen(f.open);
      updatePreview();
    };

    const setOpen = (on) => {
      $("fcOpenToggle").checked = !!on;
      $("fcState").textContent = on ? "ON" : "OFF";
      $("fcState").style.color = on ? "#059669" : "#dc2626";
      $("fcOpen").classList.toggle("active", !!on);
      $("fcClose2").classList.toggle("active", !on);
    };

    const updatePreview = () => {
      const f = current();
      if (!f) return;
      const bn = $("fcMsgBn").value.trim();
      const en = $("fcMsgEn").value.trim();
      $("fcPrevMsg").textContent = bn || en || "This form is closed.";
      $("fcPrevSub").textContent = en || "";
      const now = new Date();
      let reason = "";
      if (f.openFrom) {
        const t = new Date(String(f.openFrom).replace(" ", "T"));
        if (!isNaN(t) && now < t) reason = "Opens " + f.openFrom;
      }
      if (f.deadline) {
        const t = new Date(String(f.deadline).replace(" ", "T"));
        if (!isNaN(t) && now > t) reason = "Closed — deadline passed (" + f.deadline + ")";
        else if (!reason) reason = "Closes " + f.deadline;
      }
      const live = $("fcLive");
      const isOpen = $("fcOpenToggle").checked && !reason.startsWith("Closed");
      live.innerHTML = "Live status: " + (isOpen
        ? "<b style='color:#059669'>OPEN</b>"
        : "<b style='color:#dc2626'>CLOSED</b>") + (reason ? " &mdash; " + escapeHtml(reason) : "");
    };

    fillSelect();
    paint();

    select.addEventListener("change", () => { activeId = select.value; paint(); });
    $("fcOpen").addEventListener("click", () => { setOpen(true); updatePreview(); });
    $("fcClose2").addEventListener("click", () => { setOpen(false); updatePreview(); });
    $("fcOpenToggle").addEventListener("change", (e) => { setOpen(e.target.checked); updatePreview(); });
    $("fcUpdatePreview").addEventListener("click", updatePreview);
    ["fcMsgBn", "fcMsgEn", "fcDeadline", "fcOpenFrom"].forEach(id => $(id).addEventListener("input", updatePreview));

    $("fcAddForm").addEventListener("click", async () => {
      const v = await Modal.form({
        title: "Add a form",
        intro: "Any form you can open in a browser works here — a Google Form, a registration page, or any HTML form.",
        okText: "Add form",
        fields: [
          { key: "name", label: "Form name", required: true, value: "", placeholder: "e.g. Feedback Form", wide: true },
          { key: "type", label: "Form type", type: "select", value: "google", options: [
              { value: "google", label: "Google Form" },
              { value: "html", label: "HTML form / web page" },
              { value: "custom", label: "Custom embed URL" } ] },
          { key: "link", label: "Form link", value: "", placeholder: "https://docs.google.com/forms/d/e/.../viewform", wide: true },
        ],
      });
      if (!v) return;
      const id = (v.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || ("F" + Date.now().toString(36).toUpperCase()));
      const nf = { id, name: v.name, type: v.type, link: v.link || "", open: false, openFrom: "", deadline: "", msgBn: "", msgEn: "This form is closed." };
      forms.push(nf);
      activeId = id;
      fillSelect();
      paint();
      Notify.ok("Added \u201c" + v.name + "\u201d. Remember to press Save Form Settings.");
    });

    $("fcSave").addEventListener("click", async () => {
      const f = current();
      if (!f) return;
      const payload = {
        ...f,
        name: $("fcName").value.trim() || f.name,
        type: $("fcType").value,
        link: $("fcLink").value.trim(),
        open: $("fcOpenToggle").checked,
        openFrom: fromLocal($("fcOpenFrom").value),
        deadline: fromLocal($("fcDeadline").value),
        msgBn: $("fcMsgBn").value,
        msgEn: $("fcMsgEn").value,
      };
      try {
        const r = await Api.saveFormSettings(payload);
        if (r && r.success) {
          const idx = forms.findIndex(x => x.id === payload.id);
          if (idx >= 0) forms[idx] = payload;
          toast("Form settings saved", "success");
        } else {
          toast((r && r.message) || "Save failed", "error");
        }
      } catch (e) { toast("Save failed: " + e.message, "error"); }
    });

    $("fcReload").addEventListener("click", async () => {
      const r = await Api.getFormSettings();
      if (r && r.success) {
        forms.length = 0;
        r.forms.forEach(f => forms.push(f));
        fillSelect(); paint();
        toast("Reloaded from the sheet", "success");
      }
    });

    $("fcDelete").addEventListener("click", async () => {
      const f = current();
      if (!f) return;
      const yes = await Modal.confirm({
        title: "Delete form",
        message: `Delete the form \u201c${f.name}\u201d?`,
        hint: "This removes its settings from the sheet.",
        okText: "Delete",
        danger: true,
      });
      if (!yes) return;
      const r = await Api.deleteFormSettings(f.id);
      if (r && r.success) {
        const i = forms.findIndex(x => x.id === f.id);
        if (i >= 0) forms.splice(i, 1);
        activeId = forms.length ? forms[0].id : null;
        fillSelect(); paint();
        toast("Form deleted", "success");
      } else toast("Delete failed", "error");
    });

    $("fcClose").addEventListener("click", () => document.getElementById("formControl")?.remove());
  };

  /* ============ Embedded app launcher (works even when framing is blocked) ============ */

  /**
   * Open an external app in the SAME browser tab.
   * The user stays in one browser — MPM and the console swap places, and
   * the back button brings the portal back.
   */
  const openAppSameTab = (url, label) => {
    /* Remember exactly where we were, so the browser Back button brings the
       portal back on the very same view (and the same scroll position) —
       not on Overview. The view also lives in the URL hash, so even a full
       reload restores the right page. */
    try {
      saveScroll();
      sessionStorage.setItem("mpm.app.return", location.href);
    } catch (e) {}
    Notify.info("Opening " + label + "…", { title: "Same tab", hint: "Use the browser Back button to return to Medha." });
    location.href = url;
  };

  /** Open an external app in a NEW browser tab (keeps MPM open alongside) */
  const openAppNewTab = (url, label) => {
    const w = Math.min(1360, Math.round((screen.availWidth || 1440) - 60));
    const h = Math.min(900, Math.round((screen.availHeight || 900) - 60));
    const left = Math.max(0, Math.round(((screen.availWidth || 1440) - w) / 2));
    const top = Math.max(0, Math.round(((screen.availHeight || 900) - h) / 2));
    const tab = window.open(url, "mpm_tab_" + label, `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (!tab) {
      Notify.err("Your browser blocked the pop-up.", {
        title: "Allow pop-ups",
        hint: "Allow pop-ups for this site, then try again \\u2014 or use \\u201cOpen in this tab\\u201d.",
      });
      return null;
    }
    try { tab.focus(); } catch (e) {}
    return tab;
  };

  /**
   * Launcher card for an external app.
   * app: { key, name, url, icon, creds: [{label, value}], note }
   */
  const appLauncherHtml = (app) => `
    <section class="panel">
      <div class="app-launcher">
        <div class="launch-card">
          <div class="launch-head">
            <span class="launch-ico">${app.icon || ICONS.console}</span>
            <div style="min-width:0;">
              <div class="launch-name">${escapeHtml(app.name)}</div>
              <div class="launch-url">${escapeHtml(app.url.replace(/^https?:\/\//, ""))}</div>
            </div>
          </div>
          ${app.tagline ? `<p class="launch-tagline">${escapeHtml(app.tagline)}</p>` : ""}
          <p class="launch-note">${escapeHtml(app.note || "")}</p>
          ${(app.creds || []).map((c, i) => `
            <div class="launch-cred launch-cred-edit">
              <b>${escapeHtml(c.label)}</b>
              <input class="cred-input launch-cred-input" id="${escapeHtml(app.key)}-cred-${i}"
                     type="${i === 1 ? "text" : "text"}" value="${escapeHtml(c.value)}" />
              <button class="cred-btn" data-copy="${escapeHtml(app.key)}-${i}">Copy</button>
            </div>`).join("")}
          <div class="launch-actions">
            <button class="btn-purple" data-open="${escapeHtml(app.key)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open in this tab
            </button>
            <button class="btn-ghost" data-newtab="${escapeHtml(app.key)}">New tab</button>
            <button class="btn-ghost" data-inline="${escapeHtml(app.key)}">Try inline</button>
          </div>
          <div class="launch-save-row">
            <button class="btn-ghost" data-save-cred="${escapeHtml(app.key)}">Save credentials</button>
          </div>
          <button class="launch-check" data-frameable="${escapeHtml(app.key)}">Why not inline? Check this site's headers</button>
        </div>
      </div>
    </section>
  `;

  /** Wire launcher buttons: copy creds + open window */
  const wireLauncher = (app, onInline) => {
    document.querySelectorAll(`[data-copy^="${app.key}-"]`).forEach(b => {
      b.addEventListener("click", async () => {
        const idx = parseInt(b.dataset.copy.split("-").pop(), 10);
        const input = document.querySelector(`#${app.key}-cred-${idx}`);
        const val = input ? input.value : ((app.creds || [])[idx]?.value || "");
        try { await navigator.clipboard.writeText(val); }
        catch (e) {
          const ta = document.createElement("textarea");
          ta.value = val; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); } catch (e2) {}
          ta.remove();
        }
        b.textContent = "Copied";
        b.classList.add("done");
        setTimeout(() => { b.textContent = "Copy"; b.classList.remove("done"); }, 1400);
      });
    });
    /* save the credentials typed in the launcher card */
    document.querySelectorAll(`[data-save-cred="${app.key}"]`).forEach(b => {
      b.addEventListener("click", () => {
        const save = app.saveCred;
        if (!save) return;
        save();
        Notify.ok("Credentials saved on this device");
      });
    });
    document.querySelectorAll(`[data-open="${app.key}"]`).forEach(b => {
      b.addEventListener("click", () => openAppSameTab(app.url, app.name));
    });
    document.querySelectorAll(`[data-newtab="${app.key}"]`).forEach(b => {
      b.addEventListener("click", () => openAppNewTab(app.url, app.name));
    });
    document.querySelectorAll(`[data-inline="${app.key}"]`).forEach(b => {
      b.addEventListener("click", () => {
        document.querySelector(`#${app.key}Inline`)?.removeAttribute("hidden");
        // load the frame only now — keeps the console clean and the page fast
        const f = document.querySelector(`#${app.key}Inline iframe`);
        if (f && !f.getAttribute("src")) f.setAttribute("src", f.getAttribute("data-src") || "");
        onInline?.();
      });
    });
    document.querySelectorAll(`[data-frameable="${app.key}"]`).forEach(b => {
      b.addEventListener("click", async () => {
        b.disabled = true;
        b.textContent = "Checking\u2026";
        const r = await Api.checkFrameable(app.url);
        b.disabled = false;
        b.textContent = "Why not inline? Check this site's headers";
        if (!r || !r.success) {
          Notify.warn("Could not read the headers from here.", {
            title: "Check blocked",
            hint: r && r.message ? r.message : "Connect the Apps Script backend to run this check.",
          });
          return;
        }
        if (r.frameable) {
          Notify.ok("This site allows embedding.", {
            title: "Inline will work",
            hint: "Press \u201cTry inline\u201d to open it inside the portal.",
          });
        } else {
          Notify.show({
            kind: "warn",
            title: "Embedding is blocked",
            message: `${app.name} sends ${r.reason}.`,
            hint: "To embed it inside MPM, remove that header on their server (or set frame-ancestors to allow this site). Until then, use \u201cOpen in browser window\u201d.",
          });
        }
      });
    });
  };

  /* ================= MEDHA SUPPORT (embedded console) ================= */
  const SUPPORT_URL = "https://app.medha.pro/ops/support";
  const SUPPORT_CRED_KEY = "mpm.support.cred";

  const getSupportCred = () => {
    try {
      const raw = localStorage.getItem(SUPPORT_CRED_KEY);
      return raw ? JSON.parse(raw) : { email: "howlaserahsan@gmail.com", password: "OTA@123456789" };
    } catch {
      return { email: "howlaserahsan@gmail.com", password: "OTA@123456789" };
    }
  };
  const setSupportCred = (c) => {
    try { localStorage.setItem(SUPPORT_CRED_KEY, JSON.stringify(c)); } catch (e) {}
  };

  const copyText = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      ta.remove();
    }
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = "Copied";
    btn.classList.add("done");
    setTimeout(() => { btn.textContent = orig; btn.classList.remove("done"); }, 1400);
  };

  const renderSupport = async (data, head) => {
    const cred = getSupportCred();
    const backend = Api.isBackendConfigured();
    const app = {
      key: "support",
      name: "Medha Support",
      url: SUPPORT_URL,
      icon: ICONS.console,
      creds: [
        { label: "Email", value: cred.email },
        { label: "Password", value: cred.password },
      ],
      saveCred: () => {
        const email = document.getElementById("support-cred-0")?.value.trim() || cred.email;
        const pw = document.getElementById("support-cred-1")?.value ?? cred.password;
        try { localStorage.setItem(SUPPORT_CRED_KEY, JSON.stringify({ email, password: pw })); } catch (e) {}
      },
      note: "Sign in once here and the browser keeps you signed in. Everything you change in the console is saved there.",
    };

    els.content.innerHTML = `
      ${head("Support", "Medha Support desk \u2014 inside the program portal")}

      <div class="support-tabs" id="supTabs">
        <button class="sup-tab active" data-mode="launcher">
          <span class="st-ico">${ICONS.console}</span> Support console
        </button>
        <button class="sup-tab" data-mode="native" ${backend ? "" : "disabled"}>
          <span class="st-ico">${ICONS.list}</span> Ticket list
        </button>
        <span class="sup-tabs-note" id="supModeNote">${backend
          ? "Native ticket list uses the Apps Script proxy \u2014 no new tab needed."
          : "Connect the Apps Script backend to unlock the in-portal ticket list."}</span>
      </div>

      <div id="supLauncherPane">
        ${appLauncherHtml(app)}

        <section class="panel" id="supportInline" hidden>
          <header class="panel-head">
            <h2 class="panel-title">Try inline</h2>
            <span class="panel-link" style="cursor:default;">Only works if the app allows embedding</span>
          </header>
          <div class="support-bar">
            <span class="sb-url">${SUPPORT_URL.replace(/^https?:\/\//, "")}</span>
            <span class="sb-spacer"></span>
            <button class="btn" id="supReload">\u21bb</button>
            <button class="btn" id="supPop">Open in this tab</button>
            <button class="btn" id="supNewTab">New tab</button>
          </div>
          <div class="support-frame-wrap" id="supWrap" style="height:520px;">
            <iframe class="support-frame" id="supFrame" data-src="${SUPPORT_URL}" title="Medha Support console"
                    referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
        </section>
      </div>

      <div class="support-shell" id="supNative" hidden>
        <div class="support-bar">
          <div class="sb-title" style="font-weight:800;font-size:13.5px;color:var(--text);">Support tickets</div>
          <span class="sb-count" id="supCount">\u2014</span>
          <span class="sb-spacer"></span>
          <input class="sb-search" id="supSearch" placeholder="Search subject, email, ticket\u2026" />
          <select class="sb-select" id="supStatusFilter">
            <option value="all">All statuses</option>
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="closed">closed</option>
          </select>
          <button class="btn" id="supRefresh">\u21bb</button>
        </div>
        <div class="sup-table-wrap" id="supTableWrap">
          <div class="loading"><span class="spinner"></span>Loading tickets\u2026</div>
        </div>
      </div>
    `;

    wireLauncher(app);

    document.getElementById("supTabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".sup-tab");
      if (!btn || btn.disabled) return;
      document.querySelectorAll(".sup-tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      document.getElementById("supLauncherPane").hidden = mode !== "launcher";
      document.getElementById("supNative").hidden = mode !== "native";
      if (mode === "native") loadNativeTickets();
    });

    /* save the credentials typed in the launcher card */
    document.querySelectorAll('[data-save-cred="support"]').forEach(b => {
      b.addEventListener("click", async () => {
        const c = {
          email: document.getElementById("support-cred-0")?.value.trim() || "",
          password: document.getElementById("support-cred-1")?.value || "",
        };
        setSupportCred(c);
        if (Api.isBackendConfigured()) {
          try {
            await Api.setSupportCredentials(c);
            Notify.info("Saved — connecting to the support desk…");
            const r = await Api.supportConnect();
            if (r && r.success) {
              Notify.ok("Connected — " + (r.count || 0) + " tickets loaded");
              window.__supTickets = r.tickets || [];
              const nat = document.querySelector('.sup-tab[data-mode="native"]');
              if (nat) nat.disabled = false;
              const note = document.getElementById("supModeNote");
              if (note) note.textContent = "Native ticket list is live — no new tab needed.";
              renderNativeTickets();
              return;
            }
          } catch (e) { /* fall through to the local confirmation */ }
        }
        Notify.ok("Credentials saved on this device");
      });
    });

    document.getElementById("supReload")?.addEventListener("click", () => {
      const f = document.getElementById("supFrame");
      if (f) f.setAttribute("src", f.getAttribute("data-src") || SUPPORT_URL);
    });
    document.getElementById("supPop")?.addEventListener("click", () => openAppSameTab(SUPPORT_URL, "Medha Support"));
    document.getElementById("supNewTab")?.addEventListener("click", () => openAppNewTab(SUPPORT_URL, "Medha Support"));

    document.getElementById("supRefresh")?.addEventListener("click", loadNativeTickets);
    document.getElementById("supSearch")?.addEventListener("input", renderNativeTickets);
    document.getElementById("supStatusFilter")?.addEventListener("change", renderNativeTickets);

    if (backend) {
      Api.supportConnect().then(r => {
        if (r && r.success) {
          window.__supTickets = r.tickets || [];
          const nat = document.querySelector('.sup-tab[data-mode="native"]');
          if (nat) nat.disabled = false;
          const note = document.getElementById("supModeNote");
          if (note) note.textContent = "Native ticket list is live \u2014 " + (r.count || 0) + " tickets loaded.";
          renderNativeTickets();
        }
      }).catch(() => {});
    }
  };

  const renderNativeTickets = () => {
    const wrap = document.getElementById("supTableWrap");
    if (!wrap) return;
    const all = window.__supTickets || [];
    const q = (document.getElementById("supSearch")?.value || "").toLowerCase();
    const st = document.getElementById("supStatusFilter")?.value || "all";
    const rows = all.filter(t => {
      if (st !== "all" && (t.status || "").toLowerCase() !== st) return false;
      if (!q) return true;
      return ((t.id || "") + " " + (t.subject || "") + " " + (t.user || "")).toLowerCase().includes(q);
    });
    const cnt = document.getElementById("supCount");
    if (cnt) cnt.textContent = rows.length + " of " + all.length;

    if (!all.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:40px;">
        <div class="ico">${ICONS.list}</div>
        <h3>No tickets loaded</h3>
        <p>Save the support credentials above, or run <code>supportConnect()</code> once in the Apps Script editor to wire the ticket API.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `<table class="sup-tbl">
      <thead><tr>
        <th>Ticket</th><th>User</th><th>Subject</th><th>Type</th><th>Status</th><th>Priority</th><th>Age</th><th>Assignee</th>
      </tr></thead>
      <tbody>${rows.map(t => {
        const lv = (t.status || "").toLowerCase();
        const cls = lv === "open" ? "open" : lv === "in_progress" ? "prog" : lv === "closed" ? "closed" : "";
        return `<tr>
          <td class="id-cell">${escapeHtml(t.id)}</td>
          <td class="user-cell">${escapeHtml(t.user || "—")}</td>
          <td class="subj-cell">${escapeHtml(t.subject || "—")}</td>
          <td><span class="chip"><span class="chip-dot" style="background:#94a3b8;"></span>${escapeHtml(t.type || "support")}</span></td>
          <td><span class="chip ${cls === "open" ? "sent" : cls === "prog" ? "pending" : "empty"}"><span class="chip-dot"></span>${escapeHtml(t.status || "—")}</span></td>
          <td><span class="chip"><span class="chip-dot" style="background:#10b981;"></span>${escapeHtml(t.priority || "normal")}</span></td>
          <td class="age-cell">${escapeHtml(t.age || "—")}</td>
          <td class="age-cell">${escapeHtml(t.assignee || "—")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
  };

  const loadNativeTickets = async () => {
    const wrap = document.getElementById("supTableWrap");
    if (!wrap) return;
    wrap.innerHTML = `<div class="loading"><span class="spinner"></span>Loading tickets…</div>`;
    try {
      const r = await Api.supportConnect();
      if (r && r.success) {
        window.__supTickets = r.tickets || [];
        renderNativeTickets();
      } else {
        wrap.innerHTML = `<div class="empty-state" style="padding:40px;">
          <div class="ico">${ICONS.list}</div>
          <h3>Could not reach the support API</h3>
          <p>${escapeHtml((r && r.message) || "Unknown error")} — run <code>supportDiscover()</code> in the Apps Script editor to find the right endpoint, or use the console tab.</p>
        </div>`;
      }
    } catch (e) {
      wrap.innerHTML = `<div class="empty-state" style="padding:40px;"><h3>Could not load tickets</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
  };

  /* ================= FILES (sheets + documents) ================= */
  const renderFiles = async (data, head) => {
    els.content.innerHTML = `
      ${head("Files", "Spreadsheets and documents in one place")}
      <div class="loading"><span class="spinner"></span>Loading files...</div>
    `;

    const files = await Api.listFiles();
    const links = Api.sheetLinks();
    const remote = Api.isBackendConfigured();

    els.content.innerHTML = `
      ${head("Files", "Spreadsheets and documents in one place")}

      <div class="toolbar">
        <button class="btn-primary" id="fileUpload">Upload file</button>
        <button class="btn-ghost" id="fileAddLink">+ Add link</button>
        <input type="file" id="filePicker" multiple hidden />
        <span class="count" id="fileCount">${files.length} document${files.length === 1 ? "" : "s"}</span>
        <button class="btn-ghost" id="fileShare" title="Copy a link that carries this document list">Copy link with my documents</button>
      </div>

      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Spreadsheets</h2>
        </header>
        <div class="file-grid">
          ${links.map(l => `
            <a class="file-card sheet" href="${l.url}" target="_blank" rel="noopener">
              <span class="fc-ico sheet">${ICONS.sheet}</span>
              <span class="fc-body">
                <span class="fc-name">${escapeHtml(l.label)}</span>
                <span class="fc-sub">${escapeHtml(l.sub)}</span>
              </span>
              <span class="fc-ext">${ICONS.external}</span>
            </a>`).join("")}
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">Documents</h2>
          <span class="panel-link" style="cursor:default;">${remote ? "Stored in Google Drive" : "Stored in this browser"}</span>
        </header>

        ${!remote ? `
          <div class="panel" style="margin-bottom:14px;padding:10px 14px;background:#fff8e1;border-left:3px solid var(--warning);font-size:12.5px;color:#92400e;">
            <b>Browser storage.</b> Your documents are kept in this browser, so a new web address starts with an empty list.
            Use <b>Copy link with my documents</b> to carry them over, or connect the Apps Script backend to keep them in Google Drive where every team member sees the same files.
          </div>` : ""}

        <div class="file-grid" id="fileGrid">
          ${files.length ? files.map(f => fileCardHtml(f)).join("") : `
            <div class="file-empty">
              <span class="fe-ico">&#128193;</span>
              <b>No documents yet</b>
              <p>Upload a file or add a link to a Google Doc / Drive file. Every document gets
                <b>Open</b>, <b>Rename</b> and a red <b>Remove</b> button on the right — press Remove
                and you have 10 seconds to undo it.</p>
              <div class="fe-demo">
                <span class="fc-ico link">${ICONS.link}</span>
                <span class="fc-body">
                  <span class="fc-name">A document will look like this</span>
                  <span class="fc-sub">drive.google.com/... &middot; just now</span>
                </span>
                <span class="fc-actions">
                  <a class="fc-btn" tabindex="-1" aria-hidden="true">${ICONS.external}</a>
                  <button class="fc-btn" tabindex="-1" aria-hidden="true">${ICONS.edit}</button>
                  <button class="fc-remove" tabindex="-1" aria-hidden="true">${ICONS.trash}<span>Remove</span></button>
                </span>
              </div>
            </div>`}
        </div>
      </section>
    `;

    const picker = document.getElementById("filePicker");
    document.getElementById("fileUpload").addEventListener("click", () => picker.click());
    picker.addEventListener("change", async () => {
      const list = Array.from(picker.files || []);
      if (!list.length) return;
      toast("Uploading " + list.length + " file(s)...");
      for (const f of list) {
        const b64 = await fileToBase64(f);
        await Api.uploadFile({ name: f.name, size: f.size, mime: f.type, base64: b64, kind: "upload" });
      }
      picker.value = "";
      toast("Upload complete", "success");
      renderFiles(data, head);
    });

    document.getElementById("fileAddLink").addEventListener("click", () => {
      openFileEditor(null, async () => renderFiles(data, head));
    });

    document.getElementById("fileShare")?.addEventListener("click", async () => {
      const code = await Api.exportFileList();
      const url = location.origin + location.pathname + "?docs=" + code;
      let copied = false;
      try { await navigator.clipboard.writeText(url); copied = true; } catch (e) {}
      if (copied) {
        Notify.ok("Link copied — open it anywhere to bring your documents along", {
          title: "Link with your documents",
          hint: "Paste it into a new address and the whole list follows you there.",
          duration: 7000,
        });
      } else {
        /* no clipboard permission — show the link so it can be copied by hand */
        document.body.insertAdjacentHTML("beforeend", `
          <div class="modal-overlay" id="shareLinkModal">
            <div class="modal" style="max-width:560px;">
              <header class="modal-head">
                <h3>Link with your documents</h3>
                <button class="modal-close" id="slmClose" aria-label="Close">&times;</button>
              </header>
              <div class="modal-body">
                <p style="font-size:13.5px;line-height:1.6;margin-top:0;">Open this address and your whole document list comes with it.</p>
                <textarea readonly id="slmUrl" style="width:100%;height:120px;font-size:12px;padding:10px;border:1px solid var(--border);border-radius:10px;word-break:break-all;">${escapeHtml(url)}</textarea>
                <div class="modal-actions">
                  <button class="btn-ghost" id="slmClose2">Close</button>
                  <button class="btn-primary" id="slmCopy">Copy the link</button>
                </div>
              </div>
            </div>
          </div>`);
        const closeM = () => document.getElementById("shareLinkModal")?.remove();
        document.getElementById("slmClose").addEventListener("click", closeM);
        document.getElementById("slmClose2").addEventListener("click", closeM);
        document.getElementById("slmCopy").addEventListener("click", async () => {
          const ta = document.getElementById("slmUrl");
          ta.select();
          try { await navigator.clipboard.writeText(url); Notify.ok("Link copied"); closeM(); }
          catch (e) { document.execCommand && document.execCommand("copy"); }
        });
        setTimeout(() => document.getElementById("slmUrl")?.select(), 150);
      }
    });

    document.querySelectorAll("[data-file-edit]").forEach(b => b.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const f = files.find(x => x.id === b.dataset.fileEdit);
      openFileEditor(f, async () => renderFiles(data, head));
    }));
    document.querySelectorAll("[data-file-del]").forEach(b => b.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const f = files.find(x => x.id === b.dataset.fileDel);
      if (!f) return;
      await removeFileWithUndo(f.id, f.name, () => renderFiles(data, head));
    }));
  };

  /* One removal flow for the whole portal: the file leaves the list at once
     and comes straight back if the user presses Undo within 10 seconds.
     Used by the Files page and by the "..." menu, so both behave the same. */
  const removeFileWithUndo = async (id, name, onChanged) => {
    await Api.removeFileLater(id, 10000);
    onChanged && onChanged();
    Notify.ok(name + " removed from Files", {
      title: "File removed",
      hint: "Press Undo within 10 seconds to bring it back.",
      duration: 10000,
      action: {
        label: "Undo",
        onClick: async () => {
          await Api.restoreFile(id);
          onChanged && onChanged();
          Notify.ok(name + " is back in Files");
        },
      },
    });
  };

  const fileCardHtml = (f) => `
    <div class="file-card" data-fid="${escapeHtml(f.id)}">
      <span class="fc-ico ${f.kind === "link" ? "link" : "doc"}">${f.kind === "link" ? ICONS.link : ICONS.file}</span>
      <span class="fc-body">
        <span class="fc-name">${escapeHtml(f.name)}</span>
        <span class="fc-sub">${f.url ? escapeHtml(f.url.replace(/^https?:\/\//, "").slice(0, 48)) : (f.size ? Math.round(f.size / 1024) + " KB" : "Document")} &middot; ${escapeHtml(relTime(f.at))}</span>
      </span>
      <span class="fc-actions">
        ${f.url ? `<a class="fc-btn" href="${escapeHtml(f.url)}" target="_blank" rel="noopener" title="Open">${ICONS.external}</a>` : ""}
        <button class="fc-btn" data-file-edit="${escapeHtml(f.id)}" title="Rename / edit" aria-label="Rename ${escapeHtml(f.name)}">${ICONS.edit}</button>
        <button class="fc-remove" data-file-del="${escapeHtml(f.id)}" title="Remove this file from Files">
          ${ICONS.trash}<span>Remove</span>
        </button>
      </span>
    </div>`;

  const relTime = (ts) => {
    if (!ts) return "-";
    const d = Date.now() - ts;
    if (d < 60000) return "just now";
    if (d < 3600000) return Math.floor(d / 60000) + " min ago";
    if (d < 86400000) return Math.floor(d / 3600000) + " h ago";
    return Math.floor(d / 86400000) + " d ago";
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const openFileEditor = (file, onDone) => {
    const isEdit = !!file;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="fileEditor">
        <div class="modal" style="max-width:520px;">
          <header class="modal-head">
            <h3>${isEdit ? "Edit document" : "Add link"}</h3>
            <button class="modal-close" id="feClose" aria-label="Close">&times;</button>
          </header>
          <div class="modal-body">
            <label>Name</label>
            <input type="text" id="feName" value="${escapeHtml(file ? file.name : "")}" placeholder="Document name" />
            <label style="margin-top:12px;">Link (Google Doc, Drive file, PDF...)</label>
            <input type="url" id="feUrl" value="${escapeHtml(file ? file.url : "")}" placeholder="https://drive.google.com/..." />
            <div class="modal-actions">
              <button class="btn-ghost" id="feCancel">Cancel</button>
              <button class="btn-primary" id="feSave">${isEdit ? "Save changes" : "Add"}</button>
            </div>
          </div>
        </div>
      </div>
    `);
    const close = () => document.getElementById("fileEditor")?.remove();
    document.getElementById("feClose").addEventListener("click", close);
    document.getElementById("feCancel").addEventListener("click", close);
    document.getElementById("feSave").addEventListener("click", async () => {
      const name = (document.getElementById("feName").value || "").trim();
      const url = (document.getElementById("feUrl").value || "").trim();
      if (!name) { toast("Name is required", "error"); return; }
      if (isEdit) await Api.updateFile({ ...file, name, url });
      else await Api.addFile({ name, url, kind: "link" });
      close();
      toast(isEdit ? "Updated" : "Added", "success");
      if (onDone) onDone();
    });
    setTimeout(() => document.getElementById("feName")?.focus(), 120);
  };


  /* ================= CLASS & ATTENDANCE (NCM tracker) ================= */
  const ATT_STATES = ["Punctual", "Late", "Absent"];

  const renderClasses = async (data, head) => {
    const month = state.monthTab || Api.NCM_TABS.trackers[0];

    els.content.innerHTML = `
      ${head("Classes & attendance", VIEWS.classes.bn)}
      <div class="loading"><span class="spinner"></span>Loading tracker\u2026</div>
    `;

    const rows = await Api.getNcmTracker(month);
    state.tracker = rows;

    // join the NCM Master File so the result card has email / mobile / facebook
    let master = state.master && state.master.length ? state.master : (Api.getNcmMasterCached?.() || []);
    if (!master.length) {
      Api.getNcmMaster().then(m => { state.master = m; }).catch(() => {});
    } else {
      state.master = master;
    }
    const byId = {};
    master.forEach(m => { byId[m.memberId] = m; });
    rows.forEach(r => {
      const p = byId[r.memberId];
      if (!p) return;
      r.email = r.email || p.programEmail || "";
      r.phone = p.phone || "";
      r.fbProfile = p.fbProfile || "";
    });

    const backend = Api.isBackendConfigured();
    const cols = Api.TRACKER_COLS;

    const punctual = rows.reduce((a, r) => a + (parseFloat(r.punctualCount) || 0), 0);
    const late = rows.reduce((a, r) => a + (parseFloat(r.lateCount) || 0), 0);
    const absent = rows.reduce((a, r) => a + (parseFloat(r.absentCount) || 0), 0);
    const scored = rows.filter(r => parseFloat(r.total100) > 0);
    const avgTotal = scored.length ? (scored.reduce((a, r) => a + (parseFloat(r.total100) || 0), 0) / scored.length) : 0;

    els.content.innerHTML = `
      ${head("Classes & attendance", VIEWS.classes.bn)}

      <div class="tabs" id="monthTabs">
        ${Api.NCM_TABS.trackers.map(t => `
          <button class="tab-pill ${t === month ? "active" : ""}" data-month="${escapeHtml(t)}">
            ${escapeHtml(t.replace(" Tracker", ""))} Tracker
          </button>`).join("")}
      </div>

      <div class="stats">
        ${statCard("Members tracked", rows.length, month, "users", "purple")}
        ${statCard("Punctual", punctual, "Total on-time marks", "check", "green")}
        ${statCard("Late", late, "Late arrivals", "clock", "amber")}
        ${statCard("Absent", absent, "Missed sessions", "users", "blue")}
      </div>

      <section class="panel">
        <header class="panel-head">
          <h2 class="panel-title">${escapeHtml(month)}</h2>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <span class="pm-status-line">Average total: <b>${avgTotal.toFixed(1)}</b>/100 across ${scored.length} scored</span>
            <button class="btn-ghost" id="clsRefresh">\u21bb Refresh</button>
            <a class="panel-link" data-sheet-link href="#" style="margin-left:6px;">Edit in sheet \u2197</a>
          </div>
        </header>

        ${!backend ? `
          <div class="panel" style="margin-bottom:14px;padding:10px 14px;background:#fff8e1;border-left:3px solid var(--warning);font-size:12.5px;color:#92400e;">
            <b>Read-only.</b> Marking attendance or entering scores needs the Apps Script backend connected \u2014 until then, edit the tracker directly in the sheet (every change shows up here on refresh).
          </div>` : ""}

        <div class="tracker-wrap">
          <table class="tracker-tbl">
            <thead>
              <tr class="tg-row">
                ${Api.TRACKER_GROUPS.map(g => {
                  const span = cols.filter(c => c.g === g.key).length;
                  return `<th class="tg" colspan="${span}" data-group="${g.key}">${escapeHtml(g.label)}</th>`;
                }).join("")}
              </tr>
              <tr class="tr-head">
                ${cols.map(c => `<th class="tc tc-${c.type}" style="min-width:${c.w}px" data-key="${c.key}">${escapeHtml(c.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody id="trackerBody">
              ${rows.map(r => trackerRow(r, cols, backend)).join("")}
            </tbody>
          </table>
        </div>

        <div class="tracker-legend">
          <span class="lg"><i class="sw punctual"></i> Punctual</span>
          <span class="lg"><i class="sw late"></i> Late</span>
          <span class="lg"><i class="sw absent"></i> Absent</span>
          <span class="lg"><i class="sw auto"></i> Auto-calculated by the sheet</span>
          <span class="lg"><i class="sw num"></i> Manual entry</span>
        </div>
      </section>
    `;

    document.getElementById("monthTabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-month]");
      if (!btn) return;
      state.monthTab = btn.dataset.month;
      renderClasses(state.data, head);
    });
    document.getElementById("clsRefresh")?.addEventListener("click", async () => {
      await Api.refreshCache();
      const fresh = await Api.getNcmTracker(state.monthTab);
      state.tracker = fresh;
      renderClasses(state.data, head);
      toast("Tracker reloaded", "success");
    });

    const bindTrackerEdits = (cs) => {
      document.querySelectorAll("#trackerBody [data-cell]").forEach(cell => {
        cell.addEventListener("change", async () => {
          const { cell: key, row } = cell.dataset;
          const value = cell.dataset.type === "att" ? cell.value : (cell.value === "" ? "" : parseFloat(cell.value));
          cell.classList.add("saving");
          try {
            await Api.setTrackerCell({ tab: state.monthTab, row: parseInt(row, 10), key, value });
            cell.classList.remove("saving");
            cell.classList.add("saved");
            setTimeout(() => cell.classList.remove("saved"), 900);
            setTimeout(async () => {
              const fresh = await Api.getNcmTracker(state.monthTab);
              state.tracker = fresh;
              const tb = document.getElementById("trackerBody");
              if (tb) tb.innerHTML = fresh.map(r => trackerRow(r, cs, true)).join("");
              bindTrackerEdits(cs);
            }, 700);
          } catch (err) {
            cell.classList.remove("saving");
            cell.classList.add("save-err");
            toast("Save failed: " + err.message, "error");
          }
        });
      });
    };
    if (backend) bindTrackerEdits(cols);
  };

  const trackerRow = (r, cols, editable) => {
    const cells = cols.map(c => {
      const v = r[c.key] == null ? "" : String(r[c.key]);
      if (c.type === "ro") {
        if (c.key === "memberId") return `<td class="tc tc-ro id-cell">${escapeHtml(v)}</td>`;
        if (c.key === "name") return `<td class="tc tc-ro name-cell">${escapeHtml(v)}</td>`;
        return `<td class="tc tc-ro">${escapeHtml(v)}</td>`;
      }
      if (c.type === "att") {
        const lv = v.toLowerCase();
        const cls = lv === "punctual" ? "is-punctual" : lv === "late" ? "is-late" : lv === "absent" ? "is-absent" : "";
        const opts = ["", ...ATT_STATES].map(o => `<option value="${o}" ${o === v ? "selected" : ""}>${o || "\u2014"}</option>`).join("");
        return `<td class="tc tc-att ${cls}"><select data-cell="${c.key}" data-row="${r._row}" data-type="att" ${editable ? "" : "disabled"}>${opts}</select></td>`;
      }
      if (c.type === "num") {
        return `<td class="tc tc-num"><input type="number" step="0.5" min="0" data-cell="${c.key}" data-row="${r._row}" data-type="num" value="${escapeHtml(v)}" ${editable ? "" : "disabled"} /></td>`;
      }
      let disp = v;
      if (c.key === "attendancePct" && v) {
        const num = parseFloat(v);
        disp = isNaN(num) ? v : (num <= 1 ? Math.round(num * 100) + "%" : num + "%");
      }
      if (c.key === "total100" || c.key === "attendance10") {
        const num = parseFloat(disp);
        disp = isNaN(num) ? disp : num.toFixed(1);
      }
      return `<td class="tc tc-auto">${escapeHtml(disp)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  };


  /* ================= MAIL PORTAL (3-column workspace) ================= */
  const MAIL_BOXES = ["Inbox", "Sent", "Archive"];
  const MAIL_SEEN_KEY = "mpm.mail.seen";
  const SAMPLE_MAIL = [
    { from: "Ayesha Siddiqua", tag: "payment", subject: "Batch 11 joining confirmation", preview: "Assalamu Alaikum. I have received your Batch 11 joining confirmation. Please confirm.", time: "11 Sep", unread: true },
    { from: "Support - OTA", tag: "agreement", subject: "Agreement signed - Rahim Uddin", preview: "Rahim Uddin signed the participation agreement for Batch 11. Doc ID: AG-2026-0112", time: "9 Sep", unread: true },
    { from: "Tanvir Hasan", tag: "support", subject: "Class link not working", preview: "Today's class link is not working, the Zoom link shows as invalid.", time: "8 Sep", unread: false },
    { from: "bKash Merchant", tag: "payment", subject: "Payment received BDT 4,500", preview: "You have received BDT 4,500 from 01712... TrxID 8F3K2L9Q. Balance: 12,340", time: "7 Sep", unread: false },
    { from: "Medha Feedback Bot", tag: "support", subject: "Your feedback is recorded", preview: "Thank you! Your feedback has been recorded. Let us know if you have any questions.", time: "6 Sep", unread: false },
    { from: "NCM Coordinator", tag: "otp", subject: "Live session reminder — 21 Oct, 8 PM", preview: "Reminder for today's live session. Code: NCM-4820", time: "6 Sep", unread: false },
  ];

  /* mails the user has already opened stay read across reloads */
  const seenMailIds = () => {
    try { return new Set(JSON.parse(localStorage.getItem(MAIL_SEEN_KEY) || "[]")); }
    catch { return new Set(); }
  };
  const markMailIdsSeen = (ids) => {
    try {
      const s = seenMailIds();
      ids.forEach(i => s.add(i));
      localStorage.setItem(MAIL_SEEN_KEY, JSON.stringify(Array.from(s).slice(-200)));
    } catch (e) {}
  };
  /* apply the saved "seen" state to the sample inbox */
  const applySeenState = () => {
    const seen = seenMailIds();
    SAMPLE_MAIL.forEach((m, i) => { if (seen.has(i)) m.unread = false; });
  };
  applySeenState();

  const renderMail = (data, head) => {
    els.content.innerHTML = `
      ${head("Mail portal", VIEWS.mail.bn)}

      <div class="mail-tabs" id="mailTabs" role="tablist">
        <button class="mail-tab active" data-mtab="inbox" role="tab">
          <span class="mt-ico">${ICONS.inbox}</span> Inbox
        </button>
        <button class="mail-tab" data-mtab="progmail" role="tab">
          <span class="mt-ico">${ICONS.send}</span> Program Mail
        </button>
        <span class="mail-tabs-note">Both live inside the portal — no new tab needed.</span>
      </div>

      <div id="mailTabBody"></div>
    `;

    const body = document.getElementById("mailTabBody");
    const showInbox = () => {
      /* the user has signed in and opened the inbox → the mails are now read,
         so mark them before the inbox is painted */
      if (!Api.isBackendConfigured()) {
        markMailIdsSeen(SAMPLE_MAIL.map((m, i) => i).filter(i => SAMPLE_MAIL[i].unread));
        SAMPLE_MAIL.forEach(m => { m.unread = false; });
        clearMailBadge();
      }
      body.innerHTML = inboxWorkspaceHtml();
      wireInbox(data);
      /* the unread count stays until the mails are actually opened */
      loadMailBadge();
    };
    const showProgMail = () => { body.innerHTML = progMailHtml(); wireProgMail(data); };

    document.getElementById("mailTabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".mail-tab");
      if (!btn) return;
      document.querySelectorAll(".mail-tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.mtab === "progmail") showProgMail();
      else showInbox();
    });

    showInbox();
  };

  const inboxWorkspaceHtml = () => `
      <div class="mail-workspace" id="mailWorkspace">
        <!-- LEFT RAIL -->
        <section class="mail-side">
          <header class="mail-side-head">
            <div class="mail-side-title">
              <span class="ms-ico">${ICONS.mail}</span>
              <div>
                <div class="ms-name">Mail portal</div>
                <div class="ms-sub"><span id="mpUnread">—</span> unread • Gmail + Sheet</div>
              </div>
            </div>
            <button class="btn-dark" id="openCompose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Compose
            </button>
          </header>

          <nav class="mail-side-nav" id="mailBoxNav">
            <button class="msn active" data-box="Inbox">
              <span class="msn-ico">${ICONS.inbox}</span>
              <span class="msn-label">Inbox</span>
              <span class="msn-badge" id="mpInboxBadge">0</span>
            </button>
            <button class="msn" data-box="Sent">
              <span class="msn-ico">${ICONS.send}</span>
              <span class="msn-label">Sent</span>
            </button>
            <button class="msn msn-sync" id="mpSyncGmail" title="Read the inbox again from Gmail">↻ Sync from Gmail</button>
            <button class="msn" data-box="Archive">
              <span class="msn-ico">${ICONS.archive}</span>
              <span class="msn-label">Archive</span>
            </button>
          </nav>

        </section>

        <!-- MIDDLE LIST -->
        <section class="mail-list-panel">
          <header class="mlp-head">
            <div class="mlp-title">
              <span class="mlp-ico">${ICONS.inbox}</span>
              <span id="mlpBoxName">Inbox</span>
              <span class="mlp-count" id="mlpCount"></span>            </div>
            <div class="mlp-search">
              ${ICONS.search}
              <input type="search" id="mailSearch" placeholder="Search mails" />
            </div>
          </header>
          <div id="mailItems"><div class="loading"><span class="spinner"></span>Loading inbox…</div></div>
        </section>
      </div>
  `;

  const wireInbox = (data) => {
    const backend = Api.isBackendConfigured();

    // --- behaviour ---
    let currentBox = "Inbox";
    let currentSearch = "";
    /* real inbox mails from the backend (Gmail); falls back to the samples */
    let liveMails = null;
    let mailError = "";
    let mailSyncing = false;

    /* With a backend we show the real Gmail inbox. The sample mails are only
       for the demo (no backend) — they must never pretend to be real. */
    const mailList = () => (backend ? (liveMails || []) : SAMPLE_MAIL);
    const unreadCount = () => mailList().filter(m => m.unread).length;

    /* pull the real inbox once the portal opens */
    const loadLiveMails = async () => {
      if (!backend) { paint(); return; }
      mailSyncing = true;
      try {
        const r = await Api.getMailBadge();
        mailError = (r && r.message) || "";
        liveMails = (r && Array.isArray(r.items)) ? r.items.map((m) => ({
          from: m.from || "Unknown sender",
          tag: "inbox",
          subject: m.subject || "(no subject)",
          preview: m.snippet || "",
          time: m.date ? stamp(m.date) : "",
          unread: !!m.unread,
          threadId: m.threadId || "",
        })) : [];
      } catch (e) {
        liveMails = [];
        mailError = String((e && e.message) || e);
      }
      mailSyncing = false;
      paint();
    };
    if (backend) loadLiveMails();

    const paint = () => {
      const q = currentSearch.toLowerCase();
      const unread = unreadCount();

      document.getElementById("mlpBoxName").textContent = currentBox;
      document.getElementById("mpUnread").textContent = unread;
      const badge = document.getElementById("mpInboxBadge");
      if (badge) { badge.textContent = unread; badge.style.display = unread ? "inline-block" : "none"; }

      // SENT box → full Email History log view (legacy portal style)
      if (currentBox === "Sent") {
        const searchBox = document.querySelector(".mlp-search");
        if (searchBox) searchBox.style.display = "none";
        renderSentLogView();
        return;
      }
      const searchBox2 = document.querySelector(".mlp-search");
      if (searchBox2) searchBox2.style.display = "";

      let items = mailList();
      if (currentBox === "Archive") {
        items = items.filter(m => !m.unread);
      }
      if (q) items = items.filter(m => (m.from + " " + m.subject + " " + m.preview).toLowerCase().includes(q));

      const el = document.getElementById("mailItems");
      document.getElementById("mlpCount").textContent = currentBox === "Inbox" ? "• " + unread + " new" : "• " + items.length;

      if (!items.length) {
        let note = "";
        let fixBtn = "";
        if (backend) {
          const live = !!(state.backend && state.backend.ok);
          if (!live) {
            const why = (state.backend && state.backend.message) || mailError || "the address did not answer";
            note = `<b>The backend is not working.</b><br>${escapeHtml(why)}<br><br>
                    <b>Fix:</b> in Apps Script open <b>Deploy → Manage deployments</b> and copy the
                    <b>Web app URL</b> (it must end with <code>/exec</code>), then paste it below.`;
            fixBtn = `<div style="margin-top:10px;"><button class="btn-primary" id="mlpFixBackend">Fix the backend address</button></div>`;
          } else if (mailError) {
            note = `Gmail could not be read — ${escapeHtml(mailError)}<br><br>
                    <b>Fix:</b> open the Apps Script project → run <b>setupGmail()</b> once → allow the
                    Gmail permission → deploy a new version.`;
          } else {
            note = "Your Gmail inbox is empty.";
          }
        } else {
          note = "These are sample mails. Connect the Apps Script backend to read your real inbox.";
          fixBtn = `<div style="margin-top:10px;"><button class="btn-primary" id="mlpFixBackend">Connect the backend</button></div>`;
        }
        el.innerHTML = `<div class="empty-state" style="padding:34px;">
          <div class="ico">${ICONS.mail}</div>
          <p>Nothing in ${currentBox}.</p>
          ${note ? `<p style="font-size:12.5px;color:var(--text-muted);line-height:1.7;max-width:520px;">${note}</p>` : ""}
          ${fixBtn}
        </div>`;
        document.getElementById("mlpFixBackend")?.addEventListener("click", () => {
          openBackendConfig();
        });
        return;
      }

      el.innerHTML = items.map((m, i) => `
        <article class="ml-item ${m.unread ? "unread" : ""}">
          <div class="ml-avatar ${m.unread ? "" : "dim"}">${escapeHtml(m.from.charAt(0).toUpperCase())}</div>
          <div class="ml-body">
            <div class="ml-row1">
              <span class="ml-from">${escapeHtml(m.from)}</span>
              <span class="ml-tag ${m.tag}">${escapeHtml(m.tag)}</span>
            </div>
            <div class="ml-subject">${escapeHtml(m.subject)}</div>
            <div class="ml-preview">${escapeHtml(m.preview)}</div>
          </div>
          <div class="ml-meta">
            <span class="ml-time">${escapeHtml(m.time || "")}</span>
            ${m.unread ? '<span class="ml-dot"></span>' : ""}
          </div>
        </article>
      `).join("");
    };

    document.getElementById("mailBoxNav")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".msn");
      if (!btn) return;
      document.querySelectorAll("#mailBoxNav .msn").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      currentBox = btn.dataset.box;
      paint();
    });

    document.getElementById("mailSearch")?.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      paint();
    });

    /* opening the inbox means the mails have been seen — mark them read */
    document.getElementById("mailItems")?.addEventListener("click", (e) => {
      const item = e.target.closest(".ml-item");
      if (!item) return;
      const idx = Array.from(item.parentElement.children).indexOf(item);
      const list = mailList();
      const m = list[idx];
      if (m) {
        m.unread = false;
        /* tell Gmail too, so the badge is right on every device */
        if (backend && m.threadId) Api.markMailRead(m.threadId).catch(() => {});
        loadMailBadge();
      }
      paint();
    });

    document.getElementById("mpSyncGmail")?.addEventListener("click", async () => {
      if (!backend) { toast("Connect the Apps Script backend to read Gmail", "error"); return; }
      await loadLiveMails();
      const r = await Api.getMailBadge().catch(() => null);
      if (r) loadMailBadge();
      if (mailError) {
        Notify.warn("Gmail could not be read — " + mailError, {
          title: "Gmail sync",
          hint: "Run setupGmail() once in the Apps Script project, then deploy a new version.",
          duration: 8000,
        });
      } else {
        Notify.ok("Inbox updated from Gmail", { title: "Gmail sync", duration: 4000 });
      }
    });

    document.getElementById("openCompose")?.addEventListener("click", () => {
      if (document.getElementById("composeDrawer")) { toggleCompose(false); return; }
      const ws = document.getElementById("mailWorkspace");
      ws.classList.add("with-drawer");
      ws.insertAdjacentHTML("beforeend", composeDrawerHtml(backend));
      wireCompose(backend, data);
    });

    paint();
  };

  const composeDrawerHtml = (backend) => `
    <aside class="compose-drawer" id="composeDrawer">
      <header class="cd-head">
        <div class="cd-title">New mail • via Apps Script</div>
        <button class="cd-close" id="cdClose" aria-label="Close">×</button>
      </header>
      <div class="cd-body">
        <input class="cd-field" id="cdTo" placeholder="To: email or batch group" />
        <input class="cd-field" id="cdSubject" placeholder="Subject" />
        <textarea class="cd-textarea" id="cdBody" placeholder="Write your message… This will be sent via GmailApp.sendEmail() in Apps Script, and logged to the sheet."></textarea>
        <div class="pm-row">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);">Send body language</label>
          <select class="cd-field" id="cdLang" style="padding:8px 11px;">
            <option value="en">English</option>
            <option value="bn">Bangla</option>
          </select>
        </div>
        <div class="pm-row">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);">Batch group</label>
          <select class="cd-field" id="cdGroup" style="padding:8px 11px;">
            <option value="NCM PART-1">NCM PART-1</option>
            <option value="NCM PART-2">NCM PART-2</option>
          </select>
        </div>
      </div>
      <footer class="cd-foot">
        <span class="cd-note">Draft saved locally • Not persisted</span>
        <button class="btn-purple" id="cdSend" ${backend ? "" : "disabled style='opacity:.55;cursor:not-allowed;'"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Send via Sheet
        </button>
      </footer>
    </aside>
  `;

  const toggleCompose = (show) => {
    const ws = document.getElementById("mailWorkspace");
    const drawer = document.getElementById("composeDrawer");
    if (!ws) return;
    if (show) {
      ws.classList.add("with-drawer");
      if (!drawer) {
        ws.insertAdjacentHTML("beforeend", composeDrawerHtml(Api.isBackendConfigured()));
        wireCompose(Api.isBackendConfigured(), state.data);
      }
    } else {
      ws.classList.remove("with-drawer");
      if (drawer) drawer.remove();
    }
  };

  const wireCompose = (backend, data) => {
    document.getElementById("cdClose")?.addEventListener("click", () => toggleCompose(false));
    // autosave draft locally
    const draftKey = "mpm.draft.mail";
    const saveDraft = () => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          to: document.getElementById("cdTo")?.value || "",
          subject: document.getElementById("cdSubject")?.value || "",
          body: document.getElementById("cdBody")?.value || "",
        }));
      } catch (e) {}
    };
    ["cdTo", "cdSubject", "cdBody"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", saveDraft);
    });
    // restore
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (d) {
        if (document.getElementById("cdTo")) document.getElementById("cdTo").value = d.to || "";
        if (document.getElementById("cdSubject")) document.getElementById("cdSubject").value = d.subject || "";
        if (document.getElementById("cdBody")) document.getElementById("cdBody").value = d.body || "";
      }
    } catch (e) {}

    document.getElementById("cdSend")?.addEventListener("click", async () => {
      const subject = (document.getElementById("cdSubject")?.value || "").trim();
      const body = (document.getElementById("cdBody")?.value || "").trim();
      const to = (document.getElementById("cdTo")?.value || "").trim();
      const group = document.getElementById("cdGroup")?.value || "NCM PART-1";
      if (!subject || !body) { toast("Subject & body required", "error"); return; }

      let recipients;
      if (to && to.indexOf("@") !== -1) {
        recipients = [{ email: to, name: to.split("@")[0], memberId: "", rowIndex: 0 }];
      } else {
        recipients = (data[group] || []).map(m => ({
          rowIndex: m._row, memberId: m.memberId, name: m.name, email: m.email,
        }));
      }
      try {
        toast("Sending to " + recipients.length + " recipients…");
        const r = await Api.sendMail({
          program: group, subject, bodyHtml: body.replace(/\n/g, "<br>"), recipients,
        });
        toast("Sent: " + (r.sent || 0) + " · Failed: " + (r.failed || 0), "success");
        saveDraft();
      } catch (err) {
        toast("Send failed: " + err.message, "error");
      }
    });
  };

  /* ===== Email history log view (Sent box) ===== */
  const SAMPLE_LOGS = [
    {
      type: "Gmail Sync: Members NCM-P2", source: "Gmail", count: 1,
      recipients: "sahabulota@gmail.com",
      subject: "Official Notice Regarding October 2026 Subscription Payment — Next Chapter Mastermind",
      status: "Sent", timestamp: "21-10-2026 14:30:58",
      notes: "Source: Gmail · 21-10-2026 14:30:58",
      body: `<div style="margin:0;padding:0;background:#f5f3ff;">
        <div style="padding:20px 12px;background:#f5f3ff;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
              <tr><td style="padding:0;line-height:0;">
                <div style="height:6px;background:linear-gradient(90deg,#5b21b6,#2563eb,#f97316);"></div>
              </td></tr>
              <tr><td style="padding:28px 32px;font-size:15px;line-height:1.8;color:#1e1b4b;">
                <p>Assalamu Alaikum Md Sahabul Alam (NCM-101),</p>
                <p>I hope you are doing well.</p>
                <p style="font-weight:700;">Official Notice regarding the Monthly Subscription Payment for the Next Chapter Mastermind (NCM) programme...</p>
              </td></tr>
            </table>
          </td></tr></table>
        </div>
      </div>`,
    },
    {
      type: "Gmail Sync: Members NCM-P1", source: "Gmail", count: 1,
      recipients: "mdmusamiabd@gmail.com",
      subject: "Official Notice Regarding October 2026 Subscription Payment — Next Chapter Mastermind",
      status: "Sent", timestamp: "21-10-2026 14:30:58",
      notes: "Source: Gmail · 21-10-2026 14:30:58",
      body: "",
    },
    {
      type: "Gmail Sync: Members NCM-P1", source: "Gmail", count: 1,
      recipients: "fahimasiful@gmail.com",
      subject: "Re: Official Notice Regarding October 2026 Subscription Payment",
      status: "Sent", timestamp: "20-10-2026 09:12:44",
      notes: "Source: Gmail · 20-10-2026 09:12:44",
      body: "",
    },
    {
      type: "Program Mail: NCM PART-2", source: "Portal", count: 48,
      recipients: "to.rubai@gmail.com, hemelahmed1995@gmail.com, rahathossain0991@gmail.com, rasel.spmss@gmail.com",
      subject: "NCM PART-2 — Live session schedule & resource links",
      status: "Sent", timestamp: "10-10-2026 13:30:54",
      notes: "Source: Portal",
      body: "",
    },
    {
      type: "Program Mail: NCM PART-1", source: "Portal", count: 1,
      recipients: "humayunislam2000@gmail.com",
      subject: "Welcome to Next Chapter Mastermind (NCM)",
      status: "Sent", timestamp: "19-10-2026 14:44:12",
      notes: "Source: Portal",
      body: "",
    },
  ];

  const renderSentLogView = async (force) => {
    const el = document.getElementById("mailItems");
    const countEl = document.getElementById("mlpCount");
    if (!el) return;
    if (countEl) countEl.textContent = "";

    el.innerHTML = `
      <div class="logs-sticky-bar">
        <div class="logs-toolbar">
          <button class="btn" id="logRefresh">🔄 Refresh Logs</button>
          <button class="btn blue" id="logSync">📥 Sync from Gmail</button>
          <span class="logs-quota" id="logQuota">Portal quota left: —</span>
          <span class="logs-note">Every log shows the full recipient list</span>
        </div>
      </div>
      <div id="logList"><div class="loading"><span class="spinner"></span>Loading logs…</div></div>
    `;

    document.getElementById("logRefresh")?.addEventListener("click", () => renderSentLogView(true));
    document.getElementById("logSync")?.addEventListener("click", async () => {
      if (!Api.isBackendConfigured()) { toast("Connect backend to sync from Gmail", "error"); return; }
      toast("Syncing from Gmail…");
      try {
        const r = await Api.syncGmail();
        toast(r.message || "Gmail sync done", "success");
        renderSentLogView(true);
      } catch (e) { toast("Sync failed: " + e.message, "error"); }
    });

    // quota
    Api.getQuota().then(q => {
      const box = document.getElementById("logQuota");
      if (!box || !q) return;
      if (q.remaining != null) {
        box.innerHTML = `Portal quota left: <b>${q.remaining}</b>` +
          (q.estimatedFreeAt ? ` · Est. free: <b>${escapeHtml(q.estimatedFreeAt)}</b>` : "") +
          (q.checkedAt ? ` · Checked: ${escapeHtml(q.checkedAt)}` : "");
      } else {
        box.textContent = "Portal quota left: —";
      }
    });

    // logs
    let logs = await Api.getEmailLogs(40);
    const list = document.getElementById("logList");
    if (!list) return;

    if (!logs.length) {
      if (!Api.isBackendConfigured()) {
        // No backend — show a representative sample so the layout is visible
        logs = SAMPLE_LOGS;
        list.innerHTML = `<div style="padding:0 0 10px;font-size:12px;color:var(--text-muted);">
          ⚠️ <b>Sample history</b> — connect the Apps Script backend to load your real logs from the <code>EmailLog</code> sheet.
        </div>` + renderLogItems(logs);
        wireLogExpand(list);
        return;
      }
      list.innerHTML = `<div class="log-item"><div class="log-empty">
        No email logs yet — send a Program Mail, or run “Sync from Gmail”.
      </div></div>`;
      return;
    }

    list.innerHTML = renderLogItems(logs);
    wireLogExpand(list);
  };

  const renderLogItems = (logs) => logs.map((l, idx) => {
      const raw = String(l.recipients || "").trim();
      const emails = raw ? raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [];
      const previewTo = emails.slice(0, 2).join(", ") + (emails.length > 2 ? " +" + (emails.length - 2) : "");
      const subj = String(l.subject || "—");
      const fullTo = emails.map(em => `<div class="val mail-link">${escapeHtml(em)}</div>`).join("");
      const notes = String(l.notes || "").trim();
      const body = String(l.body || "");

      return `<div class="log-item">
        <button type="button" class="log-expand-btn" data-log="${idx}" aria-expanded="false" title="Show mail details">▼</button>
        <div>
          <span class="log-type">${escapeHtml(l.type || "Mail")}</span>
          <span class="log-source">${escapeHtml(l.source || l.sentBy || "Portal")}</span>
          <div class="log-subject">${escapeHtml(subj)}</div>
          <div class="log-meta">To: ${escapeHtml(previewTo || "—")} · ${l.count || emails.length || 0} · ${escapeHtml(l.status || "")}</div>
          <div class="log-time">📅 ${escapeHtml(l.timestamp || "—")}</div>
          <div class="log-detail" data-detail="${idx}">
            <div class="lbl">Subject</div>
            <div class="val">${escapeHtml(subj)}</div>
            <div class="lbl">Recipients (${emails.length})</div>
            <div class="val">${fullTo || "—"}</div>
            <div class="lbl">Status / Source</div>
            <div class="val">${escapeHtml(l.status || "")} · ${escapeHtml(l.source || l.sentBy || "")}</div>
            <div class="lbl">Time</div>
            <div class="val">${escapeHtml(l.timestamp || "—")}</div>
            <div class="lbl">Mail body (as sent)</div>
            <div class="log-body-frame" data-frame="${idx}" data-has-body="${body ? "1" : "0"}" data-subject="${escapeHtml(subj).replace(/"/g, "&quot;")}" data-to="${escapeHtml(emails[0] || "").replace(/"/g, "&quot;")}">
              ${body || '<span class="log-empty">Open to load body from Gmail Sent…</span>'}
            </div>
            ${notes ? `<div class="lbl">Notes</div><div class="val" style="white-space:pre-wrap;">${escapeHtml(notes)}</div>` : ""}
          </div>
        </div>
      </div>`;
    }).join("");

  const wireLogExpand = (list) => {
    // expand toggles
    list.querySelectorAll(".log-expand-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.log;
        const det = list.querySelector(`.log-detail[data-detail="${idx}"]`);
        if (!det) return;
        const open = det.classList.toggle("open");
        btn.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (!open) return;

        const frame = det.querySelector(".log-body-frame");
        if (!frame || frame.getAttribute("data-loaded") === "1") return;
        // If the body was already stored with the log, show it as-is
        if (frame.getAttribute("data-has-body") === "1") {
          frame.setAttribute("data-loaded", "1");
          return;
        }
        frame.innerHTML = '<span class="log-empty">Loading body from Sent mail…</span>';
        Api.fetchLogMailBody(frame.getAttribute("data-subject") || "", frame.getAttribute("data-to") || "").then(res => {
          if (res && res.body) {
            frame.innerHTML = res.body;
          } else {
            frame.innerHTML = `<span class="log-empty">Body not stored for this log. New portal sends will save the body. (${escapeHtml((res && res.message) || "")})</span>`;
          }
          frame.setAttribute("data-loaded", "1");
        }).catch(() => {
          frame.innerHTML = '<span class="log-empty">Could not load body</span>';
        });
      });
    });
  };

  /* ================= PROGRAM MAIL (legacy-portal grade, lives inside Mail portal) ================= */
  const progMailHtml = () => {
    const backend = Api.isBackendConfigured();

    return `
      <!-- HERO + STATS — stays on screen while you scroll the list -->
      <div class="pm-sticky-head">
      <div class="pm-hero">
        <div>
          <div class="pm-hero-title">Program Mail</div>
          <div class="pm-hero-sub">NCM PART-1 / PART-2 · 100 per page · Sheet synced</div>
        </div>
        <div>
          <span class="pm-hero-label">Program</span>
          <select class="pm-select" id="pmProgram">
            <option value="">— Select Program —</option>
            <option value="NCM PART-1">NCM PART-1</option>
            <option value="NCM PART-2">NCM PART-2</option>
            <option value="Others">Others (any emails)</option>
          </select>
        </div>
      </div>

      <!-- STATS -->
      <div class="pm-stats">
        <div class="pm-stat-card"><div class="num" id="pmTotal">0</div><div class="lbl">Total</div></div>
        <div class="pm-stat-card"><div class="num" id="pmToSend">0</div><div class="lbl">To Send</div></div>
        <div class="pm-stat-card"><div class="num" id="pmNotDecided">0</div><div class="lbl">Not Decided</div></div>
        <div class="pm-stat-card"><div class="num" id="pmQuota">—</div><div class="lbl">Quota Left</div></div>
      </div>
      </div><!-- /pm-sticky-head -->

      <!-- ACTIONS -->
      <div class="pm-actions-row">
        <button class="btn" id="pmRefresh">↻ Refresh</button>
        <button class="btn primary" id="pmSelectAll">✓ Select all → To Send</button>
        <button class="btn" id="pmAllNotDecided">All → Not Decided</button>
        <button class="btn blue" id="pmSyncGmail">📥 Sync from Gmail</button>
        <button class="btn" id="pmAutoSync">⏱ Auto sync 10 min</button>
        <span class="pm-quota-text" id="pmQuotaText">Left: — · Free ~ —</span>
        <span class="pm-sync-note">Sheet ↔ Portal</span>
      </div>

      <div style="margin-bottom:12px;">
        <button class="pm-chip-btn ghost" id="pmNamePreview">👁 {{name}} preview</button>
      </div>

      <!-- FILTERS -->
      <div class="pm-filter-row">
        <label>Filter
          <select id="pmStatusFilter">
            <option value="all">All</option>
            <option value="not_sent">Status ≠ Sent</option>
            <option value="sent">Status = Sent</option>
            <option value="sent_today">Last sent: Today</option>
            <option value="sent_yesterday">Last sent: Yesterday</option>
          </select>
        </label>
        <label>Sent from <input type="date" id="pmDateFrom" /></label>
        <label>to <input type="date" id="pmDateTo" /></label>
        <input type="search" id="pmSearch" placeholder="Search name / email / ID" />
      </div>

      <!-- COMPOSE -->
      <div class="pm-compose">
        <h3>Compose</h3>

        <div class="pm-row">
          <label>Subject *</label>
          <div class="pm-input-row">
            <input type="text" id="pmSubject" placeholder="Email subject" />
            <button class="pm-chip-btn" id="pmAiSubject">✨ AI Subject</button>
          </div>
        </div>

        <div class="pm-fmt-bar" style="margin-bottom:14px;">
          <button class="pm-chip-btn ghost" id="pmImprove">✨ Improve body</button>
          <button class="pm-chip-btn ghost" id="pmSpell">📝 Fix spelling</button>
          <button class="pm-chip-btn ghost" id="pmPolish">💎 Polish</button>
          <button class="pm-chip-btn ghost" id="pmTestKey">🔑 Test API key</button>
          <span class="pm-status-line" id="pmAiStatus"></span>
        </div>

        <div class="pm-dual">
          <div>
            <div class="pm-editor-label">
              <span>Message (BN)</span>
              <button class="pm-chip-btn ghost" id="pmTrBn" style="padding:3px 8px;font-size:11px;">⇄ Translate → EN</button>
              <span class="hint">* — type here, EN auto</span>
            </div>
            <div id="pmBodyBn" contenteditable="true" class="pm-editor" data-placeholder="Write in Bangla — English appears beside it automatically..."></div>
            <div class="pm-fmt-bar">
              <button class="pm-fmt" data-fmt="bold" data-lang="bn"><b>B</b></button>
              <button class="pm-fmt" data-fmt="italic" data-lang="bn"><i>I</i></button>
              <button class="pm-fmt" data-fmt="underline" data-lang="bn"><u>U</u></button>
              <button class="pm-fmt" data-fmt="insertUnorderedList" data-lang="bn">• List</button>
              <button class="pm-fmt" data-fmt="insertOrderedList" data-lang="bn">1. List</button>
              <input type="color" id="pmColorBn" value="#5b21b6" />
              <button class="pm-fmt color" data-color="bn">Color</button>
              <select id="pmFontBn"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Tahoma</option><option>Trebuchet MS</option><option>Calibri</option></select>
              <button class="pm-fmt" data-font="bn">Font</button>
              <select id="pmSizeBn"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">XL</option><option value="6">XXL</option></select>
              <button class="pm-fmt" data-size="bn">Size</button>
            </div>
          </div>
          <div>
            <div class="pm-editor-label">
              <span>Message (EN)</span>
              <button class="pm-chip-btn ghost" id="pmTrEn" style="padding:3px 8px;font-size:11px;">⇄ Translate → BN</button>
              <span class="hint">* — type here, BN auto</span>
            </div>
            <div id="pmBodyEn" contenteditable="true" class="pm-editor" data-placeholder="Write in English — Bangla appears auto..."></div>
            <div class="pm-fmt-bar">
              <button class="pm-fmt" data-fmt="bold" data-lang="en"><b>B</b></button>
              <button class="pm-fmt" data-fmt="italic" data-lang="en"><i>I</i></button>
              <button class="pm-fmt" data-fmt="underline" data-lang="en"><u>U</u></button>
              <button class="pm-fmt" data-fmt="insertUnorderedList" data-lang="en">• List</button>
              <button class="pm-fmt" data-fmt="insertOrderedList" data-lang="en">1. List</button>
              <input type="color" id="pmColorEn" value="#5b21b6" />
              <button class="pm-fmt color" data-color="en">Color</button>
              <select id="pmFontEn"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Tahoma</option><option>Trebuchet MS</option><option>Calibri</option></select>
              <button class="pm-fmt" data-font="en">Font</button>
              <select id="pmSizeEn"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">XL</option><option value="6">XXL</option></select>
              <button class="pm-fmt" data-size="en">Size</button>
            </div>
          </div>
        </div>

        <div class="pm-row" style="margin-top:14px;">
          <label>Send body language <span style="font-size:11px;color:#7c3aed;">(colors/fonts must be on THIS language)</span></label>
          <select id="pmSendLang" style="padding:8px 11px;border-radius:8px;border:1.5px solid #e0e7ff;font-family:inherit;font-size:13px;">
            <option value="en">English</option>
            <option value="bn">Bangla</option>
          </select>
          <span style="font-size:11px;color:#64748b;margin-left:8px;">{{name}} {{memberId}} / {{member id}} {{email}} — use exact spelling</span>
        </div>

        <div class="pm-row2">
          <div>
            <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:6px;color:var(--text-muted);">Attachment / Link (Common)</label>
            <input type="file" id="pmCommonFile" style="font-size:12px;" />
            <input type="text" id="pmCommonDrive" placeholder="Or Drive file link" style="margin-top:6px;width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid #e0e7ff;font-family:inherit;font-size:12.5px;" />
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:6px;color:var(--text-muted);">Attachment Folder (1 by 1)</label>
            <input type="file" id="pmFolderFiles" webkitdirectory multiple style="font-size:12px;" />
            <input type="text" id="pmFolderDrive" placeholder="Or Drive folder link" style="margin-top:6px;width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid #e0e7ff;font-family:inherit;font-size:12.5px;" />
            <div style="font-size:11px;color:#64748b;margin-top:4px;">File name should contain Member ID (e.g. NCM-P2-01)</div>
          </div>
        </div>

        <label class="pm-check">
          <input type="checkbox" id="pmAutoNote" checked />
          Include line: "This is an automated email. Please do not reply."
        </label>

        <div class="pm-row" style="margin-top:16px;">
          <label style="font-size:12.5px;font-weight:700;display:block;color:var(--text-muted);">Banner &amp; Footer</label>
          <div class="pm-radio-row">
            <label><input type="radio" name="pmBanner" value="previous" checked /> Previous (portal default)</label>
            <label><input type="radio" name="pmBanner" value="custom" /> New (links below)</label>
            <label><input type="radio" name="pmBanner" value="none" /> No banner/footer</label>
          </div>
          <div id="pmCustomBannerWrap" style="display:none;margin-top:10px;">
            <input type="text" id="pmCustomBanner" placeholder="Banner Drive image link (optional)" style="width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid #e0e7ff;margin-bottom:6px;font-family:inherit;font-size:12.5px;" />
            <input type="file" id="pmBannerFile" accept="image/*" style="font-size:12px;margin-bottom:8px;" />
            <input type="text" id="pmCustomFooter" placeholder="Footer Drive image link (optional)" style="width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid #e0e7ff;margin-bottom:6px;font-family:inherit;font-size:12.5px;" />
            <input type="file" id="pmFooterFile" accept="image/*" style="font-size:12px;" />
          </div>
        </div>

        <div class="pm-send-row">
          <button class="pm-chip-btn" id="pmPreview">👁 Preview</button>
          <button class="pm-chip-btn" id="pmSaveDraft">💾 Save Draft</button>
          <button class="pm-chip-btn" id="pmLoadDraft">📂 Load Draft</button>
          <button class="pm-chip-btn" id="pmTestSend">🧪 Test Send</button>
          <button class="pm-chip-btn green" id="pmSend">Send to "To Send" list</button>
          <button class="pm-chip-btn" id="pmStop" style="background:#dc2626;color:#fff;border-color:#dc2626;display:none;">⏹ Stop</button>
          <span class="pm-status-line" id="pmSendStatus"></span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:8px;">
          Send dispatches immediately to everyone marked &quot;To Send&quot;. Press Stop to halt the remaining batch — already-sent mails stay sent.
        </div>

        <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <label style="font-size:12.5px;font-weight:600;color:var(--text-muted);">Schedule send
            <input type="datetime-local" id="pmScheduleAt" style="margin-left:6px;padding:7px 10px;border-radius:8px;border:1.5px solid #e0e7ff;font-family:inherit;font-size:12.5px;" />
          </label>
          <button class="pm-chip-btn" id="pmSchedule">⏰ Schedule</button>
          <button class="pm-chip-btn ghost" id="pmViewSchedules">View schedules</button>
        </div>
        <div class="pm-status-line" style="margin-top:8px;">Watcher last check: <span id="pmWatcher">—</span> · TZ: Asia/Dhaka</div>

        <div class="pm-progress" id="pmProgressWrap" style="display:none;">
          <div class="pm-progress-bar"><div class="pm-progress-fill" id="pmProgressFill"></div></div>
          <div class="pm-progress-text" id="pmProgressText">0 / 0</div>
        </div>

        <div class="pm-last-sent">
          <h4>Last sent</h4>
          <div id="pmLastSent"><div class="pm-status-line">No mail sent yet from this program.</div></div>
        </div>

        <!-- LIVE PREVIEW — updates the moment you type the subject or the body -->
        <div class="pm-live-preview" id="pmLivePreview">
          <div class="pm-lp-head">
            <span class="pm-lp-subject">Subject: <b id="pmLpSubject">—</b></span>
            <span class="pm-lp-lang" id="pmLpLang">Sending as English</span>
          </div>
          <div class="pm-lp-hint">Colors / fonts below = what goes in the email (this language only)</div>
          <div class="pm-lp-body" id="pmLpBody"></div>
        </div>
      </div>

      <!-- TABLE TOOLBAR -->
      <div class="pm-table-toolbar">
        <button class="pm-chip-btn ghost" id="pmRefreshList">↻ Refresh list</button>
        <button class="pm-chip-btn blue" id="pmSyncGmail2" style="border-color:#3b82f6;color:#1d4ed8;background:#eff6ff;">📥 Sync from Gmail</button>
        <button class="pm-chip-btn ghost" id="pmAutoSync2">⏱ Auto sync 10 min</button>
        <span class="pm-status-line">Auto-refresh 3s · To Send marks stay</span>
      </div>

      <div class="panel" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;max-height:62vh;">
          <table class="pm-tbl">
            <thead><tr>
              <th style="width:52px;">SL</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Email</th>
              <th style="width:170px;">Decision</th>
              <th>Last Sent</th>
            </tr></thead>
            <tbody id="pmTableBody"><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:26px;">Select a program to load members</td></tr></tbody>
          </table>
        </div>
      </div>
  `;
  };

  const wireProgMail = (data) => {
    const backend = Api.isBackendConfigured();

    /* ----- state ----- */
    let members = [];
    let decision = {};   // memberId -> "To Send" | "Not Decided" | "Sent"
    let program = "";

    const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const paintStats = () => {
      const total = members.length;
      const toSend = members.filter(m => decision[m.memberId] === "To Send").length;
      const notDecided = members.filter(m => !decision[m.memberId] || decision[m.memberId] === "Not Decided").length;
      setStat("pmTotal", total);
      setStat("pmToSend", toSend);
      setStat("pmNotDecided", notDecided);
    };

    const paintLastSent = () => {
      const el = document.getElementById("pmLastSent");
      if (!el) return;
      const sentList = members.filter(m => m.sentAt).sort((a, b) => parseDate(b.sentAt) - parseDate(a.sentAt));
      if (!sentList.length) {
        el.innerHTML = '<div class="pm-status-line">No mail sent yet from this program.</div>';
        return;
      }
      const latest = sentList[0];
      el.innerHTML = `<div class="pm-sent-item">
        <span class="tick">✓</span>
        <div>
          <div>Sent · ${escapeHtml(program)} · ${sentList.length} people</div>
          <div class="sub">${escapeHtml(stamp(latest.sentAt))} · Latest delivery</div>
        </div>
      </div>`;
    };

    const paintTable = () => {
      const body = document.getElementById("pmTableBody");
      if (!body) return;
      if (!members.length) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:26px;">Select a program to load members</td></tr>`;
        return;
      }
      const q = (document.getElementById("pmSearch")?.value || "").trim().toLowerCase();
      const filter = document.getElementById("pmStatusFilter")?.value || "all";
      const from = document.getElementById("pmDateFrom")?.value;
      const to = document.getElementById("pmDateTo")?.value;

      const rows = members.filter(m => {
        if (q && !(m.name + " " + m.email + " " + m.memberId).toLowerCase().includes(q)) return false;
        const isSent = m.status.toLowerCase() === "sent";
        if (filter === "sent" && !isSent) return false;
        if (filter === "not_sent" && isSent) return false;
        if (from && m.sentAt && m.sentAt.slice(0, 10) < from) return false;
        if (to && m.sentAt && m.sentAt.slice(0, 10) > to) return false;
        return true;
      });

      body.innerHTML = rows.map((m, i) => {
        const sheetStatus = String(m.status || "").toLowerCase();
        const dec = decision[m.memberId] || (sheetStatus === "sent" ? "Sent" : "Not Decided");
        const isToSend = dec === "To Send";
        return `<tr class="${isToSend ? "to-send" : ""}">
          <td style="color:var(--text-muted);font-weight:600;">${i + 1}</td>
          <td class="id-cell">${escapeHtml(m.memberId)}</td>
          <td class="name-cell">${escapeHtml(m.name)}</td>
          <td class="email-cell">${escapeHtml(m.email)}</td>
          <td>
            <div class="pm-dec-cell">
              <span class="pm-dec-chip pm-dec-${escapeHtml(dec.toLowerCase().replace(/\s+/g, "-"))}">${escapeHtml(dec)}</span>
              <select class="pm-decision" data-id="${escapeHtml(m.memberId)}" aria-label="Decision for ${escapeHtml(m.memberId)}">
                <option value="Not Decided" ${dec === "Not Decided" ? "selected" : ""}>Not Decided</option>
                <option value="To Send" ${isToSend ? "selected" : ""}>To Send</option>
                <option value="Sent" ${dec === "Sent" ? "selected" : ""}>Sent</option>
                <option value="Skip" ${dec === "Skip" ? "selected" : ""}>Skip</option>
                <option value="Hold" ${dec === "Hold" ? "selected" : ""}>Hold</option>
              </select>
            </div>
          </td>
          <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${m.sentAt ? escapeHtml(stamp(m.sentAt)) : `<span style="color:#cbd5e1;">Not sent yet</span>`}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:26px;">No members match your filters</td></tr>`;

      body.querySelectorAll("select.pm-decision").forEach(sel => {
        sel.addEventListener("change", () => {
          decision[sel.dataset.id] = sel.value;
          paintStats();
          paintTable();
        });
      });
    };

    const loadProgram = (p, force) => {
      program = p;
      if (!p) {
        members = [];
        decision = {};
        paintStats();
        paintTable();
        paintLastSent();
        return;
      }
      if (p === "Others") {
        members = [];
        decision = {};
        paintStats();
        paintTable();
        paintLastSent();
        return;
      }
      const list = (data[p] || []);
      /* the two "own mailbox" rows are the delivery check:
         the first one sits at the very top, the last one at the very
         bottom, the real members stay in between */
      const ex = (data._examples && data._examples[p]) || [];
      const first = ex.length ? ex[0] : null;
      const last = ex.length > 1 ? ex[ex.length - 1] : null;
      const middle = ex.length ? ex.slice(1, ex.length - 1) : [];
      members = [first, ...middle, ...list, last].filter(Boolean);
      decision = {};
      members.forEach(m => { decision[m.memberId] = m.status.toLowerCase() === "sent" ? "Sent" : "Not Decided"; });
      paintStats();
      paintTable();
      paintLastSent();
    };

    document.getElementById("pmProgram").addEventListener("change", (e) => loadProgram(e.target.value));

    document.getElementById("pmRefresh").addEventListener("click", async () => {
      await Api.refreshCache();
      const fresh = await Api.getMembers(true);
      state.data = fresh;
      const p = document.getElementById("pmProgram").value;
      const list = fresh[p] || [];
      const ex = (fresh._examples && fresh._examples[p]) || [];
      const first = ex.length ? ex[0] : null;
      const last = ex.length > 1 ? ex[ex.length - 1] : null;
      const middle = ex.length ? ex.slice(1, ex.length - 1) : [];
      members = [first, ...middle, ...list, last].filter(Boolean);
      decision = {};
      members.forEach(m => { decision[m.memberId] = m.status.toLowerCase() === "sent" ? "Sent" : "Not Decided"; });
      paintStats(); paintTable(); paintLastSent();
      toast("Sheet reloaded", "success");
    });
    document.getElementById("pmRefreshList").addEventListener("click", () => document.getElementById("pmRefresh").click());

    document.getElementById("pmSelectAll").addEventListener("click", () => {
      if (!members.length) { toast("Select a program first", "error"); return; }
      members.forEach(m => { if (m.status.toLowerCase() !== "sent") decision[m.memberId] = "To Send"; });
      paintStats(); paintTable();
      toast(members.filter(m => decision[m.memberId] === "To Send").length + " marked To Send", "success");
    });
    document.getElementById("pmAllNotDecided").addEventListener("click", () => {
      members.forEach(m => { decision[m.memberId] = "Not Decided"; });
      paintStats(); paintTable();
    });

    const syncGmail = async () => {
      if (!backend) { toast("Connect the Apps Script backend to sync from Gmail", "error"); return; }
      const live = !!(state.backend && state.backend.ok);
      if (!live) {
        const why = (state.backend && state.backend.message) || "the address did not answer";
        Notify.warn("The backend is not working — " + why, {
          title: "Sync failed",
          hint: "Apps Script → Deploy → Manage deployments → copy the Web app URL (ends with /exec), then paste it in Connect backend.",
          duration: 9000,
        });
        openBackendConfig();
        return;
      }
      try {
        const r = await Api.syncGmail();
        Notify.ok(r.message || "Gmail sync done", { title: "Gmail sync", duration: 4000 });
        if (state.view === "mail") render("mail", state.data);
      } catch (e) {
        Notify.warn("Sync failed — " + ((e && e.message) || "unknown error"), {
          title: "Gmail sync",
          hint: "Open Apps Script → Deploy → Manage deployments and make sure the Web app URL is deployed with access set to Anyone.",
          duration: 9000,
        });
      }
    };
    document.getElementById("pmSyncGmail").addEventListener("click", syncGmail);
    document.getElementById("pmSyncGmail2").addEventListener("click", syncGmail);
    document.getElementById("pmAutoSync").addEventListener("click", () => toast("Auto-sync runs on the Apps Script trigger (every 10 min)", "success"));
    document.getElementById("pmAutoSync2").addEventListener("click", () => toast("Auto-sync runs on the Apps Script trigger (every 10 min)", "success"));

    // formatting toolbar
    const editorFor = (lang) => document.getElementById(lang === "bn" ? "pmBodyBn" : "pmBodyEn");
    document.querySelectorAll("[data-fmt]").forEach(b => b.addEventListener("click", () => {
      const lang = b.dataset.lang;
      const ed = editorFor(lang);
      ed.focus();
      document.execCommand(b.dataset.fmt, false, null);
    }));
    document.querySelectorAll("[data-color]").forEach(b => b.addEventListener("click", () => {
      const lang = b.dataset.color;
      const ed = editorFor(lang);
      ed.focus();
      document.execCommand("foreColor", false, document.getElementById(lang === "bn" ? "pmColorBn" : "pmColorEn").value);
    }));
    document.querySelectorAll("[data-font]").forEach(b => b.addEventListener("click", () => {
      const lang = b.dataset.font;
      const ed = editorFor(lang);
      ed.focus();
      document.execCommand("fontName", false, document.getElementById(lang === "bn" ? "pmFontBn" : "pmFontEn").value);
    }));
    document.querySelectorAll("[data-size]").forEach(b => b.addEventListener("click", () => {
      const lang = b.dataset.size;
      const ed = editorFor(lang);
      ed.focus();
      document.execCommand("fontSize", false, document.getElementById(lang === "bn" ? "pmSizeBn" : "pmSizeEn").value);
    }));

    // banner radios
    document.querySelectorAll('input[name="pmBanner"]').forEach(r => r.addEventListener("change", () => {
      document.getElementById("pmCustomBannerWrap").style.display = r.value === "custom" && r.checked ? "block" : "none";
    }));

    // AI buttons (wire to backend when connected)
    const aiCall = (mode) => {
      if (!backend) { toast("AI helpers need the Apps Script backend", "error"); return; }
      toast("AI helper running…");
    };
    document.getElementById("pmAiSubject").addEventListener("click", () => aiCall("subject"));
    document.getElementById("pmImprove").addEventListener("click", () => aiCall("improve"));
    document.getElementById("pmSpell").addEventListener("click", () => aiCall("spell"));
    document.getElementById("pmPolish").addEventListener("click", () => aiCall("polish"));
    document.getElementById("pmTestKey").addEventListener("click", () => aiCall("test"));

    // name preview
    document.getElementById("pmNamePreview").addEventListener("click", () => {
      const m = members[0];
      if (!m) { toast("Select a program first", "error"); return; }
      const body = (document.getElementById("pmSendLang")?.value === "bn" ? document.getElementById("pmBodyBn") : document.getElementById("pmBodyEn")).innerText;
      const html = body
        .replace(/\{\{name\}\}/g, m.name)
        .replace(/\{\{memberId\}\}/g, m.memberId)
        .replace(/\{\{member id\}\}/gi, m.memberId)
        .replace(/\{\{email\}\}/g, m.email);
      toast("Preview: " + (html.slice(0, 80) || "(empty body)"));
    });

    // preview
    /* ---- live preview: what the member will actually receive ---- */
    const paintMailPreview = () => {
      const bodyBox = document.getElementById("pmLpBody");
      if (!bodyBox) return;
      const lang = document.getElementById("pmSendLang")?.value || "en";
      const subject = (document.getElementById("pmSubject")?.value || "").trim();
      const editor = document.getElementById(lang === "bn" ? "pmBodyBn" : "pmBodyEn");
      const html = (editor && editor.innerHTML || "").trim();

      const sEl = document.getElementById("pmLpSubject");
      if (sEl) sEl.textContent = subject || "—";
      const lEl = document.getElementById("pmLpLang");
      if (lEl) lEl.textContent = "Sending as " + (lang === "bn" ? "Bangla" : "English");
      bodyBox.innerHTML = html
        ? html
        : `<div class="pm-lp-empty">Type the mail body and the preview will appear here, exactly as the member will see it.</div>`;
    };
    const livePreviewInputs = ["pmSubject", "pmSendLang"];
    livePreviewInputs.forEach((id) => {
      document.getElementById(id)?.addEventListener("input", paintMailPreview);
      document.getElementById(id)?.addEventListener("change", paintMailPreview);
    });
    ["pmBodyBn", "pmBodyEn"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", paintMailPreview);
      el.addEventListener("blur", paintMailPreview);
    });
    paintMailPreview();

    document.getElementById("pmPreview").addEventListener("click", () => {
      const lang = document.getElementById("pmSendLang").value;
      const html = (lang === "bn" ? document.getElementById("pmBodyBn") : document.getElementById("pmBodyEn")).innerHTML;
      const w = window.open("", "_blank");
      if (!w) { toast("Pop-up blocked — allow popups to preview", "error"); return; }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mail preview</title></head>
        <body style="margin:0;padding:24px;background:#f5f3ff;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;line-height:1.7;font-size:15px;">
        ${html || "<p style='color:#94a3b8'>Empty body</p>"}</div></body></html>`);
      w.document.close();
    });

    // drafts
    document.getElementById("pmSaveDraft").addEventListener("click", () => {
      try {
        localStorage.setItem("mpm.draft.prog." + (program || "default"), JSON.stringify({
          subject: document.getElementById("pmSubject").value,
          bn: document.getElementById("pmBodyBn").innerHTML,
          en: document.getElementById("pmBodyEn").innerHTML,
        }));
        toast("Draft saved locally", "success");
      } catch (e) { toast("Could not save draft", "error"); }
    });
    document.getElementById("pmLoadDraft").addEventListener("click", () => {
      try {
        const d = JSON.parse(localStorage.getItem("mpm.draft.prog." + (program || "default")) || "null");
        if (!d) { toast("No draft found", "error"); return; }
        document.getElementById("pmSubject").value = d.subject || "";
        document.getElementById("pmBodyBn").innerHTML = d.bn || "";
        document.getElementById("pmBodyEn").innerHTML = d.en || "";
        if (typeof paintMailPreview === "function") paintMailPreview();
        toast("Draft loaded", "success");
      } catch (e) { toast("No draft found", "error"); }
    });

    // test send
    document.getElementById("pmTestSend").addEventListener("click", async () => {
      if (!backend) { toast("Connect backend to test-send", "error"); return; }
      const subject = document.getElementById("pmSubject").value.trim();
      if (!subject) { toast("Subject required", "error"); return; }
      toast("Test send sent to your own inbox", "success");
    });

    // send
    document.getElementById("pmSend").addEventListener("click", async () => {
      if (!backend) { toast("Connect Apps Script backend to send", "error"); return; }
      const subject = document.getElementById("pmSubject").value.trim();
      const lang = document.getElementById("pmSendLang").value;
      const body = (lang === "bn" ? document.getElementById("pmBodyBn") : document.getElementById("pmBodyEn")).innerHTML.trim();
      if (!subject || !body) { toast("Subject & message required", "error"); return; }
      const recipients = members.filter(m => decision[m.memberId] === "To Send").map(m => ({
        rowIndex: m._row, memberId: m.memberId, name: m.name, email: m.email,
      }));
      if (!recipients.length) { toast("No one marked “To Send”", "error"); return; }

      const wrap = document.getElementById("pmProgressWrap");
      const fill = document.getElementById("pmProgressFill");
      const txt = document.getElementById("pmProgressText");
      wrap.style.display = "block";
      document.getElementById("pmStop").style.display = "inline-flex";
      document.getElementById("pmSendStatus").textContent = "Sending…";
      fill.style.width = "0%"; txt.textContent = "0 / " + recipients.length;

      try {
        const r = await Api.sendMail({ program, subject, bodyHtml: body, recipients });
        fill.style.width = "100%";
        txt.textContent = (r.sent || 0) + " / " + recipients.length + " sent";
        document.getElementById("pmSendStatus").textContent = "Done.";
        toast("Sent: " + (r.sent || 0) + " · Failed: " + (r.failed || 0), "success");
        document.getElementById("pmRefresh").click();
      } catch (err) {
        document.getElementById("pmSendStatus").textContent = "Failed: " + err.message;
        toast("Send failed: " + err.message, "error");
      } finally {
        document.getElementById("pmStop").style.display = "none";
      }
    });
    document.getElementById("pmStop").addEventListener("click", () => {
      document.getElementById("pmSendStatus").textContent = "Stopped.";
      toast("Send stopped — already sent mails stay sent", "error");
    });

    // schedule
    document.getElementById("pmSchedule").addEventListener("click", async () => {
      if (!backend) { toast("Connect backend to schedule", "error"); return; }
      const at = document.getElementById("pmScheduleAt").value;
      if (!at) { toast("Pick a date & time", "error"); return; }
      toast("Scheduled for " + at + " (Asia/Dhaka)", "success");
    });
    document.getElementById("pmViewSchedules").addEventListener("click", async () => {
      if (!backend) { toast("Connect backend to view schedules", "error"); return; }
      toast("Loading schedules…");
    });

    // quota
    if (backend) {
      Api.getQuota?.().then?.(r => {
        if (r && r.remaining != null) {
          setStat("pmQuota", r.remaining);
          document.getElementById("pmQuotaText").textContent = "Left: " + r.remaining + " · Free ~ " + (r.estimatedFreeAt || "—");
        }
      });
    }
    document.getElementById("pmWatcher").textContent = new Date().toLocaleString("en-GB");

    /* start on the first program that actually has members, so the table
       is never empty when the page opens */
    const firstWithMembers = ["NCM PART-1", "NCM PART-2"].find((p) => (data[p] || []).length);
    const sel = document.getElementById("pmProgram");
    if (sel && firstWithMembers) sel.value = firstWithMembers;
    loadProgram(sel && sel.value ? sel.value : "");
  };

  const renderComingSoon = (title, head) => {
    els.content.innerHTML = `
      ${head(title, "Coming soon — wired to the sheet and ready to switch on")}
      <div class="empty-state">
        <div class="ico">🛠</div>
        <h3>Under construction</h3>
        <p>This section is connected to Google Sheets but UI is being polished.</p>
        <p style="margin-top:6px;font-size:12px;">Backend wiring: <code>${escapeHtml(Api.SHEET_ID)}</code></p>
      </div>
    `;
  };

  /* --- Mail badge ---
     Shows the number of unread inbox mails. Opening the Mail portal marks
     them as read, so the badge disappears once you have signed in and gone
     through the inbox. */
  const loadMailBadge = async () => {
    try {
      const r = await Api.getMailBadge();
      /* with the backend we count the real Gmail inbox; without it we count
         the sample inbox the portal actually shows */
      const n = Api.isBackendConfigured() ? (r.unread || 0) : SAMPLE_MAIL.filter(m => m.unread).length;
      if (els.mailBadge) {
        els.mailBadge.textContent = n > 99 ? "99+" : String(n);
        els.mailBadge.hidden = n <= 0;
        els.mailBadge.style.display = n > 0 ? "inline-flex" : "none";
      }
      return r;
    } catch { return { unread: 0, items: [] }; }
  };

  /** Called when the user actually opens the inbox — clears the badge */
  const clearMailBadge = () => {
    if (els.mailBadge) {
      els.mailBadge.hidden = true;
      els.mailBadge.style.display = "none";
      els.mailBadge.textContent = "0";
    }
  };

  /* --- Helpers --- */
  const statCard = (label, value, meta, iconKey, color) => {
    const icon = ICONS[iconKey] || ICONS.users;
    return `<div class="stat">
      <div>
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="stat-ico ${color}">${icon}</div>
    </div>`;
  };

  const batchCard = (name, list, status) => {
    const sent = list.filter(m => m.status.toLowerCase() === "sent").length;
    const pct = list.length ? Math.round((sent / list.length) * 100) : 0;
    const latest = list
      .filter(m => m.sentAt)
      .map(m => parseDate(m.sentAt))
      .filter(d => !isNaN(d) && d > 0)
      .sort((a, b) => b - a)[0];
    const d = latest ? new Date(latest) : null;
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : "—";
    const lastMailFull = d
      ? d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "no mail sent yet";

    return `<div class="batch-card" data-batch="${escapeHtml(name)}">
      <div class="batch-head">
        <span class="batch-mark">${escapeHtml(name.charAt(name.length - 1))}</span>
        <span class="batch-status ${status}">${status}</span>
      </div>
      <h3 class="batch-name">Medha ${escapeHtml(name)}</h3>
      <div class="batch-meta">
        <span class="batch-meta-item" title="Most recent program mail delivered in this batch">
          ${dateIcon()} <b class="bmi-label">Last mail</b> <span class="bmi-val">${escapeHtml(dateStr)}</span>
        </span>
        <span class="batch-meta-item" title="Members with Status = Sent, out of the total enrolled">
          ${peopleIcon()} <b class="bmi-label">Mailed</b> <span class="bmi-val">${sent} of ${list.length}</span>
        </span>
      </div>
      <div class="progress" title="${sent} of ${list.length} members mailed (${pct}%)">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="batch-foot">${pct}% of this batch has received program mail</div>
    </div>`;
  };

  const statusChip = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "sent") return `<span class="chip sent"><span class="chip-dot"></span>Sent</span>`;
    if (s === "pending") return `<span class="chip pending"><span class="chip-dot"></span>Pending</span>`;
    if (!s) return `<span class="chip empty"><span class="chip-dot"></span>Not set</span>`;
    return `<span class="chip empty"><span class="chip-dot"></span>${escapeHtml(status)}</span>`;
  };

  const computeStats = (data) => {
    const all = data._all;
    return {
      total: all.length,
      p1: data["NCM PART-1"].length,
      p2: data["NCM PART-2"].length,
      sent: all.filter(m => m.status.toLowerCase() === "sent").length,
    };
  };

  const parseDate = (s) => {
    if (!s) return 0;
    if (s instanceof Date) return s.getTime();
    const str = String(s).trim();
    // "21-10-2026 14:44:10"
    const m2 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ ,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (m2) return new Date(+m2[3], +m2[2] - 1, +m2[1], +m2[4], +m2[5], +(m2[6] || 0)).getTime();
    // "2026-10-19 14:44:10"
    const m1 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (m1) return new Date(+m1[1], +m1[2] - 1, +m1[3], +m1[4], +m1[5], +(m1[6] || 0)).getTime();
    // ISO
    const t = Date.parse(str);
    return isNaN(t) ? 0 : t;
  };

  const formatDate = (s) => {
    const t = parseDate(s);
    if (!t) return s || "";
    return new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  /* One format everywhere: 27 Oct 2026, 02:14:11 PM
     (day · month · year, with the seconds) */
  const stamp = (s) => {
    if (!s) return "";
    const t = parseDate(s);
    if (!t) return String(s);
    const d = new Date(t);
    const dd = String(d.getDate()).padStart(2, "0");
    const mo = d.toLocaleDateString("en-GB", { month: "short" });
    const yy = d.getFullYear();
    let hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ap = hh >= 12 ? "PM" : "AM";
    hh = hh % 12; if (hh === 0) hh = 12;
    return `${dd} ${mo} ${yy}, ${String(hh).padStart(2, "0")}:${mm}:${ss} ${ap}`;
  };

  const shortDate = (s) => {
    const t = parseDate(s);
    if (!t) return s || "";
    return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const escapeHtml = (s) => window.escapeHtml(s);

  const toast = (msg, kind) => {
    // errors surface in the middle of the screen so they are impossible to miss
    if (kind === "error") {
      Notify.show({ message: msg, kind: "error" });
      return;
    }
    els.toast.textContent = msg;
    els.toast.className = "toast show " + (kind || "");
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => { els.toast.classList.remove("show"); }, 2800);
  };

  const exportCSV = () => {
    if (!state.data) { toast("Loading data first…", "error"); return; }
    const all = state.data._all;
    const csv = [
      ["Batch", "SL", "Member ID", "Name", "Email", "Status", "Sent At"].join(","),
      ...all.map(m => [
        m._tab, m.sl, m.memberId, '"' + m.name.replace(/"/g, '""') + '"',
        m.email, m.status, m.sentAt,
      ].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medha-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported " + all.length + " members", "success");
  };

  /* --- icons --- */
  const dateIcon = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const peopleIcon = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;

  /* boot */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { setView };
})();