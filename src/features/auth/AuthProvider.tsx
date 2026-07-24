import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react-native";
import { supabase } from "@/lib/supabase";
import { seedCategories } from "@/features/categories/seedCategories";
import { seedRules } from "@/features/rules/seedRules";
import { usePushRegistration } from "@/features/push/usePushRegistration";
import { deletePushToken } from "@/features/push/pushTokenApi";
import { getDeviceInstallationId } from "@/lib/deviceId";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bounded retry (not indefinite — sign-out must still complete promptly) for
// a call whose failure has a real privacy consequence (self-critique F2): a
// transient network blip should not be enough to leave a device's push
// registration pointing at a user who just signed out. A same-token
// registration by a later sign-in on this device is the backstop for
// anything this retry still can't recover from (0006_push_token_reassignment.sql).
async function withRetries(fn: () => Promise<void>, delaysMs: number[]): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      await fn();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < delaysMs.length) {
        await delay(delaysMs[attempt]);
      }
    }
  }
  throw lastError;
}

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const registerPush = usePushRegistration();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      if (event === "SIGNED_IN" && nextSession?.user) {
        // Fire-and-forget: seeding is idempotent (research.md #5) and must
        // never block the sign-in transition from completing. Push
        // registration (F5, FR-001) is a no-op until permission has already
        // been granted elsewhere, so it's equally safe to fire-and-forget.
        seedCategories(nextSession.user.id).catch((error) => {
          console.error("Failed to seed default categories", error);
        });
        seedRules(nextSession.user.id).catch((error) => {
          console.error("Failed to seed default rules", error);
        });
        registerPush(nextSession.user.id).catch((error) => {
          console.error("Failed to register device for push notifications", error);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [registerPush]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    // If email confirmation is enabled on the Supabase project, signUp
    // succeeds but returns no session until the user confirms.
    return { error: null, needsEmailConfirmation: data.session === null };
  };

  const signOut = async () => {
    // Revoke this device's push registration before the session goes away
    // (FR-007) so a subsequent different user signing into this same
    // device never receives the outgoing user's reminders. Retried (not a
    // single best-effort attempt, self-critique F2) since this delete
    // requires the about-to-end session's own RLS scope — once
    // supabase.auth.signOut() completes, there is no going back and
    // retrying it later as this user.
    const userId = session?.user.id;
    if (userId) {
      try {
        const deviceId = await getDeviceInstallationId();
        await withRetries(() => deletePushToken(userId, deviceId), [250, 750]);
      } catch (error) {
        console.error("Failed to revoke push registration on sign-out", error);
        Sentry.captureException(error, { extra: { context: "signOut push token revoke" } });
      }
    }
    await supabase.auth.signOut();
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{ session, isLoading, authError, clearAuthError, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
