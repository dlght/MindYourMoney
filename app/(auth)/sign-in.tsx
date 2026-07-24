import { useState } from "react";
import { Platform, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";

type Mode = "sign-in" | "sign-up";
type ScreenState = "idle" | "submitting" | "awaiting-confirmation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function SignInScreen() {
  const { signIn, signUp, authError, clearAuthError } = useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<ScreenState>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const toggleMode = () => {
    setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
    setFormError(null);
    clearAuthError();
  };

  const handleSubmit = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setFormError(null);
    setState("submitting");

    if (mode === "sign-in") {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setFormError(error);
        setState("idle");
        return;
      }
      // Successful sign-in triggers the SIGNED_IN event; the root layout
      // routes away from this screen once the session lands.
      return;
    }

    const { error, needsEmailConfirmation } = await signUp(email.trim(), password);
    if (error) {
      setFormError(error);
      setState("idle");
      return;
    }
    if (needsEmailConfirmation) {
      setState("awaiting-confirmation");
      return;
    }
    // Confirmation is disabled on the Supabase project: signUp returns a
    // session directly and the SIGNED_IN event routes away from here.
  };

  const displayError = formError ?? authError;

  if (state === "awaiting-confirmation") {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 items-center justify-center gap-3 px-6"
        >
          <Text className="text-center text-lg font-semibold text-slate-900 dark:text-white">
            Confirm your email
          </Text>
          <Text className="text-center text-slate-600 dark:text-slate-400">
            We sent a confirmation link to {email.trim()}. Open it, then come back and sign in.
          </Text>
          <Pressable
            onPress={() => {
              setState("idle");
              setMode("sign-in");
            }}
            accessibilityRole="button"
          >
            <Text className="font-medium text-indigo-600 dark:text-indigo-400">Back to sign in</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center gap-4 px-6"
      >
      <Text className="text-2xl font-semibold text-slate-900 dark:text-white">
        MindYourMoney
      </Text>
      <Text className="text-center text-slate-600 dark:text-slate-400">
        {mode === "sign-in" ? "Sign in with your email and password." : "Create an account to get started."}
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-700 dark:text-white"
        accessibilityLabel="Email address"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-700 dark:text-white"
        accessibilityLabel="Password"
      />
      {displayError ? <Text className="text-red-600 dark:text-red-400">{displayError}</Text> : null}
      <Pressable
        onPress={handleSubmit}
        disabled={state === "submitting"}
        className="w-full items-center rounded-lg bg-indigo-600 px-4 py-3 disabled:opacity-60"
        accessibilityRole="button"
      >
        {state === "submitting" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-medium text-white">
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Text>
        )}
      </Pressable>
      <Pressable onPress={toggleMode} accessibilityRole="button">
        <Text className="font-medium text-indigo-600 dark:text-indigo-400">
          {mode === "sign-in" ? "Don't have an account? Create one" : "Already have an account? Sign in"}
        </Text>
      </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
