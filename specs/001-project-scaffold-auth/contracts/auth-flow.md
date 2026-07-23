# Contract: Auth Flow (Supabase Email + Password)

This app has no custom backend endpoints (constitution II) — the "contract"
is the shape of the Supabase Auth client calls the app relies on, and what
the app guarantees to the user at each step.

## 1. Create an account

**Call**: `supabase.auth.signUp({ email, password })`

**App guarantees**:
- If the Supabase project has email confirmation disabled (this project's
  configuration), a successful call returns a session directly and the user
  is signed in immediately — no email round trip.
- If email confirmation is enabled, a successful call returns no session;
  the app shows a "confirm your email" state instead of silently doing
  nothing.
- An email that is already registered, or a password that fails Supabase's
  policy, surfaces the returned error message to the user without leaving
  them stuck.

**Failure modes surfaced to the user**: email already registered; password
too short (checked client-side first, then server-side); no network at
request time.

## 2. Sign in

**Call**: `supabase.auth.signInWithPassword({ email, password })`

**App guarantees**:
- Correct credentials result in a `SIGNED_IN` event and the user is routed
  from `(auth)` to `(tabs)`.
- Incorrect credentials do not silently fail: the app shows the returned
  "Invalid login credentials" message inline on the sign-in form.

## 3. Session restore on app launch

**Call**: `supabase.auth.getSession()` (backed by the `expo-secure-store`
adapter — research.md #2), invoked once from the root layout before
deciding which route group to render.

**App guarantees**:
- If a persisted session exists and has not been explicitly signed out,
  the user lands in `(tabs)` with no re-authentication step (FR-003).
- If no session exists (or it has been invalidated), the user lands in
  `(auth)`.

## 4. Sign out

**Call**: `supabase.auth.signOut()`

**App guarantees**:
- Ends the persisted session immediately; next app launch renders
  `(auth)` (FR-004).

## 5. First-login category seeding (triggered by this flow, not a separate contract)

Immediately after a `SIGNED_IN` event where `seedCategories` finds no
existing categories for `user.id`, the app inserts the 11 default rows
defined in `data-model.md` / `contracts/categories-schema.sql` in a single
batched insert (research.md #5). This is an internal app-to-Supabase-table
call, not a user-facing step — the user simply finds their categories
already present.
