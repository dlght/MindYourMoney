# Feature Specification: Tab Bar Visibility Fix & On-The-Day Default Reminder

**Feature Branch**: `007-tabbar-visibility-default-reminder`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "F7 — Bottom tab bar visibility fix and on-the-day payment reminder. Two bundled items: (1) The bottom tab bar (Home/Add/Rules/Settings in app/(tabs)/_layout.tsx) is barely visible/perceptible to users — it sits flush against the screen's bottom edge with no safe-area inset padding (so on devices with a home indicator, labels sit in or under that gesture area), and has minimal visual separation from the page content (just a 1px top border, background color close to the page background, small icons/labels). Fix it to be clearly visible and usable: respect bottom safe-area insets so nothing is obscured by the home indicator, and give it enough visual distinction (spacing/contrast/elevation) from page content that users notice and can comfortably tap it, on both native and the PWA/web build, in light and dark mode. (2) Notifications currently only fire from user-configured or default Rules, evaluated server-side by the evaluate-reminders Supabase Edge Function. The two shipped default rules are 'Big expense ahead' (5 days before due date, only for expenses >= 200) and 'Due tomorrow' (1 day before due date). Neither one reminds the user on the actual due date, and the 5-day reminder excludes smaller expenses. Add a new default rule shipped to all users (existing and new) that reminds them on the due date itself (days_before = 0) for all planned expenses regardless of amount. Keep the existing two default rules unchanged. New/existing users should end up with this third default rule enabled unless they've already disabled/deleted their default rules."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A tab bar users can actually see and trust (Priority: P1)

A user opens the app on their phone (or the installed web app) and wants to move between Home, Add, Rules, and Settings. Today the tab bar blends into the bottom of the screen and, on phones with a home-indicator gesture bar, its labels sit right where that system UI lives — making the bar hard to notice and occasionally awkward to tap accurately. The user should be able to glance down and immediately see a clearly separated, comfortably tappable navigation bar, with nothing obscured by their device's home indicator or the browser's own UI.

**Why this priority**: Navigation is used on every single screen, every session. A barely-visible or partially-obscured tab bar is a core usability defect that affects 100% of app usage, not an edge-case bug.

**Independent Test**: On a mobile-width viewport (native and PWA/web), with and without a simulated device safe-area inset, visually and programmatically confirm the tab bar is clearly separated from page content, fully clear of the home-indicator safe area, and each tab is comfortably tappable, in both light and dark mode.

**Acceptance Scenarios**:

1. **Given** a user on any primary screen (Home, Add, Rules, Settings), **When** they look at the bottom of the screen, **Then** the tab bar is visually distinct from the page content (clear separation via contrast, elevation, or spacing) rather than blending into it.
2. **Given** a device that reports a bottom safe-area inset (e.g. a home indicator), **When** the tab bar is rendered, **Then** no tab icon or label is obscured by, or rendered underneath, that safe area.
3. **Given** the app in light mode and in dark mode, **When** the tab bar is rendered in each, **Then** it remains clearly visible and legible in both.
4. **Given** the PWA/web build on a mobile-width browser viewport, **When** the tab bar is rendered, **Then** it is positioned and styled consistently with the native behavior described above (clear separation, safe-area aware).

---

### User Story 2 - Every upcoming payment gets a same-day reminder (Priority: P1)

A user has planned expenses due today. Today, the app only sends a heads-up reminder in advance (5 days before, and only for expenses of 200 or more) or the day before (for any amount, grouped). Nothing reminds the user specifically on the day a payment is actually due, and smaller expenses never get an advance heads-up at all. The user wants a reminder on the due date itself, for every planned expense regardless of amount, so a payment due today is never missed simply because it was small or because they didn't check the app that morning.

**Why this priority**: This directly serves the product's core promise ("never be surprised by an expense again"). Missing a same-day reminder is a gap in the app's primary value proposition, equally critical to the visibility fix above.

**Independent Test**: For a signed-in user (new or existing) with default rules intact, create a planned expense due today and confirm the server-side reminder evaluation produces a due-date notification for it, regardless of its amount. Separately, confirm a new sign-up automatically has this reminder enabled, and an existing user who has not touched their default rules also has it enabled after the change ships.

**Acceptance Scenarios**:

1. **Given** a signed-up user who has never modified their default rules, **When** the system evaluates reminders on the date a planned expense is due, **Then** the user receives a notification for that expense on its due date, regardless of the expense's amount.
2. **Given** a brand-new user who has just completed sign-up, **When** their account is provisioned, **Then** they end up with a due-date reminder enabled in addition to the two existing default reminders.
3. **Given** an existing user who has disabled or deleted one or more of their default rules before this change ships, **When** the change ships, **Then** the system does not silently re-enable or restore a rule the user already turned off — only rules the user never touched are affected.
4. **Given** an expense due in 5+ days and under 200, **When** reminders are evaluated, **Then** the user still receives no advance heads-up before the due date (unchanged behavior) but does receive the new due-date reminder once the due date arrives.
5. **Given** a user who already receives a "Due tomorrow" notification for an expense, **When** that expense's due date subsequently arrives, **Then** the user also receives the new due-date notification (the two are distinct reminders, not duplicates of each other).

