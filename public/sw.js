// Minimal runtime-caching service worker (no build-time precache list — the
// Expo web export's asset filenames are content-hashed per build, so this
// caches opportunistically as things are actually requested instead of
// needing a generated manifest).
const CACHE_NAME = "mindyourmoney-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Hashed, immutable build assets: cache-first, they never change content
  // for a given filename.
  if (url.pathname.startsWith("/_expo/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Navigations (the HTML shell) and everything else: network-first so
  // updates show up immediately, falling back to cache when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

// Web Push (F8, contracts/service-worker-push-contract.md): renders an
// incoming push message as a real system notification. A malformed/empty
// payload still shows a generic fallback rather than silently doing
// nothing — an unexplained missed reminder is worse than a generic one.
self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "MindYourMoney";
  const body = payload.body || "You have a new reminder.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: payload.data || {},
      icon: "/icons/icon-192.png",
    })
  );
});

// Tapping a notification focuses an already-open tab for this origin if
// one exists, otherwise opens a new one (FR-004).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});
