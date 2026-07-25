# Feature Specification: Web Push Notifications for the PWA

**Feature Branch**: `008-web-push-notifications`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "F8 — Web Push notifications for the PWA (Netlify-hosted), as an alternative to a paid native app-store build. Today, opening the app via the Netlify-hosted PWA URL on a phone (whether as a plain browser tab or installed to the home screen) never results in any push notification, because the entire notification pipeline is built exclusively on expo-notifications' native push token flow and explicitly no-ops on web — no permission is ever requested, no token is ever registered, and the existing service worker has no push/notificationclick handler at all. Add standard Web Push API support so a user who only ever uses the Netlify-hosted PWA (no EAS/App Store build, no $ cost) can still receive real push notifications for their expense reminders when the app/tab isn't open. This means: (1) requesting the browser's native notification permission on web, (2) subscribing to a Web Push subscription and storing it against the signed-in user, reusing/extending the existing push-token lifecycle (registered at sign-in and on reconciliation, revoked at sign-out) the same way ios/android tokens already work, (3) adding push/notificationclick handlers to the service worker, and (4) extending the server-side reminder-evaluation job to send to web subscriptions as a second delivery path alongside its existing native path, including cleaning up subscriptions the push service reports as gone/expired. Important platform constraint: Android Chrome supports Web Push from a plain browser tab, but iOS Safari only supports it for a PWA installed to the home screen — a normal iOS Safari tab can never receive push, so the feature must detect this and give accurate guidance rather than silently failing. Purely additive — the existing native paths are unaffected."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receiving a reminder without installing a native app (Priority: P1)

A user who only ever opens the app through its web address (no App Store/Play Store install, no paid developer account involved) wants to actually be notified when a payment is coming up — today they get nothing once they close the tab. They want to grant notification permission once, the same way any other web app on their phone would ask, and from then on receive a real system notification for their reminders even when the app isn't open.

**Why this priority**: This is the entire point of the feature — without it, the web/PWA path has no notification delivery mechanism at all, which is the core gap driving this work.

**Independent Test**: On a supported browser (Android Chrome in a tab, or an iOS PWA already installed to the home screen), grant notification permission when prompted, then trigger a reminder condition server-side and confirm a system notification appears on the device with the app closed, and tapping it opens the app.

**Acceptance Scenarios**:

