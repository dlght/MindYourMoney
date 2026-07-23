# Feature Specification: Project Scaffold & Auth

**Feature Branch**: `001-project-scaffold-auth`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "F1 — Project scaffold & auth: Expo app with Expo Router tabs (Home, Add, Rules, Settings), Supabase project, magic-link auth, session persistence, seeded default categories on first login." (see `docs/mindyourmoney-spec.md`, §6 and §7, Feature F1)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with email and password and stay signed in (Priority: P1)

A new user creates an account with an email address and password; a
returning user signs in with the same credentials and lands inside the app
already authenticated. The next time they open the app, they are still
signed in — no repeated sign-in step — until they explicitly sign out.

**Why this priority**: Nothing else in the app is reachable or useful without
an authenticated session; this is the load-bearing story for every other
feature.

**Independent Test**: Can be fully tested by creating an account with an
email and password, force-quitting the app, and reopening it — the user
should land signed in without re-entering anything.

**Acceptance Scenarios**:

1. **Given** a user has never signed in before, **When** they enter an email
   and password and submit the create-account form, **Then** their account
   is created and they are signed into the app.
2. **Given** a returning user, **When** they enter their email and correct
   password and submit the sign-in form, **Then** they are signed into the
   app.
3. **Given** a signed-in user force-quits and reopens the app, **When** the
   app launches, **Then** they see the app already signed in, with no
   sign-in prompt.
4. **Given** a signed-in user taps "Sign out" in Settings, **When** the app
   is reopened afterward, **Then** they are shown the sign-in screen again.
5. **Given** a user enters an email/password combination that does not match
   an existing account, **When** they submit the sign-in form, **Then** they
   see a clear message that the credentials are invalid.

---

### User Story 2 - Navigate the app via Home, Add, Rules, and Settings (Priority: P2)

A signed-in user can move between the four primary areas of the app — Home,
Add, Rules, and Settings — using a persistent bottom tab bar, from anywhere
in the app, in a single tap.

**Why this priority**: Every other feature (expense entry, dashboard, rule
management) is delivered inside one of these four destinations; without the
navigation scaffold in place, no other feature has anywhere to live.

**Independent Test**: Can be fully tested by signing in and tapping each of
the four tabs in turn, confirming each opens its corresponding screen and
that the previously active tab is not lost when returning to it.

**Acceptance Scenarios**:

1. **Given** a signed-in user is on any tab, **When** they tap one of the
   other three tab icons, **Then** the corresponding screen opens
   immediately.
2. **Given** a user is not signed in, **When** they attempt to open the app,
   **Then** they see the sign-in flow instead of the tab navigation.

---

### User Story 3 - See default categories ready to use on first login (Priority: P3)

The first time a user successfully signs in, the app has already populated
their account with the standard set of expense categories (Housing,
Utilities, Transport, Groceries & Household, Health, Subscriptions,
Education & Kids, Lifestyle & Leisure, Debt & Savings, Taxes & Fees, Other),
each with its designated icon and color, so they can start logging expenses
without any setup step.

**Why this priority**: Category assignment is required to log an expense at
all (per product scope, expenses require a category); seeding removes a
setup step that would otherwise block the very first action a user takes,
but the app is technically navigable without it, so it ranks behind auth and
navigation.

**Independent Test**: Can be fully tested by signing in with a brand-new
account and confirming the full default category list is present and
correctly styled, with no manual setup performed.

**Acceptance Scenarios**:

1. **Given** a brand-new user completes sign-in for the first time, **When**
   their account is provisioned, **Then** all default categories from the
   product's category list are available to them, each with its name, icon,
   and color.
2. **Given** an existing user signs in again (e.g., on a new device or after
   signing out and back in), **When** their session starts, **Then** the
   default categories are not duplicated — exactly one instance of each
   remains.

---

### Edge Cases

- What happens when a user tries to create an account with an email that is
  already registered? The system must surface a clear message rather than
  silently failing or overwriting the existing account.
