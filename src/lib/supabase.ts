import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Supabase's client-side key (formerly "anon key") — safe to ship in the
// app bundle; access is enforced by each table's RLS policy, not by this
// key's secrecy.
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill in your Supabase project values."
  );
}

// SecureStore only stores strings up to ~2KB per key on some platforms and
// has no multi-get; Supabase's storage interface is a simple async
// key/value contract so this adapter is sufficient for a single session blob.
const secureStoreAdapter: SupportedStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// expo-secure-store has no web implementation; localStorage is the standard
// web equivalent for a session blob (PWA conversion). Known platform
// limitation, not a bug here: Safari's Intelligent Tracking Prevention can
// clear localStorage after ~7 days of no interaction unless the PWA has
// been added to the home screen, in which case storage persists normally.
const webStorageAdapter: SupportedStorage = {
  getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: Platform.OS === "web" ? webStorageAdapter : secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
