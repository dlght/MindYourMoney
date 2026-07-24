-- Contract: rules + notifications_log tables + RLS policies
-- Mirrors docs/mindyourmoney-spec.md §5 and data-model.md.
-- Applied as supabase/migrations/0003_rules_notifications.sql during implementation.
-- Default rule rows are seeded client-side per user (mirrors seedCategories.ts
-- pattern from F1), not via a DB-level trigger/function.

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null check (length(trim(name)) > 0),
  enabled boolean not null default true,
  is_default boolean not null default false,
  -- true only for the seeded "Due tomorrow" rule; combines same-day matches
  -- into one digest notification instead of one per expense (data-model.md).
  is_grouped boolean not null default false,
  min_amount numeric(12,2) check (min_amount is null or min_amount > 0),
  category_ids uuid[],
  days_before int not null check (days_before between 0 and 30),
  repeat_days_before int check (
    repeat_days_before is null
    or (repeat_days_before >= 0 and repeat_days_before < days_before)
  ),
  created_at timestamptz not null default now()
);

create index if not exists rules_user_enabled_idx on rules (user_id, enabled);

alter table rules enable row level security;

create policy "rules_select_own"
  on rules for select
  using (auth.uid() = user_id);

create policy "rules_insert_own"
  on rules for insert
  with check (auth.uid() = user_id);

create policy "rules_update_own"
  on rules for update
  using (auth.uid() = user_id);

-- Default rules (is_default = true) are only ever disabled, never deleted,
-- by the app (FR-005); this policy still permits the delete at the DB layer
-- so a determined direct-API caller isn't blocked by RLS alone, matching
-- this project's convention of enforcing UX-level guarantees in the app
-- (see F2's mark_expense_paid idempotency for the same "belt, not just
-- suspenders" reasoning) rather than doubling up ownership rules in SQL.
create policy "rules_delete_own"
  on rules for delete
  using (auth.uid() = user_id);

create table if not exists notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  expense_id uuid references expenses on delete cascade,
  rule_id uuid references rules on delete set null,
  trigger_kind text not null check (trigger_kind in ('primary', 'repeat', 'grouped')),
  sent_at timestamptz not null default now(),
  channel text not null default 'push'
);

create index if not exists notifications_log_user_sent_at_idx on notifications_log (user_id, sent_at desc);

alter table notifications_log enable row level security;

create policy "notifications_log_select_own"
  on notifications_log for select
  using (auth.uid() = user_id);

create policy "notifications_log_insert_own"
  on notifications_log for insert
  with check (auth.uid() = user_id);
