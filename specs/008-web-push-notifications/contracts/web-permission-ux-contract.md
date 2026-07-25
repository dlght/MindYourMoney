# Contract: Web Notification Permission UX

Governs the client-side permission/subscribe flow (FR-001, FR-002, FR-005,
FR-006, FR-012) and where it's surfaced in the UI (research.md #6, #7, #8).

## Rule

1. `hasNotificationPermission()` (`notificationScheduler.ts`) MUST, on web,
   return `Notification.permission === "granted"` when Web Push is
   supported (`"serviceWorker" in navigator && "PushManager" in window &&
   "Notification" in window`), and `false` otherwise (unsupported browser,
   or supported but not yet granted) — replacing the current hardcoded
   `false`. Native behavior is unchanged.
2. The Rules screen's existing "Reminders are off" banner
   (`RulesScreen.tsx`) MUST, on web, render one of exactly three states:
   - **Not supported at all** (no Web Push capability): the existing static
     text, unchanged.
   - **iOS Safari tab, not installed to home screen** (research.md #7):
     install guidance text (e.g. "Add this app to your Home Screen to
     enable notifications"), no actionable button — attempting
     `requestPermission()` here MUST NOT happen (FR-005).
   - **Supported and not yet granted**: an actionable "Enable
     notifications" control that, on press, calls
     `Notification.requestPermission()` directly (not via
     `expo-notifications`, research.md #6) and on `"granted"` proceeds to
     subscribe (contracts/push-tokens-web-schema.sql's shape) and register
     via the extended `usePushRegistration`/`upsertPushToken`.
   - **Already granted**: banner does not render at all (matches existing
     `hasNotificationPermission === false ? banner : null` behavior).
3. `usePushRegistration`'s web branch MUST NOT be invoked automatically on
   sign-in or opportunistic reconciliation the way the native branch is
   (research.md #6) — it is only reachable via the explicit user action in
   rule 2, since an unsolicited page-load permission prompt has no
   reliable/good-practice equivalent on the web.
4. Denying permission (`Notification.permission === "denied"`) MUST leave
   the rest of the app fully functional (FR-012) — the banner may remain
   visible (there is nothing more to do from in-app; the user must change
   the OS/browser-level permission themselves) but nothing else in the app
   degrades.

## Non-goals

- No custom "we'd like to send you notifications" pre-prompt UI beyond the
  banner's own button — a single, direct browser permission request is
  sufficient and matches the spec's "prompted once" framing (User Story 1,
  Acceptance Scenario 1).
- No change to the native permission-request flow (still opportunistic, via
  `useNotificationReconciliation`, unchanged).

## Verification

SC-002 (0 users silently believe notifications are "on" when they can't be)
and FR-006 (graceful degradation on unsupported browsers) are checked via:
- Unit tests on the new `hasNotificationPermission()` web branch and on a
  small `getWebPushBannerState()`-style helper (or equivalent), covering
  all three renderable states plus the "already granted" no-render case,
  driven by mocked `navigator`/`Notification`/`window.matchMedia` values.
- A component test on `RulesScreen` asserting the correct banner variant
  renders for each of the three states.
