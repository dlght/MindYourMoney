# Feature Specification: Server Push Notifications & Production Hardening

**Feature Branch**: `005-server-push-hardening`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "F5 — Server push notifications + production hardening. Build on F4 (local notifications, rules, notifications_log) to add real server-driven Expo push notifications so alerts fire even when the app hasn't been opened in days, per docs/mindyourmoney-spec.md MVP2 roadmap item F5. Scope: push token registration, server-side rule evaluation and push send, daily scheduled evaluation, push receipt/token cleanup, local notifications remain as fallback. Folded in: CI pipeline, root error boundary + crash reporting, server job logging/alerting, expense list pagination, staging environment separation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get reminded even when the app has been closed for days (Priority: P1)

As a user who doesn't open the app every day, I want to still receive my configured reminders for upcoming expenses even if I haven't opened the app recently, so the app's core promise ("never be surprised by an expense again") holds true regardless of my usage habits.

**Why this priority**: This is the entire point of F5 and the gap explicitly called out in F4's assumptions — local-only reminders stop working the moment the app has been closed since the last reconciliation. Without this, the product's core value proposition is conditional on a habit (opening the app) it's supposed to remove the need for.

**Independent Test**: Can be fully tested by creating a qualifying expense on a device, then leaving the app fully closed (not just backgrounded) past a reminder's trigger point, and confirming a push notification still arrives.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a qualifying expense and the app not opened in over a day, **When** a reminder's trigger point (per their enabled rules) is reached, **Then** the user receives a push notification on their device without needing to open the app.
2. **Given** a user has already received a local, in-app reminder for a specific expense/rule/trigger point, **When** the server-side evaluation later runs for that same combination, **Then** the user does not receive a duplicate notification for it.
3. **Given** a user marks an expense paid or edits it out of a rule's conditions before its trigger point, **When** server-side evaluation next runs, **Then** no push notification is sent for that now-irrelevant reminder.
4. **Given** a user signs in on a new device, **When** they grant notification permission, **Then** that device becomes eligible to receive server-sent reminders without any further setup.
5. **Given** a user signs out of a device, **When** another person later signs into a different account on that same device, **Then** the original user's reminders are never delivered to that device again.

---

### User Story 2 - Trust that a reminder actually got sent (Priority: P2)

As a user, I want to trust that if I stop receiving reminders, someone will notice and fix it — not silently lose the safety net the app exists to provide.

**Why this priority**: A background job that fails silently is worse than no background job — the user believes they're protected and isn't. This doesn't change what the user directly interacts with, but it's a precondition for User Story 1 being trustworthy over time rather than just on launch day.

**Independent Test**: Can be tested by deliberately breaking the server-side evaluation job (e.g. invalid data) in a non-production environment and confirming the failure is surfaced to the maintainer rather than disappearing into logs no one reads.

**Acceptance Scenarios**:

1. **Given** the scheduled server-side reminder evaluation fails to run or errors partway through, **When** that happens, **Then** the maintainer is notified of the failure separately from the user-facing app.
2. **Given** a batch of push notifications is sent, **When** some of them fail to deliver because a device is no longer reachable, **Then** that device is not targeted again on the next evaluation cycle.
3. **Given** an unexpected error occurs anywhere in the running app, **When** that happens, **Then** the user sees a recoverable error state instead of a blank/frozen screen, and the error is recorded for the maintainer to investigate.

---

### User Story 3 - App stays fast and changes stay safe as it grows (Priority: P3)

As a user with a long history of expenses, and as the maintainer shipping new changes, I want the app to stay responsive as data accumulates and want new changes (especially ones running unattended on a server) to be verified before they can affect real users.

**Why this priority**: Not required for server push to function on day one, but without it the feature degrades or becomes risky to iterate on shortly after launch — long-lived accounts slow down, and future changes to unattended server code risk shipping breakage straight to production with no safety net.

**Independent Test**: Can be tested by (a) confirming the expense list stays responsive for an account with several years of history, and (b) confirming a proposed code change is automatically checked and a new server-side change can be tried in an isolated environment before it reaches production.

