# Feature Specification: Rules & Local Notifications

**Feature Branch**: `004-rules-notifications`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "F4 — Rules & local notifications: rules table, rule editor (threshold, days-before, category filter, enable toggle), notification scheduler that reconciles all local notifications on any expense/rule change, notifications_log. (see docs/mindyourmoney-spec.md §3, §7, and Acceptance-test seeds for F4)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get warned before a big expense hits (Priority: P1)

As a user, I want the app to automatically notify me some days before a large upcoming expense is due, and again shortly before if I still haven't marked it paid, so I'm never blindsided by a big payment.

**Why this priority**: This is the app's core value proposition ("never be surprised by an expense again"). Without at least one working, automatically-applied reminder rule, the app is just a list — this is the smallest slice that delivers the product's reason for existing.

**Independent Test**: Can be fully tested by creating an expense of €250 due in 10 days (above the default €200 threshold) with no other setup, and confirming a reminder notification is scheduled for 5 days before its due date, with a second reminder 1 day before if it's still unpaid at that point.

**Acceptance Scenarios**:

1. **Given** a signed-in user with the default rules active, **When** they add an expense with amount ≥ €200 due in more than 5 days, **Then** a reminder notification is scheduled for 5 days before the due date.
2. **Given** the expense from Scenario 1 has not been marked paid, **When** the calendar reaches 1 day before its due date, **Then** a second reminder notification is scheduled/fires.
3. **Given** the expense from Scenario 1, **When** the user marks it paid before either reminder fires, **Then** both pending reminders are cancelled and never delivered.
4. **Given** the expense from Scenario 1, **When** the user edits its amount down to below €200, **Then** the scheduled reminders tied to the "big expense" rule are cancelled.

---

### User Story 2 - Get a quiet heads-up for anything due tomorrow (Priority: P2)

As a user, I want a gentle, once-a-day reminder for anything due tomorrow — regardless of amount — so small recurring bills (subscriptions, small utility top-ups) don't slip past me either.

**Why this priority**: Extends the safety net from "big" expenses to all expenses, but is additive to (not required for) the core value delivered by User Story 1, and is explicitly modeled as a low-noise, grouped reminder rather than a per-expense alert.

**Independent Test**: Can be fully tested by creating any expense (any amount) due tomorrow and confirming exactly one grouped notification is scheduled for today, independent of the big-expense rule.

**Acceptance Scenarios**:

1. **Given** a signed-in user with the default rules active, **When** they have one or more expenses due tomorrow, **Then** a single grouped reminder notification (not one per expense) is scheduled for today.
2. **Given** an expense is both ≥ €200 and due tomorrow, **When** notifications are reconciled, **Then** the user receives one "due tomorrow" notification and does not receive a duplicate reminder for the same due date from the big-expense rule's 1-day-before trigger.

---

### User Story 3 - Customize or add reminder rules (Priority: P3)

As a user, I want to view my reminder rules, adjust the amount threshold, timing, and category filter on the defaults, turn any rule on or off, and add my own rules, so notifications match my own risk tolerance and spending patterns rather than a one-size-fits-all default.

**Why this priority**: Valuable for making the feature fit individual habits, but the app already delivers its core promise via the seeded defaults in User Stories 1-2 without any customization — this is refinement, not the MVP floor.

**Independent Test**: Can be fully tested by opening the rules screen, editing the default "Big expense ahead" rule's threshold from €200 to €500, and confirming an existing €300 expense's scheduled reminder is cancelled (no longer qualifies) without the user touching that expense directly.

**Acceptance Scenarios**:

1. **Given** a user opens the rules screen for the first time, **When** the screen loads, **Then** they see exactly the two seeded default rules with their current threshold, timing, and enabled state.
2. **Given** a user edits a rule's threshold, days-before timing, or category filter, **When** they save, **Then** all future notifications reflect the new configuration and any now-stale scheduled notifications are cancelled.
3. **Given** a user disables a rule, **When** the change is saved, **Then** all notifications previously scheduled because of that rule are cancelled, and no new ones are scheduled from it until it's re-enabled.
4. **Given** a user creates a new custom rule (threshold, days-before, optional category filter), **When** they save it, **Then** it is evaluated against existing and future expenses exactly like a default rule.
5. **Given** a user attempts to delete one of the two seeded default rules, **When** they try, **Then** the app blocks the deletion and offers disabling it instead.
6. **Given** a user creates and later deletes a custom rule, **When** the deletion is saved, **Then** all notifications scheduled because of that rule are cancelled.

---

### Edge Cases

