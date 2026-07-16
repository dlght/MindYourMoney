# Implementation Plan: Project Scaffold & Auth

**Branch**: `001-project-scaffold-auth` | **Date**: 2026-07-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-project-scaffold-auth/spec.md`

## Summary

Stand up the Expo app shell that every later MindYourMoney feature builds on:
Expo Router tab navigation (Home, Add, Rules, Settings) gated behind
Supabase email magic-link authentication with a persisted session, plus
automatic seeding of the eleven default expense categories into a user's
account on their first successful sign-in. Technical approach: a single
Expo + TypeScript app using NativeWind for styling, `@supabase/supabase-js`
for auth/data, TanStack Query for data fetching/caching (offline-tolerant
per constitution IV), and `expo-secure-store` to persist the Supabase
session across restarts.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (constitution I) — Expo SDK 51 (React Native 0.74, React 18)

**Primary Dependencies**: `expo-router` (navigation/tabs), `nativewind` + `tailwindcss` (styling/themes), `@supabase/supabase-js` (auth + Postgres client), `@tanstack/react-query` (data fetching/cache), `expo-secure-store` (session persistence), `@react-native-async-storage/async-storage` (Supabase client storage adapter requirement), `expo-linking` (magic-link deep link handling)

**Storage**: Supabase Postgres (`categories` table, RLS-scoped to `auth.uid()`); local session persisted via `expo-secure-store`; TanStack Query's in-memory + persisted cache for offline reads

**Testing**: Jest + `jest-expo` preset for unit tests (category-seeding logic, session helpers); React Native Testing Library for component tests (tab layout, sign-in screen) — per constitution VIII

**Target Platform**: iOS 15+ and Android (Expo managed workflow, single codebase)

**Project Type**: mobile-app (single Expo project; no separate backend service — Supabase is the only backend, constitution II)

**Performance Goals**: Cold start to interactive Home tab under ~3s on a mid-range device; tab switches feel instant (no visible loading spinner for cached data)

**Constraints**: Must open and show previously-seen data with no network connection (constitution IV); every dependency must be usable at zero cost on its provider's free tier (constitution III); every Supabase table must carry an RLS policy scoped to `auth.uid()` (constitution II)

**Scale/Scope**: Single-user MVP1 scope — 1 auth flow, 4 tab screens (Home/Add/Rules/Settings, placeholder content beyond Home per spec assumptions), 1 seeded table (`categories`, 11 rows/user)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Check for this feature | Status |
|---|-----------|------------------------|--------|
| I | Mobile-First Delivery | Expo + Expo Router + TypeScript strict is the entire deliverable of this feature | PASS |
| II | Supabase-Only Backend | Only backend touched is Supabase Auth + Postgres; `categories` table ships with an RLS policy scoped to `auth.uid()`; no custom server introduced | PASS |
| III | Free-Tier Discipline | Expo, NativeWind, Supabase, TanStack Query, `expo-secure-store` are all free/open-source; Supabase free tier covers Auth + this table's scale | PASS |
| IV | Offline-Tolerant by Default | Session read from `expo-secure-store` (no network needed to know you're signed in); categories cached via TanStack Query so Home can render without a live connection | PASS |
| V | Notifications Are Core | N/A — this feature has no expenses or rules yet (out of scope per spec Assumptions); no notification logic introduced | N/A (justified in spec) |
| VI | Money as Exact Decimal | N/A — no monetary fields in this feature's scope (`categories` has no amount column) | N/A (justified in spec) |
| VII | Consistent Modern UI | NativeWind design system applied from the root layout; dark/light theme wired in at scaffold time, not deferred | PASS |
| VIII | Spec-Driven Delivery | This plan + `/speckit-tasks` output + unit/component tests satisfy the requirement before F1 is marked done | PASS (in progress) |
| IX | Small, Mergeable Iterations | F1 is scoped to scaffold + auth + category seeding only; dashboard/rules/settings content is explicitly deferred to F2–F4 | PASS |

No violations requiring justification — Complexity Tracking table below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-scaffold-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── auth-flow.md
│   └── categories-schema.sql
└── tasks.md              # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
app/                        # Expo Router file-based routes
├── _layout.tsx              # Root layout: ThemeProvider, QueryClientProvider, AuthProvider, auth-gate redirect
├── +not-found.tsx
├── (auth)/
│   ├── _layout.tsx           # Redirects signed-in users to (tabs)
│   └── sign-in.tsx           # Email entry + magic-link sent state + invalid/expired link state
└── (tabs)/
    ├── _layout.tsx            # Tab bar: Home, Add, Rules, Settings; redirects signed-out users to (auth)
    ├── index.tsx               # Home (placeholder content; full dashboard is F3)
    ├── add.tsx                 # Add (placeholder content; full flow is F2)
    ├── rules.tsx                # Rules (placeholder content; full editor is F4)
    └── settings.tsx             # Settings (sign-out action lives here)

src/
├── lib/
│   ├── supabase.ts           # Supabase client init (URL/anon key from env, SecureStore-backed auth storage adapter)
│   └── queryClient.ts        # TanStack Query client (cache/staleTime defaults for offline tolerance)
├── features/
│   ├── auth/
│   │   ├── AuthProvider.tsx   # Session context; subscribes to Supabase auth state; exposes signIn/signOut
│   │   └── useSession.ts      # Hook to read current session/loading state
│   └── categories/
│       ├── defaultCategories.ts  # The 11 default categories (name/icon/color) from product spec §2
│       └── seedCategories.ts     # Idempotent seeding: insert defaults only if user has none yet
├── theme/
│   └── colors.ts              # NativeWind color tokens for dark/light themes
└── components/
    └── ScreenPlaceholder.tsx  # Shared placeholder used by Add/Rules/Settings until F2–F4 land

supabase/
└── migrations/
    └── 0001_categories.sql    # categories table + RLS policy (mirrors contracts/categories-schema.sql)

tests/
├── unit/
│   └── seedCategories.test.ts
└── component/
    ├── sign-in.test.tsx
    └── tabs-layout.test.tsx
```

**Structure Decision**: Single Expo project (mobile-app, no separate backend
service). Routing lives in `app/` per Expo Router convention; non-route
logic (Supabase client, auth/session state, category seeding, theme) lives
in `src/` so it's testable independently of the route files. Supabase
schema/RLS is tracked as a migration under `supabase/migrations/` so the
database is reproducible and reviewable alongside app code, per constitution
II. This directly extends the standard single-project layout — `app/` and
`src/` replace the generic `src/` from the template's Option 1, and
`supabase/migrations/` stands in for the template's storage layer since
there is no separate backend project.

## Complexity Tracking

*No entries — Constitution Check reported no violations for this feature.*
