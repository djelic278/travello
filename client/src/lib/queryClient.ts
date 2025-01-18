import { QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Error handler function to format error messages
const formatErrorMessage = (error: any): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};

// Create a new query client with enhanced error handling and retry logic
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          const res = await fetch(queryKey[0] as string, {
            credentials: "include",
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            }
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorText = await res.text();
            if (res.status >= 500) {
              throw new Error(`Server Error (${res.status}): ${errorText}`);
            }
            throw new Error(errorText || `Error ${res.status}: ${res.statusText}`);
          }

          return res.json();
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
          }
          throw error;
        }
      },
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('Error 4')) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      onError: (error) => {
        toast({
          title: "Error",
          description: formatErrorMessage(error),
          variant: "destructive",
        });
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('Error 4')) {
          return false;
        }
        // Retry once for other errors
        return failureCount < 1;
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: formatErrorMessage(error),
          variant: "destructive",
        });
      },
    }
  },
});