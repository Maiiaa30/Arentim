import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { OnzeLeaderboardRow } from '@/types/db';

export type OnzeScope = 'global' | 'friends';

/** Today's Onze de Ouro leaderboard (friends or global). */
export function useOnzeLeaderboard(scope: OnzeScope) {
  return useQuery({
    queryKey: ['onze-leaderboard', scope] as const,
    queryFn: async (): Promise<OnzeLeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('onze_leaderboard', { p_scope: scope });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface OnzeSubmission {
  score: number;
  rating: number;
  wins: number;
  champion: boolean;
  record: string;
  formation: string;
  xi: string[]; // player ids
}

/** Submit the daily ranked run (server keeps your best for the day). */
export function useSubmitOnzeScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: OnzeSubmission): Promise<{ best: number }> => {
      const { data, error } = await supabase.rpc('submit_onze_score', {
        p_score: s.score,
        p_rating: s.rating,
        p_wins: s.wins,
        p_champion: s.champion,
        p_record: s.record,
        p_formation: s.formation,
        p_xi: s.xi,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onze-leaderboard'] });
    },
  });
}
