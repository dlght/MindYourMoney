# Research: PWA E2E Testing, Mobile Layout Spacing & Add-Expense Error Fix

## 1. Root cause of the spurious add-expense error

**Decision**: The error is not in the save path itself — it's an unrelated
post-save step (local notification reconciliation) throwing, and that
exception incorrectly propagating back into the save flow's error handler.

**Trace** (confirmed by reading the actual code, not guessed):

1. `ExpenseSheet.handleSave` (`src/features/expenses/ExpenseSheet.tsx:210-228`)
   wraps `await onSave(payload)` in a `try/catch` and sets
   `errors.submit = SUBMIT_ERROR_MESSAGE` on *any* rejection.
2. `onSave` is wired in `app/(tabs)/add.tsx:55` to
   `(input) => createExpense.mutateAsync(input)`.
3. `useCreateExpense` (`src/features/expenses/useExpenseMutations.ts:37-82`)
   is a TanStack Query `useMutation` whose `onSettled` does:
   ```ts
   onSettled: async () => {
     await settleExpenseCaches(queryClient, user?.id);
     await reconcile(); // useNotificationReconciliation()
   }
   ```
   In TanStack Query v5, `mutateAsync`'s returned promise resolves/rejects
   only after the mutation's own `onSuccess`/`onError`/`onSettled`
   callbacks have run — so an exception thrown inside `onSettled` rejects
   the `mutateAsync()` promise **even though `mutationFn` (the actual
   Supabase insert) already resolved successfully**.
4. `reconcile()` is `useNotificationReconciliation()`
   (`src/features/rules/useNotificationReconciliation.ts:32-45`), which
   calls `await reconcileScheduledNotifications(user.id, desired)`
   **without a try/catch** around it (only the separate `registerPush(...)`
   call below it is `.catch()`-guarded).
5. `reconcileScheduledNotifications`
   (`src/features/rules/notificationScheduler.ts:45-95`) calls straight
   into `expo-notifications` APIs (`getAllScheduledNotificationsAsync`,
   `getPermissionsAsync`, `scheduleNotificationAsync`, ...). Expo's local
   notification scheduling APIs have known, documented gaps on the web
   platform (no OS-level local-notification scheduler exists in a browser
   the way it does on iOS/Android) — calls here throw or reject on web
   rather than silently no-op.

Net effect: on the PWA build specifically, adding an expense correctly
writes to Supabase and updates the dashboard (steps 1-3 of the mutation
lifecycle all succeed), but step 4's *unrelated* reconciliation attempt
throws, `onSettled` doesn't catch it, `mutateAsync` rejects, and
`ExpenseSheet`'s `catch` block — which has no way to distinguish "the save
itself failed" from "something after the save failed" — reports it as a
save failure.

This also explains why `app/(tabs)/_layout.tsx`'s foreground-triggered
`reconcile()` call (`useEffect` on `AppState` change) does **not** visibly
error to the user: it's fire-and-forget (the returned promise is discarded,
not awaited into a UI-facing chain), so an uncaught rejection there is
silent. The mutation path is the only place `reconcile()`'s result is
awaited into something the UI reacts to.

**Fix shape** (for tasks.md, not applied yet in this planning phase):
Two independent, complementary changes are needed — not just one — because
each closes a different gap:
- `useNotificationReconciliation`'s call to `reconcileScheduledNotifications`
  should be wrapped the same way `registerPush` already is (caught and
  logged, not left to throw) — this is the direct fix and follows the
  existing precedent in the same function.
- `notificationScheduler.ts` should also guard against calling
  unsupported `expo-notifications` local-scheduling APIs on web at all
  (e.g. an early return / platform check), since local notification
  scheduling is a native-only capability, not just a "sometimes flaky on
  web" one — this addresses the root capability gap, not just its
  symptom, and keeps `hasNotificationPermission()` (used by
  `app/(tabs)/rules.tsx` to show a permission banner) behaving sensibly on
  web too.

