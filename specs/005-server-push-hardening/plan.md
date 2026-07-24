# Implementation Plan: Server Push Notifications & Production Hardening

**Branch**: `005-server-push-hardening` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-server-push-hardening/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Reminders currently only fire while the app is open enough to reconcile
locally (F4); this feature adds a daily Supabase Edge Function, triggered by
`pg_cron`, that evaluates every user's enabled rules against their planned
expenses and sends real push notifications via Expo's push API, so reminders
arrive even after the app has been closed for days. It reuses F4's existing
pure rule-matching logic (`notificationEngine.ts`) rather than duplicating
it, dedupes against the existing `notifications_log` table so local and
server reminders never double-fire, and prunes push registrations for
devices that stop being reachable. Bundled into the same slice, per explicit
product decision, is the operational hardening needed to run this safely
unattended for the first time: a CI pipeline, a root error boundary +
Sentry crash/error reporting (also used for cron-failure alerting), a
staging Supabase project isolated from production, and bounding the
previously-unbounded "Expenses" tab query so it doesn't degrade for
long-lived accounts.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode) for the app; TypeScript
on Deno (Supabase Edge Functions runtime) for the new server-side function

**Primary Dependencies**: Expo SDK 54, `expo-notifications` (push token
registration, extending F4's existing local-notification usage),
`@supabase/supabase-js`, `@tanstack/react-query` (`useInfiniteQuery` for
pagination — new usage), `@sentry/react-native` (new) and Sentry's Deno
integration (new, Edge Function only); Supabase Postgres extensions
`pg_cron` and `pg_net` (new, both included on Supabase's free tier)

**Storage**: Supabase Postgres — new `push_tokens` table (RLS-scoped); no
schema change to `notifications_log`, only a change in what value its
existing `channel` column is written with. A second, staging Supabase
project (new) mirrors the same schema for isolated testing.

**Testing**: Jest + `jest-expo` (existing) for all app-side unit/component
tests, including the pagination hook and the push-token registration hook.
The Edge Function's own HTTP/Deno glue is validated via `quickstart.md`'s
manual scenarios (matching how F4's `notificationScheduler.ts` OS adapter is
validated), while its reused rule-matching core stays covered by F4's
existing `notificationEngine.test.ts` since no new copy of that logic is
introduced. New: a GitHub Actions workflow runs `typecheck` + `test` on
every PR.

**Target Platform**: iOS + Android via Expo (unchanged), plus a new
always-available server-side component (Supabase Edge Function) that runs
independent of any device being online

**Project Type**: Mobile app (Expo Router tabs) + Supabase backend,
extended with one scheduled serverless function

**Performance Goals**: The "Expenses" tab's initial render must not depend
on total historical row count (bounded first page); the daily evaluation
job must complete well within its scheduling interval for the expected
personal-scale user count (this remains a single/small-household app, not a
multi-tenant SaaS product)

**Constraints**: Offline-tolerant (Constitution IV) — the pagination change
must still serve a cached first page with no network, same as today;
notification reconciliation must keep seeing every planned expense
regardless of the "Expenses" tab's pagination (research.md #8), or F4's
delivery guarantees silently regress. Server-sent and locally-sent
reminders must never double-deliver (FR-004).

**Scale/Scope**: Same personal/household scale as prior features — a
handful of users, each with a handful of devices; the "long history" being
guarded against is calendar time (years of past expenses), not concurrent
user volume.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Mobile-First Delivery | New client code (push registration, error boundary, paginated list) stays in Expo Router/TypeScript strict | PASS |
| II. Supabase-Only Backend | New `push_tokens` table + Edge Function + `pg_cron`/`pg_net` are all native Supabase primitives; RLS enforced on `push_tokens`; no custom server introduced | PASS |
| III. Free-Tier Discipline | `pg_cron`/`pg_net` are included on Supabase's free tier; Sentry's Developer tier (5k errors/mo + Cron Monitoring) is free; GitHub Actions free minutes cover solo-dev PR volume; a second Supabase project is free-tier eligible but subject to the account's free-project count limit | PASS, with a one-time limit check flagged in research.md #9 |
| IV. Offline-Tolerant by Default | Local reconciliation (F4) is unchanged and remains the offline-available path; the "Expenses" tab still serves its cached first page with no network (`networkMode: "offlineFirst"` unchanged) | PASS |
| V. Notifications Are Core, Never an Afterthought | This feature extends the principle to a second delivery channel rather than relaxing it; dedupe logic (research.md #3) is unit-testable pure logic, same rigor as F4 | PASS |
| VI. Money as Exact Decimal | Push notification content reuses the existing `toCents`/amount-formatting logic already used by local notifications — no new float math | PASS |
| VII. Consistent Modern UI | New root error boundary screen built on NativeWind, matching existing screens' theming (dark/light) | PASS |
| VIII. Spec-Driven Delivery | This spec/plan/data-model/contracts/quickstart + unit and component tests satisfy the requirement before implementation is considered done | PASS |
| IX. Small, Mergeable Iterations | **Violation, justified below** — this feature intentionally bundles the F5 roadmap item with four hardening concerns instead of shipping them as separate slices | See Complexity Tracking |

Constitution Check re-evaluated after Phase 1 design (data-model.md,
contracts/, quickstart.md): no new violations surfaced. The decision to
avoid a bespoke "evaluation run" table (research.md #5) and to reuse rather
than duplicate the rule-matching module (research.md #2) both reduce scope
relative to a naive implementation, keeping the bundled slice as small as
it can reasonably be.

## Project Structure

### Documentation (this feature)

```text
specs/005-server-push-hardening/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── push-tokens-schema.sql
│   ├── evaluate-reminders-function.md
│   └── ci-workflow.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0004_push_tokens.sql          # applied copy of contracts/push-tokens-schema.sql
                                    # + pg_cron schedule + pg_cron/pg_net extension enable

supabase/functions/evaluate-reminders/
├── index.ts                       # HTTP entrypoint: cron-secret check, orchestrates
│                                    # receipt-check → evaluate → dedupe → send phases
├── expoPush.ts                    # Expo push API adapter: batched send + getReceipts
│                                    # (this function's Deno-side equivalent of
│                                    # notificationScheduler.ts's expo-notifications calls)
├── db.ts                          # Supabase service-role client + queries (rules,
│                                    # planned expenses, push_tokens, notifications_log
│                                    # dedupe check/insert)
└── sentry.ts                      # Sentry Deno init + Cron Monitor check-in wrapper

# Reused, not duplicated (research.md #2): evaluate-reminders/index.ts
# imports computeDesiredNotifications/matchesRule/triggerPoints directly from
# ../../../src/features/rules/notificationEngine.ts (and ../../../src/lib/money.ts),
# which remain framework-agnostic TypeScript with no RN/expo-notifications imports.

src/features/push/
├── types.ts                       # PushToken type
├── pushTokenApi.ts                 # upsert/delete push_tokens rows (mirrors expensesApi.ts shape)
└── usePushRegistration.ts           # hook: registers/upserts token on sign-in once
                                       # permission is granted; called from AuthProvider

src/components/
└── ErrorBoundary.tsx               # NEW: root error boundary, themed fallback screen,
                                      # reports to Sentry

src/lib/
└── sentry.ts                       # Sentry React Native init (app-side)

src/features/auth/AuthProvider.tsx  # UPDATED: signOut() deletes this device's
                                      # push_tokens row before supabase.auth.signOut();
                                      # sign-in wires usePushRegistration

src/features/expenses/
├── expensesApi.ts                  # UPDATED: listPlannedExpenses(userId) (new, small,
│                                     # status=eq.planned) + listExpensesPage(userId, range)
│                                     # (new, paginated, all statuses) alongside existing
│                                     # listExpenses (kept only if still referenced; else removed)
├── useExpenses.ts                  # UPDATED: usePlannedExpenses() (backs dashboard +
│                                     # reconciliation) + useExpenseHistory() (useInfiniteQuery,
│                                     # backs the Expenses tab)
└── ExpenseList.tsx                 # UPDATED: onEndReached-driven "load more" for the
                                      # paginated history view

src/features/rules/useNotificationReconciliation.ts  # UPDATED: reads from
                                      # usePlannedExpenses's query cache, not the
                                      # now-paginated history query

app/(tabs)/add.tsx                  # UPDATED: uses useExpenseHistory() + loadMore wiring
app/_layout.tsx                     # UPDATED: wraps <Slot /> in <ErrorBoundary>, inits Sentry

.github/workflows/
└── ci.yml                          # NEW: typecheck + test on every PR (contracts/ci-workflow.md)

.env.staging(.example)              # NEW: staging Supabase project values; eas.json's
                                      # development/preview profiles reference this env,
                                      # production continues using the existing project

tests/unit/
├── pushTokenApi.test.ts            # NEW
├── expensesApi.test.ts             # UPDATED: covers listPlannedExpenses/listExpensesPage
└── notificationEngine.test.ts      # UNCHANGED — same module now also imported server-side

tests/component/
├── error-boundary.test.tsx         # NEW
└── expense-list.test.tsx           # UPDATED: covers loadMore/pagination behavior
```

**Structure Decision**: Single Expo app + one new Supabase Edge Function
(no separate backend project — Constitution II still holds, Edge Functions
are a Supabase-native primitive, not a custom server). The Edge Function
imports F4's existing pure rule-matching module directly by relative path
rather than duplicating it, keeping one source of truth. The new
`src/features/push/` module mirrors the existing feature-module shape
(types → api → hook) used by `expenses`, `rules`, and `dashboard`. The
"Expenses" tab's data source splits into a small bounded query (shared with
dashboard/reconciliation, unchanged in spirit from today) and a separately
paginated history query, rather than changing what dashboard/reconciliation
already correctly consume.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution IX — one feature bundles the F5 roadmap item (server push) with four largely-orthogonal hardening concerns (CI, error monitoring, staging isolation, list pagination) instead of five separate slices | Explicit product decision: this is the first feature to ship unattended, real-world-facing server-side code (a daily cron job sending real notifications to real devices) — the hardening items exist specifically *because* of that new risk, not as unrelated cleanup, so reviewing/shipping them together keeps the risk and its mitigation visible in one place rather than temporarily shipping the riskier half alone | Splitting into five specs was considered and rejected for this iteration: shipping server push before CI/error-monitoring exist would mean the first-ever unattended server code ships with no safety net at all, which is the specific failure mode this bundling avoids; the trade-off (a larger, slower-to-review slice) was accepted knowingly rather than by default |
