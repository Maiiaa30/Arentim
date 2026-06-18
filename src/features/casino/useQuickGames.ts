import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { CoinSide } from './coinflip';
import type { CoinflipResult, SlotsResult } from '@/types/db';

function useInvalidateWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };
}

/** Coin-flip: pick a side, stake, server flips with a CSPRNG. */
export function useCoinflip() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; choice: CoinSide }): Promise<CoinflipResult> => {
      const { data, error } = await supabase.rpc('play_coinflip', {
        p_stake: input.stake,
        p_choice: input.choice,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Slots: stake, server spins three reels with a CSPRNG. */
export function useSlots() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<SlotsResult> => {
      const { data, error } = await supabase.rpc('play_slots', {
        p_stake: stake,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
