# Data Model: PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix

No schema changes. This feature introduces no new Postgres tables/columns
and modifies no `Expense`/`Rule`/`Category` shapes (see F2/F4 specs for
those). The two "entities" identified in spec.md are process/test
concepts, not persisted data models:

## Test Account

A standard Supabase Auth user, provisioned once out-of-band (not by this
feature's code), reserved exclusively for automated E2E runs.

| Attribute | Notes |
|---|---|
| Identity | Email/password Supabase Auth user, same shape as any real user |
| Data ownership | Owns its own `expenses`/`rules`/`categories` rows, isolated from real users by the existing RLS policies (`auth.uid()`-scoped) — no new isolation mechanism needed |
| Lifecycle | Long-lived (not recreated per run); individual test-created rows are cleaned up per-scenario (see research.md #3), not the account itself |
| Credentials | Held as CI/environment secrets, never committed to the repo |

## Automated Test Run

A single execution of the Playwright suite. Not persisted anywhere in the
app's own data — its "record" is the test runner's own pass/fail output
(and, in CI, the CI job's log/status).

| Attribute | Notes |
|---|---|
| Scope | One run = one invocation of the full spec suite against one environment (local dev server or the deployed Netlify build) |
| Result | Per-scenario pass/fail (FR-008), aggregated to an overall suite pass/fail |
| Side effects | Any expense/rule rows created during the run are expected to be deleted by the run itself before it ends (FR-007) |

## Existing entities referenced (unchanged)

- **Expense** — see `specs/002-expense-crud-recurrence/data-model.md`. This
  feature's US1 changes only *when an error is surfaced* around expense
  creation, not the `Expense` shape or its persistence.
- **Rule** — see `specs/004-rules-notifications/data-model.md`. Exercised
  read/write by the E2E suite (US2) but not modified.
