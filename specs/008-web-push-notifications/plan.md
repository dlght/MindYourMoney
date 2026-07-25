# Implementation Plan: Web Push Notifications for the PWA

**Branch**: `008-web-push-notifications` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-web-push-notifications/spec.md`

## Summary

Adds standard Web Push API support as a second, additive notification
delivery path for the Netlify-hosted PWA, so a user can receive real push
notifications without a paid native app-store build. Client-side: a new web
branch in `usePushRegistration.ts` requests the browser's native
notification permission (never currently requested on web at all) and
subscribes via `PushManager`, gated behind an explicit "Enable
notifications" action on the Rules screen rather than an automatic prompt.
Server-side: `evaluate-reminders` gains a `webPush.ts` adapter (VAPID-signed,
via `npm:web-push`, mirroring the existing `expoPush.ts` adapter) that sends
to web subscriptions stored in an extended `push_tokens` table. The existing
service worker gains `push`/`notificationclick` handlers so an incoming push
actually renders and is tappable. iOS Safari's install-to-home-screen
requirement is detected and surfaced as explicit guidance rather than a
silent dead end. All existing native (iOS/Android) paths are untouched.

## Technical Context

**Language/Version**: TypeScript (strict mode) for the client; Deno
(TypeScript) for the Edge Function — both unchanged, existing runtimes.

**Primary Dependencies**: `npm:web-push@3` (new — Deno-`npm:`-imported in
`supabase/functions/evaluate-reminders`, the same import mechanism already
proven in this repo via `npm:@supabase/supabase-js@2` and
`npm:@sentry/deno@8`); no new client-side dependency — `PushManager`,
`Notification`, and service worker APIs are standard browser APIs, no
library needed.

**Storage**: Extends the existing `push_tokens` table (nullable
`expo_push_token`, widened `platform` check, three new nullable `web_*`
columns) via a new migration; no new table (research.md #5). No change to
`notifications_log`'s shape.

**Testing**: Existing Jest suite for the genuinely pure, runtime-agnostic
client-side pieces (`webPushSupport.ts`, `vapidKey.ts`, the banner-variant
decision helper, `hasNotificationPermission()`'s web branch, and the
`RulesScreen` banner states). No Jest/Deno unit test for `webPush.ts` itself
or `evaluate-reminders`'s platform-partitioning — matching this repo's
existing precedent that `expoPush.ts`/`db.ts`/`index.ts` have never been
unit tested (no Deno test runner is configured anywhere in this project);
those are verified via quickstart.md's manual scenarios instead, same as
the existing native send path already is.

**Target Platform**: Web/PWA only (Android Chrome/Chromium browsers; iOS
Safari 16.4+ when installed to the home screen) — this feature does not
touch native iOS/Android, which already has its own working delivery path.

**Project Type**: Single Expo project (mobile-app + web export) — no new
project/package boundary; extends the existing
`supabase/functions/evaluate-reminders` Edge Function in place.

**Performance Goals**: N/A beyond the existing daily evaluation cadence —
this feature adds a delivery destination, not a new schedule
(research.md #2 of the Assumptions in spec.md).

**Constraints**: No paid third-party push service introduced (constitution
III) — direct VAPID-authenticated Web Push only. Permission MUST NOT be
requested automatically on page load/sign-in (research.md #6) — only via an
explicit user action. iOS's install-before-push constraint MUST be detected
and surfaced accurately (FR-005), not silently ignored.

**Scale/Scope**: 1 schema migration, 3 new/extended server-side files
(`webPush.ts` new, `index.ts` + `db.ts` extended in
`evaluate-reminders`), 1 service worker file extended (`sw.js`), 2-3
client files extended (`usePushRegistration.ts`, `notificationScheduler.ts`,
`RulesScreen.tsx`/`rules.tsx`), plus a new small VAPID key-conversion helper
and a new banner-state helper.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Mobile-First Delivery** — PASS. This feature specifically serves
  mobile users of the web/PWA build (the primary way this project's users
  reach it without a paid native install); no desktop-first or
  backend-first detour — the mobile Rules-screen banner is the entry point.
- **II. Supabase-Only Backend** — PASS. No new backend primitive — the send
  path lives inside the existing `evaluate-reminders` Supabase Edge
  Function; `push_tokens` (existing Supabase Postgres table, RLS already
  enabled) is extended, not replaced.
- **III. Free-Tier Discipline** — PASS, directly served: this feature
  exists specifically to avoid the paid native app-store path. The
  `web-push` npm package is open-source/free; the standard Web Push
  protocol has no per-message cost from any browser vendor.
- **IV. Offline-Tolerant by Default** — PASS (not touched). No change to
  cached-read behavior; push delivery is inherently an online-only
  mechanism on every platform, native included.
- **V. Notifications Are Core, Never an Afterthought** — PASS, directly
  served: this feature closes the single largest remaining notification
  gap (the web/PWA path currently delivers nothing at all once closed).
  Reconciliation-on-mutation is unaffected; this only adds a destination.
- **VI. Money as Exact Decimal** — PASS (not touched).
- **VII. Consistent Modern UI** — PASS. The new banner states
  (contracts/web-permission-ux-contract.md) reuse the existing banner
  component/styling already on `RulesScreen.tsx`, not a new ad hoc UI
  pattern.
- **VIII. Spec-Driven Delivery** — PASS. This plan + upcoming tasks.md +
  tests satisfy the gate.
- **IX. Small, Mergeable Iterations** — PASS without exception needed: this
  is one cohesive feature (one new delivery path, its permission UX, and
  its server-side send/cleanup logic) rather than several unrelated
  concerns bundled together — no Complexity Tracking entry required.

No violations. No Complexity Tracking entries needed.

**Post-design re-check** (after Phase 1 artifacts above): unchanged —
research.md's decisions (extend `push_tokens` rather than a new table; use
`npm:web-push` rather than hand-rolled crypto or a paid third-party
service; gate permission behind an explicit user action) introduce no new
backend primitive, paid dependency, or governance deviation. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-web-push-notifications/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── push-tokens-web-schema.sql
│   ├── web-push-send-contract.md
│   ├── service-worker-push-contract.md
│   └── web-permission-ux-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0007_web_push_tokens.sql        # new — push_tokens web-shape extension (contracts/push-tokens-web-schema.sql)

supabase/functions/evaluate-reminders/
├── webPush.ts                       # new — VAPID Web Push adapter (contracts/web-push-send-contract.md), parallel to expoPush.ts
├── db.ts                            # extended — fetch/select the new web_* columns, delete-on-410 helper
└── index.ts                         # extended — partition push_tokens by platform, branch send phase

public/
└── sw.js                            # extended — push + notificationclick handlers (contracts/service-worker-push-contract.md)

src/features/push/
├── usePushRegistration.ts           # extended — new web branch (permission + PushManager.subscribe)
├── pushTokenApi.ts                  # extended — upsertPushToken accepts the web subscription shape
├── types.ts                         # extended — PushPlatform gains "web", new web subscription fields
└── vapidKey.ts                      # new — base64url → Uint8Array conversion helper for applicationServerKey

src/features/rules/
├── notificationScheduler.ts         # extended — hasNotificationPermission() web-aware (contracts/web-permission-ux-contract.md)
├── RulesScreen.tsx                  # extended — three-state banner (unsupported / iOS-install-guidance / enable-action)
└── webPushSupport.ts                # new — isWebPushSupported() / isIosNotInstalled() detection helpers (research.md #7)

app/(tabs)/
└── rules.tsx                        # extended — wires the enable-notifications action through to RulesScreen

tests/unit/                          # extended
├── webPushSupport.test.ts           # new — iOS/standalone detection matrix
└── vapidKey.test.ts                 # new — key-conversion helper

tests/component/
└── rules-screen.test.tsx            # extended — three banner-state assertions
```

**Structure Decision**: Single Expo project, unchanged — extends existing
files/directories in place (`src/features/push/`, `src/features/rules/`,
`supabase/functions/evaluate-reminders/`, `public/sw.js`) plus one new
migration file, matching the pattern every prior push/notification feature
in this repo (F5, F7) has already used. No new top-level directory.

## Complexity Tracking

*No violations — table intentionally omitted.*
