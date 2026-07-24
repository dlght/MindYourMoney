-- Fix-forward: managed Postgres does not grant ALTER DATABASE ... SET
-- privileges for custom GUCs to the role available via the CLI/Management
-- API (discovered when applying 0004 — "permission denied to set parameter
-- app.cron_secret"), so the evaluate-reminders cron job's secret moves to
-- Supabase Vault instead, the platform-supported mechanism for secrets
-- referenced from SQL/pg_cron. The secret VALUE itself is created
-- separately (not in this file — never commit a real secret to git); this
-- migration only re-points the existing cron job at
-- vault.decrypted_secrets by name.

select cron.alter_job(
  (select jobid from cron.job where jobname = 'evaluate-reminders-daily'),
  command := $$
  select net.http_post(
    url := 'https://tvbyqwnwlrlsxvgemwls.supabase.co/functions/v1/evaluate-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $$
);
