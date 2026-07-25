# Contract: Web Push Delivery Path in `evaluate-reminders`

Extends `specs/005-server-push-hardening/contracts/evaluate-reminders-function.md`
(unchanged for the existing Expo/native path) with a second delivery
destination for `platform = 'web'` rows.

## Rule

1. During the **Evaluation/Send phase**, `push_tokens` rows fetched for a
   candidate's user MUST be partitioned by `platform`: `'ios'`/`'android'`
   rows continue through the existing, unmodified `expoPush.ts` path;
   `'web'` rows are sent through a new `webPush.ts` adapter.
2. `webPush.ts` MUST send each web message via the standard Web Push
   protocol, VAPID-authenticated using `VAPID_PRIVATE_KEY` (a Supabase Edge
   Function secret, never logged or returned in any response) and
   `EXPO_PUBLIC_VAPID_PUBLIC_KEY`'s corresponding value.
3. The push payload sent to a web subscription MUST carry enough
   structured data (`title`, `body`, and the same `data: { ruleId,
   expenseIds, triggerKind }` shape already used for Expo messages) for the
   service worker's `push` handler (contracts/service-worker-push-contract.md)
   to render an equivalent notification to the native path.
4. On a `404` or `410` response from the push service for a given
   subscription (a `WebPushError` with that `statusCode` from the
   `web-push` library), the corresponding `push_tokens` row MUST be deleted
   immediately, synchronously with the send attempt — no separate
   receipt-check phase (research.md #4; this differs from the native path's
   `pruneStaleTokens`, which is unaffected and continues to run only
   against `platform in ('ios', 'android')` rows with a pending
   `last_ticket_id`).
5. A successfully-sent web candidate MUST still write a
   `notifications_log` row with `channel = 'server'`, identical in shape to
   the existing native path — the dedup mechanism (FR-012 of
   specs/007-tabbar-visibility-default-reminder, unaffected here) does not
   distinguish delivery platform.
6. A send failure for one user's web subscription MUST NOT prevent
   evaluation or sending from continuing for any other candidate or user in
   the same run (matches the existing per-candidate error isolation
   implied by the native path's loop structure).

## Non-goals

- No change to how candidates are computed, matched, or deduped
  (`computeDesiredNotifications`, `filterUndelivered`) — this contract
  governs only the send *destination*, not the evaluation logic.
- No change to the existing Expo/native send path, receipt-check phase, or
  its `pruneStaleTokens` behavior.
- No retry-with-backoff for a transient (non-404/410) web push failure
  within the same run — matches existing native-path behavior (edge case
  in spec.md: "not retried within the same evaluation run").

## Verification

SC-001 (delivery within one evaluation cycle) and SC-004 (expired
subscriptions removed, not retried) are checked via
[quickstart.md](../quickstart.md)'s US1/US3 manual scenarios (a real send
against a real browser subscription, and a real expired-subscription
cleanup), **not** a Jest unit test — this repo has no Deno test runner
configured, and `webPush.ts`'s direct precedent, `expoPush.ts`, has never
had a unit test either (its own HTTP-calling logic is unverified by
anything but the same kind of manual/quickstart check). Introducing new
Deno test infrastructure for this one function would be disproportionate
scope beyond what any other part of `evaluate-reminders` has; if Deno
testing is ever added project-wide, this is a natural first candidate to
backfill.
