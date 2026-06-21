import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { BalatroState, BalatroPlayResult, BalatroDiscardResult } from './balatro';

function useInvalidateWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };
}

/** Balatró: stake a blind — debit + deal a fresh hidden deck and 8-card hand. */
export function useBalatroStart() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<BalatroState> => {
      const { data, error } = await supabase.rpc('balatro_start', { p_stake: stake });
      if (error) throw error;
      return data as BalatroState;
    },
    onSuccess: invalidate,
  });
}

/** Balatró: play 1–5 selected cards (scores, costs a hand). */
export function useBalatroPlay() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (cards: number[]): Promise<BalatroPlayResult> => {
      const { data, error } = await supabase.rpc('balatro_play', { p_cards: cards });
      if (error) throw error;
      return data as BalatroPlayResult;
    },
    onSuccess: invalidate,
  });
}

/** Balatró: discard 1–5 selected cards (no score, costs a discard). */
export function useBalatroDiscard() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (cards: number[]): Promise<BalatroDiscardResult> => {
      const { data, error } = await supabase.rpc('balatro_discard', { p_cards: cards });
      if (error) throw error;
      return data as BalatroDiscardResult;
    },
    onSuccess: invalidate,
  });
}

/** Balatró: resume the live round (masked state) or null if none. */
export function useBalatroCurrent() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['balatro_current', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BalatroState | null> => {
      const { data, error } = await supabase.rpc('balatro_current');
      if (error) throw error;
      return (data as BalatroState | null) ?? null;
    },
  });
}
