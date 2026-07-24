# Research: Home Dashboard

No items in the plan's Technical Context were left as `NEEDS
CLARIFICATION` — F3 reuses F2's data layer entirely, so the open questions
here are about derivation logic, not new infrastructure.

## 1. Data source: reuse `useExpenses()` vs. a new dashboard-specific query

**Decision**: Reuse the existing `useExpenses()` hook
(`src/features/expenses/useExpenses.ts`) unchanged as the dashboard's only
data source, and derive everything (grouping, windows, totals, biggest-
expense) client-side from its result with pure functions.

**Rationale**: `useExpenses()` already fetches all of the signed-in user's
expenses via TanStack Query with RLS scoping and offline-tolerant caching
(constitution IV) — exactly what FR-010 requires. A single-user MVP's
expense list is small (tens to low hundreds of rows), so client-side
grouping/windowing/summing is effectively instant and needs no server-side
aggregation. Reusing the same query key also means a mutation from the Add
tab (create/edit/delete/mark-paid) invalidates the same cache entry the
dashboard reads, so FR-012's "updates immediately" requirement falls out for
free from TanStack Query's existing invalidation, with no new wiring.

**Alternatives considered**:
- *A dedicated Supabase view/RPC that pre-aggregates the monthly total and
  biggest expense server-side.* Rejected: adds a new backend surface
  (violates the "no new schema" simplicity of this feature) for a
  computation trivial to do client-side at this scale; would also need its
  own offline-cache story duplicate to `useExpenses()`'s.
- *A separate `useDashboard()` query with its own fetch.* Rejected: would
  either duplicate the same `select * from expenses` call (double network
  traffic, two cache entries to keep in sync) or require a second round-trip
  after `useExpenses()` — no benefit over deriving from the one query already
  in cache.

## 2. Next-30-days grouping and "Today" heading

**Decision**: Compute the window as `[today, today + 29 days]` inclusive
(30 calendar days total, matching the product doc's "next-30-days" phrasing
and the existing `due_date` string format `YYYY-MM-DD` from F2). Group by
exact `due_date` string equality (no timezone conversion needed since
`due_date` is a plain date, not a timestamp). The heading for a group is
computed by comparing the group's date string to today's date string
(device-local calendar day) and rendering `"Today"` on match, otherwise a
localized, human-readable date (e.g., `Intl.DateTimeFormat` with a short
weekday+month+day format), reusing whatever locale-formatting convention F2
already established for dates in the sheet, if any, for visual consistency.

**Rationale**: `due_date` is already a plain SQL `date` (no time-of-day or
timezone component), so string-based grouping avoids any timezone math bugs
entirely — two expenses with the same `due_date` string are definitionally
"the same day" with no ambiguity.

**Alternatives considered**:
- *Group by `Date` object day-boundaries.* Rejected: introduces timezone
  conversion risk for zero benefit, since the underlying data has no time
  component to convert.

## 3. "Next month" total window vs. "next 30 days" window

**Original decision (superseded — see "round 2 patch" below)**: Implemented
as two independently-computed windows in `selectors.ts`: the 30-day window
was `[today, today+29]`; the "next month" window was the full calendar
month following the current one (first day to last day). The rationale at
the time was that the product doc (§3's "Monthly heads-up" rule, §6.6)
treats "next month" as a distinct, calendar-month-aligned concept from the
rolling 30-day list, and conflating them would misrepresent one or the
other depending on the day of the month.

**What went wrong in practice**: after implementation, real device testing
showed the calendar-month total rarely matched what was visible in the
30-day list (e.g., on 2026-07-23 the list spans Jul 23–Aug 21, but "next
month" meant all of August 1–31 — mostly a *different* set of expenses).
Two concrete, reported symptoms: (1) the total often equaled a single
expense's amount — whichever one happened to be the sole item landing in
the disjoint calendar-month window — which could coincidentally match the
biggest-upcoming-expense card's number, reading as "it's just showing the
biggest expense again"; (2) marking an expense paid from the visible list
frequently did not change the total at all, because that expense's due date
was outside the calendar-month window to begin with, so it was never part
of that number. Both looked like bugs but were the calendar-month
window doing exactly what it was told — just not what a user watching the
visible list expects a "total" next to it to do.

**Decision (round 2 patch)**: Retarget the total to sum the exact same
next-30-days/`planned` set the list and the biggest-expense card already
use — via one shared filter, `planForNext30Days(expenses, todayIso)`, that
all three selectors call. Renamed `nextMonthTotal` → `upcomingTotal` and
the `MonthlyTotal` type → `UpcomingTotal` throughout, and relabeled the UI
card from "Next month" to "Upcoming total (next 30 days)" so the label
matches what it now computes. No independent calendar-month window exists
in this feature anymore.

**Rationale**: A total that's guaranteed to sum exactly what's on screen is
directly, visibly reconcilable — adding, editing, deleting, or marking paid
any expense in the visible list now moves the total by exactly that
expense's amount, every time. This is the more useful reading of the
product doc's key user story 3 ("see next month's total upcoming expenses
at a glance") in an MVP where the "glance" *is* the next-30-days list.

**Alternatives considered**:
- *Keep the calendar-month total, just relabel it with the actual month
  name (e.g., "Due in August").* Rejected: still wouldn't react to actions
  taken on the visible list, which was the core of the reported confusion,
  not just a labeling problem.
- *Show both a calendar-month total and a list-scoped total.* Rejected as
  unnecessary duplication for this MVP — two numbers with subtly different
  windows is more cognitive load than value at this stage; a literal
  calendar-month "monthly heads-up" figure (product doc §3) can be
  reintroduced later (F4/F7) as its own clearly-labeled, separate feature if
  still wanted, rather than living inconsistently inside F3.
- *Treat "next month" as also a rolling 30-day-ish window* (considered
  originally). Rejected at the time in favor of the literal calendar-month
  reading — reconsidered and reversed by this patch once real usage showed
  the literal reading was the wrong default for this feature's purpose.

## 4. Integer-cent summation for the upcoming total (constitution VI)

**Decision**: `selectors.ts`'s upcoming-total function converts each
`amount` to integer cents via `Math.round(amount * 100)` before summing,
then divides the integer sum by 100 for display — never accumulating
`amount` floats directly with `+=`.

**Rationale**: Constitution VI requires all in-app monetary arithmetic to
avoid native float accumulation. Individual `amount` values already arrive
as JS `number` from F2's Supabase client (an existing precedent this feature
doesn't change), but *summing several of them* is new arithmetic introduced
by this feature, so it's the point where float-drift risk actually enters —
e.g. repeated `0.1 + 0.2`-style rounding errors across dozens of rows. Doing
the accumulation in integer cents eliminates that risk with a one-line
change, without needing a full decimal library dependency (which would also
need a free-tier/dependency check per constitution III for no real benefit
at this scale).

**Alternatives considered**:
- *Sum floats directly, round only for display.* Rejected: same category of
  bug the constitution explicitly calls out; trivial to avoid.
- *Adopt a decimal-math library (e.g. `decimal.js`).* Rejected as
  over-engineering for a single `+` reduction over at most a few hundred
  rows; integer-cent arithmetic is sufficient and adds no new dependency.

## 5. Biggest-upcoming-expense tie-break (FR-007)

**Decision**: Sort candidates (the same next-30-days-windowed, `planned`-
status subset used for the list) by amount descending, then by `due_date`
ascending, then by `name` ascending, and take the first result.

**Rationale**: A fully deterministic, stable sort ensures the same input
data always produces the same displayed card — required by FR-007/Acceptance
Scenario 2 ("not a different one on every render"). Soonest-due-date as the
first tie-break matches the product's "never be surprised" framing: between
two equally large expenses, the one arriving sooner is the more urgent one
to see highlighted.

**Alternatives considered**:
- *Break ties by insertion/array order (whatever order Supabase returns).*
  Rejected: not guaranteed stable across refetches/cache updates, and not
  meaningful to a user (`created_at` order has no bearing on urgency).

## 6. Reusing `useMarkExpensePaid()` for the Home list's mark-as-paid action

**Decision**: `DashboardScreen.tsx` imports `useMarkExpensePaid()` from
`src/features/expenses/useExpenseMutations.ts` unchanged and wires it to
`UpcomingList`'s per-row action, identical to how `add.tsx` already wires it
to `ExpenseList`.

**Rationale**: F2 already built this mutation as optimistic (updates the
shared `useExpenses()` cache immediately, including previewing a recurring
roll-forward) and idempotent server-side (FR-010 from F2's spec). Reusing it
here for FR-014 needs zero new mutation code — only a new UI entry point —
and guarantees the Home list and Add tab can never disagree about an
expense's paid state, since they share one cache entry and one mutation.

**Alternatives considered**:
- *A dashboard-specific mark-paid wrapper.* Rejected: no behavioral
  difference needed; would only add indirection over the existing hook.

## 7. Shared `planForNext30Days` filter (round 2 patch)

**Decision**: Extracted the next-30-days/`planned` filter that
`groupNext30Days`, `upcomingTotal`, and `biggestUpcoming` each need into one
function, `planForNext30Days(expenses, todayIso)`, called by all three.

**Rationale**: Introduced as part of the #3 round-2 patch — with the total
now sharing the list's exact window, having three separately-written copies
of the same filter expression would be one more place for the two to
silently drift apart again if only one copy were edited in a future change.
One function makes "the three dashboard sections always agree" a structural
guarantee rather than something to remember to keep in sync by hand.

**Alternatives considered**:
- *Keep three inline filter expressions, kept identical by convention.*
  Rejected: this is exactly the shape of bug that prompted the #3 patch in
  the first place — convention alone didn't prevent the total's window from
  drifting from the list's.
