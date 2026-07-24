-- Contract: push_tokens table + RLS policy
-- Mirrors data-model.md. Applied as supabase/migrations/0004_push_tokens.sql
-- during implementation.

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
