import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { BuyTicketsResult, RaffleState } from '@/types/db';

const raffleKey = ['raffle'] as const;

/** Current open raffle (lazily drawn/rolled over) + my tickets + recent winners. */
export function useRaffle() {
  const { user } = useAuth();
  return useQuery({
    queryKey: raffleKey,
    enabled: !!user,
    // Modest poll: the draw happens lazily; this is enough to catch it while on the page.
    refetchInterval: 20_000,
    queryFn: async (): Promise<RaffleState> => {
      const { data, error } = await supabase.rpc('raffle_current');
      if (error) throw error;
      return data;
    },
  });
}

/** Buys N tickets in the current raffle. */
export function useBuyTickets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (qty: number): Promise<BuyTicketsResult> => {
      const { data, error } = await supabase.rpc('buy_raffle_tickets', { p_qty: qty });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: raffleKey });
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });
}
