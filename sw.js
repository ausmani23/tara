/* Cache-first service worker with background refresh (stale-while-revalidate).
   Bump CACHE on every deploy that changes app files — it's what triggers
   clients to pick up the new version. */
const CACHE = "tara-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./config.js",
  "./styles.css",
  "./app.js",
  "./lift.js",
  "./schedule.js",
  "./drag.js",
  "./routines.js",
  "./program.js",
  "./history.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const refresh = fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});
