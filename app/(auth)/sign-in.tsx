import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useSession } from "@/features/auth/useSession";

type ScreenState = "idle" | "sending" | "sent" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { signInWithEmail, linkError, clearLinkError } = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ScreenState>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    setFormError(null);
    setState("sending");
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setFormError(error);
      setState("error");
      return;
    }
    setState("sent");
  };

  const handleRequestNewLink = () => {
    clearLinkError();
    setState("idle");
  };

  if (linkError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-slate-900">
        <Text className="text-center text-lg font-semibold text-slate-900 dark:text-white">
          This sign-in link is no longer valid
        </Text>
        <Text className="text-center text-slate-600 dark:text-slate-400">{linkError}</Text>
        <Pressable
          onPress={handleRequestNewLink}
          className="rounded-lg bg-indigo-600 px-4 py-3"
          accessibilityRole="button"
        >
          <Text className="font-medium text-white">Request a new link</Text>
        </Pressable>
      </View>
    );
  }

  if (state === "sent") {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white px-6 dark:bg-slate-900">
        <Text className="text-center text-lg font-semibold text-slate-900 dark:text-white">
          Check your email
        </Text>
        <Text className="text-center text-slate-600 dark:text-slate-400">
          We sent a sign-in link to {email.trim()}. Open it on this device to continue.
        </Text>
        <Pressable onPress={() => setState("idle")} accessibilityRole="button">
          <Text className="font-medium text-indigo-600 dark:text-indigo-400">
            Use a different email
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-slate-900">
      <Text className="text-2xl font-semibold text-slate-900 dark:text-white">
        MindYourMoney
      </Text>
      <Text className="text-center text-slate-600 dark:text-slate-400">
        Enter your email and we'll send you a sign-in link — no password needed.
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
      {formError ? <Text className="text-red-600 dark:text-red-400">{formError}</Text> : null}
      <Pressable
        onPress={handleSubmit}
        disabled={state === "sending"}
        className="w-full items-center rounded-lg bg-indigo-600 px-4 py-3 disabled:opacity-60"
        accessibilityRole="button"
      >
        {state === "sending" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-medium text-white">Send sign-in link</Text>
        )}
      </Pressable>
    </View>
  );
}
