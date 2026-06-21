import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { PlinkoResult, PlinkoRisk, PlinkoRows } from './plinko';

function useInvalidateWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };
}

/** Plinko: drop a ball through `rows` peg rows at a chosen risk; server settles. */
export function usePlinko() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; rows: PlinkoRows; risk: PlinkoRisk }): Promise<PlinkoResult> => {
      const { data, error } = await supabase.rpc('play_plinko', {
        p_stake: input.stake,
        p_rows: input.rows,
        p_risk: input.risk,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
