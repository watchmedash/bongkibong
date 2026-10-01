const CACHE = "dashflix-v8";
const OFFLINE = "./offline.html";
const STATIC_ASSETS = [
  "./offline.html",
  "./app.js", "./style.css",
  "./index.css", "./index.js",
  "./movies.js", "./pages.css",
  "./shows.js",
  "./watchlist.css", "./watchlist.js",
  "./player.css", "./player.js",
  "./players.js",
  "./person.js",
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS).catch(() => {})));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Never intercept non-GET or external requests (TMDB API, CDN, ads)
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // HTML navigation — always network-first, never serve stale pages
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(OFFLINE))
    );
    return;
  }

  // Static assets (JS, CSS) — cache-first
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => Response.error());
    })
  );
});
