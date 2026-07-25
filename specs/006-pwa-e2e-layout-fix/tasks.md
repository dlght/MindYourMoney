---

description: "Task list for PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix"
---

# Tasks: PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix

**Input**: Design documents from `/specs/006-pwa-e2e-layout-fix/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included — a regression unit test (US1) and the E2E suite itself (US2, which *is* the deliverable) are both explicit requirements of this feature, not optional scaffolding.

**Organization**: Tasks are grouped by user story (US1 = P1 add-expense error fix, US2 = P2 E2E suite, US3 = P3 mobile spacing) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are exact and relative to the repo root

## Path Conventions

Single Expo project (mobile-app + web export) per plan.md — `src/`, `app/`, `tests/` at repo root, plus a new top-level `e2e/` directory for the Playwright suite.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the E2E toolchain in place before any US2 work begins; harmless no-op for US1/US3.

- [X] T001 Install `@playwright/test` as a devDependency and add a `"test:e2e": "playwright test"` script in `package.json` (also run `npx playwright install chromium` locally/document it as a one-time setup step); commit the resulting `package-lock.json` update
- [X] T002 [P] Create `playwright.config.ts` at the repo root: `testDir: "./e2e"`, base URL pointing at the locally-served web build (e.g. `http://localhost:4173`), and a `webServer` block that runs `npm run build:web` then serves `dist/` (mirroring the `npx serve -p 4173 -s dist` pattern already used to verify the PWA conversion)
- [X] T003 [P] Create `.env.e2e.example` at the repo root documenting the required test-account env vars: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_BASE_URL` (with placeholder values, no real secrets)
- [X] T004 [P] Add `.env.e2e` to `.gitignore` so real test-account credentials are never committed

**Checkpoint**: Playwright is installed and configured; no test specs exist yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish a known-green baseline before touching three separate areas of the app, so any later regression is attributable to this feature's changes.

**⚠️ CRITICAL**: Do not proceed to Phase 3+ until this baseline is confirmed.

- [X] T005 Run `npm test && npm run typecheck` and confirm the existing suite passes cleanly (verification only — no files change in this task); note the passing count as the baseline for comparison after US1's changes (baseline: 123/123 tests, 16/16 suites, typecheck clean)

**Checkpoint**: Baseline confirmed green — user story work can now begin.

---

## Phase 3: User Story 1 - Trustworthy expense creation (Priority: P1) 🎯 MVP

**Goal**: Adding an expense that saves successfully never shows an error message; a genuinely failed save still does.

**Independent Test**: Add a valid expense on the web build → expense appears, no error shown (per [quickstart.md](./quickstart.md) US1 steps). Go offline, attempt another add → error IS shown.

### Implementation for User Story 1

- [X] T006 [P] [US1] In `src/features/rules/notificationScheduler.ts`, add a platform guard so `reconcileScheduledNotifications` and `hasNotificationPermission` return early (no-op / `false`) on `Platform.OS === "web"` instead of calling unsupported `expo-notifications` local-scheduling APIs (research.md #1, second fix)
- [X] T007 [US1] In `src/features/rules/useNotificationReconciliation.ts`, wrap the `await reconcileScheduledNotifications(...)` call in try/catch with `console.error` on failure, mirroring the existing `registerPush(...).catch(...)` pattern immediately below it (research.md #1, first fix; contracts/expense-save-error-contract.md)
- [X] T008 [P] [US1] Add `tests/unit/useNotificationReconciliation.test.tsx`: mock `notificationScheduler` so `reconcileScheduledNotifications` rejects, assert the hook's returned callback resolves without throwing (regression test for T007) — `.tsx` extension (not `.ts` as originally planned) since the test wraps the hook in a JSX provider tree
- [X] T009 [US1] Manually verify both scenarios from [quickstart.md](./quickstart.md) US1 section against the local web build: successful add shows no error (confirmed); offline add shows the real error (confirmed)

**Checkpoint**: User Story 1 is fully functional and independently verifiable — the add-expense error bug is fixed.

---

## Phase 4: User Story 2 - Automated regression safety net for the web app (Priority: P2)

**Goal**: A repeatable Playwright suite drives the web app through sign-in, every tab, and expense/rule CRUD, asserting on real UI state, safe to run repeatedly against one shared test account.

**Independent Test**: `npm run test:e2e` twice in a row against the test account both pass (SC-003); a deliberately broken flow fails only its own scenario (SC-005).

### Implementation for User Story 2

- [X] T010 [US2] Provision a dedicated Supabase Auth test account (email/password, out-of-band via Supabase dashboard or CLI) and record its real credentials in a local, gitignored `.env.e2e` (not committed) — matches `.env.e2e.example` from T003 (done ahead of sequence, reused for T009's manual verification)
- [X] T011 [US2] Create `e2e/fixtures/test-account.ts`: a Playwright fixture that signs in via the UI using the `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` env vars, plus a helper that generates unique run-scoped names (e.g. a timestamp/random suffix) for data created during a run (depends on T002, T010)
- [X] T012 [P] [US2] Create `e2e/navigation.spec.ts` covering the Sign in, Navigate every tab, and Sign out scenarios from [contracts/e2e-test-scenarios.md](./contracts/e2e-test-scenarios.md)
- [X] T013 [P] [US2] Create `e2e/expense-flows.spec.ts` covering Add/Edit/Delete expense scenarios from [contracts/e2e-test-scenarios.md](./contracts/e2e-test-scenarios.md), including per-scenario cleanup and the "no error message on successful save" assertion from [contracts/expense-save-error-contract.md](./contracts/expense-save-error-contract.md) (expected to pass once US1/T007 lands) — role-name selectors had to avoid the words Add/Edit/Delete/Save/Mark inside generated expense names to dodge Playwright's substring role-name matching against the sheet's own buttons; discovered and fixed during implementation
- [X] T014 [P] [US2] Create `e2e/rule-flows.spec.ts` covering Add/Edit/Delete rule scenarios from [contracts/e2e-test-scenarios.md](./contracts/e2e-test-scenarios.md), including per-scenario cleanup
- [X] T015 [US2] Add an E2E job to `.github/workflows/ci.yml`: build the web export, serve `dist/`, run `npm run test:e2e` using `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` from repository secrets (depends on T001-T004, T012-T014) — repo secrets must be added manually (no `gh` CLI available); documented in quickstart.md
- [X] T016 [US2] Validate per [quickstart.md](./quickstart.md) US2 steps: run the suite twice consecutively locally and confirm both pass (SC-003 — confirmed, 7/7 both times); temporarily break the Add button's `onPress` in `app/(tabs)/add.tsx`, rerun, confirm only the add-expense scenario fails, then revert (SC-005 — confirmed: all 3 expense scenarios failed with the shared Add-sheet flow broken, navigation and rule scenarios stayed green; reverted and reconfirmed 7/7)

**Checkpoint**: User Stories 1 AND 2 both work independently — the fix is verified and now permanently guarded by an automated suite.

---

## Phase 5: User Story 3 - Comfortable mobile layout (Priority: P3)

**Goal**: Consistent, safe-area-aware breathing room on all four primary screens per [contracts/layout-spacing-contract.md](./contracts/layout-spacing-contract.md).

**Independent Test**: On a mobile-width viewport, no content on Home/Add/Rules/Settings is flush against any screen edge (SC-004); nothing is clipped/overlapped as a result (FR-011).

### Implementation for User Story 3

- [X] T017 [P] [US3] Add top/bottom breathing-room padding beyond the existing safe-area insets in `src/features/dashboard/DashboardScreen.tsx` (all three render branches: error, empty, populated) per the spacing contract — fixed by normalizing children's `mx-4`→`mx-6` (UpcomingTotalCard, BiggestExpenseCard, UpcomingList); top/bottom already conformant
- [X] T018 [P] [US3] Add top/bottom breathing-room padding beyond the existing safe-area insets in `app/(tabs)/add.tsx` and list-end spacing above the tab bar in `src/features/expenses/ExpenseList.tsx` — `contentContainerStyle` horizontal 16→24, bottom 8→24
- [X] T019 [P] [US3] Add top/bottom breathing-room padding beyond the existing safe-area insets in `src/features/rules/RulesScreen.tsx` — FlatList `paddingHorizontal` 16→24
- [X] T020 [P] [US3] Add top/bottom breathing-room padding beyond the existing safe-area insets in `app/(tabs)/settings.tsx` — **required more than a class tweak**: discovered `SafeAreaView`'s own `className` is not compiled by NativeWind on web at all (confirmed via DOM inspection — its class list renders as inert text, zero matching CSS), so padding applied directly to it (the pre-existing pattern here) silently did nothing on web. Restructured to match the working pattern already used by `sign-in.tsx` and the other 3 tab screens: `SafeAreaView` carries only `flex-1`/background classes, and a new inner `View` carries the real `px-6 pt-4 pb-6` padding
- [X] T021 [US3] Normalize horizontal padding to a consistent 24px (`px-6`) on the outermost container of all four screens (depends on T017-T020) — verified via grep: no remaining `mx-4`/outer `px-4` on screen-edge containers
- [X] T022 [US3] Manually verify per [quickstart.md](./quickstart.md) US3 steps at two mobile viewport widths (e.g. 390×844 and 375×667): no edge-flush content, no clipping/overlap, list content has breathing room above the tab bar — verified programmatically (0 flush-edge elements on all 4 tabs at both widths) and visually via screenshots

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing regressed and the delivered artifacts match what was planned.

- [X] T023 [P] Run the full regression pass — `npm test && npm run typecheck` — and confirm all tests pass, including the new T008 unit test, with no change to any pre-existing test's expected behavior (124/124 tests, 17/17 suites, typecheck clean including `e2e/*` and `playwright.config.ts`)
- [X] T024 [P] Run the E2E suite once more (`npm run test:e2e`) against the final state of all three stories together and confirm a full pass (7/7 passed)
- [X] T025 Review [contracts/e2e-test-scenarios.md](./contracts/e2e-test-scenarios.md) against the implemented `e2e/*.spec.ts` files and confirm every listed scenario has a corresponding, passing test (all 9 scenarios covered: sign-in/navigate-tabs/sign-out in navigation.spec.ts; add/edit/delete-expense in expense-flows.spec.ts; add/edit/delete-rule in rule-flows.spec.ts; no leftover test data confirmed in Supabase)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T004 don't touch app code, so this is really just a verification gate) — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational (T005). US1 (T006-T009) has no dependency on US2/US3. US2 (T010-T016) is independent of US3 but its expense-flow assertions (T013) are only meaningful once US1/T007 has landed — implement in priority order (US1 → US2 → US3) rather than parallelizing US1/US2 to avoid a temporarily-failing E2E scenario. US3 (T017-T022) has no dependency on US1 or US2 and could run in parallel with either.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- US1: T006 and T008 can run in parallel; T007 is the core fix (depends conceptually on understanding T006 but touches a different file); T009 (manual verification) comes last
- US2: T010 (account provisioning) blocks T011 (fixture uses its credentials); T011 blocks T012-T014 (specs use the fixture); T015 (CI wiring) and T016 (validation) come after specs exist
- US3: T017-T020 (per-screen padding) are independent of each other; T021 (normalization pass) depends on all four landing first; T022 (manual verification) comes last

### Parallel Opportunities

- T002, T003, T004 (Setup) can run in parallel with each other and with T001
- T006 and T008 (US1) can run in parallel
- T012, T013, T014 (US2 spec files) can run in parallel once T011's fixture exists
- T017, T018, T019, T020 (US3 per-screen padding) can all run in parallel
- US3's entire phase can run in parallel with US1 and/or US2 by a different contributor, since it touches disjoint files

---

## Parallel Example: User Story 2

```bash
# After T011 (fixture) is done, launch all three spec files together:
Task: "Create e2e/navigation.spec.ts covering sign-in/tabs/sign-out"
Task: "Create e2e/expense-flows.spec.ts covering expense CRUD"
Task: "Create e2e/rule-flows.spec.ts covering rule CRUD"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004) — needed regardless, cheap to do first
2. Complete Phase 2: Foundational (T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. **STOP and VALIDATE**: the add-expense bug is fixed and independently verified
5. Ship this alone if needed — US2/US3 add safety-net and polish value but aren't required for the bug to be fixed

### Incremental Delivery

1. Setup + Foundational → toolchain ready, baseline confirmed
2. Add User Story 1 → validate independently → the core defect is gone (MVP)
3. Add User Story 2 → validate independently → regressions in US1 (and everything else covered) are now caught automatically
4. Add User Story 3 → validate independently → mobile layout no longer feels cramped
5. Polish → full regression pass across all three together

### Parallel Team Strategy

With multiple contributors, after Setup + Foundational:

- Contributor A: User Story 1 (small, fastest to land, unblocks a fully-passing US2 expense-flow scenario)
- Contributor B: User Story 3 (fully independent of US1/US2, disjoint files)
- User Story 2 starts once US1 lands (or in parallel, accepting that `e2e/expense-flows.spec.ts`'s success-path assertion will fail until US1 merges)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- The E2E test account (T010) holds real, if low-value, credentials — never commit `.env.e2e`; only `.env.e2e.example` (placeholders) is tracked