**Acceptance Scenarios**:

1. **Given** a user account with multiple years of expense history, **When** they open their expense list, **Then** it loads promptly rather than fetching and rendering the entire history at once.
2. **Given** a proposed code change, **When** it is submitted for review, **Then** the project's automated tests and type checks run against it automatically and their results are visible before it can be merged.
3. ~~Given a change to the server-side reminder evaluation logic, When it needs to be tried out, Then it can be run against an isolated environment that cannot affect real users' data or send them real notifications.~~ Not currently satisfied — see FR-013's amendment note.

---

### Edge Cases

- What happens when a user has never granted notification permission at all? No push notifications are sent to that user's device; behavior matches F4's existing "reminders are off" handling, extended to the server-sent path.
- What happens when the same reminder becomes due while the app happens to be open? The user receives exactly one notification for it, regardless of whether the local or server path produced it first.
- What happens when a device's push registration goes stale (app uninstalled, token revoked) mid-cycle? Delivery to it fails gracefully, the registration is removed, and no further attempts target it.
- What happens when the scheduled evaluation job runs but finds nothing due for any user? It completes with no notifications sent and no false alerts to the maintainer.
- What happens when a recurring expense rolls forward to its next occurrence? Server-side evaluation reflects the new occurrence's due date on its next run, consistent with F4's existing rolled-forward reconciliation.
- What happens when a user with years of history adds a new expense? It still appears immediately in the (bounded/paginated) list without requiring the user to page forward to find it.
- What happens when an in-review code change breaks an existing test? The change is blocked from merging until fixed.
- What happens when a grouped ("due tomorrow"-style) digest has some but not all of its expenses already individually notified via another rule? The digest still sends, re-mentioning the already-notified expense(s) alongside the new one(s) — a small amount of redundant content is preferred over silently dropping the reminder for the expenses that are genuinely new (self-critique F9; see `filterUndelivered` in `notificationEngine.ts`).

## Requirements *(mandatory)*

### Functional Requirements

**Server-sent reminders**

- **FR-001**: System MUST register a device to receive server-sent reminders when a user signs in and has granted notification permission, without requiring any additional setup step from the user.
- **FR-002**: System MUST evaluate every enabled rule against every signed-in user's planned expenses on a recurring daily schedule, independent of whether any user currently has the app open.
- **FR-003**: System MUST send a push notification to a user's registered device(s) for each rule/expense/trigger-point combination that is due and has not already been delivered via the local (in-app) path.
- **FR-004**: System MUST NOT deliver more than one notification for the same user/expense/rule/trigger-point combination, regardless of whether it was ultimately delivered locally or via server push.
- **FR-005**: System MUST record every server-sent reminder in the same notification history used for local reminders (F4), distinguishing how it was delivered.
- **FR-006**: System MUST remove a device's push registration once delivery to it is confirmed to be permanently failing (e.g. the app was uninstalled), so future evaluation cycles stop targeting it.
- **FR-007**: System MUST remove or deactivate a device's push registration when the user who registered it signs out, so a subsequent different user on that device cannot receive the prior user's reminders.
- **FR-008**: System MUST scope every push registration to its owning signed-in user, consistent with existing expense/rule/category ownership isolation.
- **FR-009**: Local, in-app reminder scheduling and reconciliation (F4) MUST continue to function unchanged as the primary path when the app is open; server-sent reminders are additive, not a replacement.

**Operational reliability**

