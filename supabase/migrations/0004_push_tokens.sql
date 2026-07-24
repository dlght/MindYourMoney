-- Contract: push_tokens table + RLS policy + daily reminder-evaluation cron job
-- Mirrors docs/mindyourmoney-spec.md §7 (F5) and data-model.md.
-- Applied as supabase/migrations/0004_push_tokens.sql during implementation.

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  device_installation_id text not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  last_ticket_id text,
  last_ticket_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_installation_id)
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

create policy "push_tokens_select_own"
  on push_tokens for select
  using (auth.uid() = user_id);

create policy "push_tokens_insert_own"
  on push_tokens for insert
  with check (auth.uid() = user_id);

create policy "push_tokens_update_own"
  on push_tokens for update
  using (auth.uid() = user_id);

create policy "push_tokens_delete_own"
  on push_tokens for delete
  using (auth.uid() = user_id);

-- The evaluate-reminders Edge Function reads/writes this table via the
-- Supabase service role key (bypasses RLS by design — same trust boundary
-- as any other scheduled backend job in this project), never a user JWT.

-- Daily server-side reminder evaluation (F5, research.md #1).
-- pg_cron and pg_net are Postgres extensions Supabase enables on all tiers
-- including free (Constitution III).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The secret compared against is read from the 'app.cron_secret' database
-- setting (set separately via ALTER DATABASE, not committed here) so it
-- never appears in this file's git history; it must match the
-- evaluate-reminders function's CRON_SECRET env var.
select cron.schedule(
  'evaluate-reminders-daily',
  '0 8 * * *', -- 08:00 UTC daily
  $$
  select net.http_post(
    url := 'https://tvbyqwnwlrlsxvgemwls.supabase.co/functions/v1/evaluate-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    )
  );
  $$
);
