// Phase 20 — minimal installable-PWA service worker for the authenticated
// app shell (scope: /app/). Deliberately narrow: it does NOT cache API
// responses or queue offline mutations (see
// docs/architecture/responsive-pwa.md's "known gaps" — true offline task
// completion is out of scope for this phase). Its only job is (a) make
// the app installable and (b) show a clear offline fallback page for a
// navigation that fails while offline, instead of the browser's default
// "no internet" error.
const CACHE_NAME = "processpilot-app-shell-v1";
const OFFLINE_URL = "/app/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network-only for everything except: on a failed navigation request,
// fall back to the cached offline page. Never intercepts API/data
// requests, so every read/write always reflects live, authorized,
// tenant-scoped data — nothing served from a stale cache.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())),
  );
});
