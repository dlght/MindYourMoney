---

description: "Task list for feature implementation"
---

# Tasks: Project Scaffold & Auth

**Input**: Design documents from `/specs/001-project-scaffold-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — constitution principle VIII mandates component tests
for screens and unit tests for non-trivial logic (here: session restore and
category seeding); these are not optional for this project.

**Organization**: Tasks are grouped by user story (from spec.md: US1 = Sign
in & stay signed in [P1], US2 = Tab navigation [P2], US3 = Default category
seeding [P3]) so each can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Initialize the Expo + TypeScript project at repo root (`package.json`, `app.json`, `tsconfig.json` with strict mode per constitution I)
- [X] T002 Install dependencies: `expo-router`, `nativewind`, `tailwindcss`, `@supabase/supabase-js`, `@tanstack/react-query`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-linking`
- [X] T003 [P] Configure NativeWind + Tailwind: `tailwind.config.js`, `babel.config.js`, `global.css`, `nativewind-env.d.ts`
- [X] T004 [P] Configure Jest: `jest-expo` preset and `@testing-library/react-native` in `package.json`/`jest.config.js`
- [X] T005 [P] Create `.env.example` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` placeholders

**Checkpoint**: Project builds and `npx expo start` runs an empty app shell.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create Supabase client in `src/lib/supabase.ts` (SecureStore-backed auth storage adapter per research.md #2, env vars from T005)
- [X] T007 [P] Create TanStack Query client in `src/lib/queryClient.ts` (`networkMode: 'offlineFirst'` per research.md #4 and constitution IV)
- [X] T008 [P] Create `src/features/categories/defaultCategories.ts` with the 11 default categories (name/icon/color) from `docs/mindyourmoney-spec.md` §2 and `data-model.md`
- [X] T009 [P] Create NativeWind theme tokens `src/theme/colors.ts` (dark/light per constitution VII)
- [X] T010 Apply `contracts/categories-schema.sql` as `supabase/migrations/0001_categories.sql` against the Supabase project (table + RLS scoped to `auth.uid()` per constitution II) — applied to project `tvbyqwnwlrlsxvgemwls` via the Supabase Management API; verified `categories` table (7 columns) and all 4 RLS policies exist
- [X] T011 Create `src/features/auth/AuthProvider.tsx` (session context: subscribes to `onAuthStateChange`, exposes `signIn`/`signUp`/`signOut`, per contracts/auth-flow.md — **amended** from the original magic-link design to email+password; see git history for the switch)
- [X] T012 Create `src/features/auth/useSession.ts` (hook exposing current session + `isLoading` from `AuthProvider`)
- [X] T013 Create root layout `app/_layout.tsx` (wraps app in `QueryClientProvider` + `AuthProvider`, applies theme from T009, renders a loading state while `isLoading`)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Sign in with email and password and stay signed in (Priority: P1) 🎯 MVP

**Goal**: A user can create an account or sign in with an email and
password, and remains signed in across app restarts until they explicitly
sign out. (Amended from the originally-planned magic-link flow during
implementation — self-critique F3, see contracts/auth-flow.md.)

**Independent Test**: Enter an email and password and submit, force-quit
and reopen the app — land signed in with no re-authentication.

### Tests for User Story 1

- [X] T014 [P] [US1] Component test for sign-in screen states (sign-in / create-account / validation / invalid-credentials) in `tests/component/sign-in.test.tsx`
- [X] T015 [P] [US1] Unit test for session-restore behavior (persisted session → signed-in; no session → signed-out) in `tests/unit/useSession.test.tsx`

### Implementation for User Story 1

- [X] T016 [US1] Create `app/(auth)/_layout.tsx` (redirects an already-signed-in user to `(tabs)`)
- [X] T017 [US1] Implement `app/(auth)/sign-in.tsx`: email + password entry with a sign-in/create-account mode toggle → `signIn`/`signUp`; invalid-credentials and confirm-your-email states (FR-005, Edge Cases)
- [X] T018 [US1] Wire the auth-gate redirect into `app/_layout.tsx` (depends on T013): signed-in → `(tabs)`, signed-out → `(auth)`, based on `useSession()` from T012

**Checkpoint**: A user can sign in with email and password and the session
survives an app restart, independent of tabs or category content existing
yet.

---

## Phase 4: User Story 2 - Navigate the app via Home, Add, Rules, and Settings (Priority: P2)

**Goal**: A signed-in user reaches any of the four primary destinations in
one tap; a signed-out user never sees the tab bar.

**Independent Test**: Sign in, tap each of the four tabs in turn, confirm
each opens its screen; sign out and confirm the tabs are no longer shown.

### Tests for User Story 2

- [X] T019 [P] [US2] Component test for tabs layout (all four tabs reachable; signed-out users redirected away) in `tests/component/tabs-layout.test.tsx`

### Implementation for User Story 2

- [X] T020 [US2] Create `app/(tabs)/_layout.tsx` (tab bar: Home, Add, Rules, Settings; redirects a signed-out user to `(auth)`, per FR-006/FR-007)
- [X] T021 [P] [US2] Create `src/components/ScreenPlaceholder.tsx` (shared placeholder used by Add/Rules until F2/F4 land)
- [X] T022 [P] [US2] Create `app/(tabs)/index.tsx` (Home; minimal placeholder content — full dashboard is F3)
- [X] T023 [P] [US2] Create `app/(tabs)/add.tsx` (placeholder via `ScreenPlaceholder`; full flow is F2)
- [X] T024 [P] [US2] Create `app/(tabs)/rules.tsx` (placeholder via `ScreenPlaceholder`; full editor is F4)
- [X] T025 [US2] Create `app/(tabs)/settings.tsx` (shows signed-in email; "Sign out" button calling `useSession().signOut` from T011/T012, satisfying FR-004)

**Checkpoint**: All four tabs are reachable for signed-in users and hidden
from signed-out users, independent of category seeding.

---

## Phase 5: User Story 3 - See default categories ready to use on first login (Priority: P3)

**Goal**: A brand-new user's account has all 11 default categories present
immediately after their first successful sign-in, with no duplicates on
subsequent logins.

**Independent Test**: Sign in with a brand-new account and confirm the full
default category list exists with no manual setup; sign in again and
confirm no duplicates were created.

### Tests for User Story 3

- [X] T026 [P] [US3] Unit test for `seedCategories` idempotency (no rows → inserts 11; rows already exist → no-op; partial-failure retry leaves a clean state) in `tests/unit/seedCategories.test.ts`

### Implementation for User Story 3

- [X] T027 [US3] Create `src/features/categories/seedCategories.ts` (checks for existing rows for `user_id`; if none, batched-inserts the 11 defaults from T008, per research.md #5)
- [X] T028 [US3] Call `seedCategories` from `AuthProvider`'s `SIGNED_IN` handler in `src/features/auth/AuthProvider.tsx` (extends T011; sequential, same file)

**Checkpoint**: All three user stories are independently functional and
demonstrable together as Feature F1.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 [P] Unit test for `defaultCategories` completeness (exactly 11 entries; every entry has a non-empty name/icon/color) in `tests/unit/defaultCategories.test.ts`
- [X] T030 Run `quickstart.md` Scenarios 1–6 manually end-to-end against a real Supabase project and record results — verified manually by the user: sign-in against the real Supabase project succeeds and lands in the app signed in

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational only (uses `useSession` from T012, not on US1's screens)
- **User Story 3 (Phase 5)**: Depends on Foundational (T006, T008) and on `AuthProvider` existing (T011); T028 sequentially extends the same file as T011
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 — testable alone once Foundational is done
- **US2 (P2)**: No dependency on US1's screens, but a human tester needs a signed-in session (from US1) to reach the tabs at all — independently *implementable*, but independently *testable* only once US1 exists. Build order should be US1 → US2 → US3.
- **US3 (P3)**: Depends on the `SIGNED_IN` event existing (US1) to have somewhere to hook into — implement after US1.

### Within Each User Story

- Tests written before implementation, and MUST fail first
- Shared/context files before the screens that consume them
- Story complete before moving to the next priority

### Parallel Opportunities

- All Setup [P] tasks (T003–T005) in parallel
- All Foundational [P] tasks (T007, T008, T009) in parallel; T006 and T010 are not parallel with each other's consumers but can run alongside T007–T009
- Within US1: T014 and T015 in parallel (different test files)
- Within US2: T019 in parallel with nothing until T020 lands; T021–T024 in parallel with each other (different files); T025 depends on T011/T012 (Foundational) only
- Within US3: T026 can be written in parallel with T027 (test-first), but T027 must exist before T026 can pass

---

## Parallel Example: User Story 2

```bash
# After T020 (tabs layout) exists, these run together:
Task: "Create ScreenPlaceholder in src/components/ScreenPlaceholder.tsx"
Task: "Create Home screen in app/(tabs)/index.tsx"
Task: "Create Add screen in app/(tabs)/add.tsx"
Task: "Create Rules screen in app/(tabs)/rules.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US1: sign in, session persists)
3. **STOP and VALIDATE**: run quickstart.md Scenarios 2–3, 5 by hand
4. This alone is not shippable (no way to reach app content) but proves the
   riskiest technical piece — Supabase email+password auth + SecureStore — works

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate sign-in/session independently
3. Add US2 → validate tab navigation independently (now the app is usable end-to-end, minus categories)
4. Add US3 → validate category seeding independently → Feature F1 complete
5. Polish (T029–T030) → full quickstart.md pass

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them
- [Story] labels map tasks back to spec.md's prioritized user stories
- Commit after each task or logical group, per constitution IX (small, mergeable slices)
- Verify each new test fails before writing the implementation that makes it pass
