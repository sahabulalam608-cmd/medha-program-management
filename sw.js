/* Medha Program Management — service worker
 *
 * Strategy
 *  - Code (html / css / js): NETWORK FIRST with a short timeout.
 *    A redeploy is visible on the very next reload — no "stale version"
 *    surprises. If the network is slow or offline, the cached copy is used.
 *  - Heavy / rarely-changing files (images, the bundled docx library):
 *    CACHE FIRST, refreshed quietly in the background.
 *  - Google Sheets: always the network, because the data must be live.
 */
const CACHE = "mpm-v36";
const SHELL = [
  "./",
  "./index.html",
  "./guide.html",
  "./assets/styles.css",
  "./assets/mail.css",
  "./assets/login.css",
  "./assets/support.css",
  "./assets/results.css",
  "./assets/notify.css",
  "./assets/vault.css",
  "./assets/icons.js",
  "./assets/api.js",
  "./assets/login.js",
  "./assets/app.js",
  "./assets/notify.js",
  "./assets/vault.js",
  "./assets/results.js",
  "./assets/medha-logo-256.png",
  "./assets/medha-logo-512.png",
  "./assets/ota-logo-1000.png",
  "./assets/ota-logo-600.png",
  "./assets/ota-logo-1000.webp",
  "./assets/ota-logo-wide.png",
  "./assets/facebook-icon.png",
];

const HEAVY = /\/(assets\/vendor\/|assets\/img\/|assets\/.*\.(png|webp|jpg))/i;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(
        SHELL.map((u) => c.add(u).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE))
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.clients.claim())
  );
});

const networkFirst = (req, ms) =>
  Promise.race([
    fetch(req).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]).then((res) => {
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }
    return res;
  });

const cacheFirst = (req) =>
  caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || net;
  });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.hostname.endsWith("google.com") || url.hostname.endsWith("googleusercontent.com")) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  if (url.origin === self.location.origin) {
    if (HEAVY.test(url.pathname)) {
      e.respondWith(cacheFirst(req));
      return;
    }
    e.respondWith(
      networkFirst(req, 3500).then((res) => res || caches.match(req).then((hit) => hit || Response.error()))
    );
    return;
  }

  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(cacheFirst(req));
  }
});
