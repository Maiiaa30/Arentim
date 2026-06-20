import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { CrashRoomState, CrashBetRow, CrashRoomCashoutResult } from '@/types/db';

const POLL_MS = 250;

/**
 * Drives the shared Crash room: polls crash_room_now() (the authoritative,
 * crash-point-masked snapshot) every 250 ms, mirrors the round's bets live via
 * Realtime, and exposes bet / cash-out mutations. Every client computes the same
 * rocket from the same server-stamped fly_start_at, so everyone is in sync.
 */
export function useCrashRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<CrashRoomState | null>(null);
  const [bets, setBets] = useState<CrashBetRow[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const inFlight = useRef(false);

  // Poll the shared round.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { data } = await supabase.rpc('crash_room_now');
        if (!cancelled && data) setState(data as CrashRoomState);
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

  // Load + live-subscribe the bets of the current round.
  useEffect(() => {
    if (roomId == null) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from('crash_bets')
        .select('*')
        .eq('room_id', roomId)
        .order('stake', { ascending: false });
      if (active && data) setBets(data as CrashBetRow[]);
    };
    void load();
    const ch = supabase
      .channel(`crash_bets:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crash_bets', filter: `room_id=eq.${roomId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Refresh the "previous crashes" strip on load and whenever a round busts.
  const bustedRound = state?.status === 'busted' ? roomId : 0;
  useEffect(() => {
    void supabase.rpc('crash_room_history').then(({ data }) => {
      if (Array.isArray(data)) setHistory(data.map(Number));
    });
  }, [bustedRound]);

  const placeBet = useMutation({
    mutationFn: async (input: { stake: number; autoTarget: number | null }) => {
      if (roomId == null) throw new Error('Sala indisponível.');
      const { data, error } = await supabase.rpc('crash_room_bet', {
        p_room_id: roomId,
        p_stake: input.stake,
        p_auto_target: input.autoTarget,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKey(user?.id) }),
  });

  const cashout = useMutation({
    mutationFn: async (): Promise<CrashRoomCashoutResult> => {
      if (roomId == null) throw new Error('Sala indisponível.');
      const { data, error } = await supabase.rpc('crash_room_cashout', { p_room_id: roomId });
      if (error) throw error;
      return data as CrashRoomCashoutResult;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKey(user?.id) }),
  });

  return { state, bets, history, placeBet, cashout };
}
