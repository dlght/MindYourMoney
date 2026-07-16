import { supabase } from "@/lib/supabase";

export interface SessionFromUrlResult {
  handled: boolean;
  error: string | null;
}

/**
 * Parses a Supabase magic-link redirect URL and either establishes a
 * session or extracts the reason it couldn't (e.g. an expired/used link).
 * Supabase's `detectSessionInUrl` is a no-op on React Native (it reads
 * `window.location`, which doesn't exist here), so this replaces it.
 */
export async function createSessionFromUrl(url: string): Promise<SessionFromUrlResult> {
  const [, paramString] = url.split("#");
  const params = new URLSearchParams(paramString ?? url.split("?")[1] ?? "");

  const errorCode = params.get("error_code");
  const errorDescription = params.get("error_description");
  if (errorCode) {
    return {
      handled: true,
      error: errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "This sign-in link is no longer valid.",
    };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { handled: true, error: error?.message ?? null };
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { handled: true, error: error?.message ?? null };
  }

  return { handled: false, error: null };
}
