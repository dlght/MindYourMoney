# Implementation Plan: Tab Bar Visibility Fix & On-The-Day Default Reminder

**Branch**: `007-tabbar-visibility-default-reminder` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-tabbar-visibility-default-reminder/spec.md`

## Summary

Two small, bundled quality fixes on the existing app: (1) the bottom tab bar
(`app/(tabs)/_layout.tsx`) currently has no explicit safe-area handling and no
visual distinction from page content beyond a 1px border — confirmed via a
live screenshot of the running web build, where the bar sits flush against
the viewport edge with minimal contrast; fix by explicitly computing
safe-area-aware padding/height via `useSafeAreaInsets()` and adding a
`surface`-token background plus elevation/shadow. (2) Notifications only fire
from configured Rules, and the two shipped default rules never cover the due
date itself (only 5-days-before for ≥200 expenses, and 1-day-before); add a
third default rule (`"Due today"`, `days_before: 0`, all amounts) and change
`seedRules.ts`'s all-or-nothing seeding check to a per-rule-name presence
check so existing users — not just new sign-ups — actually receive it,
without disturbing any default rule a user already disabled.

## Technical Context

**Language/Version**: TypeScript (strict mode), existing Expo/React Native 0.81 + Expo SDK 54 codebase; no new runtime language.

**Primary Dependencies**: No new dependencies. Reuses `react-native-safe-area-context` (already used by `ExpenseSheet.tsx`/`RuleSheet.tsx`), `@react-navigation/bottom-tabs` (via `expo-router`'s `Tabs`), existing Supabase client (`seedRules.ts`), and the existing `notificationEngine.ts`/`notificationScheduler.ts`/`evaluate-reminders` pipeline (unmodified, per research.md #4).

**Storage**: No schema change. New default-rule row uses the existing `rules` table shape (`days_before: 0` already permitted by its check constraint).

**Testing**: Existing Jest + `@testing-library/react-native` unit/component suite — new/updated unit tests for `seedRules`'s name-diffing logic and a `TabsLayout` style-computation test; existing Playwright E2E suite (`e2e/`) extended with a tab-bar visibility assertion if practical, otherwise covered by quickstart.md manual steps (Chromium/Playwright can't reliably simulate `env(safe-area-inset-*)`; see research.md #1).

**Target Platform**: Native (iOS/Android) and PWA/web, matching the app's existing full platform matrix — both items apply across all three.

**Project Type**: Single Expo project (mobile-app + web export) — no new project/package boundary.

**Performance Goals**: N/A — both changes are style/seeding-logic only, no new network calls beyond the single existing `seedRules` query (now selecting `name` instead of just existence, same round-trip count).

**Constraints**: Tab bar fix MUST NOT reduce tappable area or truncate labels (FR-005); default-rule backfill MUST NOT re-enable or duplicate a rule a user already disabled (FR-009); the two existing default rules MUST remain functionally unchanged (FR-010).

**Scale/Scope**: 1 layout file (`app/(tabs)/_layout.tsx`) for the tab bar; 2 files (`defaultRules.ts`, `seedRules.ts`) for the reminder; a handful of new/updated unit tests; no new screens, tables, or Edge Functions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Mobile-First Delivery** — PASS. Both fixes are mobile-client changes (styling + client-side seeding logic); no backend-first detour.
- **II. Supabase-Only Backend** — PASS. No new backend primitive; the new default rule is a plain row in the existing `rules` table via the existing client-seeding convention (explicitly preferred over a DB-level backfill per migration 0003's own comment and research.md #2).
- **III. Free-Tier Discipline** — PASS. No new dependency or service.
- **IV. Offline-Tolerant by Default** — PASS (not touched). No change to caching/offline read behavior.
- **V. Notifications Are Core, Never an Afterthought** — PASS, directly served: this feature closes a real gap in reminder coverage (no due-date reminder existed at all). The new rule flows through the existing, already-tested reconciliation-on-mutation path with no special-casing (research.md #4).
- **VI. Money as Exact Decimal** — PASS (not touched). `min_amount: null` for the new rule is a threshold *absence*, not new arithmetic.
- **VII. Consistent Modern UI** — PASS, directly served: the tab bar fix reuses existing `src/theme/colors.ts` tokens (`surface`), not a new ad hoc color.
- **VIII. Spec-Driven Delivery** — PASS. This plan + upcoming tasks.md + unit tests satisfy the gate.
- **IX. Small, Mergeable Iterations** — see Complexity Tracking below; bundling two items is a deliberate, small exception here.

No unjustified violations. One documented exception (IX) below.

**Post-design re-check** (after Phase 1 artifacts above): unchanged — research.md's two decisions (explicit safe-area computation + elevation for the tab bar; name-diffing backfill for the default rule) introduce no new backend primitive, paid dependency, schema change, or deviation beyond the IX exception already recorded. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/007-tabbar-visibility-default-reminder/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── tab-bar-visibility-contract.md
│   └── default-rule-backfill-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/(tabs)/
└── _layout.tsx                 # US1: compute safe-area-aware, elevated tabBarStyle

src/theme/
└── colors.ts                   # US1: no change — confirms `surface` token already exists to reuse

src/features/rules/
├── defaultRules.ts              # US2: add third DEFAULT_RULES entry ("Due today")
├── seedRules.ts                 # US2: change existence check to per-name presence/backfill
├── notificationEngine.ts        # US2: unmodified — already handles days_before:0 generically (research.md #4)
└── notificationScheduler.ts     # US2: unmodified — same-day DATE trigger behavior documented, not changed

tests/unit/                      # US1 + US2 — new/updated tests
├── seedRules.test.ts            # new — name-diffing backfill fixtures (contracts/default-rule-backfill-contract.md)
└── tabBarStyle.test.ts          # new — safe-area/elevation style computation, if extracted to a testable helper
```

**Structure Decision**: Single Expo project, unchanged. Both items touch a
small number of existing files in place — no new directories, no new
top-level packages. The tab bar's style computation may be extracted from
`_layout.tsx` into a small pure helper (e.g. `getTabBarStyle(insets, colors,
scheme)`) purely so it's unit-testable without rendering the full
`Tabs` tree; this is the only new "file" either item introduces, and it's a
plain function, not a new architectural layer.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| IX. Small, Mergeable Iterations — one feature bundles 2 distinct concerns (tab bar styling, default-rule backfill) | Both were raised together by the user in the same request as small, unrelated-but-simultaneously-noticed polish/gap items on the already-shipped app; each is individually tiny (1–3 files) with no shared code path, so splitting into two Spec Kit features would double the spec/plan/tasks overhead for two changes a reviewer would still likely review as one small PR | Two fully separate features was considered and is the "default" per this principle, but given the trivial size of each item and that they were explicitly requested together, the process overhead outweighs the review-tractability benefit here — matches the precedent already set (and justified the same way) in `specs/006-pwa-e2e-layout-fix/plan.md` |
