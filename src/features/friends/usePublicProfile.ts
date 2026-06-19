import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PublicProfile } from '@/types/db';

/** Safe public stat card for any player (used by the leaderboard popup). */
export function usePublicProfile(userId: string | null) {
  return useQuery({
    queryKey: ['public-profile', userId] as const,
    enabled: !!userId,
    queryFn: async (): Promise<PublicProfile | null> => {
      const { data, error } = await supabase.rpc('public_profile', { p_user: userId! });
      if (error) throw error;
      return data;
    },
  });
}
