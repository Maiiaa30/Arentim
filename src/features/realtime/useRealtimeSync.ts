import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { Profile } from '@/types/db';

/**
 * One realtime channel for the signed-in user that keeps the UI fresh WITHOUT a
 * page reload. RLS still governs which rows arrive (own friendships / own
 * notifications / own profile row).
 *
 * - friendships (as addressee OR requester) → refresh friend lists + requests + bell
 * - notifications (mine)                    → refresh the bell
 * - profiles (my row)                       → push the new balance/stats straight in
 *
 * Mounted once, high in the tree (AppLayout). Postgres-changes filters can only
 * test a single column, so friendships needs two subscriptions (one per side).
 */
export function useRealtimeSync(): void {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const uid = user.id;

    const refreshFriends = () => {
      void qc.invalidateQueries({ queryKey: ['friends', uid] });
      void qc.invalidateQueries({ queryKey: ['friend-requests', uid] });
    };
    const refreshNotifs = () => {
      void qc.invalidateQueries({ queryKey: ['notifications', uid] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread', uid] });
    };

    const channel = supabase
      .channel(`sync:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${uid}` },
        () => {
          refreshFriends();
          refreshNotifs();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${uid}` },
        () => {
          refreshFriends();
          refreshNotifs();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => refreshNotifs(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        (payload) => {
          const next = payload.new as Profile;
          if (next && typeof next.balance === 'number') {
            qc.setQueryData(profileKey(uid), next);
          } else {
            void qc.invalidateQueries({ queryKey: profileKey(uid) });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);
}
