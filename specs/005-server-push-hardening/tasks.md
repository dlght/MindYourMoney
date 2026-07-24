---

description: "Task list template for feature implementation"
---

# Tasks: Server Push Notifications & Production Hardening

**Input**: Design documents from `/specs/005-server-push-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/push-tokens-schema.sql, contracts/evaluate-reminders-function.md, contracts/ci-workflow.md, quickstart.md

**Tests**: Included — Constitution VIII mandates tests before a feature is done, and Constitution V extends "notification reconciliation must be covered by tests" to this feature's server-side dedupe/evaluation logic. The Edge Function's own Deno/HTTP glue is validated via `quickstart.md`'s manual scenarios instead (matching F4's precedent for `notificationScheduler.ts`'s OS adapter), since it isn't practically unit-testable under the existing Jest setup.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2, US3 = P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Add `@sentry/react-native` to `package.json` dependencies and configure it per Sentry's Expo guide (`app.json` plugin entry, DSN via `.env`) — dependency installed and app-side init wired (T022); the `app.json` Expo config plugin (native source-map symbolication) is deferred to when a real Sentry project exists, since it needs real org/project slugs (see quickstart.md)
- [ ] T002 [P] Create the staging Supabase project ("MindYourMoney Staging") and apply migrations `0001_categories.sql`-`0003_rules_notifications.sql` to it (manual step — requires Supabase account access; record its URL/publishable key in `.env.staging.example`)
- [X] T003 [P] Copy `contracts/push-tokens-schema.sql` into `supabase/migrations/0004_push_tokens.sql`, then append: `create extension if not exists pg_cron`, `create extension if not exists pg_net`, and the `cron.schedule('evaluate-reminders-daily', ...)` block from `contracts/evaluate-reminders-function.md`
- [X] T004 [P] Scaffold `supabase/functions/evaluate-reminders/` with empty `index.ts`, `expoPush.ts`, `db.ts`, `sentry.ts` files (`supabase functions new evaluate-reminders` or manual directory creation) — implemented directly rather than left empty-then-filled (see T015-T017, T023)

**Checkpoint**: Dependencies declared, staging project exists, schema/cron migration drafted, function directory scaffolded.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared plumbing every user story's implementation tasks build on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create `src/lib/deviceId.ts` — generates a random id on first call and persists it via `@react-native-async-storage/async-storage`, returning the same id on every subsequent call (backs `push_tokens.device_installation_id`)
- [X] T006 [P] Create `src/features/push/types.ts` — `PushToken` type per data-model.md
- [X] T007 Create `src/features/push/pushTokenApi.ts` — `upsertPushToken(userId, { deviceInstallationId, expoPushToken, platform })` and `deletePushToken(userId, deviceInstallationId)`, mirroring `expensesApi.ts`'s structure and scoped via RLS
- [X] T008 Update `src/features/rules/notificationScheduler.ts`'s hardcoded `channel: "push"` (line 22) to `channel: "local"` (research.md #3); update `tests/unit/notificationEngine.test.ts`/any fixture asserting the old value — no existing test asserted the old value, so no fixture update was needed

**Checkpoint**: Device identification, push-token persistence, and the local/server channel distinction are all in place — user story implementation can now begin.

---

## Phase 3: User Story 1 - Get reminded even when the app has been closed for days (Priority: P1) 🎯 MVP

**Goal**: A user who hasn't opened the app receives a real push notification for a due reminder, registered automatically on sign-in, revoked on sign-out, and never duplicated against a locally-delivered reminder for the same expense/rule/trigger point.

**Independent Test**: Create a qualifying expense, leave the app fully closed, manually invoke the deployed `evaluate-reminders` function against staging, and confirm a push notification arrives exactly once.

### Tests for User Story 1 ⚠️

- [X] T009 [P] [US1] Write `tests/unit/pushTokenApi.test.ts` covering `upsertPushToken`/`deletePushToken` calling the correct table/columns and scoping to the given user — written first, expected to fail
- [X] T010 [P] [US1] Write `tests/unit/notificationDedupe.test.ts` covering a new pure `filterUndelivered(candidates, existingLogRows)` function: drops a candidate when a `notifications_log` row already exists for its `(user_id, expense_id, rule_id, trigger_kind)` regardless of `channel` value — written first, expected to fail

### Implementation for User Story 1

- [X] T011 [US1] Add `filterUndelivered(candidates, existingLogRows)` to `src/features/rules/notificationEngine.ts` (or a new co-located module) to satisfy T010 (research.md #3) — must remain framework-agnostic so it can be imported by both the app and the Edge Function
- [X] T012 [US1] Implement `src/features/push/usePushRegistration.ts` — given notification permission is granted, calls `Notifications.getExpoPushTokenAsync({ projectId })` (EAS `projectId` from `app.json`) and `upsertPushToken` with `deviceId.ts`'s id and detected platform, to satisfy T009
- [X] T013 [US1] Wire `usePushRegistration` into `src/features/auth/AuthProvider.tsx`'s `SIGNED_IN` handler as a fire-and-forget call alongside the existing `seedCategories`/`seedRules` calls (FR-001)
- [X] T014 [US1] Update `AuthProvider.tsx`'s `signOut()` to call `deletePushToken(user.id, deviceId)` before `supabase.auth.signOut()` (FR-007)
- [X] T015 [US1] Implement `supabase/functions/evaluate-reminders/db.ts` — service-role Supabase client; functions to fetch all enabled rules, all planned expenses, today's relevant `notifications_log` rows, and active `push_tokens`, plus an insert helper for new log rows
- [X] T016 [US1] Implement `supabase/functions/evaluate-reminders/expoPush.ts` — `sendPushBatch(messages)` POSTing to `https://exp.host/--/api/v2/push/send` in chunks of ≤100 (contracts/evaluate-reminders-function.md)
- [X] T017 [US1] Implement `supabase/functions/evaluate-reminders/index.ts` — verifies the `x-cron-secret` header, fetches data via `db.ts`, computes candidates via the imported `computeDesiredNotifications` (relative import from `src/features/rules/notificationEngine.ts`, research.md #2), filters via `filterUndelivered` (T011), sends via `expoPush.ts`, and writes `notifications_log` rows with `channel: 'server'`
- [X] T018 [US1] Deploy `evaluate-reminders` to the staging project (`supabase functions deploy evaluate-reminders --project-ref <staging-ref>`) and set its `CRON_SECRET` via `supabase secrets set` — deployed to the project's actual single Supabase project (no separate staging project exists, by user decision), required `--no-verify-jwt` (discovered live, documented in contracts/evaluate-reminders-function.md); verified with curl: no/wrong secret → 401, correct secret → 200 with a clean `{sent:0,pruned_tokens:0,skipped_duplicates:0}` summary
- [X] T019 [US1] Apply `supabase/migrations/0004_push_tokens.sql` (T003, now including the cron schedule) to the staging project, using the same secret configured in T018 — applied to the real project; 0001-0003 were discovered already live but untracked by CLI history (repaired via `supabase migration repair`) before pushing 0004. The GUC-based secret plan in 0004 hit a permissions wall (`ALTER DATABASE` not grantable via CLI/Management API on this platform) — added `0005_cron_secret_vault.sql` to re-point the cron job at Supabase Vault instead, applied and verified (cron job active, vault secret resolves)

**Checkpoint**: User Story 1 fully functional against the live project — quickstart.md Scenarios 1, 3, 5 verified (via curl auth checks + clean function response); Scenario 2 (actual device receiving a push) still needs a real registered device, per T037.

---

## Phase 4: User Story 2 - Trust that a reminder actually got sent (Priority: P2)

**Goal**: A failed scheduled run alerts the maintainer, a device that stops being reachable is pruned from future sends, and an unexpected app error shows a recoverable screen instead of freezing.

**Independent Test**: Deliberately break the staging Edge Function and confirm a Sentry alert fires; throw an error inside a screen component and confirm the fallback UI appears instead of a blank screen.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Write `tests/component/error-boundary.test.tsx` — a child that throws renders the fallback UI (not a crash/blank tree) — written first, expected to fail

### Implementation for User Story 2

- [X] T021 [US2] Implement `src/components/ErrorBoundary.tsx` (or adopt `Sentry.ErrorBoundary` if its default fallback API fits the existing NativeWind theming, per research.md #6) with a themed "Something went wrong" screen and a retry action, to satisfy T020 — hand-rolled class component (matches existing theming exactly; still reports to Sentry.captureException)
- [X] T022 [US2] Create `src/lib/sentry.ts` (Sentry React Native init) and call it at startup in `app/_layout.tsx`; wrap `<Slot />` in `<ErrorBoundary>` inside `RootLayout`/`AuthGate`
- [X] T023 [US2] Implement `supabase/functions/evaluate-reminders/sentry.ts` — Sentry Deno init + a Cron Monitor check-in wrapper (`in_progress` → `ok`/`error`); wrap `index.ts`'s (T017) orchestration in it
- [X] T024 [US2] Extend `db.ts`/`index.ts` with the receipt-check phase: for `push_tokens` rows with a non-null `last_ticket_id`, call `expoPush.ts`'s `getReceipts`, delete rows reporting `DeviceNotRegistered`, and after each send set `last_ticket_id`/`last_ticket_sent_at` for tomorrow's check (research.md #4, FR-006)
- [ ] T025 [US2] Configure the Sentry Cron Monitor's alert rule (e.g. email) for `evaluate-reminders` in the Sentry dashboard (one-time manual configuration; document the completed setup in quickstart.md Scenario 6)

**Checkpoint**: User Stories 1 and 2 both work independently — quickstart.md Scenarios 4, 6, 7 pass.

---

## Phase 5: User Story 3 - App stays fast and changes stay safe as it grows (Priority: P3)

**Goal**: The "Expenses" tab stays fast regardless of history length, every PR is automatically verified, and server-side changes can be tried in isolation before reaching production.

**Independent Test**: Seed a staging account with years of history and confirm the Expenses tab still loads its first page promptly; open a PR with a failing test and confirm CI blocks it.

### Tests for User Story 3 ⚠️

- [X] T026 [P] [US3] Extend `tests/unit/expensesApi.test.ts` covering new `listPlannedExpenses(userId)` and `listExpensesPage(userId, { from, to })` — written first, expected to fail
- [X] T027 [P] [US3] Extend `tests/component/expense-list.test.tsx` covering `onEndReached`-triggered `fetchNextPage` behavior — written first, expected to fail

### Implementation for User Story 3

- [X] T028 [US3] Add `listPlannedExpenses(userId)` (`status=eq.planned`, no range limit) and `listExpensesPage(userId, { from, to })` (`.range()`-paginated, all statuses, ordered by `due_date`) to `src/features/expenses/expensesApi.ts`; remove the now-unused unbounded `listExpenses` once callers migrate (T030-T032)
- [X] T029 [US3] Split `src/features/expenses/useExpenses.ts` into `usePlannedExpenses()` (plain `useQuery` over `listPlannedExpenses`) and `useExpenseHistory()` (`useInfiniteQuery` over `listExpensesPage`, page size 50), to satisfy T026
- [X] T030 [US3] Update `app/(tabs)/index.tsx` and `src/features/dashboard/DashboardScreen.tsx`'s data source to `usePlannedExpenses()` in place of the old `useExpenses()`
- [X] T031 [US3] Update `src/features/rules/useNotificationReconciliation.ts` to read from `usePlannedExpenses`'s query key instead of the old `expensesQueryKey`, so reconciliation keeps seeing every planned expense regardless of history pagination (research.md #8)
- [X] T032 [US3] Update `app/(tabs)/add.tsx` to use `useExpenseHistory()` and update `src/features/expenses/ExpenseList.tsx` to call `fetchNextPage` on `onEndReached`, to satisfy T027
- [X] T033 [US3] Create `.github/workflows/ci.yml` per `contracts/ci-workflow.md` (checkout, Node setup, `npm ci`, `npm run typecheck`, `npm test`, triggered on `pull_request`/`push` to `main`)
- [ ] T034 [US3] Enable branch protection on `main` requiring the CI workflow's `verify` job to pass before merge (`gh api repos/{owner}/{repo}/branches/main/protection` or the GitHub UI — one-time manual step)
- [X] T035 [US3] ~~Document the staging-vs-production mapping: `.env.staging.example` committed, `eas.json`'s `development`/`preview` profiles' `env` pointing at staging values, `production` unchanged~~ — **corrected (self-critique F6)**: an earlier pass added `eas.json` `env` blocks referencing fictional `<staging-project-ref>`/`<production-project-ref>` placeholders that don't correspond to any real project; since there's only one real Supabase project (per T002/FR-013's amendment), those blocks would have injected broken URLs into any real EAS build. Reverted `eas.json` to its pre-F5 state (no per-profile `env` overrides — builds use `.env`/`.env.local` like every prior feature). `.env.staging.example` is kept as a template for if/when a real second project is created, but nothing currently wires it in.

**Checkpoint**: All three user stories independently functional — quickstart.md Scenarios 8-10 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Run full `npx jest` and `npx tsc --noEmit`; fix any regressions from the channel rename (T008) or the `useExpenses` split (T029) — 16/16 suites, 123/123 tests pass; typecheck clean. Along the way, fixed two pre-existing gaps this work surfaced: RNTL v14's `render()` must be `await`ed (new test files only), and AsyncStorage needed its official Jest mock wired in (`jest.setup.js`) since `src/lib/deviceId.ts` is this project's first real usage
- [ ] T037 Run `quickstart.md` Scenarios 1-10 end-to-end against staging (physical device, Sentry dashboard, a real GitHub PR) — left unchecked here for the user to perform, per F3/F4 precedent for device/infra-level manual validation that Jest can't exercise

---

## Phase 7: Remediation (post-implementation `/speckit-analyze` self-critique, 2026-07-24)

A cross-artifact analysis across F1-F5 surfaced 2 CRITICAL and 4 HIGH findings, all introduced or left unresolved by this feature. Resolved:

- [X] T038 (self-critique F2, CRITICAL) — `AuthProvider.signOut()`'s push-token revoke was a single best-effort attempt (console.error only, no retry, invisible without Sentry). Added `supabase/migrations/0006_push_token_reassignment.sql`: a `security definer` trigger that deletes any other user's `push_tokens` row sharing the same `expo_push_token` on insert/update — makes cross-user notification leakage self-healing on the next sign-in regardless of whether a prior revoke succeeded. Applied to the live project and verified directly (inserted two rows sharing a token under different users; confirmed the older row was auto-deleted). Also hardened the client path: `signOut()` now retries the revoke (2 retries, 250ms/750ms backoff) and reports failures via `Sentry.captureException`, not just `console.error`.
- [X] T039 (self-critique F1, CRITICAL) — `spec.md`'s FR-013/SC-008 and the User Story 3 acceptance scenario asserted an isolated staging environment as a MUST/100% guarantee that the actual deployment (T018/T019, to the project's one real Supabase project) does not meet. Amended all three in place (strikethrough + note, matching this project's existing convention for corrected requirements — see F3/spec.md's calendar-month precedent) rather than leaving the spec asserting something false.
- [X] T040 (self-critique F5, HIGH) — `usePushRegistration` only ran once, on `SIGNED_IN`; a user who denied notification permission at sign-in and granted it later never got registered until their next sign-in/out cycle. `useNotificationReconciliation` (already re-run on every foreground/mutation since F4) now also calls `registerPush` opportunistically on every invocation — no new listener needed.
- [X] T041 (self-critique F6, HIGH) — `eas.json`'s per-profile `env` blocks referenced fictional `<staging-project-ref>`/`<production-project-ref>` placeholders that don't correspond to any real project; since there's only one real project, these would have injected broken URLs into any actual EAS build. Reverted `eas.json` to its pre-F5 state.
- [X] T042 (self-critique F3, HIGH) — Removed stale "magic-link" language from `specs/001-.../plan.md`, `tasks.md`, and `data-model.md`, left over from F1's mid-implementation pivot to email+password auth (which `spec.md` and `contracts/auth-flow.md` already correctly reflected).
- [X] T043 (self-critique F4, HIGH) — Fixed `specs/003-.../plan.md`'s Summary and Constraints sections, which had regressed to describing a "next-calendar-month total" — the exact reading spec.md's own Assumptions document as already having been found wrong and corrected once. Also fixed the equivalent stale wording in `tasks.md`'s Phase 4 header/Goal/Independent Test.
- [X] T044 (self-critique F7/F8, MEDIUM) — Added "superseded by F5" notes to `specs/002-.../plan.md` and `specs/003-.../plan.md` (both described the now-replaced single `useExpenses()` hook) and to `specs/004-.../data-model.md` (described `notifications_log.channel` as defaulting to `'push'`, unaware of F5's `'local'`/`'server'` values).
- [X] T045 (self-critique F9, MEDIUM) — Documented the grouped-digest partial-redundancy behavior (a "due tomorrow" digest can re-mention an expense already separately notified) as an explicit Edge Case in `spec.md`, matching the existing code comment in `filterUndelivered`.
- [X] T046 (self-critique F10, MEDIUM/Constitution VI) — `dashboard/selectors.ts`'s two amount-based sort comparators used raw `b.amount - a.amount` float subtraction instead of `toCents`-based comparison, present since F3. Fixed both.
- [X] T047 (self-critique F13, LOW) — Added a scoping comment to `tsconfig.json`'s `allowImportingTsExtensions`, so it's clear this is deliberately narrow (one cross-runtime import) rather than a general house style.
- [X] T048 — Fixed a regression T038 introduced: `AuthProvider.tsx` importing `@sentry/react-native` at module scope broke 3 test suites (`@sentry/core`'s nested ESM isn't Babel-transformed by default). Added a global mock in `jest.setup.js`.

**Not resolved — genuinely require your action, unchanged from before this pass**: T002 (real staging project), T025 (Sentry account), T034 (branch protection).

**Checkpoint**: `npx jest` — 16/16 suites, 123/123 tests pass. `npx tsc --noEmit` — clean. Migration 0006 applied and verified live.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (T002's staging project creation is the only externally-gated step; everything else can proceed in parallel)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; T023/T024 extend the same `index.ts`/`db.ts` files US1 creates (T015-T017), so it runs after Phase 3 in this solo-iteration plan even though it's conceptually independent — matching how F4 sequenced US1→US2
- **User Story 3 (Phase 5)**: Depends on Foundational only; fully independent of US1/US2's push-delivery internals (different files entirely)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T001-T004 (Setup) can all run in parallel
- T005-T006 (Foundational) can run in parallel; T007 depends on T005/T006, T008 is independent of both
- T009 and T010 (US1 tests) are separate files and can run in parallel
- T020 (US2 test) can start as soon as Foundational is done, in parallel with all of Phase 3
- T026 and T027 (US3 tests) are separate files and can run in parallel with each other and with Phases 3-4
- Once Foundational completes, Phase 3 and Phase 5 (US1 and US3) can proceed fully in parallel — they share no files

---

## Parallel Example: User Story 1

```bash
# Launch both US1 tests together:
Task: "Write tests/unit/pushTokenApi.test.ts covering upsert/delete scoping"
Task: "Write tests/unit/notificationDedupe.test.ts covering filterUndelivered"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md Scenarios 1-3, 5 — real push notifications arrive against staging, deduped correctly, revoked on sign-out
5. Continue to US2 → US3 → Polish incrementally, each independently testable per quickstart.md

### Incremental Delivery

1. Setup + Foundational → shared plumbing ready
2. US1 → real push notifications work end-to-end against staging (the F5 roadmap item's core value)
3. US2 → the push pipeline becomes trustworthy over time (alerting, pruning) and the app stops white-screening on errors
4. US3 → the app stays fast at scale and future changes (especially more unattended server code) ship safely

### Note on scope

This feature bundles five previously-separate concerns per explicit product decision (Constitution IX violation, justified in plan.md's Complexity Tracking). If capacity is limited, US1 alone is a legitimate stopping point that already delivers the roadmap's stated F5 value — US2 and US3 harden it but aren't required for push notifications to function.
