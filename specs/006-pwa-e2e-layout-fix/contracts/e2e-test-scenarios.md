# Contract: E2E Test Scenario Coverage

Defines the minimum scenario set the Playwright suite MUST implement to
satisfy FR-004/FR-005/FR-008 and SC-002/SC-003/SC-005. Each scenario is a
contract between "what a real user can do" and "what the suite asserts" —
implementation (selectors, helper structure) is left to tasks.md.

## Scenario: Sign in

- **Given** the test account's credentials
- **When** the suite submits them on the sign-in screen
- **Then** the app navigates to the signed-in tab layout (Home tab visible)

## Scenario: Navigate every tab

- **Given** a signed-in session
- **When** the suite taps Home, Add, Rules, Settings in turn
- **Then** each screen's distinguishing content renders (e.g. Settings
  shows the signed-in email) with no console/page error

## Scenario: Add expense

- **Given** a signed-in session on the Add tab
- **When** the suite opens the entry sheet, fills a uniquely-named expense
  (e.g. `E2E Test Expense <run-id>`), and saves
- **Then** no error message renders in the UI, the sheet closes, and the
  expense appears in the list
- **Cleanup**: the same scenario (or an `afterEach`) deletes this expense
  before the suite ends

## Scenario: Edit expense

- **Given** an expense created by the suite (from the Add scenario, or
  created fresh in this scenario's own setup)
- **When** the suite opens it and changes a field (e.g. amount)
- **Then** the updated value renders in the list, no error message appears
- **Cleanup**: deletes the expense afterward

## Scenario: Delete expense

- **Given** an expense created by the suite
- **When** the suite deletes it (via the sheet's delete + confirm flow)
- **Then** it no longer appears in the list

## Scenario: Add rule

- **Given** a signed-in session on the Rules tab
- **When** the suite creates a rule with a uniquely-identifiable name/config
- **Then** it appears in the rules list
- **Cleanup**: deletes the rule before the suite ends

## Scenario: Edit rule

- **Given** a rule created by the suite
- **When** the suite changes one of its fields
- **Then** the change renders in the list

## Scenario: Delete rule

- **Given** a rule created by the suite
- **When** the suite deletes it
- **Then** it no longer appears in the list

## Scenario: Sign out

- **Given** a signed-in session
- **When** the suite triggers sign-out from Settings
- **Then** the app redirects to the sign-in screen

## Idempotency requirement (applies to all scenarios above)

Running the full scenario set twice in immediate succession against the
same test account MUST pass both times (SC-003). Each scenario that
creates data MUST also remove that data by the time the suite completes,
and MUST identify "its own" data via a unique, run-generated identifier
rather than assuming a specific pre-existing count of rows.

## Regression-detection requirement

A deliberate breaking change to any one covered flow (e.g. disabling the
Add button) MUST cause the corresponding scenario — and only that
scenario — to fail, not the whole suite to hang or produce a false pass
(SC-005).
