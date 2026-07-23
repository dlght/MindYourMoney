import { useAuthContext } from "@/features/auth/AuthProvider";

export function useSession() {
  const { session, isLoading, authError, clearAuthError, signIn, signUp, signOut } =
    useAuthContext();
  return {
    session,
    user: session?.user ?? null,
    isSignedIn: session !== null,
    isLoading,
    authError,
    clearAuthError,
    signIn,
    signUp,
    signOut,
  };
}
