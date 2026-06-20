import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { RouletteRoomState, RouletteRoomBetRow, RouletteBetPayload } from '@/types/db';

const POLL_MS = 400;

/**
 * Drives the shared Roulette table: polls roulette_room_now() (number masked
 * until betting closes), mirrors every player's slip live via Realtime, and
 * exposes the place-slip mutation. Everyone sees the same wheel land together.
 */
export function useRouletteRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<RouletteRoomState | null>(null);
  const [roomBets, setRoomBets] = useState<RouletteRoomBetRow[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { data } = await supabase.rpc('roulette_room_now');
        if (!cancelled && data) setState(data as RouletteRoomState);
      } finally {
        inFlight.current = false;
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const roomId = state?.room_id ?? null;

  useEffect(() => {
    if (roomId == null) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from('roulette_room_bets')
        .select('*')
        .eq('room_id', roomId)
        .order('stake', { ascending: false });
      if (active && data) setRoomBets(data as RouletteRoomBetRow[]);
    };
    void load();
    const ch = supabase
      .channel(`roulette_bets:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roulette_room_bets', filter: `room_id=eq.${roomId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Refresh the recent-numbers strip whenever a round finishes.
  const doneRound = state?.status === 'done' ? roomId : 0;
  useEffect(() => {
    void supabase.rpc('roulette_room_history').then(({ data }) => {
      if (Array.isArray(data)) setHistory(data.map(Number));
    });
  }, [doneRound]);

  const placeBet = useMutation({
    mutationFn: async (bets: RouletteBetPayload[]) => {
      if (roomId == null) throw new Error('Sala indisponível.');
      const { data, error } = await supabase.rpc('roulette_room_bet', { p_room_id: roomId, p_bets: bets });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKey(user?.id) }),
  });

  return { state, roomBets, history, placeBet };
}
