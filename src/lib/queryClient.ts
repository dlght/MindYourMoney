import { QueryClient } from "@tanstack/react-query";

// networkMode "offlineFirst" + a long gcTime lets the last-fetched result
// render immediately on app open regardless of connectivity (constitution
// IV — offline-tolerant by default), while still refreshing in the
// background once a network is available.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});
