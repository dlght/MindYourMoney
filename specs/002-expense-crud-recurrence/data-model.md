# Phase 1 Data Model: Expense CRUD & Recurrence

Derived from spec.md's Key Entities section and `docs/mindyourmoney-spec.md`
§5 (which already defines the `expenses` table shape, reused here with the
`recurrence`/`status` values constrained per this feature's scope).

## Expense

Persisted in Supabase Postgres. Schema matches
`docs/mindyourmoney-spec.md` §5, with `recurrence` and `status` constrained
to the values this feature actually produces (the product doc leaves
`recurrence` as free text for future rrule support; this feature only ever
writes `null`, `'monthly'`, or `'yearly'`):

```sql
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories not null,
  name text not null,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  due_date date not null,
  recurrence text,               -- null | 'monthly' | 'yearly'
  status text not null default 'planned',  -- 'planned' | 'paid' | 'skipped'
  paid_at timestamptz,
  rolled_from_id uuid references expenses,
  notes text,
  created_at timestamptz not null default now()
);
```

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to `auth.users`; RLS policy scoped to this (constitution II, FR-011) |
| `category_id` | uuid | FK to `categories` (F1); defaults to the user's "Other" category when none chosen (FR-003) |
| `name` | text | Required, non-empty (FR-002) |
| `amount` | numeric(12,2) | Required, must be `> 0` (FR-002, constitution VI — never a JS float) |
| `currency` | text | Fixed `'EUR'` for this feature (see spec Assumptions) |
| `due_date` | date | Required; past dates allowed (spec Edge Cases) |
| `recurrence` | text \| null | `null` (one-off), `'monthly'`, or `'yearly'` only (FR-006) |
| `status` | text | `'planned'` (default) → `'paid'` via mark-as-paid (FR-007); `'skipped'` is a valid value reserved for a later feature (spec Assumptions), not set by this feature |
| `paid_at` | timestamptz \| null | Set when `status` transitions to `'paid'` |
| `rolled_from_id` | uuid \| null | Set on a roll-forward row to the id of the expense it rolled from; `null` for a user-created expense. Not user-facing in this feature; exists so a future feature (e.g., "view history of this recurring bill") can trace the chain without re-deriving it |
| `notes` | text \| null | Carried over from the product's existing schema; no UI surface for it in this feature (out of scope) |
| `created_at` | timestamptz | Set at insert time |

**Validation rules** (FR-002, FR-003, FR-006):
- `name` non-empty; `amount > 0` — both enforced client-side before any
  network call, per spec Edge Cases.
- `category_id` defaults to the signed-in user's "Other" category when the
  user does not pick one; every expense always has exactly one category
  (FR-012 / SC-004).
- `recurrence` is one of `null`, `'monthly'`, `'yearly'` — enforced by a
  Postgres `check` constraint as well as client-side, since this is a fixed
  enum for this feature (see research.md #2 on why broader recurrence is
  out of scope).

**Relationships**:
- One `auth.users` row → many `expenses` rows (1:N), scoped by RLS.
- One `categories` row → many `expenses` rows (1:N); an expense always
  belongs to exactly one category.
- Self-referential: `rolled_from_id` links a roll-forward expense back to
  the paid occurrence it was generated from (0 or 1 per row; a row can be
  referenced by at most one roll-forward, since `mark_expense_paid` only
  ever runs once per row per research.md #1's idempotency guarantee).

**State transitions** (FR-007, FR-008, FR-009, FR-010):

```text
[created] --> planned
planned --> paid                              (mark-as-paid; recurrence = null)
planned --> paid + new row (status=planned)   (mark-as-paid; recurrence = monthly/yearly)
paid --> paid                                 (repeat mark-as-paid call: no-op, no new row)
planned --> [deleted]                         (user delete, any time before paid)
paid --> [deleted]                            (user delete; does not affect any row it already rolled forward to)
```

The `planned → paid (+ new row)` transition is performed by the
`mark_expense_paid` Postgres function (research.md #1) as a single atomic
operation, not as two separate application-level writes.

## Category (existing, from F1)

No schema change. This feature only reads `categories` (to populate the
sheet's category picker and to resolve the "Other" default); category
management remains out of scope here.