---

### Edge Cases

- What happens if a user already has a custom rule with `days_before = 0` that they created themselves? The new default rule must not create duplicate notifications for the same expense on the same day — existing dedup-by-(expense, rule, trigger) behavior applies per rule, so the user may receive one notification per matching rule; this is consistent with how multiple custom rules already coexist today.
- What happens to a user who deleted (not just disabled) a default rule in the past? Per existing product behavior, default rules are only ever disabled, never deleted by the user through normal UI flows — this new rule follows the same "default rules are disabled, not deleted" convention and is not force-recreated for a user who has already disabled it.
- What happens on a mobile viewport narrow enough that the tab bar's four labels would normally feel cramped? The visibility fix must not reduce tappable area or truncate labels as a side effect of adding spacing/elevation.
- What happens for a planned expense whose due date has already passed without being marked paid? Out of scope for this feature — due-date reminder timing follows the same "planned expense" evaluation the existing rules already use; overdue handling is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tab bar MUST be visually distinguishable from page content on every primary screen (Home, Add, Rules, Settings), via a combination of contrast, elevation, and/or spacing — not solely a 1px border.
- **FR-002**: The tab bar MUST reserve space for, and MUST NOT render any tab icon or label underneath, the device's bottom safe-area inset (e.g. home indicator).
- **FR-003**: The tab bar's visual distinction and safe-area handling MUST hold in both light and dark theme.
- **FR-004**: The tab bar's visual distinction and safe-area handling MUST hold on the PWA/web build at mobile viewport widths, not only on native builds.
- **FR-005**: The tab bar fix MUST NOT reduce the tappable area of any tab or truncate/clip any tab's label on currently-supported mobile viewport widths.
- **FR-006**: The system MUST ship a new default notification rule that triggers on an expense's due date (0 days before) for all planned expenses, regardless of amount.
- **FR-007**: The new due-date default rule MUST be provisioned automatically for every new user at sign-up, alongside the two existing default rules.
- **FR-008**: The new due-date default rule MUST be provisioned for existing users as part of this change shipping, following the same rule-provisioning mechanism used for the existing two default rules.
- **FR-009**: The system MUST NOT re-enable or recreate the new due-date default rule for a user who has already disabled or removed one or more of their existing default rules before this change ships — an already-disabled default-rule set is left as the user configured it.
- **FR-010**: The two existing default rules ("Big expense ahead", "Due tomorrow") MUST remain functionally unchanged by this feature.
- **FR-011**: The new due-date default rule MUST follow the existing default-rule convention where users can disable it, but normal UI flows do not permit deleting it outright.
- **FR-012**: Notification delivery for the new due-date rule MUST use the existing dedup-by-(expense, rule, trigger) mechanism so a user is not sent duplicate notifications for the same expense/rule/day combination.

### Key Entities

- **Rule** *(existing entity)*: Gains a new default instance ("Due today" or equivalent) shipped alongside the two existing default rules; same shape as existing rules (enabled flag, is_default flag, days_before, min_amount, grouping).
- **Tab Bar** *(existing UI element)*: The bottom primary navigation surface (Home, Add, Rules, Settings); its visual styling and safe-area layout behavior are the subject of this feature, not its navigation structure or tab set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a mobile-width viewport with a simulated home-indicator safe area, 0 tab bar icons or labels are measured as obscured by or rendered under that safe area, across native and PWA/web builds.
- **SC-002**: In a visual contrast check across light and dark themes, the tab bar is measured as distinguishable from adjacent page content (not simply matching background color with a hairline border) on all four primary screens.
- **SC-003**: For 20 consecutive planned expenses due "today" across distinct test users with untouched default rules, 20 out of 20 produce a due-date reminder notification regardless of individual expense amount.
- **SC-004**: 100% of newly created accounts end up with three enabled default rules (existing two plus the new due-date rule) immediately after sign-up.
- **SC-005**: 0 existing users who had already disabled a default rule prior to this shipping have that rule silently re-enabled as a result of this change.

## Assumptions

- "Existing users" receive the new default rule via the same mechanism already used to seed default rules for a user's account (e.g. on next app foreground/sign-in), consistent with how `src/features/rules/seedRules.ts` currently operates — no separate one-off backfill migration is assumed necessary unless the implementation phase determines otherwise.
- The visual treatment for tab bar distinction (exact colors, elevation/shadow values, spacing amounts) is a design decision to be finalized during planning/implementation, guided by the existing NativeWind design system and `src/theme/colors.ts` tokens, not prescribed at the spec level.
- "PWA/web build" scope matches the existing web build already shipped and covered by the project's E2E suite (specs/006-pwa-e2e-layout-fix); no new platforms are introduced.
- The due-date reminder's message content (title/body copy) is a small content decision left to implementation, following the tone of the existing "Big expense ahead" / "Due tomorrow" copy.
- No new notification channel is introduced — the due-date reminder uses the same push-notification delivery path (local scheduled notifications on-device, and server-side push via evaluate-reminders) already used by existing rules.
