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
      // Set stale time to 5 minutes for expense data
      staleTime: 5 * 60 * 1000,
      // Refresh data every 5 minutes
      refetchInterval: 5 * 60 * 1000,
      // Still refetch on window focus for real-time updates when user returns
      refetchOnWindowFocus: true,
      // Retry failed requests 3 times
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Show stale data while fetching
      placeholderData: undefined,
      // Ensure data is fetched on mount
      refetchOnMount: "always",
    },
    mutations: {
      retry: false,
    }
  },
});