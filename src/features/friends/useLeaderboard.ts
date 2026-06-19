import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LeaderboardRow } from '@/types/db';

export type LeaderboardScope = 'global' | 'friends';
export type LeaderboardMetric = 'net' | 'biggest_win' | 'streak';

export function useLeaderboard(scope: LeaderboardScope, metric: LeaderboardMetric) {
  return useQuery({
    queryKey: ['leaderboard', scope, metric] as const,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('leaderboard', { p_scope: scope, p_metric: metric });
      if (error) throw error;
      return data;
    },
  });
}
