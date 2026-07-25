# Feature Specification: PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix

**Feature Branch**: `006-pwa-e2e-layout-fix`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "F6 — PWA E2E automation, mobile layout spacing, and add-expense UI error investigation. Three bundled items for the recently-shipped PWA (Netlify-hosted) build: (1) Full browser automation test suite exercising sign-in, every tab, and every core flow with real UI assertions, runnable repeatedly against a test account. (2) Mobile layout spacing: content runs too close to screen edges on mobile viewports; add consistent breathing room respecting safe-area insets. (3) Add-expense error bug: expense is correctly written to Supabase and shown on the dashboard, but the UI still shows an error message; investigate root cause and fix so no spurious error appears on success."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trustworthy expense creation (Priority: P1)

A user adds a new expense. It saves correctly and appears on their dashboard exactly as expected — but today the app also shows them an error message, making them think something went wrong even though nothing did. They may re-submit the expense (creating a duplicate) or lose trust in the app's reliability.

**Why this priority**: This is an active, user-visible correctness defect in the single most common action in the app (adding an expense). It erodes trust and risks duplicate data entry. Fixing it is higher priority than adding new safety nets around it.

**Independent Test**: Sign in, add an expense with valid data, and confirm (a) the expense appears in Supabase and on the dashboard, and (b) no error message is shown anywhere in the UI during or after the operation.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the Add screen, **When** they submit a valid new expense, **Then** the expense is persisted, appears on the dashboard, and no error message is displayed.
2. **Given** a signed-in user on the Add screen, **When** they submit an expense that fails to save (e.g. network failure), **Then** an error message IS displayed and the expense does not appear on the dashboard.
3. **Given** the expense creation flow, **When** a developer inspects the cause of the previous spurious error, **Then** the root cause is documented and no longer reproducible.

---

### User Story 2 - Automated regression safety net for the web app (Priority: P2)

As the app now ships as an installable web app in addition to mobile, changes can silently break flows that no one manually re-checks every time (sign-in, navigating tabs, adding/editing/deleting expenses and rules, signing out). The team needs a repeatable, automated way to drive the app in a real browser like a user would and get a pass/fail signal, instead of relying on manual spot-checks before each deploy.

**Why this priority**: This is a safety net, not a fix for a known defect — valuable, but secondary to the active bug in User Story 1. It also depends on the app being in a stable, correctly-behaving state (including the US1 fix) to produce a meaningful, non-flaky baseline.

**Independent Test**: Run the automated suite end-to-end against a dedicated test account and confirm it produces a clear pass/fail result covering sign-in, every tab, and every core CRUD flow, without requiring manual setup or cleanup steps.

**Acceptance Scenarios**:

1. **Given** the deployed or locally-served web app and a dedicated test account, **When** the automated suite is run, **Then** it signs in, visits every tab, exercises add/edit/delete for an expense and for a rule, and signs out — asserting on real rendered UI state at each step.
2. **Given** the suite has just completed a full run, **When** it is run again immediately against the same test account, **Then** it passes again with no leftover-state failures (e.g. duplicate rows, stale rules) carried over from the previous run.
3. **Given** a change that breaks a core flow (e.g. the Add button stops opening the entry form), **When** the suite is run, **Then** it fails clearly on the affected scenario rather than passing silently.

---

### User Story 3 - Comfortable mobile layout (Priority: P3)

A user on a phone-sized screen finds that text, buttons, and cards sit flush against the edges of the screen — including areas the OS reserves for notches, status bars, and home indicators — making the app feel cramped and occasionally making controls hard to tap near the edges.

**Why this priority**: This is a visual/usability polish issue. It affects perceived quality but does not block any task or produce incorrect data, so it is addressed after the correctness bug and the testing safety net that will help guard the other fixes.

**Independent Test**: On a mobile-width viewport, visually and programmatically inspect each primary screen (dashboard, add/edit expense, rules, settings) and confirm consistent minimum spacing between content and all four screen edges, with no content obscured by device safe areas.

**Acceptance Scenarios**:

1. **Given** a mobile-width viewport, **When** any primary screen is displayed, **Then** there is visible, consistent padding between the screen content and the top, bottom, left, and right edges.
2. **Given** a device with a notch or home-indicator safe area, **When** a primary screen is displayed, **Then** no interactive control or text is obscured by or rendered underneath that safe area.
3. **Given** the spacing fix is applied, **When** compared to the current layout, **Then** no existing content is clipped, overlapped, or pushed off-screen as a result of the added spacing.

---

### Edge Cases

