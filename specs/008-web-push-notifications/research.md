# Phase 0 Research: Web Push Notifications for the PWA

## 1. Why nothing happens today (confirmed by reading the code)

- `usePushRegistration.ts`'s `currentPlatform()` returns `null` unless
  `Platform.OS` is `"ios"` or `"android"` — on web it returns immediately,
  before requesting permission or fetching any token.
- `notificationScheduler.ts`'s `hasNotificationPermission()` is hardcoded
  `return false` on web — the actual browser `Notification.permission` state
  is never inspected, and the browser's native permission prompt is never
  triggered anywhere in the current codebase.
- `public/sw.js` (the existing offline-caching service worker, added by
  `specs/006-pwa-e2e-layout-fix`) has no `push` or `notificationclick`
  listener — even a hypothetical incoming push message today would have no
  code to turn it into a visible system notification.
- The `rules.tsx` screen already surfaces a *static* "Reminders are off"
  banner (`RulesScreen.tsx`) whenever `hasNotificationPermission` is `false`
  — on web this fires unconditionally today, and is plain text with no
  action attached.

This is the load-bearing confirmation that this feature is purely additive:
nothing web-related currently runs, so there's no existing web notification
behavior to preserve or migrate.

## 2. Web Push mechanics and the VAPID key pair

