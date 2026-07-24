import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "mindyourmoney.deviceInstallationId";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

let cached: string | null = null;

// Stable per-install identifier backing push_tokens.device_installation_id
// (data-model.md) — not a security token, just enough to tell one device
// apart from another for the same user, so a random non-cryptographic id
// generated once and persisted locally is sufficient.
export async function getDeviceInstallationId(): Promise<string> {
  if (cached) {
    return cached;
  }

  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const generated = generateId();
  await AsyncStorage.setItem(STORAGE_KEY, generated);
  cached = generated;
  return generated;
}
