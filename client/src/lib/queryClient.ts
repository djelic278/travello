import { QueryClient, type QueryKey } from "@tanstack/react-query";

interface MutationContext {
  previousData: unknown;
  queryKey?: QueryKey;
}

declare global {
  interface Window {
    __queryClient: QueryClient;
  }
}

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
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Refresh data every 5 minutes in background
      refetchInterval: 5 * 60 * 1000,
      // Refresh data when window gains focus for real-time updates
      refetchOnWindowFocus: true,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Show stale data while fetching new data
      placeholderData: <T>(previousData: T) => previousData,
      // Refetch when component mounts
      refetchOnMount: "always",
      // Use structural sharing for better performance
      structuralSharing: true,
    },
    mutations: {
      retry: false,
      // Optimistic updates
      onMutate: async (variables): Promise<MutationContext> => {
        // Stop any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries();

        // Get the current query data
        const queryKey = Array.isArray(variables) ? variables[0] : variables;
        const previousData = queryClient.getQueryData(queryKey);

        return { previousData, queryKey };
      },
      onError: (error: Error, variables: unknown, context: unknown) => {
        // If we have previous data, roll back
        const mutationContext = context as MutationContext;
        if (mutationContext?.previousData && mutationContext.queryKey) {
          queryClient.setQueryData(mutationContext.queryKey, mutationContext.previousData);
        }
      },
      onSettled: () => {
        // Invalidate all queries after a mutation
        queryClient.invalidateQueries();
      },
    }
  },
});

// Make queryClient available globally for error boundary
if (typeof window !== 'undefined') {
  window.__queryClient = queryClient;
}