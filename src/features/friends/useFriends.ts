import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { FriendRequest, FriendRow, UserSearchResult } from '@/types/db';

export function useFriends() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friends', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<FriendRow[]> => {
      const { data, error } = await supabase.rpc('list_friends');
      if (error) throw error;
      return data;
    },
  });
}

export function useFriendRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['friend-requests', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<FriendRequest[]> => {
      const { data, error } = await supabase.rpc('list_friend_requests');
      if (error) throw error;
      return data;
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['user-search', query] as const,
    enabled: query.trim().length >= 2,
    queryFn: async (): Promise<UserSearchResult[]> => {
      const { data, error } = await supabase.rpc('search_users', { p_query: query.trim() });
      if (error) throw error;
      return data;
    },
  });
}

export function useFriendActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['friends', user?.id] });
    void qc.invalidateQueries({ queryKey: ['friend-requests', user?.id] });
  };

  const sendRequest = useMutation({
    mutationFn: async (addressee: string): Promise<string> => {
      const { data, error } = await supabase.rpc('send_friend_request', { p_addressee: addressee });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  const respond = useMutation({
    mutationFn: async (input: { requestId: number; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_friend_request', {
        p_request_id: input.requestId,
        p_accept: input.accept,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (other: string) => {
      const { error } = await supabase.rpc('remove_friend', { p_other: other });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { sendRequest, respond, remove };
}

/** Gift Tostões to a friend (atomic transfer via the gift_tos RPC). */
export function useGiftTos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { to: string; amount: number }) => {
      const { data, error } = await supabase.rpc('gift_tos', { p_to: input.to, p_amount: input.amount });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['friends', user?.id] });
    },
  });
}
