# Implementation Plan: Home Dashboard

**Branch**: `003-home-dashboard` | **Date**: 2026-07-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-home-dashboard/spec.md`

## Summary

Replace the Home tab's placeholder with a real dashboard: a next-30-days
expense list grouped by due date, an upcoming total scoped to that same
next-30-days window (not a calendar month — see spec.md's Assumptions on
why an earlier calendar-month reading was corrected; self-critique F4), and
a card highlighting the single biggest upcoming expense — plus
empty/offline/error states for all three. Technical approach: this is a
**read-and-derive**
feature with no new backend surface. It reuses F2's existing `useExpenses()`
TanStack Query hook (already offline-tolerant and RLS-scoped) as the single
data source, and adds a new `src/features/dashboard/` module of pure
selector functions (grouping, windowing, summing, tie-breaking) plus
presentational components that consume them. `useMarkExpensePaid()` from F2
is reused as-is for the Home list's mark-as-paid action (FR-014).

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (constitution I) — Expo SDK 54 (React Native 0.81, React 19)

**Primary Dependencies**: `@tanstack/react-query` (reuses F2's `useExpenses()`/`useMarkExpensePaid()` hooks unchanged — no new queries or mutations; **note**: F5 later split `useExpenses()` into `usePlannedExpenses()`/`useExpenseHistory()` and the Dashboard now uses `usePlannedExpenses()` — self-critique F8), existing `src/theme` NativeWind tokens for styling; no new native dependency is introduced

**Storage**: None new — reads the existing `expenses` table (F2, RLS-scoped to `auth.uid()`) exactly as F2 already exposes it; this feature adds no table, column, or RPC

**Testing**: Jest + `jest-expo` (unit tests for the pure date-window/grouping/tie-break/sum selectors, independent of any UI or network); React Native Testing Library (component tests for the dashboard's list/total/card rendering and its empty/error/offline states) — per constitution VIII

**Target Platform**: iOS 15+ and Android (Expo managed workflow, same single codebase as F1/F2)

**Project Type**: mobile-app (single Expo project; Supabase remains the only backend, constitution II)

**Performance Goals**: Home tab renders from cache (no spinner) when previously-fetched expense data exists, per constitution IV; grouping/windowing/summing over a user's expense list (expected: tens to low hundreds of rows for a single-user MVP) completes well within one frame, no visible jank on open

**Constraints**: Must render the last successfully fetched dashboard data with no network connection (constitution IV) rather than clearing to empty; the upcoming total's summation MUST use integer-cent arithmetic internally, never summing native JS floats directly (constitution VI), even though individual `amount` values already arrive as JS numbers per F2's existing `Expense` type; every derived value (grouping, window boundaries, tie-breaks) MUST be a pure, unit-testable function separate from rendering

**Scale/Scope**: Single-user MVP1 scope — one new read-only feature module (`src/features/dashboard/`), zero new tables/columns/RPCs; replaces the Home tab's F1-era placeholder only; no per-category breakdown or chart (deferred to F7 per spec Assumptions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Check for this feature | Status |
|---|-----------|------------------------|--------|
| I | Mobile-First Delivery | Expo + Expo Router + TypeScript strict continues unchanged; dashboard built with existing RN primitives | PASS |
| II | Supabase-Only Backend | No new backend surface at all — reads the existing F2 `expenses` table through the existing RLS-scoped hook; no new table, policy, or server | PASS |
| III | Free-Tier Discipline | No new dependency of any kind | PASS |
| IV | Offline-Tolerant by Default | Dashboard reads exclusively through `useExpenses()`'s TanStack Query cache; renders last-known data with no network, per FR-010 | PASS |
| V | Notifications Are Core | N/A for this feature — no rules or scheduled notifications exist yet (F4); this is a read/derive feature over existing expense data with no notification-affecting mutation beyond the already-covered mark-as-paid | N/A (justified in spec Assumptions) |
| VI | Money as Exact Decimal | Next-month total summation performed in integer cents internally (see research.md), never by summing raw floats; display formatting matches existing F2 convention | PASS |
| VII | Consistent Modern UI | Dashboard list/cards/empty-states styled through the existing NativeWind theme tokens from F1/F2; no unstyled default components | PASS |
| VIII | Spec-Driven Delivery | This plan + `/speckit-tasks` output + unit/component tests satisfy the requirement | PASS |
| IX | Small, Mergeable Iterations | F3 is scoped to the Home dashboard only; rules/notifications (F4), server push (F5), custom categories/budgets (F6), and monthly insights/charts (F7) are explicitly deferred | PASS |

No violations requiring justification — Complexity Tracking table below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-home-dashboard/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature introduces no new Supabase table,
column, policy, or RPC — it reads the existing F2 `expenses` table through
the existing `useExpenses()` hook unchanged, so there is no new
schema/interface contract to document.

### Source Code (repository root)

```text
app/
└── (tabs)/
    └── index.tsx                  # Replaces F1 placeholder: renders DashboardScreen

src/
└── features/
    └── dashboard/
        ├── selectors.ts           # Pure functions: shared planForNext30Days filter, group/
        │                          # total/biggest-expense derivations (all three share the
        │                          # exact same next-30-days/planned window — research.md #3
        │                          # round 2 patch, #7), integer-cent summation; no I/O, no React
        ├── DashboardScreen.tsx    # Composes the three sections; owns the top-level empty/
        │                          # offline/error states (FR-009–FR-011); wires mark-as-paid
        ├── UpcomingList.tsx       # Renders the grouped next-30-days list with date-group
        │                          # headings ("Today" vs. localized date) and a per-row
        │                          # mark-as-paid action (FR-001–FR-004, FR-014)
        ├── UpcomingTotalCard.tsx  # Renders the upcoming total (FR-005) — renamed from
        │                          # MonthlyTotalCard once its data source was retargeted to
        │                          # the shared next-30-days window (research.md #3)
        └── BiggestExpenseCard.tsx # Renders the biggest-upcoming-expense card or its
                                   # empty state (FR-006–FR-008)

tests/
├── unit/
│   └── dashboard-selectors.test.ts   # Windowing, grouping, tie-break, and integer-cent sum
│                                     # math — covers spec Edge Cases (zero-expense,
│                                     # all-excluded-by-status) and that the upcoming total
│                                     # tracks a status change, with no DB/UI
└── component/
    └── dashboard-screen.test.tsx     # Empty states (US1–US3 edge cases), error state with
                                       # retry, offline-renders-last-known-data, and mark-as-
                                       # paid interaction from the Home list, including its
                                       # effect on the upcoming total
```

**Structure Decision**: Extends F1/F2's existing single-Expo-project layout
with one new feature module, `src/features/dashboard/`, alongside
`src/features/auth/`, `src/features/categories/`, and `src/features/expenses/`
— following the same pattern of separating pure logic (`selectors.ts`) from
presentational components. `app/(tabs)/index.tsx` is modified in place
(replacing the placeholder scaffolded in F1 specifically for this feature),
the same way F2 modified `add.tsx` in place. `src/features/expenses/` is
otherwise untouched: `useExpenses()` and `useMarkExpensePaid()` are imported
as-is, and the Add tab's own flat `ExpenseList.tsx` (used there for
selecting an expense to edit) is intentionally left alone, per the spec's
Assumptions — the two screens serve different purposes (browse-and-edit vs.
at-a-glance dashboard) and are not meant to converge into one component.

## Complexity Tracking

*No entries — Constitution Check reported no violations for this feature.*