Standard Web Push (the same mechanism every browser push notification uses,
not a third-party service) requires:
- A **VAPID key pair** (a public/private EC key pair) that identifies this
  application server to push services (Apple's/Google's/Mozilla's).
- The **public** key is safe to ship to the client — it's used client-side as
  `PushManager.subscribe({ applicationServerKey })`.
- The **private** key must never leave the server — it's used to sign the
  Authorization header on every send.

**Decision**: Generate the key pair once (a manual, one-off ops step — the
project's established pattern for exactly this kind of secret, per migration
0005's Vault `cron_secret` creation). Store the public half as
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` (committed to `.env.example` as a placeholder,
matching the existing `EXPO_PUBLIC_SUPABASE_*` naming convention — this value
is not sensitive). Store the private half as a new Supabase Edge Function
secret, `VAPID_PRIVATE_KEY` (`supabase secrets set`), the same mechanism
already used for `CRON_SECRET`.

**Alternatives considered**: a third-party push-delivery service (e.g.
OneSignal, Firebase Cloud Messaging for Web). Rejected — introduces a paid or
account-gated external dependency for something the standard, free Web Push
protocol already does directly (constitution III); FCM specifically would
also mean two different non-Expo delivery mechanisms to maintain (Expo
already abstracts native), where a direct VAPID implementation only adds one.

## 3. Sending Web Push from the Deno Edge Function

`supabase/functions/evaluate-reminders` already imports npm packages directly
in Deno via `npm:` specifiers (`npm:@supabase/supabase-js@2`,
`npm:@sentry/deno@8`, confirmed working today) — this is Supabase Edge
Functions' documented, already-proven-in-this-repo way to use an npm
package.

**Decision**: Use `npm:web-push@3` (the standard, widely-used Node/Deno-
compatible Web Push library) to build a `webPush.ts` adapter in
`supabase/functions/evaluate-reminders/`, structurally parallel to the
existing `expoPush.ts` adapter — `sendPushBatch`-equivalent that POSTs one
message per subscription, VAPID-signed via `VAPID_PRIVATE_KEY`.

**Alternatives considered**: hand-rolling the Web Push protocol's payload
encryption (`aes128gcm`) and VAPID JWT signing directly. Rejected — this is
non-trivial cryptography with real correctness/security risk if
hand-implemented, and a well-maintained library already exists and is
already provably importable in this exact runtime.

## 4. No receipt-check phase needed for web (simpler than Expo's flow)

Expo's push flow is two-phase: send now, get a ticket id back, check a
separate receipts endpoint later (minutes-to-hours after) to learn whether
delivery actually succeeded — this is why `evaluate-reminders` has a
`pruneStaleTokens` phase that runs *before* evaluation, checking receipts
from the *previous* run.

Standard Web Push has no equivalent delayed-receipt step: the push service's
response to the send request itself is authoritative. A `404`/`410` response
means the subscription is gone.

**Decision**: On a `404`/`410` from `web-push`'s `sendNotification` (thrown
as a `WebPushError` with a `statusCode`), delete that `push_tokens` row
immediately, synchronously with the send attempt — no separate "pending
receipt" bookkeeping, no `last_ticket_id` equivalent needed for web rows.
This is simpler than the native path, not a gap relative to it.

## 5. Data model: extending `push_tokens` vs. a new table

The existing `push_tokens` table's shape (`expo_push_token text not null`,
`platform text check (platform in ('ios','android'))`) doesn't fit a web
subscription, which is structurally different: an `endpoint` URL plus two
opaque keys (`p256dh`, `auth`), not a single token string.

**Decision**: Extend the existing table rather than add a parallel one —
widen the `platform` check to include `'web'`, make `expo_push_token`
nullable, and add three nullable columns: `web_endpoint text`,
`web_p256dh text`, `web_auth text`. A new check constraint enforces exactly
one shape is populated per row, keyed by `platform`
(data-model.md). This keeps the entire existing per-device lifecycle
(unique `(user_id, device_installation_id)`, registered at sign-in/
reconciliation, revoked at sign-out, read generically by
`fetchPushTokensForUsers`) working unmodified for the *shared* parts, while
`evaluate-reminders`'s send phase branches by `platform` to pick
`expoPush.ts` or the new `webPush.ts`.

**Alternatives considered**: a separate `web_push_subscriptions` table.
Rejected — would duplicate the entire user/device lifecycle (RLS policies,
uniqueness, sign-out revocation, sign-in registration) that already exists
correctly for `push_tokens`, for no benefit; the "one row per device,
whatever shape its token takes" model already generalizes cleanly.

## 6. Requesting permission on web — a new, parallel code path

`expo-notifications`' permission APIs are deliberately not used for web (they
already no-op there by design, per `notificationScheduler.ts`'s existing
`Platform.OS === "web"` guards, confirmed correct and unrelated to this
feature). Web permission uses the browser's own `Notification.permission` /
`Notification.requestPermission()` API directly — there is no
`expo-notifications` involvement in the web path at all, before or after
this feature.

**Decision**: `usePushRegistration.ts` gains a `web` branch (parallel to,
not replacing, the existing `ios`/`android` branch) that: checks
`"serviceWorker" in navigator && "PushManager" in window` (feature
detection), checks the iOS-not-installed case (research.md #7) first, then
calls `Notification.requestPermission()`, then on `"granted"` awaits
`navigator.serviceWorker.ready` and calls
`registration.pushManager.subscribe({ userVisibleOnly: true,
applicationServerKey })`, then upserts the resulting subscription via
`upsertPushToken` (extended to accept the web shape).

Unlike the native path (where `usePushRegistration` only *proceeds* if
permission was already granted elsewhere, per its existing doc comment, so
sign-in alone never triggers an OS prompt), the web permission prompt has no
other trigger point in this app — there is no OS Settings toggle a user
could have pre-granted before ever opening the app. **This means the web
path must itself be the thing that calls `requestPermission()`**, gated
behind a real user action (the Rules screen's existing static banner,
research.md #8) rather than firing automatically on sign-in/reconciliation
— unsolicited permission prompts on page load are both bad practice and
frequently auto-denied/suppressed by browsers.

## 7. Detecting the iOS "must install first" case

There is no dedicated Web API for "is this browser an iOS Safari tab that
hasn't been added to the home screen." The standard, widely-used detection
combines:
- iOS device sniff: `/iPad|iPhone|iPod/.test(navigator.userAgent)`.
- Installed/standalone check: `window.navigator.standalone === true` (the
  iOS-Safari-specific flag) OR
  `window.matchMedia("(display-mode: standalone)").matches` (the general PWA
  standard, works for the install case on other platforms too).

**Decision**: `isIosNotInstalled = isIos && !isStandalone`. When true, the
Rules screen's banner (research.md #8) shows install guidance instead of an
"Enable notifications" action, and no permission request is attempted (FR-005
— attempting it anyway would either silently fail or, worse, permanently
mark permission as "denied" in a way the user can't easily undo, since a
plain Safari tab has no working Web Push implementation to grant into).

## 8. Where the enable action lives

The Rules screen's existing "Reminders are off" banner
(`RulesScreen.tsx`) already conditionally renders based on
`hasNotificationPermission`, sourced from `notificationScheduler.ts`'s
`hasNotificationPermission()` (currently hardcoded `false` on web).

**Decision**: (a) make `hasNotificationPermission()` web-aware — return
`Notification.permission === "granted"` when Web Push is supported, `false`
otherwise (unchanged for native); (b) turn the existing static banner into
an actionable one on web: an "Enable notifications" button when permission
hasn't been granted and the platform supports it, or the iOS install-
guidance text (research.md #7) when it doesn't/can't yet. On native, the
banner's existing behavior (static text pointing at OS Settings) is
unchanged — native permission is still requested opportunistically via
reconciliation, not from this button.

**Alternatives considered**: auto-prompting on every web sign-in/
reconciliation, mirroring the native opportunistic-retry pattern exactly.
Rejected per research.md #6 — an unsolicited page-load permission prompt is
a known bad practice on the web and many browsers actively suppress or
auto-deny prompts not tied to a user gesture, so a real click is required
for a reliable result.

## 9. Multiple devices, existing patterns unaffected

`fetchPushTokensForUsers` and the sign-out revocation path
(`deletePushToken`) both key off `(user_id, device_installation_id)` already
platform-agnostically — no changes needed there beyond the schema widening
in research.md #5. A user with both a native install and a web/PWA session
already gets independent rows today (this is exactly how two native devices
for the same user already coexist), so multi-device correctness is inherited
for free, not new work.
