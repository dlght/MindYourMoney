# Implementation Plan: PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix

**Branch**: `006-pwa-e2e-layout-fix` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-pwa-e2e-layout-fix/spec.md`

## Summary

Three bundled quality-hardening items for the PWA shipped in F5.5: (1) fix a spurious
"save failed" error shown on the Add-expense sheet even when the expense was written
successfully — root-caused to an *unrelated* post-save step (local notification
reconciliation) throwing on web and that exception propagating back through
`mutateAsync` into the sheet's save `catch` block; (2) add consistent edge/safe-area
spacing across primary screens on mobile viewports; (3) add a Playwright-driven
browser E2E suite covering sign-in, every tab, and expense/rule CRUD against a
dedicated Supabase test account, runnable repeatedly without manual cleanup.

## Technical Context

**Language/Version**: TypeScript (strict mode), existing Expo/React Native 0.81 + Expo SDK 54 codebase; no new runtime language.

**Primary Dependencies**: `@playwright/test` (new devDependency — E2E runner/assertions); existing `react-native-safe-area-context` (already used in `add.tsx`/`ExpenseSheet.tsx`, extended to remaining screens); existing `expo-notifications`, `@tanstack/react-query` (root cause of the bug fix, no new dependency).

**Storage**: N/A for schema — no new tables/columns. A dedicated Supabase Auth user ("test account") is provisioned as data, not schema, and reuses existing `expenses`/`rules`/`categories` tables scoped by the existing per-user RLS policies.

**Testing**: Playwright (new) for browser E2E against the web build; existing Jest + `@testing-library/react-native` unit/component suite is unaffected and remains the tool for the bug-fix's regression test.

**Target Platform**: Web/PWA (Chromium via Playwright) for the E2E suite, since that's what "browser automation" targets per the spec's Assumptions; the spacing fix applies across all platforms (iOS/Android/Web) since `react-native-safe-area-context` is cross-platform; the error-fix applies to all platforms but is only *reproducible* on web today (see research.md #1).

**Project Type**: Single Expo project (mobile-app + web export) — no new project/package boundary.

**Performance Goals**: E2E suite completes in well under CI-timeout range (~target <5 min) so it's practical to run on every deploy per FR-008.

**Constraints**: E2E suite MUST be idempotent against the shared test account (FR-007); the error-fix MUST NOT suppress genuine save failures (FR-002); spacing changes MUST NOT clip or overlap existing content (FR-011) or double up with screens that already handle insets (`add.tsx` already omits the `bottom` edge deliberately — see research.md #2).

**Scale/Scope**: 4 primary screens for spacing (dashboard, add/expense sheet, rules, settings), 1 mutation hook fix (`useNotificationReconciliation`/`notificationScheduler`), 1 new E2E spec file covering ~8 scenarios.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Mobile-First Delivery** — PASS. Spacing fix reinforces mobile-first presentation; E2E suite targets the web export (an already-approved addition from the prior PWA feature), not a pivot away from mobile.
- **II. Supabase-Only Backend** — PASS. No new backend primitives. The E2E test account is a standard Supabase Auth user subject to the same RLS as any real user.
- **III. Free-Tier Discipline** — PASS. Playwright is open-source/free; runs in the existing free-tier GitHub Actions CI (from F5) with no paid service added.
- **IV. Offline-Tolerant by Default** — PASS (not touched). No change to caching/offline behavior.
- **V. Notifications Are Core, Never an Afterthought** — PASS, with a nuance the fix must honor: reconciliation still runs as part of the same mutation (`onSettled`); this feature changes only whether a reconciliation *failure* is misreported as a save failure, not whether reconciliation is attempted. See research.md #1 for the exact fix shape.
- **VI. Money as Exact Decimal** — PASS (not touched).
- **VII. Consistent Modern UI** — PASS. Spacing work directly serves this principle.
- **VIII. Spec-Driven Delivery** — PASS. This plan + upcoming tasks.md + tests satisfy the gate.
- **IX. Small, Mergeable Iterations** — see Complexity Tracking below; bundling three items is a deliberate, justified exception here, not a pattern to repeat casually.

No unjustified violations. One documented exception (IX) below.

**Post-design re-check** (after Phase 1 artifacts below): unchanged — the
research.md #1 fix shape (catch reconciliation errors at their existing
call site, add a platform guard) and the data-model.md conclusion (no
schema changes) don't introduce any new backend primitive, paid
dependency, or deviation beyond the IX exception already recorded. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-pwa-e2e-layout-fix/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/features/expenses/
├── ExpenseSheet.tsx           # US1: adjust save-error handling boundary
└── useExpenseMutations.ts     # US1: onSettled reconciliation error isolation

src/features/rules/
├── useNotificationReconciliation.ts  # US1: catch/report reconciliation failures locally
└── notificationScheduler.ts          # US1: web-platform guard (research.md #1)

app/(tabs)/
├── index.tsx                  # US3: safe-area edge spacing
├── add.tsx                    # US3: verify/extend existing edge spacing
├── rules.tsx                  # US3: safe-area edge spacing
└── settings.tsx                # US3: safe-area edge spacing

e2e/                             # US2: new — Playwright E2E suite (new top-level dir)
├── fixtures/
│   └── test-account.ts        # sign-in helper + cleanup utilities for the dedicated test account
├── expense-flows.spec.ts      # add/edit/delete expense scenarios
├── rule-flows.spec.ts         # add/edit/delete rule scenarios
└── navigation.spec.ts         # sign-in, tab navigation, sign-out

playwright.config.ts            # US2: new — Playwright project config (web build target)

tests/unit/                      # existing — regression test for the US1 fix
└── useNotificationReconciliation.test.ts  # new unit test asserting mutation errors aren't swallowed by reconciliation failures
```

**Structure Decision**: Single Expo project, unchanged. The bug fix and spacing fix
touch existing files in place (`src/features/...`, `app/(tabs)/...`). The E2E suite is
new and lives in a top-level `e2e/` directory (parallel to the existing `tests/`
directory, which stays Jest/RNTL-only) because Playwright specs use a different test
runner/config and asserting against a running browser instance is a fundamentally
different kind of test than the existing unit/component suite — keeping them in
separate directories avoids Jest attempting to collect `.spec.ts` Playwright files (and
vice versa).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| IX. Small, Mergeable Iterations — one feature bundles 3 distinct concerns (bug fix, UI polish, test infra) | All three are quality/robustness work on the same recently-shipped PWA surface, explicitly grouped together by the user as one delivery unit ("define new phase that include 3 things"); the E2E suite (US2) is also what will catch regressions in the other two going forward, so building it alongside them (rather than as a fully separate feature) lets it immediately cover the fix it ships with | Splitting into 3 separate Spec Kit features was considered, but each is individually small (a few files each) and none has a dependency the others need to wait on — three near-simultaneous single-file-scope features would add process overhead (3x spec/plan/tasks cycles) without a corresponding review-tractability benefit, since a reviewer would still look at one PR-sized diff either way |