1. **Given** a signed-in user on a supported web browser who has not yet been asked, **When** they use the app, **Then** they are prompted once for notification permission (the browser's own native prompt).
2. **Given** a user who grants permission, **When** the grant completes, **Then** their device becomes eligible to receive reminders without any further action from them.
3. **Given** a user whose device is registered for web push, **When** a reminder condition they've configured (e.g. an expense due tomorrow) is evaluated server-side, **Then** they receive a system-level push notification with the reminder's content, even if the app/tab is fully closed.
4. **Given** a delivered push notification, **When** the user taps/clicks it, **Then** the app opens.
5. **Given** a user who denies notification permission, **When** they continue using the app, **Then** the app continues to function normally with no repeated permission nagging beyond what the browser itself allows.

---

### User Story 2 - Accurate guidance on iOS instead of a silent failure (Priority: P2)

An iPhone user opens the app in a plain Safari tab (has not added it to their home screen) and tries to enable notifications. Because iOS only supports push for home-screen-installed PWAs, requesting permission from a plain tab would either fail outright or silently never deliver anything, leaving the user confused about why reminders never arrive. Instead, they should be told clearly what to do (add the app to their home screen) rather than experiencing an unexplained dead end.

**Why this priority**: Prevents a confusing, silent failure mode for a large share of the target platform (iOS/Safari), but is secondary to the core delivery mechanism working at all on platforms where it works today without extra steps.

**Independent Test**: On an iOS Safari tab that has not been added to the home screen, attempt to enable notifications and confirm the app explains the home-screen-install requirement instead of requesting permission (or requesting it in a way that can never succeed). On an iOS PWA that has already been added to the home screen, confirm notifications can be enabled normally per User Story 1.

**Acceptance Scenarios**:

1. **Given** an iOS Safari tab not installed to the home screen, **When** the user attempts to enable notifications, **Then** the app tells them to add it to their home screen first, rather than requesting permission in a way that cannot succeed.
2. **Given** the same app already installed to an iOS home screen, **When** the user attempts to enable notifications, **Then** the normal permission flow from User Story 1 applies.
3. **Given** a browser/OS combination with no Web Push support at all (older browsers), **When** the user attempts to enable notifications, **Then** the app degrades gracefully (no crash, no broken UI) and does not claim notifications are enabled when they are not.

---

### User Story 3 - Device hygiene stays correct across sign-out and expiry (Priority: P3)

A user's web push registration must behave exactly like their phone's native push registration already does: it should stop targeting them the moment they sign out (so a different person using the same shared browser afterward never sees their reminders), and a subscription the push service itself reports as no-longer-valid (e.g. permission revoked in OS settings, browser data cleared) should stop being retried forever.

**Why this priority**: Correctness/privacy hygiene matters, but it's a refinement of a mechanism that only has value once User Story 1 exists — it's not independently useful before that.

**Independent Test**: Sign out on a device with an active web push registration and confirm it no longer receives reminders. Separately, simulate the push service reporting a subscription as gone and confirm it's removed rather than retried on the next evaluation cycle.

**Acceptance Scenarios**:

1. **Given** a signed-in user with an active web push registration, **When** they sign out, **Then** that device's registration is revoked and no further reminders are sent to it for that account.
2. **Given** a web push subscription the push service reports as expired/invalid when a send is attempted, **When** the next reminder evaluation runs, **Then** that subscription is removed and is not retried.
3. **Given** a device that already has an active web push registration, **When** the same user reconciles again later (e.g. reopens the app), **Then** no duplicate registration is created for the same device.

---

### Edge Cases

- What happens if the user grants notification permission but later revokes it from their browser/OS settings? The next delivery attempt against that subscription should fail gracefully and result in cleanup (User Story 3), not a repeated error.
- What happens if a user has both a native app installation (a prior EAS/App-store build) and the web/PWA open on the same or different devices? Both delivery paths coexist independently per-device; a reminder may be delivered on some of a user's devices and not others depending on which are registered, matching how multiple native devices already coexist today.
- What happens on a desktop browser (not a phone)? Out of scope to explicitly optimize for, but not excluded — if a desktop browser supports the standard Web Push API, it is treated the same as any other supported browser; no special-casing either way.
- What happens if the push service itself is temporarily unreachable when the server tries to send? The reminder for that day is not retried within the same evaluation run; this matches existing behavior for the native delivery path (no built-in retry beyond the next scheduled evaluation).
- What happens if a user tries to enable notifications from an in-app browser (e.g. opened via a link inside another app) rather than their primary browser? Treated the same as any browser session without Web Push support if the embedding browser doesn't support it — degrades per User Story 2's Scenario 3.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST be able to request notification permission from a user accessing the app via the web/PWA, on browsers that support the standard Web Push capability.
- **FR-002**: The system MUST register an eligible web device to receive reminders once permission is granted, without requiring any action beyond the permission grant itself.
- **FR-003**: The system MUST deliver a real system-level push notification to a registered web device when a reminder condition is met, even when the app/tab is fully closed.
- **FR-004**: Tapping/clicking a delivered web push notification MUST open the app.
- **FR-005**: On a browser/platform combination where Web Push cannot function in its current context (an iOS Safari tab not installed to the home screen), the system MUST inform the user of what's required (installing to the home screen) instead of silently failing or requesting permission in a way that can never succeed.
- **FR-006**: On a browser/platform with no Web Push support at all, the system MUST degrade gracefully — no crash, no broken UI, and no false claim that notifications are enabled.
- **FR-007**: A user's web push registration MUST be revoked at sign-out, matching the existing revocation guarantee for native device registrations.
- **FR-008**: A web push subscription the push service reports as expired/invalid MUST be removed from future delivery attempts rather than retried indefinitely.
- **FR-009**: Re-registering the same web device (e.g. reopening the app after already being registered) MUST NOT create a duplicate registration for that device.
- **FR-010**: The existing native (iOS/Android) notification delivery paths MUST remain functionally unchanged by this feature.
- **FR-011**: A user with reminders configured MUST be able to receive them via web push on any currently-supported browser without incurring any paid app-store developer registration or native app installation.
- **FR-012**: Denying notification permission MUST leave the rest of the app fully functional, with no degraded behavior beyond the absence of push notifications.

### Key Entities

- **Web Push Registration** *(new — conceptually extends the existing "device push registration" entity used by native devices)*: Represents one browser/device's subscription to receive push notifications for a signed-in user; analogous in role to an existing native push-token registration (same lifecycle: created on permission grant, revoked at sign-out, removed on expiry), but a browser-issued subscription (an endpoint plus delivery keys) rather than a platform push-service token.
- **Reminder** *(existing entity, unmodified)*: The thing being delivered; unchanged by this feature — only a new delivery path is added for reminders that already exist.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user on a supported browser (e.g. Android Chrome, or an iOS PWA already installed to the home screen) who grants notification permission receives a real system push notification for a qualifying reminder within one reminder-evaluation cycle, with the app/tab fully closed.
- **SC-002**: 0 users on an uninstalled iOS Safari tab are left to silently conclude notifications are "on" when they cannot actually be delivered — every such user sees explicit install guidance instead.
- **SC-003**: 100% of web push registrations are revoked within the same sign-out flow that already revokes native registrations — no lingering registration continues receiving reminders for a signed-out session.
- **SC-004**: Across repeated reminder-evaluation cycles, subscriptions the push service reports as expired are removed rather than re-attempted — 0 repeated failed-send attempts against a subscription already known to be gone.
- **SC-005**: Reopening the app on an already-registered device produces 0 duplicate registrations for that device.

## Assumptions

- "Supported browsers" means current versions of Android Chrome (and other Chromium-based mobile browsers) plus iOS Safari 16.4+ when installed to the home screen — the browser landscape the standard Web Push API actually covers today; older/unsupported browsers fall under FR-006's graceful-degradation requirement rather than being individually enumerated.
- Reminder delivery timing via this new path follows the same server-side evaluation cadence already used for the existing native push delivery path — this feature adds a delivery destination, not a new delivery schedule.
- No paid third-party push-delivery service is introduced (constitution III, free-tier discipline) — the standard, free Web Push protocol (browser-native, authenticated via a self-owned key pair) is used directly.
- This feature does not change how reminders/rules are configured by the user — it only adds a way for reminders that already exist to reach a web/PWA device that previously could never receive them.
- A user may have multiple registered devices (native and/or web) simultaneously; this feature does not introduce any new per-user device limit beyond what already implicitly exists for native devices.
