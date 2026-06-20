import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { RouletteBet } from './roulette';
import type { Profile, RouletteSpinResult } from '@/types/db';

/** The most recent landed numbers (persisted in game_rounds) — "últimos
 *  resultados", so the history survives a page reload. */
export function useRecentRoulette() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['roulette', 'recent', user?.id] as const,
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('outcome')
        .eq('game', 'roulette')
        .order('created_at', { ascending: false })
        .limit(18)
        .returns<{ outcome: { number?: number } | null }[]>();
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.outcome?.number)
        .filter((n): n is number => typeof n === 'number');
    },
  });
}

/**
 * Places a slip of roulette bets. The server (play_roulette RPC) validates,
 * spins with a CSPRNG, settles atomically and returns the authoritative result.
 * A fresh idempotency key per attempt makes retries safe (no double settlement).
 */
export function useRoulette() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    // Routine spin — don't flash the global top loading bar on every bet.
    meta: { silent: true },
    mutationFn: async (bets: RouletteBet[]): Promise<RouletteSpinResult> => {
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.rpc('play_roulette', {
        p_bets: bets.map((b) => ({ kind: b.kind, selection: b.selection, stake: b.stake })),
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      // Patch the cached balance from the authoritative result instead of
      // refetching, so the spin doesn't trigger a loading sheen.
      qc.setQueryData<Profile>(profileKey(user?.id), (old) =>
        old ? { ...old, balance: res.balance } : old,
      );
      void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
      void qc.invalidateQueries({ queryKey: ['roulette', 'recent', user?.id] });
    },
  });
}
