import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { VideoSlotResult } from './videoSlot';

/** Invalidate the wallet + transaction caches after a settled round. */
function useInvalidateWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };
}

/**
 * Fortuna de Ouro — spin the 5×3, 9-payline video slot. Stake only; the server
 * draws five reel stops with a CSPRNG and settles authoritatively.
 */
export function useVideoSlot() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<VideoSlotResult> => {
      const { data, error } = await supabase.rpc('play_video_slot', {
        p_stake: stake,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
