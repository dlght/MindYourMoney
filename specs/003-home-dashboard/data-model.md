# Data Model: Home Dashboard

This feature introduces **no new persisted entity, table, column, or RPC**.
It is a read/derive layer over the `Expense` entity already defined and
persisted in F2 (`src/features/expenses/types.ts`, `expenses` table). This
document describes only the **derived, in-memory view models** that
`selectors.ts` produces from an existing `Expense[]` for the dashboard to
render — none of it is stored.

## Reused entity (no changes)

### Expense (from F2)

| Field | Type | Used by this feature for |
|---|---|---|
| `id` | `string` | List item key, mark-as-paid target |
| `name` | `string` | List row, biggest-expense card |
| `amount` | `number` | Upcoming-total sum (as integer cents internally, see research.md #4), biggest-expense tie-break |
| `currency` | `string` | Display formatting (unchanged convention from F2) |
| `due_date` | `string` (`YYYY-MM-DD`) | Next-30-days windowing, grouping key, "Today" heading, tie-break |
| `category_id` | `string` | Not surfaced in F3 UI (deferred to F7 per spec Assumptions); passed through unused |
| `recurrence` | `"monthly" \| "yearly" \| null` | Not read directly by selectors — the roll-forward's *new* `due_date`/`status` (already computed by F2's `useMarkExpensePaid()`) is what re-enters these windows on the next render, per FR-012 |
| `status` | `"planned" \| "paid" \| "skipped"` | Filter: only `"planned"` rows are considered by any selector (FR-004) |

## Derived view models (in-memory only, produced by `selectors.ts`)

### `UpcomingGroup`

One heading + its expenses within the next-30-days window.

| Field | Type | Notes |
|---|---|---|
| `dateLabel` | `string` | `"Today"` for the current calendar day, else a localized human-readable date (research.md #2) |
| `isoDate` | `string` (`YYYY-MM-DD`) | Raw grouping key, used for stable sort/keying, not displayed |
| `expenses` | `Expense[]` | All `planned` expenses whose `due_date === isoDate`, ordered by amount descending then name ascending (spec Assumptions) |

**Derivation**: filter `Expense[]` to `status === "planned"` and
`due_date` within `[today, today+29]` inclusive → group by `due_date` →
sort groups chronologically → sort each group's expenses per the
tie-break rule above.

### `UpcomingTotal`

| Field | Type | Notes |
|---|---|---|
| `totalCents` | `number` (integer) | Sum of `amount` (converted to cents) for the *same* next-30-days/`planned` set `UpcomingGroup` filters to — not an independent window (research.md #3, round 2 patch) |
| `currency` | `string` | Assumed uniform across a single user's expenses per existing F2 convention (no multi-currency support yet) |

**Derivation**: reuse the exact same next-30-days-filtered, `planned`-only
set as `UpcomingGroup` (before grouping) → map each `amount` to
`Math.round(amount * 100)` → sum → result is `0` when the filtered set is
empty (FR-005, Acceptance Scenario 2). Sharing one filter function
(`planForNext30Days` in `selectors.ts`) with `UpcomingGroup` and
`BiggestUpcoming` guarantees all three view models always agree on exactly
which expenses are "upcoming" — an earlier version filtered this
independently by calendar month, which could silently disagree with what
the list showed (see research.md #3).

### `BiggestUpcoming`

| Field | Type | Notes |
|---|---|---|
| `expense` | `Expense \| null` | The single largest `planned` expense within the next-30-days window, or `null` if that window has none (FR-008) |

**Derivation**: reuse the same next-30-days-filtered set as `UpcomingGroup`
(before per-group re-sorting) → sort by amount descending, `due_date`
ascending, `name` ascending (research.md #5) → take index `0`, or `null` if
the filtered set is empty.

## State transitions

None — this feature has no entity of its own to transition. The underlying
`Expense.status` transitions (`planned` → `paid`, and the roll-forward
insert for recurring expenses) are entirely owned and already implemented by
F2; this feature only re-derives its three view models whenever the shared
`useExpenses()` cache changes (via TanStack Query's existing invalidation),
satisfying FR-012 with no new transition logic.
