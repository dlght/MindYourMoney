# Implementation Plan: Rules & Local Notifications

**Branch**: `004-rules-notifications` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-rules-notifications/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Users get automatic, on-device reminders before an expense is due, driven by
user-editable rules (amount threshold, days-before timing, optional category
filter, enable toggle). Two default rules ("Big expense ahead" ≥ €200 at
5-days/1-day-before, and "Due tomorrow" grouped digest) are seeded per user.
A rule/notification module computes the full desired set of local device
notifications from current rules + planned expenses, diffs it against what
`expo-notifications` currently has scheduled, and reconciles (cancels stale,
schedules missing) on every expense/rule mutation and on app foreground. A
new `rules` table and `notifications_log` table (both RLS-scoped) back the
rule editor and the audit trail.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), React Native 0.81 / React 19

**Primary Dependencies**: Expo SDK 54 (Expo Router, `expo-notifications` — new),
`@supabase/supabase-js`, `@tanstack/react-query`, `@gorhom/bottom-sheet` (rule
editor sheet, reusing the pattern established for the expense sheet)

**Storage**: Supabase Postgres — new `rules` and `notifications_log` tables,
RLS-scoped to `auth.uid()`, alongside existing `categories`/`expenses`

**Testing**: Jest + `jest-expo` preset, `@testing-library/react-native`
(unit tests for the pure rule-matching/notification-diff module, component
tests for the rules screen/editor, matching F2/F3 conventions)

**Target Platform**: iOS + Android via Expo (React Native), local on-device
notifications only (no server component this iteration)

**Project Type**: Mobile app (Expo Router tabs) + Supabase backend

**Performance Goals**: Reconciliation (rule evaluation + notification diff)
completes well within a single UI interaction (no perceptible delay after
saving an expense or a rule) for the expected personal-use scale (tens of
expenses/rules, not thousands)

**Constraints**: Offline-tolerant (Constitution IV) — reconciliation must not
block on network; local notification scheduling works with cached data.
Notifications MUST be reconciled synchronously with every expense/rule
mutation, never a deferred/best-effort follow-up (Constitution V).

**Scale/Scope**: Single user's own rules/expenses (RLS-isolated per
Constitution II); a handful of rules (2 seeded + user-added) evaluated
against a personal expense list (tens, not thousands, of rows)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Mobile-First Delivery | Rules screen + editor built in Expo Router/TypeScript strict, same as F1-F3 | PASS |
| II. Supabase-Only Backend | New `rules`/`notifications_log` tables on existing Supabase project, RLS scoped to `auth.uid()`, no new backend | PASS |
| III. Free-Tier Discipline | `expo-notifications` is free/open-source and needs no paid service (local scheduling only, no push service enrollment this iteration) | PASS |
| IV. Offline-Tolerant by Default | Reconciliation reads the offline-tolerant expense/rule caches already established (`useExpenses`); local notification scheduling itself requires no network | PASS |
| V. Notifications Are Core, Never an Afterthought | This *is* the notification-reconciliation principle's first implementation: every expense/rule mutation reconciles notifications synchronously, covered by unit tests on the pure diff function | PASS |
| VI. Money as Exact Decimal | Rule amount-threshold comparisons use integer cents, extracted to a shared `src/lib/money.ts` (reused by dashboard selectors) rather than native float comparison | PASS |
| VII. Consistent Modern UI | Rules screen/editor built on NativeWind design system, reusing the compact-row/expand pattern from the expense sheet's category picker | PASS |
| VIII. Spec-Driven Delivery | This spec/plan/tasks + unit + component tests satisfy the requirement before implementation is considered done | PASS |
| IX. Small, Mergeable Iterations | F4 is scoped to local notifications only; server push is explicitly deferred to F5 | PASS |

No violations — Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-rules-notifications/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── rules-schema.sql
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0003_rules_notifications.sql   # applied copy of contracts/rules-schema.sql

src/lib/
└── money.ts                # NEW: shared toCents() extracted from dashboard selectors

src/features/rules/
├── types.ts                 # Rule, NotificationLogEntry, trigger/candidate types
├── rulesApi.ts               # Supabase CRUD for rules (mirrors expensesApi.ts)
├── useRules.ts                # TanStack Query hook (mirrors useExpenses.ts)
├── useRuleMutations.ts         # create/update/delete/toggle mutations
├── notificationEngine.ts        # PURE: compute desired notification set from
│                                 rules+expenses+now; dedupe; grouped "due
│                                 tomorrow" digest — fully unit-testable
├── notificationScheduler.ts      # thin adapter: expo-notifications calls
│                                  (list/schedule/cancel) + notifications_log
│                                  writes; wraps notificationEngine's output
├── useNotificationReconciliation.ts  # hook wiring: runs scheduler after
│                                       expense/rule mutations and on AppState
│                                       'active' (foreground)
├── RulesScreen.tsx             # list of rules + permission-off banner (FR-014)
└── RuleSheet.tsx               # create/edit rule bottom sheet (reuses
                                  ExpenseSheet's compact category-picker pattern)

app/(tabs)/rules.tsx        # replaces F1 placeholder, wires RulesScreen
app/(tabs)/add.tsx           # updated: call reconciliation after expense save/delete
app/_layout.tsx or app/(tabs)/_layout.tsx  # AppState foreground reconciliation hook mounted once

tests/unit/
├── notificationEngine.test.ts   # rule matching, dedupe, grouping, past-trigger skip
└── money.test.ts                 # (if not already covered) toCents extraction

tests/component/
└── rules-screen.test.tsx        # list/create/edit/delete/disable, permission-off banner
```

**Structure Decision**: Single Expo app (no separate backend project, per
Constitution II — Supabase is the only backend). New feature module
`src/features/rules/` mirrors the existing `src/features/expenses/` and
`src/features/dashboard/` module shape (types → api → query hooks →
screens), keeping the pure computation (`notificationEngine.ts`) separate
from the thin OS/network adapters (`notificationScheduler.ts`,
`rulesApi.ts`) so the rule-matching logic itself needs no mocking beyond
plain data in unit tests.

## Complexity Tracking

*No violations — table not needed.*
