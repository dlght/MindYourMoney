# Quickstart: Project Scaffold & Auth

Validation guide for Feature F1. Assumes the implementation tasks in
`tasks.md` have been completed.

## Prerequisites

- Node.js LTS and the Expo CLI (`npx expo` — no global install needed)
- A Supabase project (free tier) with:
  - Email auth enabled (email + password)
  - The migration in `contracts/categories-schema.sql` applied
- `.env` (or `app.config.ts` extra) populated with `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Setup

```bash
npm install
npx expo start
```

Open the app in Expo Go or a simulator/emulator from the CLI output.

## Scenario 1 — First-time account creation seeds categories (User Story 1 + 3)

1. On the sign-in screen, tap "Don't have an account? Create one".
2. Enter an email address that has never signed in before and a password.
3. Submit the create-account form.
4. **Expect**: app opens directly onto the Home tab, signed in (assumes
   email confirmation is disabled on the Supabase project).
5. Inspect the `categories` table (Supabase dashboard or SQL) for that
   user's `user_id`.
6. **Expect**: exactly 11 rows, matching the names/icons/colors in
   `data-model.md`, all with `is_default = true`.

## Scenario 2 — Session persists across restart (User Story 1)

1. While signed in from Scenario 1, force-quit the app.
2. Reopen it.
3. **Expect**: app lands directly on the Home tab with no sign-in prompt.

## Scenario 3 — Sign out returns to sign-in (User Story 1)

1. From Settings, tap "Sign out".
2. Reopen the app (or observe immediately).
3. **Expect**: sign-in screen is shown.
4. Repeat Scenario 2's restart check.
5. **Expect**: app now shows the sign-in screen, not Home.

## Scenario 4 — Tab navigation (User Story 2)

1. While signed in, tap each of Add, Rules, Settings, then Home.
2. **Expect**: each tap opens its screen immediately, and the tab bar
   reflects the active tab.

## Scenario 5 — Invalid credentials (Edge Case)

1. On the sign-in screen (sign-in mode), enter a registered email with the
   wrong password.
2. Submit the form.
3. **Expect**: an explicit "Invalid login credentials" message — not a
   silent failure or crash.

## Scenario 6 — No duplicate categories on repeat login

1. Sign out from the account used in Scenario 1.
2. Sign in again with the same email and password.
3. Inspect the `categories` table for that `user_id` again.
4. **Expect**: still exactly 11 rows — no duplicates created.

## Automated coverage

- `tests/unit/seedCategories.test.ts` — covers Scenario 1's seeding logic
  and Scenario 6's idempotency directly against a mocked Supabase client.
- `tests/component/sign-in.test.tsx` — covers the sign-in/create-account/
  validation/error UI states from Scenarios 1 and 5.
- `tests/component/tabs-layout.test.tsx` — covers Scenario 4's tab
  reachability and the signed-out redirect from FR-007.
