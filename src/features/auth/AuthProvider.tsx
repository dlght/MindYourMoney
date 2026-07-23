import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { seedCategories } from "@/features/categories/seedCategories";

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
        // never block the sign-in transition from completing.
        seedCategories(nextSession.user.id).catch((error) => {
          console.error("Failed to seed default categories", error);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
