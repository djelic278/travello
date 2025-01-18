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
      // Reduce stale time to ensure fresh data on first load
      staleTime: 5000, // 5 seconds
      // Enable automatic background refetching
      refetchInterval: 30000, // Refetch every 30 seconds
      // Enable immediate refetch on window focus
      refetchOnWindowFocus: true,
      // Retry failed requests 3 times
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Show stale data while fetching
      keepPreviousData: true,
      // Ensure data is fetched on mount
      refetchOnMount: "always",
    },
    mutations: {
      retry: false,
    }
  },
});