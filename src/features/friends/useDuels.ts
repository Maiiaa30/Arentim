import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { DuelRow, DuelRespondResult } from '@/types/db';

/** Head-to-head settled-duel record vs another player (for the PlayerCard). */
export function useDuelRecord(otherId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['duel-record', user?.id, otherId] as const,
    enabled: !!user && !!otherId,
    queryFn: async (): Promise<{ wins: number; losses: number; total: number }> => {
      const { data, error } = await supabase.rpc('duel_record', { p_other: otherId });
      if (error) throw error;
      return data ?? { wins: 0, losses: 0, total: 0 };
    },
  });
}

export function useDuels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['duels', user?.id] as const,
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async (): Promise<DuelRow[]> => {
      const { data, error } = await supabase.rpc('duel_list');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDuelActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['duels', user?.id] });
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
  };

  const create = useMutation({
    mutationFn: async (input: { opponent: string; stake: number }) => {
      const { data, error } = await supabase.rpc('duel_create', { p_opponent: input.opponent, p_stake: input.stake });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  const respond = useMutation({
    mutationFn: async (input: { duelId: number; accept: boolean }): Promise<DuelRespondResult> => {
      const { data, error } = await supabase.rpc('duel_respond', { p_duel_id: input.duelId, p_accept: input.accept });
      if (error) throw error;
      return data as DuelRespondResult;
    },
    onSuccess: refresh,
  });

  const cancel = useMutation({
    mutationFn: async (duelId: number) => {
      const { error } = await supabase.rpc('duel_cancel', { p_duel_id: duelId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { create, respond, cancel };
}
