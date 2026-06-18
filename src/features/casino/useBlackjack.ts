import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { BlackjackView } from '@/types/db';

type Action = 'hit' | 'stand' | 'double' | 'split';

/** Fetches any in-progress hand so a reload resumes mid-game. */
export function useBlackjackCurrent() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['blackjack', 'current', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<BlackjackView | null> => {
      const { data, error } = await supabase.rpc('bj_current');
      if (error) throw error;
      return data;
    },
  });
}

export function useBlackjack() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };

  const deal = useMutation({
    mutationFn: async (stake: number): Promise<BlackjackView> => {
      const { data, error } = await supabase.rpc('bj_deal', { p_stake: stake });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  const act = useMutation({
    mutationFn: async (input: { handId: number; action: Action }): Promise<BlackjackView> => {
      const { data, error } = await supabase.rpc('bj_action', {
        p_hand_id: input.handId,
        p_action: input.action,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  return { deal, act };
}