- What happens when a user enters the wrong password? The system must show
  a clear invalid-credentials message without revealing whether the email
  itself is registered.
- What happens when a user submits a password that does not meet the
  project's minimum length? The system must reject it client-side with a
  clear message before making a network call.
- How does the system handle a user opening the app for the first time with
  no network connection? They should see a clear sign-in-requires-network
  state rather than a silent failure.
- How does the system handle app reopening after the persisted session has
  expired or been revoked (e.g., password/session reset from another
  device)? The user should be routed back to sign-in rather than shown a
  broken authenticated state.
- What happens if category seeding is interrupted partway (e.g., app closed
  mid-provisioning)? On next login, the user must end up with the complete
  default set, not a partial one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a new user create an account with an email
  address and password.
- **FR-002**: System MUST let a returning user authenticate by submitting
  their email address and password.
- **FR-003**: System MUST persist the authenticated session across app
  restarts so the user is not asked to sign in again until they explicitly
  sign out or the session is otherwise invalidated.
- **FR-004**: System MUST let a signed-in user sign out, which ends the
  persisted session and returns them to the sign-in screen on next launch.
- **FR-005**: System MUST show a clear, actionable message when sign-in
  fails (invalid credentials) or account creation fails (e.g., email already
  registered, password too short), without leaving the user stuck.
- **FR-006**: System MUST present four primary navigation destinations —
  Home, Add, Rules, and Settings — reachable in a single tap from one
  another, to every signed-in user.
- **FR-007**: System MUST NOT expose the tab navigation to a user who is not
  signed in; unauthenticated users MUST see the sign-in flow instead.
- **FR-008**: System MUST seed the full default category list (the eleven
  categories defined in the product's category list, each with its name,
  icon, and color) into a new user's account automatically on their first
  successful sign-in.
- **FR-009**: System MUST NOT create duplicate default categories for a user
  who has already had them seeded, regardless of how many times they sign in
  or how many devices they sign in from.
- **FR-010**: System MUST ensure category seeding either fully completes or
  is safely retried on a subsequent login, so a user never ends up with a
  partial default category set.

### Key Entities

- **User Session**: Represents a user's authenticated state on a device —
  who is signed in and whether that state survives an app restart. Ends on
  explicit sign-out or invalidation.
- **Category**: Represents an expense grouping available to a user — a name,
  an icon, a color, and whether it is one of the system-provided defaults.
  Owned by exactly one user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from entering their email and
  password to landing on a fully category-populated Home tab in under 2
  minutes.
- **SC-002**: 100% of first-time sign-ins result in the complete default
  category set being available, with zero duplicate categories after any
  number of subsequent sign-ins.
- **SC-003**: A returning user who reopens the app after force-quitting it
  lands signed in, without re-entering any credentials, in 100% of cases
  where their session has not been explicitly ended.
- **SC-004**: Every one of the four primary destinations (Home, Add, Rules,
  Settings) is reachable from any other in a single tap, with zero signed-in
  users able to reach a broken or missing tab.

## Assumptions

- Sign-in is email + password only for this feature; social sign-in options
  (e.g., Apple/Google) and a "forgot password" reset flow are out of scope
  here and may be added in a later feature.
- If the Supabase project has email confirmation enabled, account creation
  surfaces a "confirm your email" state instead of signing the user in
  immediately; this project's default configuration has confirmation
  disabled, so account creation signs the user in directly.
- The Home, Add, Rules, and Settings destinations are scaffolded as
  navigable screens in this feature; their full content (expense list,
  add-expense flow, rule editor, settings options) is delivered by later
  features (F2–F4) and is out of scope here beyond a minimal placeholder.
- The default category list, names, icons, and colors match section 2 of
  `docs/mindyourmoney-spec.md` exactly (11 categories, including "Other" as
  the fallback).
- Category management (renaming, adding custom categories, archiving) is out
  of scope for this feature; only the seeded defaults are in scope.
- "First successful login" means the first time a given user account
  completes authentication, regardless of device.