- What happens if the automated test suite is interrupted mid-run (e.g. crashes after creating an expense but before deleting it)? The next run must still complete successfully rather than failing on leftover data.
- What happens when the automated suite's test account has notifications/rules already configured from a prior manual test session? The suite must not assume a pristine account and must not depend on a specific starting count of expenses/rules.
- How does the add-expense flow now behave if the network genuinely fails partway through the save? The user must see an accurate error, and the fix for the spurious-error bug must not accidentally suppress this legitimate case.
- What happens on the smallest common mobile viewport width supported by the app? Added spacing must not cause primary actions (e.g. the Add button) to be pushed below the visible viewport.
- What happens if two automated suite runs are kicked off concurrently against the same test account? Out of scope for this feature — the suite is assumed to run one instance at a time (e.g. sequentially in CI).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST NOT display an error message to the user when a new expense is successfully persisted and reflected on the dashboard.
- **FR-002**: The system MUST display an error message to the user when a new expense fails to persist, and in that case the expense MUST NOT appear on the dashboard.
- **FR-003**: The root cause of the previously spurious success-path error MUST be identified and fixed at its source, not masked (e.g. not fixed by blanket-suppressing all post-save errors).
- **FR-004**: The project MUST provide an automated test suite that drives the web app in a real browser as a user would — clicking, typing, and navigating — rather than calling internal functions directly or mocking network responses.
- **FR-005**: The automated test suite MUST cover, at minimum: signing in, visiting every tab, adding an expense, editing an expense, deleting an expense, creating a rule, editing a rule, deleting a rule, and signing out.
- **FR-006**: The automated test suite MUST run against a dedicated test account that is distinct from any real user's account.
- **FR-007**: The automated test suite MUST be safe to run repeatedly (e.g. on every deploy) without manual data cleanup between runs — each run MUST leave the test account in a state that does not cause the next run to fail.
- **FR-008**: The automated test suite MUST produce a clear, unambiguous pass or fail result for each covered flow, suitable for catching UI-breaking regressions before they reach users.
- **FR-009**: All primary screens (dashboard, add/edit expense, rules, settings) MUST maintain visible, consistent spacing between their content and the top, bottom, left, and right edges of the screen on mobile viewport widths.
- **FR-010**: Spacing on all primary screens MUST account for device safe areas (e.g. notches, status bars, home indicators) so no interactive control or text is rendered underneath them.
- **FR-011**: The added spacing MUST NOT clip, overlap, or push existing content off-screen on any currently-supported mobile viewport width.

### Key Entities

- **Test Account**: A dedicated, non-production sign-in identity reserved for the automated test suite; owns its own expenses and rules, isolated from any real user's data.
- **Automated Test Run**: A single execution of the test suite against the deployed or locally-served app; produces a pass/fail result per covered scenario.
- **Expense** *(existing entity)*: Unchanged by this feature; relevant here only in that its creation flow's error-reporting behavior is being corrected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 20 consecutive successful expense creations, 0 spurious error messages are shown to the user.
- **SC-002**: A single run of the automated test suite exercises 100% of the listed core flows (sign-in, all tabs, add/edit/delete expense, add/edit/delete rule, sign-out) and completes with a clear pass/fail result with no manual steps.
- **SC-003**: Running the automated test suite twice in immediate succession against the same test account produces a passing result both times.
- **SC-004**: On a mobile-width viewport, 0 interactive or text elements are measured flush (no visible gap) against a screen edge across all primary screens.
- **SC-005**: A deliberately introduced breaking change to a core flow (e.g. disabling the Add button) causes the automated suite to fail on the corresponding scenario within the same run, rather than passing silently.

## Assumptions

- A dedicated Supabase auth account for automated testing will be provisioned (credentials held outside the repo, e.g. as CI/environment secrets); provisioning the account itself is a one-time setup step, not new product functionality.
- "Browser automation" targets the PWA/web build already shipped in the prior feature, since that is what runs in a standard browser; native iOS/Android app-store builds are out of scope for this suite.
- "Mobile viewport" means common phone screen widths (roughly 375–430px), consistent with the project's mobile-first scope; desktop/tablet layout is not newly in scope beyond not regressing.
- The add-expense error is a UI/client-state defect (e.g. the success path incorrectly falling into an error branch) rather than a data-integrity defect, since the expense data itself is confirmed correct in Supabase and on the dashboard.
- "Every tab" and "every core flow" refers to the app's current navigation structure (dashboard, add, rules, settings) and existing CRUD operations for expenses and rules; no new screens or flows are introduced by this feature.
