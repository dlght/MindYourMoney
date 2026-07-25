# Phase 1 Data Model: Tab Bar Visibility Fix & On-The-Day Default Reminder

No new tables, columns, or migrations. Both items reuse existing entities.

## Rule (Postgres: `rules` table) — *existing entity, new default row shape*

Gains a third `DEFAULT_RULES` entry (`src/features/rules/defaultRules.ts`); no
schema change (see research.md #4 — `days_before: 0` is already a valid,
permitted value under the existing `check (days_before between 0 and 30)`
constraint).

| Field | Value for the new default | Notes |
|---|---|---|
| `name` | `"Due today"` | Used as the presence key for backfill (research.md #2) — must stay unique among default-rule names and never be renamed post-ship, since renaming would make the backfill re-insert it for users who already have the old name |
| `enabled` | `true` | Same as the two existing defaults at creation time |
| `is_default` | `true` | Subject to the existing "disable, never delete" rule (`rulesApi.ts` `deleteRule`) |
| `is_grouped` | `true` | Mirrors "Due tomorrow" (research.md #3) |
| `min_amount` | `null` | All amounts, per spec FR-006 |
| `category_ids` | `null` | All categories |
| `days_before` | `0` | Fires on the due date itself |
| `repeat_days_before` | `null` | No second trigger |

**Validation rules**: unchanged from the existing `rules` table contract
(`specs/004-rules-notifications/contracts/rules-schema.sql`); the new default
satisfies all existing constraints without modification.

**Relationships**: unchanged.

## Seeding/backfill behavior (`src/features/rules/seedRules.ts`) — *existing function, changed logic*

| Before | After |
|---|---|
| Insert all of `DEFAULT_RULES` iff the user has zero rule rows total | Fetch the user's existing rule `name`s; insert only the `DEFAULT_RULES` entries whose `name` is not already present |

Still idempotent, still runs on every `AuthProvider` session change, still a
single batched insert per call (only now the batch may contain 0, 1, or up to
3 rows depending on what the user already has, instead of always being
all-3-or-nothing).

## TabsLayout style (`app/(tabs)/_layout.tsx`) — *existing UI element, new derived value*

Not a data entity, but documented here since it's a computed value rather
than a static constant going forward:

| Value | Derivation |
|---|---|
| `tabBarStyle.paddingBottom` | `Math.max(insets.bottom, 8)` from `useSafeAreaInsets()` |
| `tabBarStyle.height` | `56 + insets.bottom` |
| `tabBarStyle.backgroundColor` | `colors.surface` (was `colors.background`) |
| `tabBarStyle.shadow*` / `elevation` | New platform-appropriate elevation values (research.md #1) |

## Expense *(existing, unmodified)*

Referenced only via the existing rule-matching path (`matchesRule`,
`computeDesiredNotifications`); no field changes.
