# Research: Server Push Notifications & Production Hardening

## 1. Server-side push delivery mechanism

**Decision**: Supabase Edge Function (`evaluate-reminders`, Deno) invoked once daily by `pg_cron` via `pg_net`'s `net.http_post`, authenticated with a shared secret header (not a user JWT, since it acts on all users). The function queries all enabled rules + planned expenses across users, computes due reminders, batches them to Expo's push API (`https://exp.host/--/api/v2/push/send`), and writes `notifications_log` rows.

**Rationale**: This is exactly the mechanism named in `docs/mindyourmoney-spec.md` §7 ("F5 — Server push: pg_cron daily job runs → Edge Function evaluates all users' rules → sends Expo push tokens batch"). `pg_cron` and `pg_net` are Postgres extensions Supabase enables on all tiers including free, so this adds no new paid service (Constitution III).

**Alternatives considered**: A separate always-on worker/server — rejected outright by Constitution II (Supabase-only backend, no custom servers). A third-party scheduler (e.g. GitHub Actions cron) calling the Edge Function — rejected as an unnecessary second moving part when Postgres can schedule it natively and keep the whole pipeline inside Supabase.

## 2. Sharing rule-matching logic between the app and the Edge Function

**Decision**: Extract the platform-agnostic matching primitives already in `src/features/rules/notificationEngine.ts` (`matchesRule`, `triggerPoints`, `computeDesiredNotifications`, the date helpers) — none of which import React Native or `expo-notifications` — into a Deno-importable shared module, and have `supabase/functions/evaluate-reminders/index.ts` import it via a relative path. `notificationScheduler.ts` (the `expo-notifications` adapter) stays app-only; the Edge Function gets its own thin adapter that calls Expo's push HTTP API instead.

