# Data Model: Server Push Notifications & Production Hardening

## New: `push_tokens`

One row per device a user has granted notification permission on and that has successfully obtained an Expo push token.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid references auth.users not null` | RLS-scoped, consistent with every other table |
| `device_installation_id` | `text not null` | Stable per-install identifier (e.g. `expo-application`'s install id), distinguishes multiple devices per user |
| `expo_push_token` | `text not null` | The `ExponentPushToken[...]` string from `getExpoPushTokenAsync` |
| `platform` | `text not null check (platform in ('ios', 'android'))` | Informational; not required for sending, useful for debugging delivery issues |
| `last_ticket_id` | `text` | Expo push ticket id from the most recent send to this token, checked for a receipt on the *next* daily run (research.md #4) |
| `last_ticket_sent_at` | `timestamptz` | When that ticket was created; unused tokens naturally have no pending receipt to check |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | Bumped on every re-registration (token can rotate) |

**Constraints**: `unique (user_id, device_installation_id)` — re-registering the same device updates its row (upsert) rather than creating duplicates.

**RLS**: `select`/`insert`/`update`/`delete` all scoped to `auth.uid() = user_id`, matching every existing table. The Edge Function reads/writes this table using the Supabase service role (bypasses RLS by design, same trust boundary as any other scheduled backend job), not a user session.

**Lifecycle**:
- Created/updated on sign-in once notification permission is granted (FR-001).
- Deleted on sign-out for that device (FR-007, research.md #10).
- Deleted by the Edge Function when a receipt confirms `DeviceNotRegistered` (FR-006, research.md #4).

## Changed: `notifications_log`

No schema change. The existing `channel text not null default 'push'` column (from `0003_rules_notifications.sql`) starts being written as:
- `'local'` — by the existing on-device scheduler (`notificationScheduler.ts`), previously hardcoded to `'push'`.
- `'server'` — by the new Edge Function, for reminders it successfully sent via Expo's push API.

The existing columns (`user_id`, `expense_id`, `rule_id`, `trigger_kind`, `sent_at`) are used unchanged as the dedupe key across channels (research.md #3): before sending, the Edge Function checks for an existing row with the same `(user_id, expense_id, rule_id, trigger_kind)` regardless of `channel`.

## Not modeled as a new table: reminder evaluation runs

The spec's "Reminder evaluation run" key entity (when did the daily job run, did it succeed) is satisfied by Sentry Cron Monitoring check-ins (research.md #5) rather than a bespoke table — there is no new schema for this. If Sentry's free tier ever becomes insufficient, revisit with an actual `evaluation_runs` table at that point rather than building it preemptively.

## Existing entities referenced, not redefined

- **Expense** (F2): `status = 'planned'` rows are what the Edge Function evaluates, identical filter to the client's `notificationEngine.ts`.
- **Rule** (F4): `enabled = true` rows, matched via the shared `matchesRule`/`triggerPoints` logic (research.md #2).
- **Category**, **auth.users**: unchanged, referenced only transitively through Expense/Rule.
