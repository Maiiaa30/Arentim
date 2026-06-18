import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { RouletteBet } from './roulette';
import type { RouletteSpinResult } from '@/types/db';

/**
 * Places a slip of roulette bets. The server (play_roulette RPC) validates,
 * spins with a CSPRNG, settles atomically and returns the authoritative result.
 * A fresh idempotency key per attempt makes retries safe (no double settlement).
 */
export function useRoulette() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (bets: RouletteBet[]): Promise<RouletteSpinResult> => {
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.rpc('play_roulette', {
        p_bets: bets.map((b) => ({ kind: b.kind, selection: b.selection, stake: b.stake })),
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });
}