**Rationale**: `computeDesiredNotifications` is already pure (spec'd and tested as such in F4) — it takes plain data in and plain candidates out. Duplicating it for the Edge Function would let client and server evaluation drift out of sync silently (e.g. a future rule-type change updated in one place and not the other), which directly risks FR-004 (no duplicate/missed notifications across channels). A single relative import keeps one source of truth at negligible cost for a project this size.

**Alternatives considered**: A hand-maintained parallel copy in `supabase/functions/` — rejected for drift risk. A published shared npm package — rejected as overkill for a single-app, single-developer project (violates Constitution IX's bias toward small, simple slices).

## 3. Distinguishing local vs. server-delivered reminders for dedupe

**Decision**: `notifications_log.channel` (already a free-text column with a default of `'push'`, no CHECK constraint) starts being written as `'local'` by the existing `notificationScheduler.ts` and `'server'` by the new Edge Function. Before sending a candidate, the Edge Function queries `notifications_log` for an existing row matching the same `(user_id, expense_id, rule_id, trigger_kind)` regardless of channel — if found, it's skipped.

**Rationale**: FR-004 requires no duplicate delivery across the two paths. The column already exists and already tracks exactly the data needed (`research.md` in F4 anticipated this dedupe need); this only changes what string gets written and adds one read-before-send check. No migration is required to add the column, only to normalize the value the client writes (`notificationScheduler.ts:22`'s hardcoded `channel: "push"` becomes `"local"`).

**Alternatives considered**: A separate boolean `is_server_sent` column — rejected as redundant with the existing free-text `channel` column that was designed for exactly this.

## 4. Push token lifecycle (registration, staleness, receipts)

**Decision**: On sign-in, once notification permission is granted, the app calls `Notifications.getExpoPushTokenAsync({ projectId })` (using the existing EAS `projectId` from `app.json`) and upserts the result into a new `push_tokens` table keyed on `(user_id, device_installation_id)`. The Edge Function's daily run first re-checks receipts for the previous run's send tickets (Expo requires checking receipts separately from sending, typically minutes-to-hours later — a once-daily cadence naturally provides that gap) via `https://exp.host/--/api/v2/push/getReceipts`, deletes any `push_tokens` row whose receipt came back `DeviceNotRegistered`, then proceeds to evaluate and send the current day's batch, storing that batch's ticket ids for tomorrow's receipt check.

**Rationale**: Matches Expo's documented two-phase send/receipt pattern and satisfies FR-006 (stop targeting confirmed-dead devices) and Edge Case "device push token becomes invalid" without needing a second scheduled job — the existing daily cadence naturally provides the recommended delay between send and receipt check.

**Alternatives considered**: Checking receipts synchronously right after sending — rejected because Expo's own guidance is that receipts aren't reliably available that quickly; a same-run check would miss most staleness signals.

## 5. Error monitoring & maintainer alerting

**Decision**: Sentry (`@sentry/react-native` in the app; Sentry's Deno/edge integration in the Edge Function), using Sentry's free Developer tier (5k errors/month, includes basic Cron Monitoring). The daily Edge Function run wraps its body in a Sentry Cron Monitor check-in (`in_progress` → `ok`/`error`), so a missed or failed run pages the maintainer automatically without any bespoke run-tracking table.

**Rationale**: Satisfies FR-010 (maintainer notified on job failure) and FR-011 (unexpected app errors recorded) with one tool covering both the client and the new server-side code, staying within Constitution III's free-tier requirement. Cron Monitoring specifically replaces what would otherwise need to be a hand-built "reminder evaluation run" table + polling — the spec's "Reminder evaluation run" key entity is satisfied by Sentry's own check-in record rather than new app-owned schema.

**Alternatives considered**: Rolling a custom `evaluation_runs` table + a separate alert channel (email via a transactional-mail free tier) — rejected as reinventing what Sentry Cron Monitoring already provides for free, adding schema and code for no added reliability. Relying on Supabase's built-in function logs alone — rejected because it's pull-based (the maintainer would have to remember to check), which doesn't satisfy "notified," only "discoverable after the fact."

## 6. Root error boundary

**Decision**: A class component `ErrorBoundary` (React's `componentDidCatch`/`getDerivedStateFromError`) wrapping `<Slot />` inside `AuthGate` in `app/_layout.tsx`, rendering a themed "Something went wrong" screen with a retry action, and reporting the caught error to Sentry.

**Rationale**: React error boundaries are the standard, dependency-free mechanism for this in React Native; no library needed beyond Sentry's own React Native SDK, which also offers an `ErrorBoundary` wrapper component that can be used directly instead of a hand-rolled one — during implementation, prefer `Sentry.ErrorBoundary` if it fits the existing theming, falling back to a hand-rolled one otherwise.

## 7. CI pipeline

**Decision**: `.github/workflows/ci.yml`, triggered on every pull request (and push to `main`), running `npm ci`, `npm run typecheck`, and `npm test` on `ubuntu-latest`. The repository already has a GitHub remote (`github.com/dlght/MindYourMoney`), so no new hosting decision is needed.

**Rationale**: Directly satisfies FR-012. GitHub Actions' free minutes tier comfortably covers a solo-developer project's PR volume (Constitution III).

**Alternatives considered**: None seriously — the project is already hosted on GitHub, making GitHub Actions the zero-friction default.

## 8. Expense list performance at scale

**Decision**: No change to what already powers the dashboard and notification reconciliation — both already only ever need `status = 'planned'` rows (`selectors.ts`'s `isPlanned` filter, `notificationEngine.ts`'s `isPlanned` filter), and a personal finance app's *planned* (unpaid) row count stays small and roughly constant over time regardless of account age, since paid/skipped expenses roll off that set. The actual unbounded-growth surface is narrower than initially assumed: only the "Expenses" tab (`app/(tabs)/add.tsx`, backed by `useExpenses()`/`listExpenses()`) intentionally shows full history across all statuses, and that's the query that needs bounding. Convert that screen's data source to `useInfiniteQuery` with Supabase `.range()`-based pagination (page size 50, ordered by `due_date`), while introducing a separate, small `status=eq.planned` query to back the dashboard and notification reconciliation explicitly (rather than continuing to derive them from whatever the now-paginated full-history query happens to have loaded).

**Rationale**: Satisfies FR-014 without changing dashboard or reconciliation correctness — critically, reconciliation must keep seeing *every* planned expense (not just one page of them) or FR-006/F4's guarantees silently break for anything beyond page one. Splitting the query by purpose (small bounded "planned" query vs. paginated "full history" query) is a smaller, more precise change than date-windowing everything.

**Alternatives considered**: A single date-windowed query (e.g. "next 90 days + last 90 days") for everything — rejected because it would still need a separate unbounded escape hatch for a user browsing multi-year-old history, and would couple the dashboard's window to the browsing list's window for no reason. Client-side pagination over an unbounded fetch — rejected, it doesn't reduce the actual network/DB fetch cost, which is the thing that degrades with account age.

## 9. Staging environment separation

**Decision**: A second Supabase project ("MindYourMoney Staging") with its own copy of all migrations applied, referenced via a separate `.env` profile (`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) selected through EAS's per-build-profile environment variables. The `development` and `preview` EAS build profiles (already defined in `eas.json`) point at staging; `production` continues pointing at the existing project. The staging project gets its own `pg_cron`/Edge Function deployment so the daily job, push sends, and token pruning can be exercised without touching real user data or sending real users notifications.

**Rationale**: Directly satisfies FR-013 and SC-008. Supabase's free tier supports multiple projects (subject to the account-wide free-project count limit), so this stays within Constitution III as long as the account doesn't already have other free-tier projects competing for the slot — worth a one-time check during implementation, noted as a risk rather than a blocker.

**Alternatives considered**: A single project with staging data flagged/isolated by convention (e.g. a `is_test_user` column) — rejected as a much weaker isolation guarantee for a feature whose entire point is de-risking unattended server-side code; a real accidental cross-contamination (e.g. a bug sending real users test notifications) is exactly the failure mode a second project eliminates structurally instead of by convention.

## 10. Push registration cleanup on sign-out

**Decision**: `AuthProvider.signOut()` deletes (or deactivates) the current device's `push_tokens` row before calling `supabase.auth.signOut()`.

**Rationale**: Satisfies FR-007 and the sign-out/re-sign-in edge case — without this, a shared or resold device would keep receiving the previous account's reminders indefinitely, which is a real privacy concern for a finance app whose reminders can imply real spending amounts.