**Alternatives considered**:
- *Wrap only `ExpenseSheet`'s catch to ignore reconciliation errors
  specifically* — rejected: the sheet has no visibility into why
  `mutateAsync` rejected (TanStack Query doesn't expose "which callback
  failed"), so this would require threading an error-source flag through
  the mutation, more invasive than fixing it at the source.
- *Make `onSettled` swallow all errors unconditionally* — rejected: would
  also hide genuine cache-invalidation failures (`settleExpenseCaches`),
  which are worth surfacing/logging even if not as a user-facing "save
  failed" message. The fix targets the specific reconciliation call, not
  the whole `onSettled` block.

## 2. Mobile layout spacing — current state

**Decision**: Add safe-area-aware bottom padding where currently missing,
and normalize horizontal padding to a consistent value, rather than
introducing a new spacing/design-token system.

**Findings** (all four primary screens read directly):
- `app/(tabs)/add.tsx`, `app/(tabs)/settings.tsx`,
  `src/features/dashboard/DashboardScreen.tsx`,
  `src/features/rules/RulesScreen.tsx` all already root their content in
  `<SafeAreaView edges={["top"]} ...>` from `react-native-safe-area-context`
  — so the *top* safe-area inset (status bar / notch) is already
  respected everywhere. This is not a from-scratch integration; it's an
  extension of an existing, working pattern.
- None of the four explicitly reserve extra breathing room *beyond* the
  raw safe-area value — top padding equals the inset exactly (e.g., `pt-4`
  on top of whatever `insets.top` `SafeAreaView` applies), which is what
  reads as "cramped" on devices with a small top inset (e.g. web/desktop,
  where `insets.top` is often `0`).
- `edges={["top"]}` deliberately omits `bottom` on every screen — the
  existing comment in `add.tsx` (`edges omits "bottom": the tab bar below
  this screen already accounts for the bottom safe-area inset`) documents
  why. This reasoning holds for the *safe-area* inset specifically, but
  the tab bar's own padding doesn't add extra visual breathing room above
  it for scrollable list content — list items can still render flush
  against the tab bar's top edge.
- Horizontal padding is applied ad hoc per screen (`px-6` in most headers)
  rather than from one shared constant, which is how a screen could end up
  missing it if a new one is added without copying the pattern.

**Fix shape**: Rather than re-architecting spacing, (a) add a small fixed
top/bottom breathing-room value on top of the existing safe-area insets
(e.g. `insets.top + 16` / `insets.bottom + 16` inline, matching the
existing inline-inset pattern already used in `ExpenseSheet.tsx`'s
`paddingBottom: 32 + insets.bottom`), and (b) standardize the horizontal
padding value already in use (`px-6` = 24px) across all four screens'
outermost containers so it's consistent rather than incidentally matching.

**Alternatives considered**:
- *Introduce a shared `<ScreenContainer>` wrapper component for all four
  screens* — a cleaner long-term structure, but a larger refactor than
  this bug/polish-focused feature calls for; noted as a reasonable future
  follow-up rather than done here (avoids scope creep beyond FR-009/010/011).
- *Global CSS-like safe-area padding via NativeWind theme config* — rejected
  for this feature: NativeWind's current usage in this repo is
  utility-class-based per screen, and introducing a new global-styling
  mechanism is a larger change than the spacing bug calls for.

## 3. E2E browser automation tooling

**Decision**: Playwright (`@playwright/test`), run against the web/PWA
export, matching the tool already used ad hoc to verify the prior PWA
conversion feature in this same project.

**Rationale**: Already proven to work in this exact repo/environment
(headless Chromium via Playwright successfully drove sign-in, tab
navigation, and the add-expense bottom sheet during the PWA conversion's
manual verification pass). No new tool discovery risk. Free/open-source
(Constitution III). Runs headlessly in the existing free-tier GitHub
Actions CI already set up in F5.

**Test account & idempotency strategy**: A dedicated Supabase Auth user is
provisioned once (out-of-band, credentials as CI/env secrets per FR-006).
Each spec is responsible for cleaning up what it creates (e.g. an
"add expense" scenario also deletes the expense it added, either via UI
interaction as part of the assertion flow, or via a fixture-level teardown
using the same Supabase client library the app itself uses) so a run never
depends on, or is broken by, the exact state left by a previous run
(FR-007). Scenarios locate elements they created via unique,
run-generated names (e.g. a timestamp/random suffix in the expense name)
rather than assuming a specific starting list length, so pre-existing
leftover data from an interrupted prior run doesn't cause false failures.

**Alternatives considered**:
- *Cypress* — comparable capability, but would be a second, unproven
  browser-automation tool in this repo when Playwright is already known
  to work here; no reason to introduce it.
- *Detox / native E2E* — targets native iOS/Android builds specifically;
  out of scope per the spec's Assumptions (browser automation targets the
  PWA/web build).
- *Resetting the test account's data via a full DB wipe between runs* —
  rejected: heavier (needs elevated DB access from CI), and unnecessary
  when per-scenario cleanup + unique naming achieves the same idempotency
  guarantee more cheaply.
