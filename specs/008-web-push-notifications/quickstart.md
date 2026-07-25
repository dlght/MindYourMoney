# Quickstart: Web Push Notifications for the PWA

## Prerequisites

- A VAPID key pair generated once (e.g. `npx web-push generate-vapid-keys`)
  — a one-time manual ops step, not part of the app code.
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` set locally (`.env`) and in the Netlify
  build environment; `VAPID_PRIVATE_KEY` set as a Supabase Edge Function
  secret (`supabase secrets set VAPID_PRIVATE_KEY=...`).
- Migration `0007_web_push_tokens.sql` applied to the target Supabase
  project (`supabase db push` or the linked-project equivalent already used
  for prior migrations).
- `evaluate-reminders` redeployed with the new `webPush.ts` adapter
  (`supabase functions deploy evaluate-reminders`).
- The web build servable locally: `npm run build:web && npx serve -p 4173 -s dist`
  (same pattern as `specs/006-pwa-e2e-layout-fix`).

## US1 — Enable and receive a web push notification

1. On Android Chrome (or an iOS device with the app already added to the
   home screen), open the served build and sign in.
2. Go to the Rules tab; confirm the "Enable notifications" banner/button
   appears (not the static/install-guidance variant).
3. Tap it; confirm the browser's native permission prompt appears exactly
   once.
4. Grant permission.
5. **Expected**: the banner disappears; in Supabase Studio (or via the
   app's own state), confirm a new `push_tokens` row exists for this user
   with `platform = 'web'`, `web_endpoint`/`web_p256dh`/`web_auth`
   populated, `expo_push_token` null.
6. Create a planned expense that matches an enabled rule for today or
   tomorrow (reuses `specs/007-tabbar-visibility-default-reminder`'s "Due
   today"/"Due tomorrow" defaults).
7. Close the app/tab completely.
8. Manually invoke `evaluate-reminders` (per
   `specs/005-server-push-hardening/quickstart.md`'s existing invocation
   steps) or wait for its scheduled run.
9. **Expected**: a system notification appears on the device with the app
   closed. Tapping it opens the app.

## US2 — iOS install guidance

1. On an iPhone, open the app in a plain Safari tab (do not add to home
   screen).
2. Go to the Rules tab.
3. **Expected**: the banner shows install guidance ("Add to Home Screen to
   enable notifications"), not an "Enable notifications" button — tapping
   anywhere in the banner does not trigger a permission prompt.
4. Add the app to the home screen (Safari's Share → Add to Home Screen),
   reopen it from the home screen icon.
5. **Expected**: the banner now shows the normal "Enable notifications"
   button; proceed with US1 steps 3-9.

## US3 — Sign-out and expiry hygiene

1. With an active web push registration (per US1), sign out.
2. **Expected**: the corresponding `push_tokens` row is deleted (same
   revocation path already used for native sign-out).
3. Simulate an expired subscription: manually revoke notification
   permission from the browser's site settings for this origin, then
   trigger a reminder evaluation targeting that (now-invalid) subscription.
4. **Expected**: the send attempt fails with a `404`/`410`, and the
   corresponding `push_tokens` row is removed — a subsequent evaluation run
   does not attempt to send to it again.

## Regression check

- Confirm the existing native (iOS/Android) push registration, local
  scheduling, and `evaluate-reminders` Expo-send path are all unaffected —
  re-run `specs/005-server-push-hardening/quickstart.md`'s existing
  scenarios against a native build/simulator if available.
