import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useInvalidateWallet } from '@/features/wallet/useInvalidateWallet';
import type { PlinkoResult, PlinkoRisk, PlinkoRows } from './plinko';

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
