/* === Medha Program Management — login gate === */
/*
 * Credentials live here. Change them in one place.
 * Set AUTH_USERS to null to disable the gate entirely (open access).
 */
const AUTH_USERS = [
  { username: "admin", password: "medha2026", name: "Medha Admin" },
  { username: "ota", password: "ota2026", name: "OTA Team" },
];
const SESSION_KEY = "mpm.session";

const Login = (() => {
  let screen, card, form, btn, userEl, passEl, errEl, eyeBtn, progressEl;

  const init = () => {
    screen = document.getElementById("loginScreen");
    card = document.getElementById("loginCard");
    form = document.getElementById("loginForm");
    btn = document.getElementById("loginBtn");
    userEl = document.getElementById("loginUser");
    passEl = document.getElementById("loginPass");
    errEl = document.getElementById("loginError");
    eyeBtn = document.getElementById("loginEye");
    progressEl = document.querySelector(".lf-progress");

    if (!AUTH_USERS) { grantAccess(null); return; }

    // already signed in?
    if (readSession()) { grantAccess(readSession(), true); return; }

    // focus the first field once the entrance animation settles
    setTimeout(() => { if (!document.body.classList.contains("logged-in")) userEl?.focus(); }, 700);

    form?.addEventListener("submit", onSubmit);
    eyeBtn?.addEventListener("click", toggleEye);
    passEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") form.requestSubmit(); });
    userEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); passEl.focus(); } });
  };

  const toggleEye = () => {
    const show = passEl.type === "password";
    passEl.type = show ? "text" : "password";
    eyeBtn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    eyeBtn.style.color = show ? "var(--primary)" : "";
  };

  const readSession = () => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const username = (userEl.value || "").trim();
    const password = passEl.value || "";

    if (!username || !password) {
      showError("Please enter both user name and password.");
      return;
    }

    const match = AUTH_USERS.find(u =>
      u.username.toLowerCase() === username.toLowerCase() && u.password === password);

    if (!match) {
      showError("Incorrect user name or password. Please try again.");
      return;
    }

    // ---- animation sequence ----
    btn.classList.add("state-loading");
    btn.disabled = true;
    progressEl?.classList.add("show");
    if (progressEl) progressEl.querySelector("span").style.width = "72%";
    card.classList.remove("shake");
    errEl.classList.remove("show");

    // let the animation breathe, then confirm
    await sleep(900);

    if (progressEl) progressEl.querySelector("span").style.width = "100%";
    btn.classList.remove("state-loading");
    btn.classList.add("state-ok");
    card.classList.add("done");

    await sleep(700);

    try {
      const payload = JSON.stringify({ username: match.username, name: match.name, at: Date.now() });
      sessionStorage.setItem(SESSION_KEY, payload);
      localStorage.setItem(SESSION_KEY, payload);
    } catch (err) { /* storage blocked — session continues anyway */ }

    grantAccess({ username: match.username, name: match.name });
  };

  const showError = (msg) => {
    errEl.textContent = msg;
    errEl.classList.add("show");
    card.classList.remove("shake");
    void card.offsetWidth;   // restart animation
    card.classList.add("shake");
    passEl.focus();
    passEl.select();
  };

  const grantAccess = (session, instant) => {
    document.body.classList.add("logged-in");
    if (instant) {
      screen.classList.add("hide");
      setTimeout(() => screen.classList.add("removed"), 500);
    } else {
      screen.classList.add("hide");
      setTimeout(() => screen.classList.add("removed"), 520);
    }
    window.dispatchEvent(new CustomEvent("mpm:login", { detail: session }));
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    document.body.classList.remove("logged-in");
    screen.classList.remove("removed", "hide");
    card.classList.remove("done");
    btn.classList.remove("state-ok", "state-loading");
    btn.disabled = false;
    passEl.value = "";
    errEl.classList.remove("show");
    if (progressEl) { progressEl.classList.remove("show"); progressEl.querySelector("span").style.width = "0%"; }
    setTimeout(() => userEl.focus(), 300);
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  return { init, logout };
})();

/* expose for the app shell (sign-out from the workspace menu) */
window.Login = Login;

/* boot: login first, then the app */
(function boot() {
  const start = () => {
    Login.init();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
