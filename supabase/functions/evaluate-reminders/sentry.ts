// Sentry Deno init + Cron Monitor check-in wrapper (research.md #5, FR-010).
// A missed/failed check-in alerts the maintainer without a bespoke
// "evaluation run" table — see data-model.md's note on this.
import * as Sentry from "npm:@sentry/deno@8";

const MONITOR_SLUG = "evaluate-reminders-daily";

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN");
  if (dsn) {
    Sentry.init({ dsn, tracesSampleRate: 0 });
  }
  initialized = true;
}

/**
 * Runs `fn` as a monitored cron check-in: reports "in_progress" before,
 * "ok" after a clean return, "error" (plus the exception) if `fn` throws —
 * then rethrows so the caller still returns a non-200 response.
 */
export async function withCronMonitor<T>(fn: () => Promise<T>): Promise<T> {
  ensureInit();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: MONITOR_SLUG, status: "in_progress" });

  try {
    const result = await fn();
    Sentry.captureCheckIn({ checkInId, monitorSlug: MONITOR_SLUG, status: "ok" });
    return result;
  } catch (error) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: MONITOR_SLUG, status: "error" });
    Sentry.captureException(error);
    await Sentry.flush(2000);
    throw error;
  }
}
