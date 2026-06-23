import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { HorseRoomState, HorseBetRow } from '@/types/db';

const POLL_MS = 700;

/** Drives the shared horse-race room (poll horse_room_now + live bets via Realtime). */
export function useHorseRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<HorseRoomState | null>(null);
  const [bets, setBets] = useState<HorseBetRow[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.hidden || inFlight.current) return;
      inFlight.current = true;
      try {
        const { data } = await supabase.rpc('horse_room_now');
        if (!cancelled && data) setState(data as HorseRoomState);
      } catch {
        /* transient — keep last snapshot */
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
      const { data } = await supabase.from('horse_bets').select('*').eq('room_id', roomId).order('stake', { ascending: false });
      if (active && data) setBets(data as HorseBetRow[]);
    };
    void load();
    const ch = supabase
      .channel(`horse_bets:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horse_bets', filter: `room_id=eq.${roomId}` }, () => void load())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  const doneRound = state?.status === 'done' ? roomId : 0;
  useEffect(() => {
    void supabase.rpc('horse_room_history').then(({ data }) => {
      if (Array.isArray(data)) setHistory(data.map(Number));
    });
  }, [doneRound]);

  const placeBet = useMutation({
    mutationFn: async (input: { horse: number; stake: number }) => {
      if (roomId == null) throw new Error('Sala indisponível.');
      const { data, error } = await supabase.rpc('horse_room_bet', { p_room_id: roomId, p_horse: input.horse, p_stake: input.stake });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKey(user?.id) }),
  });

  return { state, bets, history, placeBet };
}
