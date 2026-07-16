import React, { createContext, useContext, useEffect, useState } from "react";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { createSessionFromUrl } from "@/features/auth/createSessionFromUrl";
import { seedCategories } from "@/features/categories/seedCategories";

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  linkError: string | null;
  clearLinkError: () => void;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

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

    const handleUrl = ({ url }: { url: string }) => {
      createSessionFromUrl(url).then((result) => {
        if (result.error) setLinkError(result.error);
      });
    };

    const linkingSubscription = Linking.addEventListener("url", handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signInWithEmail = async (email: string) => {
    setLinkError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "mindyourmoney://",
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const clearLinkError = () => setLinkError(null);

  return (
    <AuthContext.Provider
      value={{ session, isLoading, linkError, clearLinkError, signInWithEmail, signOut }}
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
