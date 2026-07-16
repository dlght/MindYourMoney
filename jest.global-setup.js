// Expo's Babel config inlines EXPO_PUBLIC_* vars at transform time inside
// each worker process, so setting them via `setupFiles` (which runs inside
// a worker, after it has already forked) is too late. This runs in the
// parent process before workers fork and inherit its environment.
module.exports = async function globalSetup() {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  }
};
