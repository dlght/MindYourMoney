# Contract: Service Worker Push & Notification-Click Handling

Extends `public/sw.js` (currently a pure offline-caching shell, no push
awareness at all — research.md #1) with the handlers required for FR-003/
FR-004.

## Rule

1. `sw.js` MUST register a `push` event listener that:
   - Parses the incoming push message as JSON (the payload shape sent by
     `webPush.ts`, contracts/web-push-send-contract.md #3: `{ title, body,
     data }`).
   - Calls `self.registration.showNotification(title, { body, data, icon:
     "/icons/icon-192.png" })` inside `event.waitUntil(...)` so the service
     worker isn't terminated before the notification is shown.
   - If the payload can't be parsed (malformed/empty push), MUST still show
     a generic fallback notification rather than silently doing nothing —
     an unexplained missed reminder is worse than a generic one.
2. `sw.js` MUST register a `notificationclick` event listener that:
   - Calls `event.notification.close()`.
   - Calls `event.waitUntil(clients.openWindow("/"))` (or focuses an
     already-open client window/tab for this origin if one exists, per
     standard `clients.matchAll()` + `client.focus()` practice) so tapping
     the notification opens or returns to the app (FR-004).
3. Neither handler MUST interfere with the existing `install`, `activate`,
   or `fetch` handlers already in `sw.js` (offline caching, spec 006) —
   purely additive listeners in the same file.

## Non-goals

- No rich notification actions (action buttons, images) — a title + body +
  tap-to-open is sufficient to match the existing native notification
  content shape; richer UI is not requested by spec.md.
- No change to the service worker's registration point
  (`src/lib/registerServiceWorker.ts`) — the same registration already in
  place is sufficient; `PushManager.subscribe()` (client-side,
  research.md #6) uses `navigator.serviceWorker.ready`, which resolves
  against whatever registration already exists.

## Verification

SC-001 (notification appears with app/tab closed) and FR-004 (tap opens the
app) are checked via:
- A quickstart.md manual scenario: trigger a test push (e.g. via the
  browser's DevTools "Push" simulation panel, or a real send from
  `evaluate-reminders`) with the tab fully closed, confirm the system
  notification appears, and confirm tapping it opens the app.
