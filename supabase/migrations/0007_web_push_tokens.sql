-- Extends push_tokens (0004_push_tokens.sql) to support Web Push
-- subscriptions alongside existing native Expo push tokens (F8).
-- Mirrors specs/008-web-push-notifications/contracts/push-tokens-web-schema.sql.

alter table push_tokens
  alter column expo_push_token drop not null;

alter table push_tokens
  drop constraint if exists push_tokens_platform_check;

alter table push_tokens
  add constraint push_tokens_platform_check
  check (platform in ('ios', 'android', 'web'));

alter table push_tokens
  add column if not exists web_endpoint text,
  add column if not exists web_p256dh text,
  add column if not exists web_auth text;

-- Exactly one shape populated per row, keyed by platform (data-model.md).
alter table push_tokens
  add constraint push_tokens_shape_check
  check (
    (platform in ('ios', 'android') and expo_push_token is not null and web_endpoint is null)
    or
    (platform = 'web' and expo_push_token is null and web_endpoint is not null and web_p256dh is not null and web_auth is not null)
  );

-- RLS policies, the user_id index, and the existing
-- (user_id, device_installation_id) uniqueness constraint are all unchanged
-- and already platform-agnostic (specs/005-server-push-hardening).
