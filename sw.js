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
const CACHE = "mpm-v1";
// Full content is in the updated zip — this is a partial for structure.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
