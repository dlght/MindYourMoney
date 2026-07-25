---

description: "Task list for Web Push Notifications for the PWA"
---

# Tasks: Web Push Notifications for the PWA

**Input**: Design documents from `/specs/008-web-push-notifications/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included for the genuinely pure, runtime-agnostic pieces only
(client-side detection/decision helpers and the `RulesScreen` banner
states), per constitution VIII. **Not** included for `webPush.ts` or
`evaluate-reminders`'s send-path branching — this repo has no Deno test
runner configured, and `expoPush.ts` (the exact precedent this mirrors) has
never had a unit test either; those are verified manually via
[quickstart.md](./quickstart.md) instead (see
[contracts/web-push-send-contract.md](./contracts/web-push-send-contract.md)'s
Verification section for the explicit rationale).

**Organization**: Tasks are grouped by user story (US1 = P1 core delivery,
US2 = P2 iOS install guidance, US3 = P3 sign-out/expiry hygiene) to enable
independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are exact and relative to the repo root

## Path Conventions

Single Expo project (mobile-app + web export) per plan.md — `src/`, `app/`,
`supabase/`, `tests/` at repo root; no new top-level directory.

---

## Phase 1: Setup

**Purpose**: Get the VAPID key pair and its secrets in place before any code
depends on them — everything else in this feature reads
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

- [X] T001 Generate a VAPID key pair (one-time, e.g. `npx web-push generate-vapid-keys`, or an equivalent one-off script) — a manual ops step, not application code (generated locally via `npx web-push generate-vapid-keys`; private key held for T003, not committed anywhere)
- [X] T002 Add `EXPO_PUBLIC_VAPID_PUBLIC_KEY` to `.env.example` (placeholder value) and to the local `.env`/`.env.local` (real public key — not sensitive) — done. **Netlify build environment variable still needs to be set by you**: the Netlify CLI in this environment isn't logged in (would require an interactive OAuth flow), so `EXPO_PUBLIC_VAPID_PUBLIC_KEY=BNfPpLFJRqkp_QnvBcSBv3N7NIyuRSX9vQZdh1vM2kQxY3JtAk-PzI-JDKefdEntTrkwgX38IX_8WjBtgHyHMjQ` must be added via the Netlify dashboard (Site settings → Environment variables) and the site redeployed/rebuilt before the live PWA picks it up
- [X] T003 Set `VAPID_PRIVATE_KEY` as a Supabase Edge Function secret (`supabase secrets set VAPID_PRIVATE_KEY=... --project-ref <ref>`) — never committed to git, mirrors how `CRON_SECRET` is already stored (T003 of specs/005-server-push-hardening's precedent) — done; also set `EXPO_PUBLIC_VAPID_PUBLIC_KEY` as a second function secret (the Deno function needs it too, via `Deno.env.get`, separately from the client bundle's env var) — confirmed via `supabase secrets list`
- [X] T004 [P] Add `npm:web-push@3` as the Web Push adapter's dependency inside `supabase/functions/evaluate-reminders` (Deno `npm:` import, no `package.json` change needed — mirrors the existing `npm:@supabase/supabase-js@2` / `npm:@sentry/deno@8` usage already in this function) — no action needed until T017 actually imports it; confirmed the import-only pattern requires no separate install step

**Checkpoint**: Key pair exists and is available to both the client (public) and the Edge Function (private); no application code changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the schema change and shared types before any user story's code can compile against them.

**⚠️ CRITICAL**: Do not proceed to Phase 3+ until this baseline is complete.

- [X] T005 Run `npm test && npm run typecheck` and confirm the existing suite passes cleanly (verification only — no files change in this task); record the passing count as the baseline for comparison after this feature's changes (baseline: 136/136 tests, 19/19 suites, typecheck clean)
- [X] T006 Create `supabase/migrations/0007_web_push_tokens.sql` per [contracts/push-tokens-web-schema.sql](./contracts/push-tokens-web-schema.sql): drop the `not null` on `expo_push_token`, widen the `platform` check to include `'web'`, add nullable `web_endpoint`/`web_p256dh`/`web_auth` columns, add the shape check constraint
- [X] T007 Apply the migration to the linked Supabase project (`supabase db push` or equivalent) and confirm via `supabase migration list --linked` that `0007` shows as applied both locally and remotely — done; `supabase db push --linked --dry-run` confirmed only `0007_web_push_tokens.sql` would apply (0001-0006 already applied), then applied for real; `migration list --linked` confirms `0007` now shows applied both locally and remotely
- [X] T008 [P] Extend `PushPlatform` in `src/features/push/types.ts` to `"ios" | "android" | "web"`, and extend `UpsertPushTokenInput`/`PushToken` to carry the web subscription shape (`webEndpoint`/`webP256dh`/`webAuth`, all optional, alongside the existing optional-on-web `expoPushToken`)
- [X] T009 [US-shared] Extend `upsertPushToken` in `src/features/push/pushTokenApi.ts` to pass through whichever shape (`expo_push_token` or `web_endpoint`/`web_p256dh`/`web_auth`) the input actually contains

**Checkpoint**: Schema and shared types are in place; user story implementation can begin.

---

## Phase 3: User Story 1 - Receiving a reminder without installing a native app (Priority: P1) 🎯 MVP

**Goal**: A user on a supported browser can grant notification permission and receive a real system push notification for a qualifying reminder with the app/tab closed, per [contracts/web-push-send-contract.md](./contracts/web-push-send-contract.md) and [contracts/service-worker-push-contract.md](./contracts/service-worker-push-contract.md).

**Independent Test**: Per [quickstart.md](./quickstart.md) US1 — enable notifications on Android Chrome (or an installed iOS PWA), close the app, trigger `evaluate-reminders`, confirm a system notification appears and tapping it opens the app.

### Tests for User Story 1

- [X] T010 [P] [US1] Create `tests/unit/vapidKey.test.ts`: unit-test the base64url → `Uint8Array` conversion helper (to be created in T013) against a couple of known VAPID public key strings, asserting the output length/byte values are correct
- [X] T011 [P] [US1] Create `tests/unit/webPushSupport.test.ts`: unit-test `isWebPushSupported()` (true only when `serviceWorker`/`PushManager`/`Notification` all exist on the mocked `window`/`navigator`) — the iOS-specific detection is covered separately in US2's tests

### Implementation for User Story 1

- [X] T012 [US1] Extend `public/sw.js` per [contracts/service-worker-push-contract.md](./contracts/service-worker-push-contract.md): add a `push` listener that parses the JSON payload and calls `self.registration.showNotification(title, { body, data, icon: "/icons/icon-192.png" })` inside `event.waitUntil(...)`, with a generic fallback notification if parsing fails; add a `notificationclick` listener that closes the notification and focuses an existing client or opens `"/"` — purely additive to the existing `install`/`activate`/`fetch` handlers
- [X] T013 [P] [US1] Create `src/features/push/vapidKey.ts` exporting a pure `urlBase64ToUint8Array(base64String: string): Uint8Array` helper (standard, widely-documented conversion needed because `PushManager.subscribe`'s `applicationServerKey` requires a `Uint8Array`, not the base64url string VAPID tools output)
- [X] T014 [P] [US1] Create `src/features/rules/webPushSupport.ts` exporting `isWebPushSupported(): boolean` (checks `"serviceWorker" in navigator && "PushManager" in window && "Notification" in window`) — also added `isIosNotInstalled()` in the same pass (originally scoped to T023/US2, but natural to write alongside; its dedicated unit tests still land in T021)
- [X] T015 [US1] Add a web branch to `usePushRegistration.ts` per [contracts/web-permission-ux-contract.md](./contracts/web-permission-ux-contract.md) rule 3: on `Platform.OS === "web"`, only proceed when explicitly invoked by the new enable action (not from the existing opportunistic sign-in/reconciliation call sites — see T019); when invoked, check `isWebPushSupported()`, call `Notification.requestPermission()`, and on `"granted"` await `navigator.serviceWorker.ready`, call `registration.pushManager.subscribe(...)`, extract `endpoint`/`keys.p256dh`/`keys.auth` from `subscription.toJSON()`, and call the extended `upsertPushToken` (T009) — implemented as a new `useEnableWebPush()` hook alongside the existing `usePushRegistration()` (kept fully separate rather than branching inside it, so the native hook's behavior/signature is untouched); found and fixed during manual verification (T020): `requestPermission()`/`subscribe()` failures must be try/caught into an `{ status: "error" }` result, not left to reject unhandled (FR-006)
- [X] T016 [US1] Update `notificationScheduler.ts`'s `hasNotificationPermission()` per [contracts/web-permission-ux-contract.md](./contracts/web-permission-ux-contract.md) rule 1: on web, return `isWebPushSupported() && Notification.permission === "granted"` instead of the hardcoded `false`; native branch unchanged
- [X] T017 [P] [US1] Create `supabase/functions/evaluate-reminders/webPush.ts` per [contracts/web-push-send-contract.md](./contracts/web-push-send-contract.md): a `sendWebPush(message)` function using `npm:web-push@3`'s `sendNotification` with `VAPID_PRIVATE_KEY`/`EXPO_PUBLIC_VAPID_PUBLIC_KEY`, returning `{status:"sent"}` / `{status:"gone"}` (404/410) / `{status:"error"}` for the caller to act on — structurally parallel to `expoPush.ts`'s `sendPushBatch`. **Not covered by any automated test/typecheck in this session** — `supabase/functions` is excluded from `tsc` (tsconfig.json) and no Deno CLI is available in this environment; matches the pre-existing untested state of `expoPush.ts` itself (research.md #-, contracts/web-push-send-contract.md Verification note)
- [X] T018 [US1] Extend `db.ts` and `index.ts` in `supabase/functions/evaluate-reminders`: `PushTokenRow` widened for the new `web_*` columns (the existing `select("*")` in `fetchPushTokensForUsers` already returns them, no query change needed); the send phase partitions each user's tokens by `platform`, routing `'ios'`/`'android'` rows through the existing unmodified `expoPush.ts` path and `'web'` rows through `webPush.ts` (T017) per-candidate, writing the same `notifications_log` shape on success for either path, and queuing/deleting `'web'` rows the send reports as `"gone"` (this also fully implements US3/T026 — done here rather than deferred, since it's the same code) — same untested-in-this-session caveat as T017
- [X] T019 [US1] Wire the "enable notifications" action end-to-end: extended `RulesScreen.tsx`'s banner to a `webPushBannerAction: "none" | "enable" | "ios-install"` prop (plus `onEnableWebPush`) per [contracts/web-permission-ux-contract.md](./contracts/web-permission-ux-contract.md) rule 2, and wired `app/(tabs)/rules.tsx` to compute that state (native always `"none"`; web picks via `isIosNotInstalled()`/`isWebPushSupported()`) and call the new `useEnableWebPush()` hook (T015) — all three banner states are wired now (not just two); T023/US2 only adds the dedicated unit tests for the iOS branch, since the implementation landed here
- [X] T020 [US1] Manually verify [quickstart.md](./quickstart.md) US1 steps **to the extent possible without a real human/device**: with infra now live (T003/T007 applied, function redeployed), confirmed via Playwright with a persistent (non-ephemeral) Chromium profile that the service worker registers and activates correctly and that the full permission-request → subscribe code path runs without crashing. Could **not** get headless Chromium to actually grant `Notification` permission even with `context.grantPermissions(["notifications"])` set correctly (confirmed `Notification.permission` stayed `"denied"` throughout) — this is a known headless-automation limitation (permission *prompts* can't render/auto-resolve to granted the same way in headless mode), not evidence of an app bug; the code correctly returned `{status: "denied"}` and left the banner in its "enable" state, which is the right behavior for a real denial too. **A real end-to-end delivered notification still needs a human with a real browser** — this is not something any automation in this session can substitute for

**Checkpoint**: User Story 1 is fully functional — a supported browser can receive and open a real push notification.

---

## Phase 4: User Story 2 - Accurate guidance on iOS instead of a silent failure (Priority: P2)

**Goal**: An iOS Safari tab not installed to the home screen sees explicit install guidance instead of a broken/silent permission flow, per [contracts/web-permission-ux-contract.md](./contracts/web-permission-ux-contract.md).

**Independent Test**: Per [quickstart.md](./quickstart.md) US2 — on a plain iOS Safari tab, confirm install guidance (not an enable button); after adding to the home screen, confirm the normal US1 flow applies.

### Tests for User Story 2

- [X] T021 [P] [US2] Extend `tests/unit/webPushSupport.test.ts` (T011): add `isIosNotInstalled()` cases — true for an iOS user-agent with `navigator.standalone` false/undefined and `matchMedia("(display-mode: standalone)").matches` false; false once either standalone signal is true, and false for a non-iOS user-agent regardless of standalone state
- [X] T022 [P] [US2] Extend `tests/component/rules-screen.test.tsx`: add cases for the new banner prop covering all three renderable web states (unsupported-browser static text, iOS-install-guidance text with no actionable control, enable-notifications button that calls the passed callback on press) plus confirm the banner still renders nothing when `hasNotificationPermission` is `true`

### Implementation for User Story 2

- [X] T023 [US2] Add `isIosNotInstalled(): boolean` to `src/features/rules/webPushSupport.ts` (T014) per research.md #7: iOS user-agent sniff combined with `navigator.standalone`/`matchMedia("(display-mode: standalone)")`; complete the three-state banner wiring started in T019 — `app/(tabs)/rules.tsx` now passes one of `"none" | "ios-install" | "enable"` to `RulesScreen.tsx`, which renders the matching variant (install guidance text for `"ios-install"`, with no permission request attempted, per FR-005) — implementation landed alongside T014/T019, this task's own scope (the function + wiring) was already complete; T021/T022 (this phase's tests) are what's newly added
- [ ] T024 [US2] Manually verify [quickstart.md](./quickstart.md) US2 steps on a real iOS device — **not performed in this session**: no physical iOS device or simulator is available in this environment. Left for you to verify: on an iPhone, a plain Safari tab should show install guidance only (no enable button); after "Add to Home Screen" and reopening from the icon, the normal enable flow from US1 should appear

**Checkpoint**: User Stories 1 AND 2 both work independently — delivery works where supported, and iOS users get accurate guidance instead of a dead end.

---

## Phase 5: User Story 3 - Device hygiene stays correct across sign-out and expiry (Priority: P3)

**Goal**: Web push registrations are revoked at sign-out and expired subscriptions are cleaned up rather than retried, per [contracts/web-push-send-contract.md](./contracts/web-push-send-contract.md) rule 4 and the existing sign-out revocation path.

**Independent Test**: Per [quickstart.md](./quickstart.md) US3 — sign out and confirm the `push_tokens` row is gone; simulate an expired subscription and confirm cleanup on the next evaluation without a repeated failed send.

### Implementation for User Story 3

- [X] T025 [US3] Confirm (and adjust only if needed) that `AuthProvider.tsx`'s existing `deletePushToken(userId, deviceId)` sign-out call already works unmodified for a `platform: "web"` row — confirmed by reading `pushTokenApi.ts`'s `deletePushToken`: it keys purely off `user_id`/`device_installation_id`, with no reference to `expo_push_token`, `platform`, or any web-specific column, so it needed no code change
- [X] T026 [US3] In `webPush.ts` (T017) / `index.ts`'s send-phase branching (T018), on a `{ gone: true }` result from `sendWebPush`, delete the corresponding `push_tokens` row immediately (synchronous with the send attempt, no receipt-check phase — research.md #4) via the existing `deletePushTokensByIds` helper in `db.ts` — implemented as part of T018 (same code change), not a separate diff
- [ ] T027 [US3] Manually verify [quickstart.md](./quickstart.md) US3 steps — **not performed in this session**: infra is now live (T003/T007/redeploy all done), but both scenarios require a *real, human-granted* browser subscription to exist first (sign-out revocation needs an active registration to revoke; expired-subscription cleanup needs a real subscription to then invalidate) — headless automation cannot produce that (see T020's note on the headless permission-grant limitation). This is the top thing for you to verify by hand once you've enabled notifications for real on a device

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing regressed and the delivered artifacts match what was planned.

- [X] T028 [P] Run the full regression pass — `npm test && npm run typecheck` — and confirm all tests pass, including T010, T011, T021, and T022, with no change to any pre-existing test's expected behavior (151/151 tests, 21/21 suites, typecheck clean — up from the 136/136, 19/19 baseline recorded in T005; also ran the full Playwright e2e suite as an extra check since `RulesScreen.tsx`/`rules.tsx` changed — 7/7 passed)
- [X] T029 Review all four contracts in [contracts/](./contracts/) against the implemented code and confirm every rule in each is satisfied — confirmed for the client-verifiable rules (schema shape, banner states, service worker handlers, permission-flow gating); the send-path contract's cleanup/delivery rules (`webPush.ts`/`index.ts`) are implemented per spec but unverified by any automated check in this session (T017/T018's caveat) — real verification is the held T007/T003 infra steps plus quickstart.md
- [X] T030 Run the regression check section of [quickstart.md](./quickstart.md) — confirmed via code review: `usePushRegistration()` (native path), `notificationScheduler.ts`'s native branch, and `expoPush.ts`/the native half of `index.ts`'s partitioning are all byte-for-byte unchanged or purely additive; full end-to-end native re-verification (an actual device/simulator run) was not performed in this session (none available) — no code change in this feature touches the native path, so this is a documentation confirmation, not a live one

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (T001-T003 are manual ops steps; T004 is a code-adjacent note that becomes real once T017 imports it)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (schema/types must exist before any story's code references them)
- **User Stories (Phase 3-5)**: US1 (T010-T020) has no dependency on US2/US3. US2 (T021-T024) extends the same `webPushSupport.ts` file and the same banner wiring US1 starts (T019) — implement in priority order (US1 → US2) rather than parallelizing, since US2's `isIosNotInstalled()` and full banner wiring build directly on US1's `isWebPushSupported()` and partial wiring. US3 (T025-T027) extends the same `webPush.ts`/`index.ts` files US1 creates (T017, T018) — also sequential after US1, not parallel, for the same file-overlap reason.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- US1: T010/T011 (tests) can be written alongside T013/T014 (the helpers they test); T012 (service worker) is independent of everything else in US1; T015 depends on T008/T009/T013/T014; T016 depends on T014; T017 is independent of the client-side tasks; T018 depends on T017; T019 depends on T015/T016; T020 (manual verification) comes last
- US2: T021/T022 (tests) can be written in parallel; T023 depends on T014 (extends the same file) and T019 (completes the banner wiring); T024 (manual verification) comes last
- US3: T025 is a verification-only task (expected no-op); T026 depends on T017/T018; T027 (manual verification) depends on T025 and T026

### Parallel Opportunities

- T002, T003, T004 (Setup) can happen in any order relative to each other
- T008 and T009 (Foundational) can be split across two people, though both are small
- T010, T011 (US1 tests) and T013, T014 (US1 helpers) can be drafted in parallel by different contributors before wiring them together in T015/T016
- T012 (service worker) and T017 (webPush.ts) are fully independent of each other and of the client-side permission work — three separate contributors could take client-permission-flow, service-worker, and server-send-adapter simultaneously

---

## Parallel Example: User Story 1 helpers

```bash
# These four can start together once Foundational (T008/T009) is done:
Task: "Create tests/unit/vapidKey.test.ts"
Task: "Create tests/unit/webPushSupport.test.ts (isWebPushSupported case)"
Task: "Create src/features/push/vapidKey.ts"
Task: "Create src/features/rules/webPushSupport.ts (isWebPushSupported)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004) — VAPID keys must exist first
2. Complete Phase 2: Foundational (T005-T009)
3. Complete Phase 3: User Story 1 (T010-T020)
4. **STOP and VALIDATE**: a supported browser can receive and open a real push notification — the core gap (web/PWA delivers nothing today) is closed
5. Ship this alone if needed — US2/US3 are real correctness/UX refinements but US1 alone already delivers the feature's core value for the majority (non-iOS, or already-installed-iOS) case

### Incremental Delivery

1. Setup + Foundational → VAPID keys and schema ready
2. Add User Story 1 → validate independently → web push delivery works where the platform supports it
3. Add User Story 2 → validate independently → iOS users get accurate guidance instead of a dead end
4. Add User Story 3 → validate independently → sign-out and expiry hygiene match the native path's existing guarantees
5. Polish → full regression pass across all three together

### Parallel Team Strategy

With three contributors, after Setup + Foundational:

- Contributor A: client-side permission/subscribe flow (T013-T016, T019, then US2's T023)
- Contributor B: service worker (T012) then server-side send adapter (T017, T018, then US3's T026)
- Contributor C: tests (T010, T011, T021, T022) drafted alongside A/B's corresponding implementation
- US3's T025/T027 and final Polish land after the above converge

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- T001-T003 are one-time manual ops steps (key generation, secret storage) — not something to re-run per environment beyond initial setup and, separately, whatever staging/production secret configuration `specs/005-server-push-hardening` already established a pattern for
