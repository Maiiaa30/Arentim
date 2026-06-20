import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { CoinSide } from './coinflip';
import type { DicePick, HiLoPick } from './miniGames';
import type {
  CoinflipResult,
  SlotsResult,
  DiceResult,
  HiLoResult,
  WheelResult,
  CrashResult,
} from '@/types/db';

function useInvalidateWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };
}

/** Coin-flip: pick a side, stake, server flips with a CSPRNG. */
export function useCoinflip() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; choice: CoinSide }): Promise<CoinflipResult> => {
      const { data, error } = await supabase.rpc('play_coinflip', {
        p_stake: input.stake,
        p_choice: input.choice,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Slots: stake, server spins three reels with a CSPRNG. */
export function useSlots() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<SlotsResult> => {
      const { data, error } = await supabase.rpc('play_slots', {
        p_stake: stake,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Dados: bet over/under/seven on a 2d6 total. */
export function useDice() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; pick: DicePick }): Promise<DiceResult> => {
      const { data, error } = await supabase.rpc('play_dice', {
        p_stake: input.stake,
        p_pick: input.pick,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Sobe e Desce: bet the rung climbs above / falls below / lands on 7. */
export function useSobeDesce() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; pick: HiLoPick }): Promise<HiLoResult> => {
      const { data, error } = await supabase.rpc('play_hilo', {
        p_stake: input.stake,
        p_pick: input.pick,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Roda da Sorte: spin the 24-segment wheel. */
export function useWheel() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<WheelResult> => {
      const { data, error } = await supabase.rpc('play_wheel', {
        p_stake: stake,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Crash: set an auto-cash-out target; server draws the hidden crash point. */
export function useCrash() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; target: number }): Promise<CrashResult> => {
      const { data, error } = await supabase.rpc('play_crash', {
        p_stake: input.stake,
        p_target: input.target,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
