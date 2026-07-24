-- Contract: expenses table + RLS policy + mark-as-paid roll-forward function
-- Mirrors docs/mindyourmoney-spec.md §5 and data-model.md.
-- Applied as supabase/migrations/0002_expenses.sql during implementation.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories not null,
  name text not null check (length(trim(name)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR',
  due_date date not null,
  recurrence text check (recurrence in ('monthly', 'yearly')),
  status text not null default 'planned' check (status in ('planned', 'paid', 'skipped')),
  paid_at timestamptz,
  rolled_from_id uuid references expenses,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_due_date_idx on expenses (user_id, due_date);

alter table expenses enable row level security;

create policy "expenses_select_own"
  on expenses for select
  using (auth.uid() = user_id);

create policy "expenses_insert_own"
  on expenses for insert
  with check (auth.uid() = user_id);

create policy "expenses_update_own"
  on expenses for update
  using (auth.uid() = user_id);

create policy "expenses_delete_own"
  on expenses for delete
  using (auth.uid() = user_id);

-- Atomic mark-as-paid + roll-forward (research.md #1).
-- Only inserts a next-occurrence row if the target row actually transitioned
-- from 'planned' to 'paid' in this call, making repeated/concurrent calls
-- against the same row a no-op after the first (FR-010).
create or replace function mark_expense_paid(expense_id uuid)
returns expenses
language plpgsql
security invoker
as $$
declare
  updated expenses;
  next_due date;
  inserted expenses;
begin
  update expenses
    set status = 'paid',
        paid_at = now()
    where id = expense_id
      and user_id = auth.uid()
      and status = 'planned'
    returning * into updated;

  if not found then
    -- Either already paid, doesn't exist, or not owned by this user:
    -- return the current row as-is (idempotent no-op) rather than erroring.
    select * into updated from expenses where id = expense_id and user_id = auth.uid();
    return updated;
  end if;

  -- Postgres's own date+interval arithmetic overflows past month-end
  -- (e.g. Jan 31 + 1 month = Mar 3) instead of clamping; taking the LEAST
  -- of that overflowed date and the target month's actual last day gives
  -- the clamped date the spec requires (Edge Cases), in one expression.
  if updated.recurrence = 'monthly' then
    next_due := least(
      (updated.due_date + interval '1 month')::date,
      (date_trunc('month', updated.due_date) + interval '2 month' - interval '1 day')::date
    );
  elsif updated.recurrence = 'yearly' then
    next_due := least(
      (updated.due_date + interval '1 year')::date,
      (date_trunc('month', updated.due_date) + interval '13 month' - interval '1 day')::date
    );
  end if;

  if updated.recurrence in ('monthly', 'yearly') then
    insert into expenses (
      user_id, category_id, name, amount, currency, due_date,
      recurrence, status, rolled_from_id
    ) values (
      updated.user_id, updated.category_id, updated.name, updated.amount,
      updated.currency, next_due::date, updated.recurrence, 'planned', updated.id
    )
    returning * into inserted;
  end if;

  return updated;
end;
$$;
