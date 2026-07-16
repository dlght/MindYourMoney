# Phase 0 Research: Project Scaffold & Auth

All items below were fully determined by the user-specified tech stack
(`docs/mindyourmoney-spec.md` §4 + the `/speckit.plan` instruction) and the
constitution; no `NEEDS CLARIFICATION` markers remained in the Technical
Context, so this consolidates implementation-pattern decisions rather than
open unknowns.

## 1. Navigation structure

**Decision**: Expo Router with two route groups — `(auth)` for the sign-in
screen and `(tabs)` for the four authenticated tabs — with the root
`app/_layout.tsx` deciding which group to render based on session state.

**Rationale**: Route groups are Expo Router's standard mechanism for
gating a whole section of the app behind a condition (here: signed-in vs
signed-out) without manual imperative navigation calls. It keeps FR-006/
FR-007 (tabs only reachable when signed in) enforced in one place.

**Alternatives considered**: A single flat route list with per-screen
redirect checks — rejected, it duplicates the auth check four times and
makes it easy to forget on a new screen.

## 2. Session persistence

**Decision**: Use `expo-secure-store` as the storage adapter passed to
`createClient` from `@supabase/supabase-js`, with `persistSession: true`
and `autoRefreshToken: true`.

**Rationale**: Supabase's JS client already implements refresh-token
rotation and expects an async key-value storage adapter; `expo-secure-store`
keeps the session encrypted at rest on-device, satisfying FR-003 (session
survives restart) without custom persistence code.

**Alternatives considered**: `@react-native-async-storage/async-storage`
alone — works but stores the session unencrypted; rejected in favor of
SecureStore for a token that grants account access. Plain in-memory state —
rejected outright, fails FR-003 by design (session lost on restart).

## 3. Magic-link handling

**Decision**: Configure an Expo deep link scheme (`mindyourmoney://`), set
`detectSessionInUrl: false` on the Supabase client, and have the app itself
parse the incoming URL (via `expo-linking`'s URL event + `getInitialURL`)
to extract either the implicit-flow token fragment (`#access_token=...&
refresh_token=...`) or an `error`/`error_code` pair, then call
`supabase.auth.setSession(...)` or surface the error accordingly.

**Rationale**: `detectSessionInUrl` (Supabase JS's automatic
"parse the current page URL and exchange it for a session" behavior) reads
from browser globals (`window.location`) that do not exist in React
Native — it is a no-op on this platform. The app must own parsing the
redirect URL itself; this is also the only way to detect Supabase's
`error=access_denied&error_code=otp_expired` pair on an expired/used link
and satisfy FR-005 (explicit invalid-link state), since an ignored/failed
auto-detection would surface no error at all.

**Alternatives considered**: Relying on `onAuthStateChange` alone with
`detectSessionInUrl: true` — rejected once verified against Supabase JS's
implementation, which gates that detection behind `isBrowser()`; on native
it silently does nothing, so the sign-in link would open the app but never
authenticate or explain why.

## 4. Offline-tolerant reads

**Decision**: Wrap all Supabase reads (initial category list, session
bootstrap) in TanStack Query with a long `gcTime`/`staleTime` and
`networkMode: 'offlineFirst'`, so the last-fetched result renders
immediately on app open regardless of connectivity.

**Rationale**: Directly satisfies constitution IV — TanStack Query's
offline-first mode is built for exactly this "show cached data now, refresh
in background" pattern and is already a stack-mandated dependency.

**Alternatives considered**: Rolling a custom cache with MMKV/SQLite —
deferred; constitution IV allows either, and TanStack Query's built-in
persistence is sufficient at F1's scope (one small table). Custom
SQLite caching is left as a future option if offline write queuing is
needed in later features.

## 5. Category seeding idempotency

**Decision**: `seedCategories` checks for an existing row in `categories`
for the current `user_id` before inserting; if any row exists, it is a
no-op. The insert of all 11 defaults happens in a single batched call so a
partial-seed state can't be observed by the app (either none exist yet, or
all 11 do).

**Rationale**: Satisfies FR-009/FR-010 (no duplicates, no partial sets) and
the edge case of interrupted seeding — a batched insert either fully
commits or fully fails, and a failed attempt simply leaves the "no rows
yet" state for the next login to retry.

**Alternatives considered**: A Postgres trigger on `auth.users` insert —
rejected for F1; it would work but reaches further into Supabase-side
logic than this feature's scope needs, and keeping seeding in the client
keeps the logic covered by the unit tests this feature already commits to
(constitution VIII).

## 6. Testing stack

**Decision**: `jest-expo` preset for Jest, `@testing-library/react-native`
for component tests of `sign-in.tsx` and the tabs layout, plain Jest unit
tests for `seedCategories` and `useSession`.

**Rationale**: `jest-expo` is the standard, actively-maintained preset for
Expo projects and requires no additional native-module mocking setup for
Expo Router; Testing Library is the de facto RN component-testing choice
and pairs with constitution VIII's requirement for component tests on
screens.

**Alternatives considered**: Detox for full end-to-end device testing —
out of scope for F1; appropriate later once there's a multi-screen flow
worth testing end-to-end, not for a scaffold feature.

## Output

All Technical Context items resolved; no outstanding
`NEEDS CLARIFICATION` markers remain. Proceeding to Phase 1.
