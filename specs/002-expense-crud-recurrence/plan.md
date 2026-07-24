# Implementation Plan: Expense CRUD & Recurrence

**Branch**: `002-expense-crud-recurrence` | **Date**: 2026-07-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-expense-crud-recurrence/spec.md`

## Summary

Give signed-in users real expense tracking: an `expenses` table (RLS-scoped
to `auth.uid()`) plus an add/edit sheet on the Add tab (replacing F1's
placeholder) and a delete action, supporting monthly/yearly recurrence and a
mark-as-paid action that rolls a recurring expense forward to its next due
date while preserving the paid occurrence as history. Technical approach:
extend the existing Supabase schema with an `expenses` table and a
Postgres-side roll-forward so "mark paid + create next occurrence" is one
atomic operation (avoiding the double-roll-forward race called out in the
spec's edge cases), fetched/mutated through TanStack Query for offline-
tolerant reads, presented via a NativeWind-styled bottom sheet.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (constitution I) — Expo SDK 54 (React Native 0.81, React 19)

**Primary Dependencies**: `@supabase/supabase-js` (data + RLS), `@tanstack/react-query` (fetch/cache/mutate, offline-tolerant per constitution IV), `@gorhom/bottom-sheet` (add/edit sheet UI — chosen over a bare `Modal` because `react-native-gesture-handler` and `react-native-reanimated` are already project dependencies from the Expo Router scaffold, so it adds no new native-module surface; also its `BottomSheetTextInput`/`BottomSheetScrollView`/`BottomSheetBackdrop` subcomponents, adopted during Phase 7/8 patches to fix keyboard-avoidance and touch-routing bugs a bare `TextInput`/`Modal` had inside the sheet — see research.md #5–#6), existing `src/theme` NativeWind tokens for styling

**Storage**: Supabase Postgres — new `expenses` table (RLS-scoped to `auth.uid()`, FK to the existing `categories` table from F1); TanStack Query cache for offline-tolerant reads of the user's expense list

**Testing**: Jest + `jest-expo` (unit tests for recurrence date-rolling math and mark-as-paid/roll-forward logic); React Native Testing Library (component tests for the add/edit sheet and validation states) — per constitution VIII

**Target Platform**: iOS 15+ and Android (Expo managed workflow, same single codebase as F1)

**Project Type**: mobile-app (single Expo project; Supabase remains the only backend, constitution II)

**Performance Goals**: Add-expense sheet opens and is interactive within one frame of tapping Add (no spinner before the form is usable); save round-trip feels instant via optimistic cache update, reconciled against the server response

**Constraints**: Must show previously-loaded expenses with no network connection (constitution IV); mark-as-paid roll-forward must be atomic — never zero or two next-occurrences from one action (spec FR-010); all monetary math uses integer cents or a decimal-safe representation, never native JS floats (constitution VI); every new table carries RLS scoped to `auth.uid()` (constitution II)

**Scale/Scope**: Single-user MVP1 scope — 1 new table (`expenses`), 1 add/edit sheet, 1 delete action, 1 mark-as-paid action with roll-forward; no dashboard rendering of this data yet (that's F3) and no notification scheduling yet (that's F4)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Check for this feature | Status |
|---|-----------|------------------------|--------|
| I | Mobile-First Delivery | Expo + Expo Router + TypeScript strict continues unchanged; add/edit sheet built with existing RN primitives | PASS |
| II | Supabase-Only Backend | Only new backend surface is the `expenses` table on the same Supabase project; RLS policy scoped to `auth.uid()`; no custom server | PASS |
| III | Free-Tier Discipline | `@gorhom/bottom-sheet` is free/open-source and adds no new native peer deps beyond what's already installed; no new paid service | PASS |
| IV | Offline-Tolerant by Default | Expense list read through TanStack Query cache; app must render previously-fetched expenses with no network, per FR/edge case on offline add | PASS |
| V | Notifications Are Core | N/A for this feature — no rules or scheduled notifications exist yet (F4); expense/recurrence mutations here have nothing to reconcile against yet | N/A (justified in spec Assumptions) |
| VI | Money as Exact Decimal | `amount` stored as `numeric(12,2)`; all in-app validation/comparison (positive-amount check, roll-forward carry-over) treats amount as a decimal-safe value, never a raw JS float in comparisons | PASS |
| VII | Consistent Modern UI | Add/edit sheet and expense list styled through the existing NativeWind theme tokens from F1; no unstyled default components | PASS |
| VIII | Spec-Driven Delivery | This plan + `/speckit-tasks` output + unit/component tests satisfy the requirement; F2 is complete | PASS |
| IX | Small, Mergeable Iterations | F2 is scoped to expense CRUD + recurrence only; dashboard rendering (F3) and notification scheduling (F4) are explicitly deferred | PASS |

No violations requiring justification — Complexity Tracking table below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-expense-crud-recurrence/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── expenses-schema.sql
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
app/
└── (tabs)/
    └── add.tsx                    # Replaces F1 placeholder: opens the add-expense sheet

src/
├── features/
│   └── expenses/
│       ├── expensesApi.ts         # Supabase queries/mutations: list, create, update, delete, markPaid
│       ├── useExpenses.ts         # TanStack Query hook: list expenses (offline-tolerant cache)
│       │                          # NOTE: superseded by F5, which split this into
│       │                          # usePlannedExpenses()/useExpenseHistory() (self-critique F7) —
│       │                          # this file describes F2's state at completion, not current code
│       ├── useExpenseMutations.ts # TanStack Query mutations: create/update/delete/markPaid
│       ├── recurrence.ts          # Pure date helpers: roll-forward + resolveMonthlyDueDate/resolveYearlyDueDate (month-end clamping)
│       ├── validation.ts          # Client-side validation (positive amount, required name, recurrence-conditional date fields)
│       ├── ExpenseSheet.tsx       # Add/edit bottom sheet (category, name, amount, recurrence, then conditional date field(s))
│       ├── CategoryPicker.tsx     # Compact collapsed/expandable category selector (added Phase 8 — not a native Modal, see research.md #6)
│       └── ExpenseList.tsx        # Interim list surface pending F3's Home dashboard
└── components/
    └── ConfirmDialog.tsx          # Shared delete-confirmation prompt (used by expense delete)

supabase/
└── migrations/
    └── 0002_expenses.sql          # expenses table + RLS policy + mark-paid roll-forward function — applied to project tvbyqwnwlrlsxvgemwls via the Management API

tests/
├── unit/
│   ├── recurrence.test.ts         # Monthly/yearly roll-forward math, incl. month-end clamping
│   └── expensesApi.test.ts        # markPaid roll-forward + idempotency against double-tap
└── component/
    └── expense-sheet.test.tsx     # Add/edit sheet validation and category-default behavior
```

**Structure Decision**: Extends F1's existing single-Expo-project layout —
new feature code lives in `src/features/expenses/` alongside the existing
`src/features/auth/` and `src/features/categories/`, following the same
pattern (API/hook/logic separated from the route file). The `add.tsx` route
is modified in place rather than duplicated, since F1 explicitly scaffolded
it as a placeholder for this feature to replace. The roll-forward-on-mark-
paid logic is implemented as a Postgres function invoked via RPC (see
`research.md`) rather than two round-tripped client calls, so it stays
atomic per FR-010 without needing a client-side lock.

## Complexity Tracking

*No entries — Constitution Check reported no violations for this feature.*
