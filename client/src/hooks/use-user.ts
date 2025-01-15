import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertUser, SelectUser } from "@db/schema";

type RequestResult = {
  message: string;
  user?: { id: number; username: string; isAdmin?: boolean };
};

async function handleRequest(
  url: string,
  method: string,
  body?: { username: string; password: string }
): Promise<RequestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error(response.statusText);
      }

      throw new Error(await response.text());
    }

    return response.json();
  } catch (e: any) {
    throw new Error(e.message);
  }
}

export function useUser() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<SelectUser>({
    queryKey: ['/api/user'],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (userData: { username: string; password: string }) =>
      handleRequest('/api/login', 'POST', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (userData: { username: string; password: string }) =>
      handleRequest('/api/register', 'POST', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/logout', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
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
