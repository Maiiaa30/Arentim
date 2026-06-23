import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LeaderboardRow } from '@/types/db';

export type LeaderboardScope = 'global' | 'friends';
export type LeaderboardMetric = 'net' | 'biggest_win' | 'streak';

export function useLeaderboard(scope: LeaderboardScope, metric: LeaderboardMetric) {
  return useQuery({
    queryKey: ['leaderboard', scope, metric] as const,
    // Keep the board live as players wager/win/lose (it was static until remount).
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('leaderboard', { p_scope: scope, p_metric: metric });
      if (error) throw error;
      return data;
    },
  });
}

/** Current-month gaming P&L ranking (resets on the 1st). */
export function useSeasonLeaderboard(scope: LeaderboardScope, enabled: boolean) {
  return useQuery({
    queryKey: ['season-leaderboard', scope] as const,
    enabled,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('season_leaderboard', { p_scope: scope });
      if (error) throw error;
      return data;
    },
  });
}
