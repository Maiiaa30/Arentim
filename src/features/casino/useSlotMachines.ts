import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { Profile, SlotMachineMeta, SlotSpinResult } from '@/types/db';

/** The slots floor — every machine's sanitized config (jackpot value masked). */
export function useSlotMachines() {
  return useQuery({
    queryKey: ['slot-machines'] as const,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<SlotMachineMeta[]> => {
      const { data, error } = await supabase.rpc('list_slot_machines');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Spin a chosen machine. The server rolls; we only render the outcome. */
export function usePlaySlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    // Routine spin — don't flash the global top loading bar on every bet.
    meta: { silent: true },
    mutationFn: async (v: { machine: string; stake: number }): Promise<SlotSpinResult> => {
      const { data, error } = await supabase.rpc('play_slot', {
        p_machine: v.machine,
        p_stake: v.stake,
        p_idempotency_key: crypto.randomUUID(),
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
    },
  });
}
