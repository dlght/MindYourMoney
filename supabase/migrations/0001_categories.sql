-- categories table + RLS policy
-- Mirrors docs/mindyourmoney-spec.md §5 and specs/001-project-scaffold-auth/contracts/categories-schema.sql

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  icon text,
  color text,
  is_default boolean default false,
  archived boolean default false
);

alter table categories enable row level security;

create policy "categories_select_own"
  on categories for select
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on categories for update
  using (auth.uid() = user_id);

create policy "categories_delete_own"
  on categories for delete
  using (auth.uid() = user_id);
