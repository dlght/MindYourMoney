# Quickstart: PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix

## Prerequisites

- Repo dependencies installed (`npm install`), including the new
  `@playwright/test` devDependency added by this feature.
- Playwright's browser binary installed once: `npx playwright install chromium`.
- A dedicated Supabase test account's credentials available as environment
  variables (names TBD in tasks.md, e.g. `E2E_TEST_EMAIL` /
  `E2E_TEST_PASSWORD`) — provisioning that account is a one-time manual
  step, not part of this quickstart.
- The web build servable locally: `npm run build:web && npx serve -p 4173 -s dist`
  (same pattern used to verify the prior PWA feature).

## US1 — Verify the add-expense error fix

1. Sign in to the running web build with any account.
2. Add a new expense with valid fields and save.
3. **Expected**: the sheet closes, the expense appears on the dashboard,
   and no error message is shown anywhere in the UI.
4. Open the browser console — confirm no unhandled promise rejection
   related to notification scheduling.
5. Regression check for the "must still error on real failures" half of
   the fix (FR-002): go offline (DevTools → Network → Offline), attempt to
   add another expense, and confirm an error message IS shown this time.

## US2 — Run the E2E suite

1. `npx playwright test` (config path/scripts finalized in tasks.md).
2. **Expected**: all scenarios in
   [contracts/e2e-test-scenarios.md](contracts/e2e-test-scenarios.md) pass.
3. Run it again immediately (`npx playwright test` a second time) without
   any manual cleanup in between.
4. **Expected**: passes again, identically (SC-003) — confirms
   idempotency against the shared test account.
5. Regression-detection sanity check (optional, SC-005): temporarily
   comment out the Add button's `onPress` in `app/(tabs)/add.tsx`, rerun
   the suite, confirm only the add-expense scenario fails, then revert.

## US3 — Verify mobile layout spacing

1. Open the running web build in a browser at a mobile viewport width
   (DevTools device toolbar, e.g. 390×844).
2. Visit each primary screen (Home, Add, Rules, Settings).
3. **Expected**: on every screen, content has visible padding from all
   four edges per
   [contracts/layout-spacing-contract.md](contracts/layout-spacing-contract.md)
   — nothing (text, buttons, list items) touches the screen edge.
4. Scroll a long list (e.g. Add tab's expense history) to its end.
5. **Expected**: the last item has visible breathing room above the tab
   bar, not flush against it.

**Gotcha discovered during implementation**: `playwright.config.ts`'s
`webServer.reuseExistingServer` is `true` locally (matches Playwright's own
default guidance) — if a server from a previous run is still listening on
port 4173, a new `npm run test:e2e` run reuses it *without rebuilding*,
silently testing stale code. If a change doesn't seem to take effect, kill
whatever's on port 4173 first (Windows: find the PID via
`netstat -ano | findstr :4173`, then `Stop-Process -Id <pid> -Force`) and
rerun.

## CI setup (one-time, manual)

The `e2e` job in `.github/workflows/ci.yml` needs four repository secrets
(Settings → Secrets and variables → Actions), matching what the app
already needs plus the test account from T010:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`. No `gh` CLI was available in the
implementing environment to set these automatically — add them manually
before the `e2e` job will pass in CI.

## Full regression pass

`npm test && npm run typecheck` — the existing Jest/RNTL suite and
TypeScript check must both remain green; this feature adds one new unit
test (`tests/unit/useNotificationReconciliation.test.ts`) but does not
change any existing test's expected behavior.
