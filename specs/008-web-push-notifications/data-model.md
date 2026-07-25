# Phase 1 Data Model: Web Push Notifications for the PWA

## PushToken (Postgres: `push_tokens` table) — *existing entity, extended shape*

Extends the existing table (migration 0004, RLS unchanged) rather than
introducing a parallel table (research.md #5) — one row per user/device
regardless of platform, now including a third shape for web subscriptions.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | Unchanged |
| `user_id` | `uuid` | Unchanged |
| `device_installation_id` | `text` | Unchanged — already platform-agnostic (`getDeviceInstallationId()`, AsyncStorage-backed, works on web today via its existing web polyfill) |
| `expo_push_token` | `text`, **now nullable** | Was `not null`; now populated only for `platform in ('ios', 'android')`, `null` for `platform = 'web'` |
| `platform` | `text` | Check widened: `platform in ('ios', 'android', 'web')` |
| `web_endpoint` | `text`, nullable, **new** | The push service's subscription URL (`PushSubscription.endpoint`); populated only for `platform = 'web'` |
| `web_p256dh` | `text`, nullable, **new** | Subscription's public key (`PushSubscription.toJSON().keys.p256dh`); populated only for `platform = 'web'` |
| `web_auth` | `text`, nullable, **new** | Subscription's auth secret (`PushSubscription.toJSON().keys.auth`); populated only for `platform = 'web'` |
| `last_ticket_id` / `last_ticket_sent_at` | unchanged | Native-only concept (research.md #4) — always `null` for `platform = 'web'` rows, since web has no delayed-receipt phase |
| `created_at` / `updated_at` | unchanged | |

**New validation rule** (check constraint): exactly one shape populated per
row —
```sql
(platform in ('ios', 'android') and expo_push_token is not null and web_endpoint is null)
or
(platform = 'web' and expo_push_token is null and web_endpoint is not null and web_p256dh is not null and web_auth is not null)
```

**Relationships**: unchanged — many `PushToken` rows per user (one per
device, any platform), `unique (user_id, device_installation_id)` unchanged
and still enforced across all three platform values.

**State transitions**:
- Created on: web permission grant → subscribe → upsert (new), mirroring the
  existing native "permission already granted → register" transition.
- Removed on: sign-out (existing `deletePushToken`, unchanged, already
  platform-agnostic), or the push service reporting the subscription gone
  (`404`/`410` on send, research.md #4 — new for web, conceptually parallel
  to the native `DeviceNotRegistered` receipt-driven prune).

## VapidKeyPair *(new — configuration, not a database entity)*

Not a table — an application-server credential.

| Part | Where stored | Sensitivity |
|---|---|---|
| Public key | `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (client env, `.env`/`.env.example`) | Not sensitive — shipped to every client by design |
| Private key | `VAPID_PRIVATE_KEY` (Supabase Edge Function secret) | Sensitive — never leaves the server, never committed |

## Reminder / Rule / Expense *(existing entities, unmodified)*

Referenced only via the existing, unchanged `computeDesiredNotifications` →
`notifications_log` dedup path; `evaluate-reminders`'s send phase now
branches the *destination* (Expo vs. Web Push) by the matched
`push_tokens.platform`, with no change to which candidates are computed or
how they're deduped.