- What happens when a rule's days-before value would place a trigger point in the past relative to right now? The system does not schedule a notification for that already-passed trigger point.
- What happens when an expense is marked paid after some, but not all, of its trigger points have already fired? Any remaining not-yet-fired reminders for that expense are cancelled.
- What happens when two enabled rules both match the same expense for the same due date? The user receives exactly one notification for that expense/date, not one per matching rule.
- What happens when a recurring expense rolls forward to its next occurrence (marked paid)? Reminders tied to the original occurrence are cancelled, and fresh reminders are scheduled against the new occurrence's due date using the same rules.
- What happens when the user denies notification permissions? Expense tracking continues to work normally; the app indicates reminders are currently off and explains how to enable them.
- What happens when the user deletes an expense that has pending reminders? Those reminders are cancelled immediately.
- What happens when the app has been closed for a while and rules/expenses changed via another device or process in the meantime? Reminders are fully reconciled (stale ones cancelled, missing ones scheduled) the next time the app is opened.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST seed exactly two default rules for every user on first use: "Big expense ahead" (amount ≥ €200, notify 5 days before due date, and again 1 day before if still unpaid) and "Due tomorrow" (any amount, notify 1 day before due date, grouped into a single notification).
- **FR-002**: Users MUST be able to view all of their rules, showing each rule's name, condition (amount threshold, category filter if any), timing (days-before trigger(s)), and enabled/disabled state.
- **FR-003**: Users MUST be able to create a new custom rule specifying a minimum amount threshold (or "any amount"), one primary days-before trigger point (0-30 days) and an optional second, later days-before trigger, and an optional category filter restricting the rule to specific categories.
- **FR-004**: Users MUST be able to edit an existing rule's threshold, days-before trigger(s), category filter, and enabled state, including the two seeded default rules.
- **FR-005**: Users MUST be able to delete a custom rule they created. The two seeded default rules MUST NOT be deletable — only disabled — so every user always retains a baseline safety net that can be re-enabled.
- **FR-006**: System MUST evaluate every enabled rule against every planned (unpaid) expense and schedule a local device reminder for each matching rule/expense/trigger-point combination that lies in the future.
- **FR-007**: System MUST reconcile all local reminders (cancel stale ones, schedule missing ones) whenever an expense is created, edited, deleted, or marked paid/rolled forward, and whenever a rule is created, edited, deleted, or its enabled state changes.
- **FR-008**: System MUST reconcile all local reminders every time the app is opened or brought to the foreground, to correct for any changes that could not be captured while the app was closed.
- **FR-009**: System MUST NOT schedule a reminder for a trigger point that has already passed relative to the current date/time.
- **FR-010**: System MUST cancel a previously scheduled reminder once its associated expense is marked paid, deleted, or no longer matches the rule that generated it (e.g., after an edit).
- **FR-011**: System MUST ensure the user receives at most one notification per expense per due date, even when multiple enabled rules match the same expense/date combination.
- **FR-012**: System MUST record each reminder actually delivered to the user in a notification history, capturing which expense and rule triggered it and when it was sent.
- **FR-013**: System MUST scope all rules and notification history records to the signed-in user, consistent with existing expense/category ownership isolation.
- **FR-014**: System MUST continue to allow full expense tracking if the user denies notification permissions, and MUST clearly indicate to the user that reminders are currently off until permission is granted.
- **FR-015**: When a recurring expense rolls forward (marked paid, per existing F2 behavior), the system MUST cancel any remaining reminders tied to the original occurrence and schedule fresh reminders for the new occurrence based on the same currently-enabled rules.

### Key Entities *(include if feature involves data)*

- **Rule**: A user-owned reminder configuration — name, enabled flag, optional minimum amount (absent = any amount), optional set of category filters (absent = all categories), a primary days-before trigger, an optional secondary ("repeat") days-before trigger, and a flag distinguishing the two non-deletable seeded defaults from user-created custom rules.
- **Notification history entry**: A record of one reminder actually delivered to a user — which user, which expense, which rule, and when it was sent — used to avoid duplicate sends and to give the user/support a record of what fired.
- **Expense** *(existing, from F2)*: Referenced, not redefined here — rules evaluate against its amount, category, due date, recurrence, and status fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user sees both seeded default rules, correctly configured, the first time they open the rules screen — with no setup steps required to get baseline reminders working.
- **SC-002**: 100% of expenses that meet an enabled rule's conditions produce exactly one reminder at each of that rule's configured trigger points — never zero, never a duplicate.
- **SC-003**: 100% of reminders tied to an expense that is paid, deleted, or edited out of a rule's conditions are cancelled and never delivered afterward.
- **SC-004**: Users can create a fully custom rule (threshold, timing, optional category filter) in under 30 seconds.
- **SC-005**: 100% of a user's rules and notification history are isolated to that user and never visible to another account.

## Assumptions

- The two default rules ("Big expense ahead", "Due tomorrow") are seeded automatically on first login, mirroring the existing default-category seeding pattern from F1.
- Default rules can be edited and disabled but never permanently deleted, guaranteeing every user always keeps a baseline safety net they can re-enable; only user-created custom rules can be deleted outright.
- MVP1 ships local, on-device scheduled notifications only (no server component). Reconciliation happens on every expense/rule change and on every app foreground; a device that stays closed and offline indefinitely will not receive reminders until it's reopened — guaranteed delivery while fully closed is out of scope here and planned for F5 (server push).
- Rule conditions in this feature are limited to an amount threshold, an optional category filter, and one or two days-before trigger points ("simple builder," per the product plan). A full multi-condition AND builder and a "recurring true/false" condition are deferred to MVP2's full rule builder.
- The "Monthly heads-up" digest rule (a fixed-day-of-month, aggregate summary of next month's expenses) is explicitly out of scope for this feature and remains planned for MVP2, per the product roadmap.
- A notification history entry is recorded once the app can observe that a reminder was actually delivered (e.g., on foreground receipt, or reconciliation on next app open) — this is the MVP-appropriate approximation of "sent," given no server component exists yet to guarantee delivery tracking while the app is fully closed.
