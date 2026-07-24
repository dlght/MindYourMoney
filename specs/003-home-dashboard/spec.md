# Feature Specification: Home Dashboard

**Feature Branch**: `003-home-dashboard`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "F3 — Home dashboard: next-30-days list grouped by date, next-month total, biggest upcoming expense card, empty states. (see docs/mindyourmoney-spec.md §6 and §7, Feature F3)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what's coming due in the next 30 days (Priority: P1)

As a signed-in user, when I open the app I land on a Home screen that lists
my upcoming expenses for the next 30 days, grouped by due date, so I can see
at a glance what's coming without opening the Add tab and scanning a flat
list.

**Why this priority**: This is the core value proposition of the whole
product ("never be surprised by an expense again") — it's the very first
thing a user sees, and without it the app is just a data-entry form with no
payoff. Every other Home-screen element is secondary to this list existing.

**Independent Test**: Can be fully tested by signing in with an account that
has several planned expenses with due dates inside and outside the next 30
days, opening the Home tab, and confirming only the in-window expenses
appear, grouped under their due date.

**Acceptance Scenarios**:

1. **Given** a signed-in user has planned expenses due in 5, 12, and 40 days,
   **When** they open the Home tab, **Then** the 5-day and 12-day expenses
   appear (each under a heading for its due date) and the 40-day expense does
   not.
2. **Given** two planned expenses share the same due date, **When** the Home
   tab renders, **Then** both appear listed together under one shared
   date heading, in a stable order (e.g., by amount or by name — see
   Assumptions).
3. **Given** a planned expense's due date is today, **When** the Home tab
   renders, **Then** it appears under a heading that reads distinctly (e.g.
   "Today") rather than a raw date, so it's easy to spot.
4. **Given** an expense has `status = 'paid'` or `'skipped'`, **When** the
   Home tab renders, **Then** it is excluded from the next-30-days list (only
   `'planned'` expenses are forward-looking work still owed).
