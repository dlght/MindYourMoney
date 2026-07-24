# Feature Specification: Expense CRUD & Recurrence

**Feature Branch**: `002-expense-crud-recurrence`

**Created**: 2026-07-23

**Status**: Implemented

**Input**: User description: "F2 — Expense CRUD & recurrence: expenses table + RLS, add/edit/delete sheet, monthly/yearly recurrence, mark-as-paid rolls recurring expenses to next due date. (see docs/mindyourmoney-spec.md §6 and §7, Feature F2)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log an upcoming expense (Priority: P1)

A signed-in user adds an expense — a name, an amount, a due date, and a
category — so it becomes part of their tracked upcoming spending.

**Why this priority**: This is the core action the entire product exists to
support; nothing else (dashboard, rules, notifications) has data to work with
until expenses can be created.

**Independent Test**: Can be fully tested by opening the Add tab, entering a
name, amount, due date, and category, saving, and confirming the expense now
exists with exactly those values.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the Add tab, **When** they enter a name,
   amount, due date, and category and save, **Then** a new expense is created
   with status "planned" and those values.
2. **Given** a user is adding an expense, **When** they leave the name or
   amount blank, or enter a non-positive amount, **Then** the system shows a
   validation message and does not save.
3. **Given** a user is adding an expense, **When** they do not pick a
   category, **Then** the system defaults it to the "Other" category rather
   than blocking save.
4. **Given** a user is adding an expense with many categories to choose
   from, **When** they open the category field, **Then** they see a compact
   control (not every category displayed at once) that expands to a
   selectable list on demand.
5. **Given** a user submits a save that fails (e.g., a connectivity or
   server error), **When** the failure occurs, **Then** the system shows a
   clear error message and keeps the user's entered values so they can
   retry, rather than clearing the form as if it had succeeded.

---

### User Story 2 - Edit or delete an existing expense (Priority: P2)

A user opens an expense they already logged and changes its details, or
removes it entirely because it was added in error or is no longer relevant.

**Why this priority**: Expense data is rarely entered perfectly the first
time (wrong amount, date shifts); without edit/delete the user is stuck
re-entering or living with mistakes, but this is secondary to being able to
add an expense at all.

**Independent Test**: Can be fully tested by creating an expense, editing one
of its fields and saving, confirming the change persists, then deleting a
(different) expense and confirming it no longer appears anywhere.

**Acceptance Scenarios**:

1. **Given** an existing expense, **When** the user changes its name, amount,
   due date, category, or recurrence and saves, **Then** the updated values
   persist and are reflected immediately.
2. **Given** an existing expense, **When** the user chooses delete and
   confirms, **Then** the expense is permanently removed and no longer
   appears in any list.
3. **Given** a user is deleting an expense, **When** they trigger delete,
   **Then** the system asks for confirmation before removing it (to guard
   against accidental taps).
4. **Given** a user confirms a delete that then fails (e.g., a connectivity
   or server error), **When** the failure occurs, **Then** the system shows
   a clear error message rather than behaving as if the expense were
   removed.

---

### User Story 3 - Mark a recurring expense as paid and have it roll forward (Priority: P1)

A user sets an expense to repeat monthly or yearly (e.g., rent, car
insurance). When its due date arrives and they mark it paid, the app
automatically creates the next occurrence at the next due date, so the user
never has to re-enter a recurring bill.

**Why this priority**: Recurring expenses (rent, subscriptions, insurance)
are the majority of a typical user's tracked spending; without automatic
roll-forward, the core value proposition ("never re-enter what repeats")
fails on day one of real use, so this ranks alongside basic add.

**Independent Test**: Can be fully tested by creating an expense with monthly
recurrence, marking it paid, and confirming a new expense appears with the
same name/amount/category and a due date one month later, while the original
is preserved with status "paid".

**Acceptance Scenarios**:

1. **Given** an expense with recurrence set to "monthly" or "yearly",
   **When** the user marks it as paid, **Then** the original expense's status
   becomes "paid" and a new expense is created with the same name, amount,
   and category, due one month (or one year) after the original due date.
2. **Given** an expense with no recurrence set, **When** the user marks it as
   paid, **Then** its status becomes "paid" and no new expense is created.
3. **Given** a user is creating or editing an expense, **When** they set
   recurrence, **Then** the only choices are "none", "monthly", or "yearly".
4. **Given** a recurring expense that has already rolled forward once,
   **When** the user marks the new occurrence paid again, **Then** it rolls
   forward again, indefinitely, one occurrence at a time.
