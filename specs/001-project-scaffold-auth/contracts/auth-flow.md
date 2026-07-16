# Contract: Auth Flow (Supabase Magic Link)

This app has no custom backend endpoints (constitution II) — the "contract"
is the shape of the Supabase Auth client calls the app relies on, and what
the app guarantees to the user at each step.

## 1. Request a magic link

**Call**: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`

**App guarantees**:
- Shown a "check your email" confirmation state immediately after the call
  resolves successfully.
- Re-requesting (before the first link is used) supersedes the previous
  link — the most recently requested link is the one that authenticates
  (per spec Edge Cases); the app does not block re-requesting.

**Failure modes surfaced to the user**: no network at request time; rate
limited by Supabase (shown as "try again in a moment").

## 2. Open the magic link

**Call**: the app parses the incoming deep link itself (`expo-linking`
URL event / `getInitialURL`) and calls `supabase.auth.setSession()` with
the extracted `access_token`/`refresh_token`, or reads the `error`/
`error_code` pair off the URL if the link was rejected (see research.md
#3 — `detectSessionInUrl` does not work on native, so this cannot be left
to the client library).

**App guarantees**:
- A valid, unexpired, unused link results in a `SIGNED_IN` event and the
  user is routed from `(auth)` to `(tabs)`.
- An expired or already-used link does not silently fail: the app shows an
  explicit "this link is no longer valid" state with a way to request a
  new one (FR-005).

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
