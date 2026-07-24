# Quickstart: Home Dashboard

Validation guide for Feature F3. Assumes the implementation tasks in
`tasks.md` have been completed, and F1 (auth + categories) and F2 (expense
CRUD + recurrence) are already in place.

## Prerequisites

- Node.js LTS and the Expo CLI (`npx expo` — no global install needed)
- A Supabase project (free tier) with F1's and F2's migrations already
  applied (no new migration ships with F3)
- A signed-in test account; use the Add tab (F2) to create test expenses
  with a spread of due dates and amounts before validating scenarios below

## Setup

```bash
npm install
npx expo start
```

Open the app in Expo Go or a simulator/emulator from the CLI output, signed
in with a test account.

## Scenario 1 — Next-30-days list, grouped by date (User Story 1)

1. Using the Add tab, create planned expenses due in 5, 12, and 40 days
   from today.
2. Open the Home tab.
3. **Expect**: the 5-day and 12-day expenses appear, each under a heading
   for its own due date; the 40-day expense does not appear anywhere on
   Home.

## Scenario 2 — Shared due date groups together (User Story 1)

1. Create two planned expenses with the exact same due date, within the
   next 30 days.
2. Open the Home tab.
3. **Expect**: both expenses appear under one shared date heading, ordered
   consistently (highest amount first) on every reload.

## Scenario 3 — "Today" heading (User Story 1)

1. Create a planned expense with `due_date` equal to today.
2. Open the Home tab.
3. **Expect**: it appears under a heading reading "Today", not today's raw
   date.

## Scenario 4 — Paid/skipped expenses excluded (User Story 1, FR-004)

1. Mark an upcoming (within-30-days) expense as paid from either tab.
2. Open (or return to) the Home tab.
3. **Expect**: the now-paid expense no longer appears in the next-30-days
   list. If it was recurring, its roll-forward occurrence appears instead,
   under the correct new due-date heading, only if that new date is still
   within 30 days.

## Scenario 5 — Mark as paid directly from Home (User Story 1, FR-014)

1. Open the Home tab with at least one upcoming planned expense visible.
2. Trigger its mark-as-paid action from the Home list itself (not the Add
   tab).
3. **Expect**: the list updates immediately without navigating away from
   Home.

## Scenario 6 — Upcoming total (User Story 2)

1. Create three planned expenses within the next 30 days, with known
   amounts (e.g., 100.00, 200.00, 150.00).
2. Open the Home tab.
3. **Expect**: the upcoming total displays 450.00 — the exact sum of
   exactly the expenses shown in the next-30-days list below it (not a
   different, disjoint window).

## Scenario 7 — Upcoming total is zero, not blank (User Story 2)

1. Ensure no planned expenses fall within the next 30 days (delete/edit any
   that do, for a clean test account).
2. Open the Home tab.
3. **Expect**: the upcoming total displays as 0.00 (or equivalent
   zero-amount formatting), not a blank space or dash.

## Scenario 8 — Upcoming total updates live, including on mark-as-paid (User Story 2, FR-012)

1. With the Home tab open (or freshly reopened after each step), add an
   expense due within the next 30 days.
2. **Expect**: the total increases by that expense's amount.
3. Edit that expense's amount upward, then downward.
4. **Expect**: the total tracks each change.
5. Mark that expense as paid from the Home list.
6. **Expect**: the total decreases by exactly that expense's amount
   immediately — this is the scenario that previously appeared broken when
   the total was scoped to a separate calendar-month window (see
   research.md #3); with the shared next-30-days window, marking a visible
   expense paid must always move the total.
7. Delete a different upcoming expense instead.
8. **Expect**: the total decreases by that expense's amount too.

## Scenario 9 — Biggest-upcoming-expense card (User Story 3)

1. Create three planned expenses within the next 30 days: amounts 80,
   650, and 120.
2. Open the Home tab.
3. **Expect**: the biggest-upcoming-expense card shows the 650 expense,
   with its name and due date.

## Scenario 10 — Tied biggest amount resolves deterministically (User Story 3, FR-007)

1. Create two planned expenses within the next 30 days with the identical
   (highest) amount but different due dates.
2. Open the Home tab, note which one the card shows.
3. Reload the app / re-fetch.
4. **Expect**: the card shows the same one both times — specifically, the
   one due soonest.

## Scenario 11 — No upcoming expenses hides/empties the biggest-expense card (User Story 3, FR-008)

1. Ensure no planned expenses fall within the next 30 days.
2. Open the Home tab.
3. **Expect**: the biggest-upcoming-expense card is hidden or shows an
   empty-state message — never stale data from a previous state.

## Scenario 12 — Brand-new account empty state (Edge Case, FR-009)

1. Sign in with a freshly created account that has zero expenses.
2. Open the Home tab.
3. **Expect**: all three sections (list, upcoming total, biggest-expense
   card) show a friendly empty state — no blank space, no stuck spinner,
   no crash.

## Scenario 13 — Offline shows last-known data (Edge Case, FR-010)

1. Open the Home tab while online, with some upcoming expenses, so data is
   cached.
2. Disable the device's network connection.
3. Close and reopen the app (or navigate away from and back to Home).
4. **Expect**: the same list/total/card render from cache — not an empty
   or error state.

## Scenario 14 — Fetch error shows a retry, not a silent empty dashboard (Edge Case, FR-011)

1. Simulate a real fetch failure (e.g., an invalid Supabase key/URL, or a
   backend error unrelated to being offline).
2. Open the Home tab on a fresh session with no cached data.
3. **Expect**: a visible error state with a retry option is shown — not an
   empty dashboard indistinguishable from "no expenses."

## Automated coverage

- `tests/unit/dashboard-selectors.test.ts` — covers Scenarios 1–3, 6–7,
  9–11's windowing/grouping/summing/tie-break math directly against
  `Expense[]` fixtures, independent of the database or UI, including the
  integer-cent summation (research.md #4) and that the upcoming total
  shrinks when a contributing expense's status flips to paid (Scenario 8,
  research.md #3 round 2 patch).
- `tests/component/dashboard-screen.test.tsx` — covers Scenario 5's
  mark-as-paid interaction from the Home list, Scenario 8's live total
  update on mark-as-paid, Scenario 12's empty states, Scenario 13's
  offline/cached-data rendering, and Scenario 14's error/retry state.
