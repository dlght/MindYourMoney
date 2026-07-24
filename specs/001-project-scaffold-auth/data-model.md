# Phase 1 Data Model: Project Scaffold & Auth

Derived from spec.md's Key Entities section and `docs/mindyourmoney-spec.md`
§5 (which already defines the `categories` table shape reused here
verbatim).

## User Session

Not a database table — represented client-side only, backed by Supabase
Auth's session object and persisted via `expo-secure-store` (see
research.md #2).

| Field | Type | Notes |
|---|---|---|
| `user.id` | uuid | Supabase `auth.users.id`; foreign key target for `categories.user_id` |
| `user.email` | text | Shown in Settings; used with a password to sign in (amended from magic-link, self-critique F3) |
| `access_token` / `refresh_token` | text | Managed entirely by `@supabase/supabase-js`; app code never reads these directly |
| `isLoading` | boolean (derived) | True while the session is being restored from SecureStore on app start |

**State transitions**: `signed-out → link-requested → signed-in` (happy
path); `signed-in → signed-out` (explicit sign-out); `link-requested →
signed-out` (link expired/invalid, per spec Edge Cases).

## Category

Persisted in Supabase Postgres. Schema matches
`docs/mindyourmoney-spec.md` §5 exactly:

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  icon text,
  color text,
  is_default boolean default false,
  archived boolean default false
);
```

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to `auth.users`; RLS policy scoped to this (constitution II) |
| `name` | text | e.g. "Housing", "Utilities" — see the 11 default names in `src/features/categories/defaultCategories.ts` |
| `icon` | text | Icon identifier per product spec §2 (e.g. "house", "bolt") |
| `color` | text | Color token per product spec §2 (e.g. "indigo", "amber") |
| `is_default` | boolean | `true` for all eleven seeded rows in this feature; distinguishes them from future custom categories (F6) |
| `archived` | boolean | Always `false` at seed time; archiving is out of scope for this feature (F6) |

**Validation rules**:
- `user_id` + `name` should not be duplicated for the same user (enforced
  by the seeding logic being a no-op when any row already exists for that
  user — see research.md #5; not a database-level unique constraint in F1,
  since custom categories with user-chosen names arrive in F6 and may
  legitimately need their own uniqueness rules then).
- `name`, `icon`, `color` are non-empty for every seeded row.

**Relationships**: One `auth.users` row → many `categories` rows (1:N),
scoped by RLS so a user only ever sees their own.

**State transitions**: None in this feature — rows are created once at
seed time and not otherwise mutated until F6 (custom category management)
or F2 (expenses referencing a category).