5. **Given** the user marks an expense as paid directly from the Home list,
   **When** the action completes, **Then** the list updates immediately to
   remove it (or show its recurring roll-forward in the correct new date
   group, if the roll-forward's new due date is still within 30 days).

---

### User Story 2 - See the upcoming total at a glance (Priority: P2)

As a signed-in user, I want to see the total amount of the expenses shown in
my next-30-days list on the Home screen, so I can gauge my near-term
financial load without adding up the list myself.

**Why this priority**: Builds directly on US1's data and is explicitly named
in the product's MVP1 scope (§6.6) and the F3 build-order description, but a
user can still get real value from just the list in US1 even before this
number exists — so it's the next slice, not the first.

**Independent Test**: Can be fully tested by signing in with an account that
has planned expenses due within the next 30 days, opening the Home tab, and
confirming the displayed total equals the sum of exactly the expenses shown
in the next-30-days list.

**Acceptance Scenarios**:

1. **Given** a signed-in user has 3 planned expenses due within the next 30
   days totaling €450, **When** they open the Home tab, **Then** an
   upcoming total of €450 is displayed.
2. **Given** a signed-in user has no planned expenses due within the next 30
   days, **When** they open the Home tab, **Then** the upcoming total
   displays as €0 (not blank, not an error).
3. **Given** the upcoming total is showing, **When** the user adds, edits,
   deletes, or marks paid an expense whose due date falls within the next 30
   days, **Then** the total updates to reflect the change immediately,
   without requiring a manual refresh — since it sums exactly the same set
   of expenses the next-30-days list (US1) displays.

---

### User Story 3 - Spot the single biggest upcoming expense (Priority: P3)

As a signed-in user, I want the Home screen to highlight my single largest
upcoming planned expense in its own card, so the expense most likely to
strain my budget is impossible to miss.

**Why this priority**: This is a refinement on top of US1/US2's data — useful
for the "never be surprised" value proposition, but the app is still
functional and valuable with just the grouped list and the upcoming total.

**Independent Test**: Can be fully tested by signing in with an account that
has several planned expenses of varying amounts within the next 30 days,
opening the Home tab, and confirming the highlighted card shows the one with
the highest amount, along with its name, amount, and due date.

**Acceptance Scenarios**:

1. **Given** a signed-in user has planned expenses of €80, €650, and €120 due
   within the next 30 days, **When** they open the Home tab, **Then** the
   biggest-upcoming-expense card shows the €650 expense with its name and due
   date.
2. **Given** two upcoming expenses within the next 30 days are tied for the
   highest amount, **When** the Home tab renders, **Then** the card shows
   exactly one of them, chosen by a stable rule (the one due soonest), not a
   different one on every render.
3. **Given** there are no planned expenses due within the next 30 days,
   **When** the Home tab renders, **Then** the biggest-upcoming-expense card
   is hidden or replaced by an empty-state message rather than showing stale
   or blank data.

---

### Edge Cases

- What happens when the signed-in user has zero expenses at all (brand-new
  account)? The Home screen must show a clear, friendly empty state across
  all three elements (list, upcoming total, biggest-expense card) rather than
  blank space, a spinner that never resolves, or an error.
- What happens when the user has expenses, but none fall within the next 30
  days (all are further out or all already paid)? All three Home-screen
  elements share this same empty state (distinct from the zero-expenses-at-
  all state), since the upcoming total and biggest-expense card are derived
  from the exact same next-30-days/`planned` set as the list (see FR-005).
- What happens when the device has no network connection? The Home screen
  must render the last successfully fetched data (list, total, biggest-
  expense card) per the app's offline-tolerant principle, optionally marked
  as possibly-stale, rather than clearing to an empty or error state.
- How does the system handle a recurring expense whose mark-as-paid roll-
  forward lands the new occurrence's due date beyond the 30-day window? It
  disappears from the next-30-days list, the upcoming total, and the
  biggest-expense card alike (correctly, since it's no longer imminent) —
  all three always agree, since they share one underlying filtered set.
- What happens if fetching the user's expenses fails outright (not just
  offline, but a real error)? The Home screen shows a visible error state
  with the option to retry, rather than silently showing an empty dashboard
  that could be mistaken for "no expenses."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display, on the Home screen, all of the signed-in
  user's `planned` expenses whose due date falls within the next 30 days
  (inclusive of today), grouped under a heading for each distinct due date.
- **FR-002**: System MUST render today's due-date group with a distinct,
  human-readable heading (e.g., "Today") rather than a raw ISO date, and
  MUST render other date groups in a clear, localized, human-readable
  format.
- **FR-003**: System MUST order the due-date groups chronologically
  (soonest first), and MUST order expenses within a shared due-date group
  by a stable, deterministic rule.
- **FR-004**: System MUST exclude expenses with `status = 'paid'` or
  `status = 'skipped'` from the next-30-days list.
- **FR-005**: System MUST display a total amount of exactly the same
  `planned`, next-30-days-windowed expenses shown in the FR-001 list (not an
  independent calendar-month window), showing €0 when there are none, so the
  total always agrees with what the list is currently displaying.
- **FR-006**: System MUST display a single card highlighting the `planned`
  expense with the highest amount due within the next 30 days, showing at
  minimum its name, amount, and due date.
- **FR-007**: System MUST resolve ties for the highest amount in FR-006 by
  choosing the tied expense with the soonest due date, and resolve any
  further tie deterministically (e.g., by name) so the choice never changes
  between renders of the same data.
- **FR-008**: System MUST hide or replace the biggest-upcoming-expense card
  with an empty-state message when there are no `planned` expenses due
  within the next 30 days.
- **FR-009**: System MUST show a distinct, friendly empty state for each of
  the three Home-screen elements (list, upcoming total, biggest-expense card)
  when the user has no expense data to populate them, instead of blank
  space or an indefinite loading state.
- **FR-010**: System MUST render the most recently successfully fetched
  Home-screen data when the device has no network connection, per the app's
  offline-tolerant principle, rather than clearing to empty or showing an
  error.
- **FR-011**: System MUST show a visible, actionable error state (with a
  retry option) if fetching the user's expenses fails for a reason other
  than being offline, rather than silently rendering an empty dashboard.
- **FR-012**: System MUST update the next-30-days list, the upcoming total,
  and the biggest-upcoming-expense card immediately and consistently after
  an expense is added, edited, deleted, or marked as paid — including
  reflecting a recurring expense's roll-forward occurrence identically
  across all three, since they are derived from the same underlying set.
- **FR-013**: System MUST scope all Home-screen data to the signed-in
  user's own expenses only (no cross-user data ever appears), consistent
  with the existing RLS-scoped `expenses` table from F2.
- **FR-014**: Users MUST be able to mark an expense as paid directly from
  the Home screen's next-30-days list, without navigating to the Add tab.

### Key Entities

- **Expense** (existing, from F2): reused as-is — `name`, `amount`,
  `due_date`, `category_id`, `recurrence`, `status`. The Home dashboard is a
  read-oriented view over this existing entity; it introduces no new
  persisted entity of its own.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can see everything due in the next 30 days,
  correctly grouped by date, within 1 second of opening the Home tab (using
  cached data if available, network fetch otherwise).
- **SC-002**: The upcoming total displayed always equals the exact sum of
  the `planned` expenses shown in that user's next-30-days list — 100%
  agreement in spot-checks against the underlying data.
- **SC-003**: A user can correctly identify their single largest upcoming
  expense (name, amount, due date) without leaving the Home screen, in
  100% of cases where at least one qualifying expense exists.
- **SC-004**: A brand-new account with zero expenses sees a friendly,
  informative empty state on first launch of the Home tab — never a blank
  screen, a stuck spinner, or a crash.
- **SC-005**: A user with no network connection who has opened the app
  before still sees their most recent Home-screen data, not an empty or
  broken screen.

## Assumptions

- Expenses within a shared due-date group are ordered by amount, highest
  first, then by name for any remaining tie — a reasonable default for
  scanning "what's the big one on this day" without a documented user
  preference.
- "Next 30 days" is a rolling window computed from the current date
  (inclusive of today), consistent with the product doc's phrasing in §6.6
  and §7 ("next-30-days list sorted by due date").
- The upcoming total (US2/FR-005) sums the same next-30-days/`planned`
  window as the list (US1/FR-001), not an independent calendar-month window.
  An earlier version of this spec interpreted the product doc's §6.6 phrase
  "total for next month" literally as the calendar month following the
  current one; real usage showed that a total scoped to a window the user
  can't see or act on (mostly outside the visible list, and unaffected by
  marking a visible item paid) reads as broken rather than useful. Unifying
  the total with the list's own window makes it directly, visibly
  reconcilable with what's on screen — the more valuable reading of "total
  upcoming expenses at a glance" from the product doc's key user story 3.
  A literal fixed-calendar-month heads-up (the product doc's §3 "Monthly
  heads-up" rule) remains out of scope here and is deferred to F4/F7 as a
  separate, explicitly-labeled figure if built.
- The Home dashboard is read-only for browsing/marking-paid; full add/edit/
  delete of expenses continues to live on the Add tab (F2) and is not
  duplicated here, except for the mark-as-paid action (FR-014), which the
  product doc's user story 4 ("As a user, I mark an expense as paid...")
  implies should be reachable from wherever the user is looking at their
  upcoming expenses.
- No per-category grouping or subtotal is required on Home for F3 — the
  product doc's §7 roadmap defers "category bar chart" and category-level
  breakdowns to F7 (Monthly insights); F3 is scoped to the flat next-30-days
  list, one upcoming total, and one biggest-expense card, per §7's F3
  description.
- Currency formatting follows the existing `EUR`/locale-aware formatting
  already used elsewhere in the app (F1/F2); no new currency logic is
  introduced.
- This feature does not introduce or change notification behavior — that is
  explicitly F4's scope per the product doc's roadmap.
