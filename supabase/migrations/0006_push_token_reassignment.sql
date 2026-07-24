-- Fix-forward (self-critique F2, post-005): AuthProvider.signOut() best-effort
-- deletes this device's push_tokens row before ending the session, but that
-- delete can silently fail (network blip) with only a console.error — no
-- retry, and nothing surfaces it since no maintainer alerting exists yet.
-- If it fails, a second user signing into the same device would previously
-- keep receiving the first user's reminders on the same physical
-- expo_push_token indefinitely, since the stale row is never cleaned up.
--
-- A push token is physically tied to one device installation, so whoever
-- registers it most recently is its legitimate current owner — this trigger
-- makes that self-healing on the very next sign-in on that device,
-- regardless of whether the previous sign-out's revoke succeeded. It closes
-- the gap client-side retry alone cannot (a client can never retry a delete
-- of another user's row past its own RLS scope).
--
-- security definer (unlike mark_expense_paid's security invoker, F2) is a
-- deliberate, first-of-its-kind exception here: this function must cross
-- the ownership boundary RLS otherwise enforces, specifically to remove a
-- *different* user's now-superseded row — the same trust boundary already
-- accepted for the evaluate-reminders Edge Function's service-role access
-- (0004_push_tokens.sql), now extended to one narrowly-scoped trigger.
create or replace function reassign_push_token() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from push_tokens
    where expo_push_token = new.expo_push_token
      and user_id <> new.user_id;
  return new;
end;
$$;

create trigger push_tokens_reassign_before_upsert
  before insert or update of expo_push_token on push_tokens
  for each row
  execute function reassign_push_token();
