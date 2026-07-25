# Quickstart: Tab Bar Visibility Fix & On-The-Day Default Reminder

## Prerequisites

- Repo dependencies installed (`npm install`); no new dependencies added by
  this feature.
- A Supabase project reachable via `.env.local` (existing dev setup).
- For US2 verification: ability to insert/inspect rows in the `rules` table
  for a test account (Supabase Studio or `psql`), and either a physical/
  simulator device with notification permission granted, or direct
  inspection of `evaluate-reminders`'s output.

## US1 — Verify the tab bar is clearly visible and safe-area-clear

1. Run the app on web (`npx expo start --web`) at a mobile viewport width
   (e.g. 390px) in both light and dark OS theme.
2. **Expected**: the tab bar has a visible background contrast/shadow
   against the page content, not just a hairline border, in both themes.
3. Run the app on an iOS simulator (or device) with a home indicator (e.g.
   iPhone 14 class) and repeat.
4. **Expected**: no tab icon or label renders under/behind the home
   indicator's gesture area; there's visible clearance below the labels.
5. Repeat on an Android emulator/device.
6. **Expected**: same visible clearance and contrast; no regression in tap
   target size — every tab remains comfortably tappable near the screen
   edge.

## US2 — Verify the on-the-day default reminder

1. **New user case**: sign up a brand-new test account. In Supabase Studio,
   confirm the `rules` table now has 3 rows for that `user_id`: `"Big
   expense ahead"`, `"Due tomorrow"`, `"Due today"`, all `enabled = true`.
2. **Existing user case**: using an account that already existed before this
   change shipped (has the two original default rules only), sign in again
   (triggering `seedRules`). Confirm a third `"Due today"` row is now
   inserted, `enabled = true`, without duplicating or touching the two
   existing rows.
3. **Already-disabled case**: using an account where a default rule was
   previously disabled, sign in again. Confirm the disabled rule stays
   disabled (not re-enabled) and, if `"Due today"` didn't exist yet for that
   account, it's added as a new `enabled = true` row alongside the untouched
   disabled one.
4. Create a planned expense with `due_date` = today's date and any amount
   under 200 (to prove the amount-independence requirement).
5. Trigger reminder evaluation: locally, foreground the app (reconciliation
   runs on `AppState` → `active`, `app/(tabs)/_layout.tsx`); server-side,
   manually invoke the `evaluate-reminders` function (see
   `specs/005-server-push-hardening/quickstart.md` for the existing
   invocation steps) or wait for its scheduled `pg_cron` run.
6. **Expected**: a notification is scheduled/sent for that expense on
   today's date, and a corresponding `notifications_log` row is written with
   `trigger_kind = 'grouped'` (or `'primary'`/`'repeat'` per which path fired
   — grouped is expected here per data-model.md) referencing the `"Due
   today"` rule.
7. Repeat step 5 immediately again (without changing anything).
8. **Expected**: no duplicate notification/log row is produced (existing
   dedup behavior, contract #4).

## Regression check

- Confirm the two existing default rules still behave exactly as before:
  an expense due in 5+ days at ≥200 still produces the "Big expense ahead"
  reminder; an expense due tomorrow still produces the grouped "Due
  tomorrow" reminder — unaffected by the new third rule or the seeding
  logic change.
