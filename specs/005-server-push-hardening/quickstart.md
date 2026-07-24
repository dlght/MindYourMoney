# Quickstart: Server Push Notifications & Production Hardening

Validation guide for Feature F5. Assumes F1-F4 are already in place (auth,
expense CRUD, dashboard, local rules/notifications).

## Prerequisites

- Node.js LTS and the Expo CLI (`npx expo`)
- A Supabase project with all prior migrations plus
  `supabase/migrations/0004_push_tokens.sql` and `0005_cron_secret_vault.sql`
  applied. **Actual deployment note**: research.md #9 originally called for a
  separate staging project; in practice this project is a solo/personal app
  with a single existing Supabase project (used since F1), so — by explicit
  product decision made when this was deployed — `evaluate-reminders` runs
  against that same project rather than a dedicated staging one. Revisit
  research.md #9's isolation if/when this app has real users depending on it.
- Supabase CLI (`npx supabase`) authenticated against that project
  (`SUPABASE_ACCESS_TOKEN` env var + `--project-ref`)
- A Sentry account (free Developer tier) with a project for the app and
  Cron Monitoring enabled for `evaluate-reminders` — not yet set up as of
  this deployment; the function runs fine without it (SENTRY_DSN unset is a
  no-op, research.md #5), but FR-010's maintainer alerting isn't live until
  it is
- A physical device (push notifications are unreliable/unsupported on most
  simulators) signed into a test account
- GitHub repo admin access (for the one-time branch-protection step)

## Setup

```bash
npm install
npx expo start
supabase functions deploy evaluate-reminders --project-ref <project-ref> --no-verify-jwt
```

`--no-verify-jwt` is required (see contracts/evaluate-reminders-function.md)
— without it, Supabase's gateway rejects every `pg_cron` invocation before
the function's own `x-cron-secret` check ever runs, since `net.http_post`
carries no Supabase JWT.

## Scenario 1 — Device registers for server push on sign-in (FR-001)

1. Sign in on a physical device with a staging test account, grant
   notification permission when prompted.
2. **Expect**: a row appears in the staging project's `push_tokens` table for
   that user/device with a non-null `expo_push_token`.

## Scenario 2 — Server push arrives while the app is fully closed (User Story 1, FR-002/FR-003)

1. Add a qualifying expense (e.g. matches the default "Big expense ahead"
   rule) with a due date that puts a trigger point at "today."
2. Fully close the app (not just background it).
3. Manually invoke the Edge Function against staging:
   `curl -X POST https://<staging-ref>.supabase.co/functions/v1/evaluate-reminders -H "x-cron-secret: <secret>"`
4. **Expect**: a push notification arrives on the device within a few
   seconds, without the app being opened.

## Scenario 3 — No duplicate across local and server channels (FR-004, SC-002)

1. With the app open and foregrounded, let F4's local reconciliation
   schedule/fire a reminder for a qualifying expense (existing F4 behavior).
2. Invoke the Edge Function (as in Scenario 2) for the same day.
3. **Expect**: exactly one `notifications_log` row exists for that
   `(user_id, expense_id, rule_id, trigger_kind)` combination, and the user
   receives only the one notification, not two.

## Scenario 4 — Stale device stops being targeted (FR-006, Edge Cases)

1. Register a device (Scenario 1), then uninstall the app from it (or use a
   push token known to be invalid/expired for testing).
2. Trigger the Edge Function twice, a day apart (or manually seed a
   `last_ticket_id` to force a receipt check).
3. **Expect**: after the receipt confirms `DeviceNotRegistered`, that row is
   removed from `push_tokens` and is not targeted by the next send.

## Scenario 5 — Sign-out revokes the device's registration (FR-007)

1. Sign in as User A on a device, confirm a `push_tokens` row exists.
2. Sign out.
3. **Expect**: the row is deleted (or deactivated) before sign-out
   completes.
4. Sign in as User B on the same device.
5. **Expect**: User A never receives reminders on this device again, and a
   fresh `push_tokens` row is created for User B.

## Scenario 6 — Job failure alerts the maintainer (User Story 2, FR-010, SC-004)

1. In the staging Edge Function, temporarily introduce a forced failure (or
   revoke its database access) and invoke it.
2. **Expect**: the Sentry Cron Monitor for `evaluate-reminders` reports a
   failed check-in and the configured alert (e.g. email) fires. Revert the
   forced failure afterward.

## Scenario 7 — Unexpected app error shows a recoverable screen (FR-011)

1. In a local dev build, temporarily throw an error inside a screen
   component (e.g. in `DashboardScreen`).
2. **Expect**: instead of a blank/frozen screen, the root error boundary's
   "Something went wrong" screen appears with a retry action, and the error
   appears in Sentry. Revert the temporary throw afterward.

## Scenario 8 — CI blocks a failing change (User Story 3, FR-012, SC-007)

1. Open a PR with a deliberately failing test or a type error.
2. **Expect**: the `verify` GitHub Actions workflow run fails and is shown
   as a failing/required check on the PR, blocking merge (once branch
   protection is enabled on `main` — a one-time repo settings change).

## Scenario 9 — Expense list stays fast with long history (User Story 3, FR-014, SC-006)

1. Seed a staging test account with several years' worth of paid/skipped
   expenses (e.g. via a seed script or direct inserts).
2. Open the "Expenses" tab.
3. **Expect**: the initial list renders promptly (first page only), and
   scrolling to the bottom loads further pages rather than the whole
   history being fetched up front. Confirm the Dashboard's "next 30 days"
   and notification reconciliation are unaffected (still see all planned
   expenses regardless of history size).

## Scenario 10 — Staging is fully isolated from production (User Story 3, FR-013, SC-008)

1. Confirm the staging Supabase project's `EXPO_PUBLIC_SUPABASE_URL` differs
   from production's, and that the `development`/`preview` EAS build
   profiles resolve to the staging value while `production` resolves to the
   live project's value.
2. Trigger the staging Edge Function repeatedly during testing.
3. **Expect**: no production user's `notifications_log`, `push_tokens`, or
   real device receives any notification as a result.
