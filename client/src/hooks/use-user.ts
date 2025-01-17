import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SelectUser } from "@db/schema";

type RequestResult = {
  message: string;
  user?: SelectUser;
};

async function handleRequest(
  url: string,
  method: string,
  body?: { username: string; password: string; email?: string }
): Promise<RequestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }

    return response.json();
  } catch (error: any) {
    throw new Error(error.message || 'An error occurred');
  }
}

export function useUser() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<SelectUser>({
    queryKey: ['/api/user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          throw new Error(await response.text());
        }

        return response.json();
      } catch (error: any) {
        console.error('Error fetching user:', error);
        return null;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: (userData: { username: string; password: string }) =>
      handleRequest('/api/login', 'POST', userData),
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (userData: { username: string; password: string; email: string }) =>
      handleRequest('/api/register', 'POST', userData),
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/logout', 'POST'),
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
    },
  });

  return {
    user,
    isLoading,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
  };
}