- **FR-010**: System MUST notify the maintainer when the scheduled reminder-evaluation job fails to complete or errors, separately from any user-facing surface.
- **FR-011**: System MUST present a recoverable error state to the user when an unexpected application error occurs, instead of an unresponsive or blank screen, and MUST record that error for the maintainer.
- **FR-012**: System MUST automatically run the project's automated tests and type checks against every proposed code change and make the results visible before the change can be merged.
- **FR-013**: ~~System MUST allow changes to the server-side reminder evaluation logic to be run and verified in an environment that is isolated from real users' data and cannot send them real notifications.~~ **Amended post-deployment (self-critique F1, 2026-07-24)**: this project has one Supabase project, not a separate staging one, so no isolated verification environment exists — server-side changes are verified locally/via automated tests and then applied directly to the same project real users would eventually use. This is an explicit, product-owner-approved trade-off for a solo/personal-scale app with no real users yet (see Assumptions), not a silently-dropped requirement. **Revisit this FR before the app has real users who could be affected by an unverified change reaching them directly** — at that point a genuine second project is the correct fix, not a further exception.
- **FR-014**: System MUST load a user's expense list without fetching and rendering their entire historical expense record at once, so load time does not grow unbounded with account age.

### Key Entities *(include if feature involves data)*

- **Push registration**: A user-owned record identifying one device as eligible to receive server-sent reminders — which user owns it, which device/installation it targets, and whether it is currently active.
- **Notification history entry** *(existing, from F4, extended)*: Now also records reminders delivered via the server-sent path, with a way to distinguish the delivery channel from locally-delivered reminders, so the two paths can be deduplicated against each other.
- **Reminder evaluation run**: A record of one execution of the scheduled server-side evaluation — when it ran, whether it succeeded, and enough detail to alert the maintainer if it didn't.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has not opened the app in 7+ days still receives a push notification for a reminder that became due during that time, within one scheduled evaluation cycle of its trigger point.
- **SC-002**: 100% of reminders delivered to a user — whether via the local or server path — are free of duplicates for the same expense/rule/trigger-point combination.
- **SC-003**: A device that has stopped being reachable (e.g. app uninstalled) is no longer targeted by evaluation cycles occurring after the first confirmed failed delivery to it.
- **SC-004**: 100% of scheduled-evaluation failures result in a maintainer notification within the same day, with zero silent failures.
- **SC-005**: 100% of unexpected application errors result in a recoverable screen for the user rather than an unresponsive app, and are visible to the maintainer without the user needing to report them.
- **SC-006**: A user with multiple years of expense history sees their expense list load as quickly as a brand-new user's.
- **SC-007**: 100% of proposed code changes are automatically verified (tests + type checks) with visible pass/fail results before they can be merged.
- **SC-008**: ~~New server-side reminder logic can be fully exercised end-to-end at least once in an isolated environment before every change that reaches production.~~ **Not currently met** — see FR-013's amendment; this remains the target once a real second environment exists.

## Assumptions

- Server-side reminder evaluation runs once daily, matching the MVP2 roadmap's "pg_cron daily job" description; sub-daily evaluation frequency is a possible future refinement, not required here.
- Push delivery remains subject to the same device-level notification permission introduced in F4 — a user who has denied permission receives no push notifications, server-sent or otherwise, until they grant it.
- "Maintainer" refers to this project's solo developer/operator (consistent with the constitution's free-tier, personal-project framing); failure notification can go to a single recipient rather than a team on-call rotation.
- ~~The isolated environment for verifying server-side changes is logically and data-wise separate from production — no real user's expenses, rules, or devices are reachable from it — and stays within free-tier limits per the constitution's Free-Tier Discipline principle.~~ **Superseded at deployment time (self-critique F1)**: no second Supabase project was created — this app has exactly one, and server-side changes (migrations, Edge Function deploys) are applied directly to it. Chosen deliberately over building real isolation, given there are no real users yet and the cost/complexity of a second environment wasn't justified for a solo/personal-scale app at this stage. FR-013 carries the full amendment note.
- Expense list pagination/bounding is a performance change to how history is fetched and displayed; it does not change which expenses exist or a user's ability to eventually reach older history.
- This feature does not expand rule complexity, add budgets, or add the monthly digest rule — those remain scoped to F6/F7 per the product roadmap.
- Automatic OTA app updates (e.g. `expo-updates`) are explicitly out of scope for this feature; shipping fixes still goes through the existing build/store flow.
