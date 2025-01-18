import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error(`${res.status}: ${res.statusText}`);
          }

          throw new Error(`${res.status}: ${await res.text()}`);
        }

        return res.json();
      },
      // Refetch data if it's older than 30 seconds
      staleTime: 30 * 1000,
      // Enable automatic background refetching
      refetchInterval: 60 * 1000, // Refetch every minute
      // Enable refetch on window focus with a cooldown
      refetchOnWindowFocus: true,
      refetchOnWindowFocusDelay: 5000, // Wait 5s before refetching on focus
      // Retry failed requests 3 times
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Show stale data while fetching
      keepPreviousData: true,
    },
    mutations: {
      retry: false,
    }
  },
});