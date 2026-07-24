# Contract: `evaluate-reminders` Edge Function

## Trigger

Invoked once daily by a `pg_cron` job via `pg_net`'s `net.http_post`. Not intended to be called by client apps.

```sql
-- applied as supabase/migrations/0004_push_tokens.sql (original, GUC-based)
-- and corrected by 0005_cron_secret_vault.sql (Vault-based — see below)
select cron.schedule(
  'evaluate-reminders-daily',
  '0 8 * * *', -- 08:00 UTC daily
  $$
  select net.http_post(
    url := '<project-ref>.supabase.co/functions/v1/evaluate-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $$
);
```

**Secret storage — discovered during deployment**: the original design (0004) read the secret from a database GUC (`current_setting('app.cron_secret', true)`), set via `ALTER DATABASE ... SET`. Applying that against the real project failed with `permission denied to set parameter "app.cron_secret"` — Supabase's managed Postgres doesn't grant the CLI/Management-API role `ALTER DATABASE SET` rights for custom GUCs. 0005 re-points the job at Supabase Vault instead (`vault.create_secret` / `vault.decrypted_secrets`), the platform-supported mechanism for this exact case. The secret's actual value is never committed to git in either approach — only created via a one-off `vault.create_secret(...)` call run directly against the database.

**Deploy flag — also discovered during deployment**: this function MUST be deployed with `--no-verify-jwt` (or `verify_jwt = false` in `supabase/config.toml`'s `[functions.evaluate-reminders]` section, which this repo now sets). Without it, Supabase's gateway rejects every request with `401 UNAUTHORIZED_NO_AUTH_HEADER` before the function's own code — including its `x-cron-secret` check — ever runs, since `pg_cron`'s `net.http_post` call carries no Supabase JWT (by design; this endpoint authenticates via its own secret, not a user session).

## Request

`POST /functions/v1/evaluate-reminders`

- Header `x-cron-secret` MUST match the function's configured secret (`Deno.env.get("CRON_SECRET")`). Requests without a matching header are rejected with `401` — this is not a user-facing endpoint and carries no user JWT.
- No request body required.

## Behavior (in order)

1. Start a Sentry Cron Monitor check-in (`in_progress`).
2. **Receipt check phase**: query `push_tokens` for rows with a non-null `last_ticket_id`, call Expo's `getReceipts` API, delete any `push_tokens` row whose receipt reports `DeviceNotRegistered`.
3. **Evaluation phase**: fetch all `enabled = true` rules and `status = 'planned'` expenses across all users; run the shared rule-matching logic (research.md #2) to compute due candidates for "today."
4. **Dedupe phase**: for each candidate, check `notifications_log` for an existing `(user_id, expense_id, rule_id, trigger_kind)` row (any channel) — drop already-delivered candidates.
5. **Send phase**: batch remaining candidates by up to 100 per Expo push API request, `POST https://exp.host/--/api/v2/push/send`, using each user's `push_tokens.expo_push_token`(s).
6. For each successfully-sent candidate: insert a `notifications_log` row with `channel = 'server'`, and update the corresponding `push_tokens.last_ticket_id`/`last_ticket_sent_at` for tomorrow's receipt check.
7. Complete the Sentry Cron Monitor check-in as `ok`; on any unhandled error in steps 2-6, check in as `error` (Sentry alerts the maintainer per its configured rules) and exit non-zero.

## Response

- `200` with a small JSON summary (`{ sent: number, pruned_tokens: number, skipped_duplicates: number }`) on success.
- `401` for a missing/invalid `x-cron-secret`.
- `500` if evaluation fails partway; the Sentry check-in still records `error` regardless of the HTTP status returned (the cron caller doesn't inspect the response body).

## External contract: Expo Push API

- Send: `POST https://exp.host/--/api/v2/push/send`, body is an array of `{ to, title, body, data }` (max 100 per request per Expo's documented limit).
- Receipts: `POST https://exp.host/--/api/v2/push/getReceipts`, body `{ ids: string[] }` (the ticket ids from a prior send), returns per-id status including `DeviceNotRegistered` for tokens to prune.
