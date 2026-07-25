# Phase 0 Research: Tab Bar Visibility Fix & On-The-Day Default Reminder

## 1. Tab bar: why it's "barely visible" and how to fix it robustly

**Current state** (`app/(tabs)/_layout.tsx`): `expo-router`'s `Tabs` (a thin wrapper
over `@react-navigation/bottom-tabs`) is given only
`tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border }`.
Two independent problems live in that one line:

1. **No explicit safe-area handling.** `@react-navigation/bottom-tabs` does apply
   *some* built-in bottom-inset padding by default on native, but this project
   already standardized on explicitly reading `useSafeAreaInsets()`
   (`react-native-safe-area-context`, already a dependency, already used in
   `ExpenseSheet.tsx` and `RuleSheet.tsx` for the exact same "don't let the home
   indicator/keyboard cover the last control" problem) rather than trusting a
   third-party default. On the PWA/web build specifically, `react-native-safe-area-context`
   reads `env(safe-area-inset-*)` CSS variables via a provider-injected `<div>`
   (`SafeAreaProvider` already wraps the app in `app/_layout.tsx`) — but only if a
   screen actually asks for the inset. The bare `tabBarStyle` object here never
   asks, so on an installed iOS PWA (standalone display, real home indicator) the
   bar has no guaranteed bottom clearance.
2. **No visual distinction.** `colors.background` for the tab bar *is* the same
   token every screen uses for its own background, so the only separator is a
   1px `borderTopColor` line. There is no elevation/shadow anywhere in this
   codebase today (confirmed: no `shadow`/`elevation` usage outside this
   investigation) — this is a new pattern to introduce, not one to extend.

**Decision**: Compute the tab bar's style explicitly in `TabsLayout` via
`useSafeAreaInsets()`, rather than relying on implicit library behavior:
- `paddingBottom: Math.max(insets.bottom, 8)` and a `height` baseline (e.g.
  `56 + insets.bottom`) so there's always a visible minimum, whether the
  device reports a 0 inset (older Android, most desktop browsers) or a real
  one (notched iPhone, standalone PWA).
- Swap the background token from `colors.background` to `colors.surface`
  (already defined in `src/theme/colors.ts` for exactly this "distinguish
  from page background" purpose, currently unused by the tab bar) plus a
  platform-appropriate shadow: `elevation` for Android, `shadowColor` /
  `shadowOffset` / `shadowOpacity` / `shadowRadius` for iOS — React Native
  Web (used for the Expo web export) translates these `shadow*` style props
  into a CSS `box-shadow` automatically, so one style object covers all three
  targets without a `Platform.select`.
- Keep the existing `borderTopColor` hairline in addition to (not instead of)
  the new elevation — belt-and-suspenders for the lowest-fidelity renderer.

**Alternatives considered**:
- *Trust `@react-navigation/bottom-tabs`'s implicit safe-area handling as-is.*
  Rejected: it doesn't address the separate, equally-real "no contrast"
  complaint at all, and its web/PWA-standalone behavior can't be verified
  without a physical device in this session — an explicit, testable
  computation is strictly safer and still layers cleanly on top of whatever
  the library already does.
- *Replace `expo-router`'s `Tabs` with a fully custom bottom-nav component.*
  Rejected: far larger blast radius (touches routing, not just styling) for a
  problem that is purely about the existing primitive's style/inset inputs;
  conflicts with Principle IX (Small, Mergeable Iterations).

## 2. Notification default-rule backfill for existing users

**Current state** (`src/features/rules/seedRules.ts`, called from
`AuthProvider.tsx` on every session change): the seeding function checks "does
this user have *any* rule row at all?" and inserts the full `DEFAULT_RULES`
array only if the answer is no. Because this already runs on every sign-in,
essentially every existing user already has ≥1 rule row — so this function is
a permanent no-op for them. Simply appending a third entry to
`DEFAULT_RULES` would silently do nothing for the installed base; only brand
new sign-ups would ever see it (satisfies FR-007 but not FR-008).

**Decision**: Change the seeding check from "any rows exist?" to "which
default-rule *names* already exist for this user?" — fetch the user's
existing rule `name`s once, then insert only the `DEFAULT_RULES` entries whose
`name` isn't already present. This:
- Naturally satisfies FR-008 (existing users get exactly the rules they're
  missing, added going forward via the same sign-in-time codepath that already
  runs for everyone).
- Naturally satisfies FR-009 (a user who disabled the new rule after it first
  appears — or disabled the two originals long ago — still has a row with that
  `name` present, so it's never re-inserted; "disabled" and "absent" are
  distinguished correctly without any extra flag or timestamp).
- Requires no new column, table, or migration — matches migration 0003's
  documented convention ("Default rule rows are seeded client-side per user
  ... not via a DB-level trigger/function").

**Alternatives considered**:
- *One-off SQL backfill migration inserting the new rule for every existing
  `auth.users` row.* Rejected: breaks the project's established
  client-side-seeding convention (migration 0003's own comment), and doesn't
  compose with future default-rule additions the way a general
  "diff-by-name" seeding function does.
- *A `schema_version`/"defaults applied" counter per user.* Rejected as
  over-engineered for three known rule names; name-based presence checking is
  simpler, self-documenting, and already the idiom `seedCategories.ts` uses
  for the same class of problem.

## 3. Rule shape for the new "due today" default

**Decision**: `days_before: 0`, `repeat_days_before: null`, `min_amount: null`
(explicitly "regardless of amount" per spec), `is_grouped: true`. Grouping
mirrors the existing "Due tomorrow" rule's own rationale (documented in
migration 0003: avoid one push per expense when several share a due date) —
the same multi-expense-on-one-day scenario applies equally to "due today," so
symmetry with the existing grouped default is the correct default, not a new
judgment call.

**Alternatives considered**: ungrouped (one notification per expense due
today). Rejected: would reintroduce the exact notification-flood problem
"Due tomorrow" was already grouped to avoid, for no stated benefit.

## 4. Engine/scheduler compatibility with `days_before: 0`

**Finding, no code change needed**: `computeDesiredNotifications`
(`src/features/rules/notificationEngine.ts`) already computes
`triggerDateIso = addDays(expense.due_date, -point.daysBefore)` generically —
`-0` is a no-op, so `triggerDateIso === due_date` falls out naturally, and the
existing "never schedule a trigger date before today" guard (`triggerDateIso <
todayIso`) does not exclude same-day triggers (it excludes only *past* ones).
The `rules.days_before` column already permits `0` (`check (days_before
between 0 and 30)`, migration 0003). No engine or schema change is required —
only `defaultRules.ts` (add the entry) and `seedRules.ts` (backfill logic,
research #2) change.

**Edge case documented, not fixed**: the local on-device scheduler
(`notificationScheduler.ts`) fires same-day notifications at a fixed local
09:00 (`toTriggerDate`). If a user opens the app (triggering reconciliation)
*after* 09:00 on the due date itself, `expo-notifications` schedules a `DATE`
trigger already in the past; Expo's documented behavior for a past `DATE`
trigger is to fire immediately rather than error or silently drop it. This is
acceptable, existing behavior (not introduced by this feature — any
`days_before` value can theoretically produce a same-day-in-the-past trigger
if the user opens the app very late relative to their own reconciliation
history) and requires no special-casing.