5. **Given** a user sets recurrence to "monthly", **When** they specify the
   due date, **Then** they are asked only for a day of the month — not a
   full date — and the year/month are resolved automatically.
6. **Given** a user sets recurrence to "yearly", **When** they specify the
   due date, **Then** they are asked only for a month and a day — not a
   year — and the year is resolved automatically.
7. **Given** a user editing an already-recurring expense changes only the
   day (monthly) or month/day (yearly), **When** they save, **Then** the
   expense's year (and, for monthly, month) stays anchored to its existing
   schedule rather than jumping to the current year/month.
8. **Given** a user is creating a new "monthly" or "yearly" expense and
   enters a day/month whose resolved date this cycle has already passed,
   **When** they save without checking "already paid", **Then** the
   expense is created with its next occurrence's due date instead (e.g.
   next month's or next year's), not a date already in the past.
9. **Given** a user is creating a new "monthly" or "yearly" expense and
   the resolved date has already passed, **When** they check "already
   paid" and save, **Then** the expense is created with the exact entered
   (past) due date, its status is immediately "paid", and a new "planned"
   expense is created for its next occurrence — identical in effect to
   creating it with that past date and then marking it paid (US3's core
   behavior).

---

### Edge Cases

- What happens when a user tries to save an expense with a negative or zero
  amount? The system must reject it client-side with a clear message before
  any network call.
- What happens when a user marks an already-paid expense as paid again (e.g.,
  a double tap)? The system must not create a second roll-forward expense for
  the same occurrence.
- What happens when a user deletes a category that existing expenses still
  reference? Out of scope for this feature — category management (including
  delete/archive) is not introduced until a later feature; all categories
  visible here are the read-only defaults seeded by F1.
- What happens when a user is offline and tries to add or edit an expense?
  They should see a clear indication that the change requires connectivity
  rather than a silent failure or a change that appears saved but is lost.
- What happens when a user picks a due date in the past for a one-off
  ("none" recurrence) expense? The system allows it (e.g., for logging a
  bill just missed) without blocking save — this full-date field is
  unaffected by FR-013's recurring-only advance-to-next-occurrence rule.
- What happens when a user picks a day/month for a new recurring expense
  whose resolved date this cycle has already passed? By default (FR-013)
  the system advances it to the next occurrence rather than saving a past
  date; the user can opt out of that advance via the "already paid" choice
  (FR-015) to record the passed cycle as history instead.
- What happens when the recurrence roll-forward date lands on a day that
  doesn't exist in the target month (e.g., Jan 31 → Feb 31)? The system must
  roll forward to the last valid day of that month instead.
- What happens when a user enters a day/month for a monthly or yearly
  expense that doesn't exist in the anchoring month (e.g., day 31 anchored
  to a 30-day month, or Feb 29 anchored to a non-leap year)? The system
  must clamp to the last valid day of that month, the same rule used for
  roll-forward, rather than rejecting the entry or computing an invalid
  date.
- What happens when saving, updating, or deleting an expense fails after
  the user has already submitted it? The system must show a clear error
  and preserve the user's entered values — it must never silently clear
  the form or dismiss the sheet as though the action had succeeded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a signed-in user create an expense with a
  name, amount, due date, and category.
- **FR-002**: System MUST reject expense creation or edits where the amount
  is not a positive number, or the name is empty, showing a clear message
  before any save attempt.
- **FR-003**: System MUST default an expense's category to "Other" when the
  user does not explicitly choose one.
- **FR-004**: System MUST let a user edit any field of an expense they own
  (name, amount, due date, category, recurrence) and persist the change
  immediately.
- **FR-005**: System MUST let a user delete an expense they own, after an
  explicit confirmation step, permanently removing it.
- **FR-006**: System MUST let a user set an expense's recurrence to "none",
  "monthly", or "yearly".
- **FR-007**: System MUST let a user mark a "planned" expense as "paid".
- **FR-008**: System MUST, when a "monthly" or "yearly" recurring expense is
  marked "paid", automatically create a new "planned" expense with the same
  name, amount, and category, due one month or one year (respectively) after
  the original's due date, clamped to the last valid day of the target month
  when the exact day does not exist.
- **FR-009**: System MUST NOT create a roll-forward expense when a
  non-recurring expense is marked "paid".
- **FR-010**: System MUST prevent a double roll-forward from a single
  mark-as-paid action, even under rapid repeated taps or retried requests.
- **FR-011**: System MUST scope all expense data to the owning user, so no
  user can view, edit, or delete another user's expenses.
