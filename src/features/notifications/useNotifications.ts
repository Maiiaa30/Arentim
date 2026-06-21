import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { NotificationRow } from '@/types/db';

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase.rpc('list_notifications', { p_limit: 30 });
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications-unread', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('notifications_unread_count');
      if (error) throw error;
      return data ?? 0;
    },
  });
}

export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: number[]) => {
      const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread', user?.id] });
    },
  });
}
