---

description: "Task list for Tab Bar Visibility Fix & On-The-Day Default Reminder"
---

# Tasks: Tab Bar Visibility Fix & On-The-Day Default Reminder

**Input**: Design documents from `/specs/007-tabbar-visibility-default-reminder/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included — per constitution VIII (Spec-Driven Delivery: "every feature MUST ship with... tests") and constitution V (notification reconciliation logic MUST be covered by tests), both user stories get unit test coverage; this mirrors the existing `tests/unit/seedCategories.test.ts` and `tests/unit/notificationEngine.test.ts` patterns already in the repo.

**Organization**: Tasks are grouped by user story (US1 = P1 tab bar visibility, US2 = P1 on-the-day default reminder) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are exact and relative to the repo root

## Path Conventions

Single Expo project (mobile-app + web export) per plan.md — `src/`, `app/`, `tests/` at repo root; no new top-level directories.

---

## Phase 1: Setup

**Purpose**: Confirm the existing toolchain already supports both fixes with zero new dependencies (per plan.md's Technical Context) before touching code.

- [X] T001 Confirm `react-native-safe-area-context` (already used by `src/features/expenses/ExpenseSheet.tsx`) exports `useSafeAreaInsets`, and that RN's `shadow*`/`elevation` style props are already used elsewhere without a bundler config change needed — verification only, no file changes; note findings for T004 (confirmed: `react-native-safe-area-context ~5.6.0` already a dependency, exports `useSafeAreaInsets`; no new dependency needed)

**Checkpoint**: Confirmed no dependency/config changes are needed; implementation can begin directly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish a known-green baseline before touching the tab bar layout and the rule-seeding logic, so any later regression is attributable to this feature's changes.

**⚠️ CRITICAL**: Do not proceed to Phase 3+ until this baseline is confirmed.

- [X] T002 Run `npm test && npm run typecheck` and confirm the existing suite passes cleanly (verification only — no files change in this task); record the passing count as the baseline for comparison after this feature's changes (baseline: 124/124 tests, 17/17 suites, typecheck clean)

**Checkpoint**: Baseline confirmed green — user story work can now begin.

---

## Phase 3: User Story 1 - A tab bar users can actually see and trust (Priority: P1) 🎯 MVP

**Goal**: The bottom tab bar is visually distinct from page content and never obscured by a device's bottom safe-area inset, on native and web, in light and dark mode, per [contracts/tab-bar-visibility-contract.md](./contracts/tab-bar-visibility-contract.md).

**Independent Test**: On a mobile-width viewport (with and without a simulated safe-area inset), confirm the tab bar is clearly separated from page content and fully clear of the home-indicator area, in both themes (quickstart.md US1).

### Tests for User Story 1

- [X] T003 [P] [US1] Create `tests/unit/tabBarStyle.test.ts`: unit-test the new `getTabBarStyle(insets, colors)` pure helper (to be created in T004) against `contracts/tab-bar-visibility-contract.md`'s rule — asserts `paddingBottom === Math.max(insets.bottom, 8)` for both a zero inset and a non-zero (e.g. `34`) inset, `height === 56 + insets.bottom`, `backgroundColor` equals the passed-in `colors.surface` (not `colors.background`) for both `themeColors.light` and `themeColors.dark`, and that a shadow/elevation field is present in the returned object

### Implementation for User Story 1

- [X] T004 [US1] Create `src/theme/tabBarStyle.ts` exporting `getTabBarStyle(insets: { bottom: number }, colors: ThemeColors)`: returns a style object per the contract — `backgroundColor: colors.surface`, `borderTopColor: colors.border` (existing hairline, kept), `paddingBottom: Math.max(insets.bottom, 8)`, `height: 56 + insets.bottom`, plus `elevation: 8` (Android) and `shadowColor: "#000000"`, `shadowOffset: { width: 0, height: -2 }`, `shadowOpacity: 0.1`, `shadowRadius: 4` (iOS/web — React Native Web translates these into `box-shadow`) — added `ThemeColors` type export to `src/theme/colors.ts` for this
- [X] T005 [US1] In `app/(tabs)/_layout.tsx`, import `useSafeAreaInsets` from `react-native-safe-area-context` and `getTabBarStyle` from `@/theme/tabBarStyle`; replace the inline `tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border }` in `screenOptions` with `tabBarStyle: getTabBarStyle(useSafeAreaInsets(), colors)` (depends on T004)
- [X] T006 [P] [US1] Extend `tests/component/tabs-layout.test.tsx`: change the `expo-router` mock's `Tabs` from a plain passthrough component to a `jest.fn()`-wrapped component that records its received props, and add an assertion (in the "renders all four tabs for a signed-in user" test) that `Tabs` was called with a `screenOptions.tabBarStyle.backgroundColor` matching `themeColors.light.surface` — confirms the wiring from T005, not just the pure helper from T003/T004; also wrapped the render tree in `SafeAreaProvider` (required since `_layout.tsx` now calls `useSafeAreaInsets`)
- [X] T007 [US1] Manually verify [quickstart.md](./quickstart.md) US1 steps: web at 390px width in light and dark OS theme — confirmed via Playwright screenshot against the local dev server: the tab bar now has a visible surface-color/shadow separation and comfortable bottom padding in both themes, vs. the flush/flat-bordered bar beforehand. iOS simulator and Android emulator checks were **not** performed in this session (no simulator/device available in this environment) — left for manual on-device verification

**Checkpoint**: User Story 1 is fully functional and independently verifiable — the tab bar is clearly visible and safe-area-clear everywhere.

---

## Phase 4: User Story 2 - Every upcoming payment gets a same-day reminder (Priority: P1)

**Goal**: A third default rule reminds users on an expense's due date, for all amounts; new sign-ups get it automatically and existing users get it backfilled without disturbing rules they already disabled, per [contracts/default-rule-backfill-contract.md](./contracts/default-rule-backfill-contract.md).

**Independent Test**: For an untouched-default-rules account, an expense due today produces a reminder regardless of amount; a new sign-up ends up with 3 enabled default rules; an existing user with a disabled default rule doesn't get it silently re-enabled (quickstart.md US2).

### Tests for User Story 2

- [X] T008 [P] [US2] In `tests/unit/notificationEngine.test.ts`, add a test case to the existing `"computeDesiredNotifications — grouped digest"` describe block: a `days_before: 0`, `is_grouped: true`, `min_amount: null` rule against an expense whose `due_date` equals `todayIso`, asserting a grouped candidate is produced regardless of the expense's `amount` (research.md #4 — confirms the existing engine needs no change for `days_before: 0`)
- [X] T009 [P] [US2] Create `tests/unit/seedRules.test.ts` (mirroring `tests/unit/seedCategories.test.ts`'s Supabase-mock pattern, adapted for a `.select("name")` query instead of `.select("id")`): cover (a) zero existing rules → all 3 `DEFAULT_RULES` inserted; (b) the two original default names already present → only `"Due today"` is inserted, in a single batched call; (c) all 3 default names already present → no insert call at all; (d) one default name present with `enabled: false` → that row is left untouched (not re-inserted, not re-enabled) while a genuinely missing default is still added — per [contracts/default-rule-backfill-contract.md](./contracts/default-rule-backfill-contract.md)

### Implementation for User Story 2

- [X] T010 [US2] In `src/features/rules/defaultRules.ts`, add a third `DEFAULT_RULES` entry: `name: "Due today"`, `is_grouped: true`, `min_amount: null`, `category_ids: null`, `days_before: 0`, `repeat_days_before: null` — leave the two existing entries byte-for-byte unchanged (FR-010)
- [X] T011 [US2] Rewrite `src/features/rules/seedRules.ts`: change the existence query from `.select("id").limit(1)` to `.select("name")` (no `.limit`, need all existing names); build a `Set` of existing rule names; filter `DEFAULT_RULES` to entries whose `name` is not in that set; if the filtered list is empty, return without calling insert; otherwise insert only the filtered rows in a single batched call, exactly as today (depends on T010 for the updated `DEFAULT_RULES`, and should be written/verified against the T009 fixtures)
- [X] T012 [US2] Manually verify [quickstart.md](./quickstart.md) US2 steps: **existing-user backfill case confirmed live** — signed in as the pre-existing E2E test account (`e2e-test@mindyourmoney.app`, seeded before this change under the old two-default set) via a local dev server, and the rendered Rules screen shows all 3 rules ("Big expense ahead", "Due tomorrow", "Due today"), all Enabled, confirming the backfill fired correctly on sign-in without disturbing the two pre-existing rows. New-user-signup and already-disabled-default cases were **not** re-verified against a live account (to avoid mutating the shared E2E test account's rule state, which the spec-006 E2E suite depends on) — these are covered deterministically by the T009 unit test fixtures instead. Amount-independence is covered by T008.

**Checkpoint**: Both user stories are independently functional — the tab bar fix and the due-date reminder both work on their own.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing regressed and the delivered artifacts match what was planned.

- [X] T013 [P] Run the full regression pass — `npm test && npm run typecheck` — and confirm all tests pass, including T003, T006, T008, and T009, with no change to any pre-existing test's expected behavior (136/136 tests, 19/19 suites, typecheck clean — up from the 124/124, 17/17 baseline recorded in T002)
- [X] T014 Review [contracts/tab-bar-visibility-contract.md](./contracts/tab-bar-visibility-contract.md) and [contracts/default-rule-backfill-contract.md](./contracts/default-rule-backfill-contract.md) against the implemented code and confirm every rule in both is satisfied — confirmed: `getTabBarStyle` (`src/theme/tabBarStyle.ts`) satisfies all 3 tab-bar rules (surface background + elevation, `Math.max(insets.bottom, 8)` padding, unchanged tap-target sizing); `seedRules`'s name-diffing (`src/features/rules/seedRules.ts`) satisfies all 4 backfill rules (exactly 3 `DEFAULT_RULES`, per-name presence check regardless of `enabled`, single batched insert, unchanged dedup path)
- [X] T015 Run the regression check section of [quickstart.md](./quickstart.md) — confirmed via `git diff`: the two existing `DEFAULT_RULES` entries ("Big expense ahead", "Due tomorrow") are byte-for-byte unchanged, and the live Rules-screen check in T012 shows both still rendering with their original thresholds/timing ("≥ €200.00 · 5 days before · +1-day repeat" and "Any amount · 1 days before") and `Enabled` state

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-4)**: Both depend on Foundational (T002). US1 (T003-T007) and US2 (T008-T012) touch entirely disjoint files (`app/(tabs)/_layout.tsx` + `src/theme/tabBarStyle.ts` vs. `src/features/rules/defaultRules.ts` + `seedRules.ts`) and have no dependency on each other — either order, or full parallelization, works
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- US1: T003 (test) and T004 (helper it tests) are naturally sequenced (write the test against the helper's intended contract, then implement — or implement first, either is fine since this is a small pure function); T005 (wiring) depends on T004; T006 (component-test wiring assertion) depends on T005; T007 (manual verification) comes last
- US2: T008 and T009 (tests) can be written in parallel with each other; T010 (add the rule constant) is independent of the tests and can happen anytime before T011; T011 (seeding logic) depends on T010; T012 (manual verification) depends on T010 and T011

### Parallel Opportunities

- T003 (US1 test) can be drafted in parallel with T008/T009 (US2 tests) — different files, different stories
- T006 (US1 component test) and T008/T009 (US2 unit tests) can run in parallel
- US1's entire phase (T003-T007) can be worked in parallel with US2's entire phase (T008-T012) by a different contributor, since they touch disjoint files

---

## Parallel Example: Both Stories Together

```bash
# Once Foundational (T002) is done, these can all start together:
Task: "Create tests/unit/tabBarStyle.test.ts for the new getTabBarStyle helper"
Task: "Add a days_before:0 grouped-digest test case to tests/unit/notificationEngine.test.ts"
Task: "Create tests/unit/seedRules.test.ts covering the name-diffing backfill logic"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003-T007)
4. **STOP and VALIDATE**: the tab bar is visibly fixed and independently verified
5. Ship this alone if needed — US2 adds real reminder-coverage value but US1 is a complete, independently shippable fix on its own

### Incremental Delivery

1. Setup + Foundational → baseline confirmed
2. Add User Story 1 → validate independently → the tab bar is fixed
3. Add User Story 2 → validate independently → every upcoming payment now gets a same-day reminder
4. Polish → full regression pass across both together

### Parallel Team Strategy

With two contributors, after Setup + Foundational:

- Contributor A: User Story 1 (tab bar) — `app/(tabs)/_layout.tsx`, `src/theme/tabBarStyle.ts`
- Contributor B: User Story 2 (default reminder) — `src/features/rules/defaultRules.ts`, `seedRules.ts`
- Both stories touch fully disjoint files and can land as two small, independent PRs, or one combined PR per this feature's bundled scope (plan.md Complexity Tracking)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at either checkpoint to validate a story independently
- Neither story requires a database migration or new Supabase Edge Function deploy — both are client-code-only changes