- **FR-012**: System MUST show every expense a user owns as belonging to
  exactly one of that user's categories (defaulting to "Other" per FR-003).
- **FR-013**: System MUST tailor the due-date input to the chosen
  recurrence: a one-off expense ("none") requires a full date; a "monthly"
  expense requires only a day-of-month; a "yearly" expense requires a month
  and a day. In both recurring cases the year (and, for monthly, the month)
  is resolved automatically rather than asked for — anchored to the current
  year/month when creating a new expense, or to the expense's existing due
  date when editing one, and clamped to the last valid day of the
  anchoring month when the entered day doesn't exist there. When creating a
  new recurring expense (not editing), if the resolved date has already
  passed (is earlier than today), the system MUST advance it to its next
  occurrence instead — e.g. entering day 5 on the 20th schedules next
  month's 5th, not a date 15 days in the past — unless the user opts in via
  FR-015.
- **FR-014**: System MUST show a clear, actionable error message and
  preserve the user's entered values when saving, updating, or deleting an
  expense fails, rather than silently discarding the attempt or behaving as
  though it had succeeded.
- **FR-015**: When creating a new "monthly" or "yearly" expense, the system
  MUST offer the user an explicit, opt-in choice to record the entered
  cycle as already paid instead of applying FR-013's forward-advance. When
  chosen, the system MUST create the expense with the exact entered
  (possibly past) due date, immediately mark it "paid", and — per FR-008 —
  automatically create its next "planned" occurrence, so the user is not
  asked to separately track an expense they have already paid, while still
  being reminded of the next real occurrence.

### Key Entities

- **Expense**: A single tracked cost with a name, amount, currency, due
  date, owning category, recurrence setting (none/monthly/yearly), and
  status (planned/paid/skipped). Owned by exactly one user. A recurring
  expense marked paid produces a new Expense representing the next
  occurrence; the paid one is retained as history rather than mutated into
  the next occurrence.
- **Category** (existing, from F1): The grouping an expense belongs to;
  this feature only consumes the categories already seeded, it does not
  add category management.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a new expense in under 15 seconds from opening
  the Add tab.
- **SC-002**: 100% of monthly/yearly recurring expenses that are marked paid
  produce exactly one new planned occurrence at the correct next due date,
  with zero duplicate occurrences even under repeated mark-as-paid attempts
  on the same expense.
- **SC-003**: 100% of edits and deletes a user makes to their own expenses
  are reflected immediately and are never visible to, or editable by, any
  other user.
- **SC-004**: Zero expenses are ever created or left without exactly one
  category assigned.
- **SC-005**: A user entering a monthly or yearly recurring expense is never
  asked to choose a year, and never sees a save fail or succeed silently —
  every failure surfaces a message and every success is visible in the list.
- **SC-006**: A newly created monthly/yearly recurring expense is never
  saved with a due date that has already passed, unless the user explicitly
  chose to record it as an already-paid past cycle.

## Assumptions

- Currency is fixed per the product's current single-currency assumption
  (EUR default per `docs/mindyourmoney-spec.md` §5); multi-currency is out of
  scope until MVP3.
- "Skipped" is a valid expense status per the existing product data model,
  but no user-facing action to set it is introduced by this feature — it is
  reserved for a later feature (out of scope here beyond not breaking on its
  presence).
- Recurrence is a fixed monthly/yearly toggle only; custom intervals (e.g.,
  every 2 weeks) and full RRULE support are out of scope until a later
  feature, per the product roadmap.
- The Add/Edit UI is presented as a sheet (per the product's UI baseline),
  consistent with the scaffolded placeholder in F1's Add tab, which this
  feature replaces with real functionality.
- Category management (create/rename/archive) remains out of scope; users
  choose only from the categories already seeded by F1.
- The category field is presented as a compact, collapsed control that
  expands to a selectable list on demand, rather than every category being
  shown at once — this scales to however many categories a user
  accumulates without growing the rest of the form.
- For a monthly/yearly recurring expense, only the day (monthly) or month
  and day (yearly) are entered directly; the year is always resolved
  automatically rather than being a user-facing field.
- Defaulting a new recurring expense's resolved-past date to its next
  occurrence (FR-013) — rather than saving the passed date as-is — is the
  more useful default for a forward-looking expense tracker: a user
  entering "day 5" is describing a recurring obligation, and the cycle
  that's already elapsed is not what they're being asked to plan for next.
  The "already paid" opt-in (FR-015) exists specifically for the minority
  case where the user does want to record that elapsed cycle, e.g.
  back-filling a bill they already paid before they started using the app.
