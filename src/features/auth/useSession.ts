import { useAuthContext } from "@/features/auth/AuthProvider";

export function useSession() {
  const { session, isLoading, linkError, clearLinkError, signInWithEmail, signOut } =
    useAuthContext();
  return {
    session,
    user: session?.user ?? null,
    isSignedIn: session !== null,
    isLoading,
    linkError,
    clearLinkError,
    signInWithEmail,
    signOut,
  };
}
