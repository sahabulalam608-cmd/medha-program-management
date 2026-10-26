/* === Password Vault — rotating dial unlock === */
/*
 * A combination-lock style gate for the settings area.
 *   • a metal dial with SVG teeth you drag to turn
 *   • the active digit shows in the hub
 *   • the combination shows as four blocks
 *   • typing works too (the masked field stays in sync)
 *   • the right code swings the door open
 */

const Vault = (() => {
  const SVGNS = "http://www.w3.org/2000/svg";
  let overlay = null;
  let code = ["", "", "", ""];
  let active = 0;
  let onSuccess = null;
  let angle = 0;          // current dial rotation in degrees
  let dragging = false;
  let startAngle = 0;
  let startDial = 0;
  let lastStep = 0;
  let els = {};

  /* ---------- svg helpers ---------- */
  const mk = (tag, attrs) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  /** Teeth arranged around the dial — same idea as the reference buildTeeth() */
  const buildTeeth = (g, count, inner, outer, w) => {
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    for (let i = 0; i < count; i++) {
      const r = mk("rect", {
        class: "vdp-tooth",
        x: String(-w / 2),
        y: String(-outer),
        width: String(w),
        height: String(outer - inner + 1),
        rx: "1.5",
        transform: "rotate(" + (i * 360 / count) + ")",
      });
      g.appendChild(r);
    }
  };

  /* ---------- render ---------- */
  const paintDigits = () => {
    // the value is NEVER shown here — only whether a digit is set
    els.digits.innerHTML = code.map((d, i) => `
      <div class="vault-digit ${d !== "" ? "filled" : ""} ${i === active ? "active" : ""}" data-i="${i}" title="Digit ${i + 1}">${d === "" ? "\u00b7" : "\u2022"}</div>
    `).join("");
    els.digits.querySelectorAll(".vault-digit").forEach(el => {
      el.addEventListener("click", () => {
        active = parseInt(el.dataset.i, 10);
        paintDigits();
        paintDial();
      });
    });
  };

  const paintDial = () => {
    els.rotor.setAttribute("transform", `rotate(${angle})`);
    // the digit is visible only while the wheel is being turned — otherwise it
    // is masked so nobody can read the combination over your shoulder
    const reveal = dragging;
    els.readout.textContent = reveal
      ? (code[active] === "" ? "0" : code[active])
      : "\u2022";
    els.readout.classList.toggle("masked", !reveal);
    if (els.cap) els.cap.textContent = "DIGIT " + (active + 1) + " / 4";
  };

  const paintCode = () => {
    const str = code.join("");
    els.input.value = str;
    els.input.setAttribute("data-mask", str);
    els.digits.classList.toggle("error", false);
  };

  /* ---------- dial interaction ---------- */
  const angleAt = (ev) => {
    const r = els.dial.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - cx;
    const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - cy;
    return Math.atan2(y, x) * 180 / Math.PI;
  };

  const onDown = (ev) => {
    dragging = true;
    startAngle = angleAt(ev);
    startDial = angle;
    lastStep = 0;
    els.dial.classList.add("dragging");
    els.dial.setPointerCapture?.(ev.pointerId);
    paintDial();                       // reveal the digit while turning
    ev.preventDefault();
  };

  const onMove = (ev) => {
    if (!dragging) return;
    const a = angleAt(ev);
    let delta = a - startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    angle = startDial + delta;

    // one step (30°) = one digit increment
    const STEP = 30;
    const step = Math.round(delta / STEP);
    if (step !== lastStep) {
      const dir = step > lastStep ? 1 : -1;
      for (let i = lastStep; i !== step; i += dir) bumpDigit(dir);
      lastStep = step;
    }
    els.rotor.setAttribute("transform", `rotate(${angle})`);
    ev.preventDefault();
  };

  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    els.dial.classList.remove("dragging");
    try { els.dial.releasePointerCapture?.(ev.pointerId); } catch (e) {}
    paintDial();                       // mask the readout again
  };

  const bumpDigit = (dir) => {
    const cur = code[active] === "" ? 0 : parseInt(code[active], 10);
    let next = (cur + dir) % 10;
    if (next < 0) next += 10;
    code[active] = String(next);
    paintCode();
    paintDigits();
    paintDial();
    const el = els.digits.querySelector(`.vault-digit[data-i="${active}"]`);
    if (el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  };

  /* ---------- unlock ---------- */
  const tryUnlock = () => {
    const entered = code.join("");
    const want = String(Api.SETTINGS_PASSWORD || "2026");
    if (entered === want) {
      els.door.classList.add("open");
      overlay.classList.add("opening");
      setTimeout(() => {
        overlay.classList.add("closing");
        setTimeout(() => { overlay?.remove(); overlay = null; }, 300);
      }, 700);
      setTimeout(() => { onSuccess?.(); }, 750);
    } else {
      els.door.classList.remove("deny");
      void els.door.offsetWidth;
      els.door.classList.add("deny");
      els.door.classList.add("shake");
      els.error.textContent = "Combination rejected.";
      els.error.classList.add("show");
      els.digits.classList.add("error");
      setTimeout(() => {
        els.door.classList.remove("shake");
        els.digits.classList.remove("error");
      }, 700);
      // scramble the wheels a little
      setTimeout(() => {
        code = code.map(() => String(Math.floor(Math.random() * 10)));
        paintCode(); paintDigits(); paintDial();
      }, 500);
    }
  };

  /* ---------- open ---------- */
  const open = (successCb) => {
    onSuccess = successCb;
    code = ["", "", "", ""];
    active = 0;
    angle = 0;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="vault-overlay" id="vaultOverlay">
        <div class="vault-door" id="vaultDoor">
          <span class="screw tl"></span><span class="screw tr"></span>
          <span class="screw bl"></span><span class="screw br"></span>

          <div class="vault-label">Vault Code</div>
          <div class="vault-digits" id="vaultDigits"></div>

          <div class="vault-code-row">
            <div class="vault-code">
              <svg class="vc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input id="vaultInput" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" spellcheck="false" />
              <span class="vc-hint">type or turn</span>
            </div>
          </div>

          <div class="vault-dial-row">
            <div class="vault-dial" id="vaultDial">
              <svg viewBox="-100 -100 200 200">
                <defs>
                  <radialGradient id="vdpHub" cx="40%" cy="32%">
                    <stop offset="0%" stop-color="#5d4f75"/>
                    <stop offset="60%" stop-color="#2e2545"/>
                    <stop offset="100%" stop-color="#1b1330"/>
                  </radialGradient>
                </defs>
                <circle class="vdp-ring" cx="0" cy="0" r="94"/>
                <g id="vaultRotor">
                  <g id="vaultTeeth"></g>
                  <circle class="vdp-hub" cx="0" cy="0" r="46"/>
                  <rect class="vdp-handle" x="-5" y="-88" width="10" height="20" rx="4"/>
                </g>
                <polygon class="vdp-ptr" points="0,-99 7,-86 -7,-86"/>
                <text class="vdp-readout" id="vaultReadout" x="0" y="2">0</text>
                <text class="vdp-cap" id="vaultCap" x="0" y="30">VAULT</text>
              </svg>
            </div>
            <div class="vault-dial-hint">
              <b>Turn the dial</b>
              <span>Drag the wheel to change the highlighted digit. Click a block to pick which one you are turning.</span>
            </div>
          </div>

          <button class="vault-unlock" id="vaultUnlock">Unlock</button>
          <div class="vault-error" id="vaultError"></div>
        </div>
      </div>
    `);

    overlay = document.getElementById("vaultOverlay");
    els = {
      door: document.getElementById("vaultDoor"),
      digits: document.getElementById("vaultDigits"),
      input: document.getElementById("vaultInput"),
      dial: document.getElementById("vaultDial"),
      rotor: document.getElementById("vaultRotor"),
      teeth: document.getElementById("vaultTeeth"),
      readout: document.getElementById("vaultReadout"),
      error: document.getElementById("vaultError"),
      cap: document.getElementById("vaultCap"),
    };

    buildTeeth(els.teeth, 16, 54, 92, 13);
    paintCode();
    paintDigits();
    paintDial();

    els.dial.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    els.input.addEventListener("input", () => {
      const v = els.input.value.replace(/\D/g, "").slice(0, 4);
      code = v.split("");
      while (code.length < 4) code.push("");
      active = Math.min(code.length ? code.length - 1 : 0, 3);
      if (v.length === 4) active = 3;
      els.error.classList.remove("show");
      els.digits.classList.remove("error");
      paintDigits();
      paintDial();
    });
    els.input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
    document.getElementById("vaultUnlock").addEventListener("click", tryUnlock);

    setTimeout(() => els.input.focus(), 260);
  };

  return { open };
})();

window.Vault = Vault;
