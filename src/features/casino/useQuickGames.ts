import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useInvalidateWallet } from '@/features/wallet/useInvalidateWallet';
import type { CoinSide } from './coinflip';
import type { DicePick, HiLoPick, HighLowPick } from './miniGames';
import type {
  CoinflipResult,
  SlotsResult,
  DiceResult,
  HiloDealResult,
  HiloBetResult,
  WheelResult,
  CrashStartResult,
  CrashSettleResult,
  CupsStartResult,
  CupsPickResult,
  HighLowResult,
  MinesState,
  MinesPickResult,
  MinesCashoutResult,
  MinesCurrent,
  TigrinhoResult,
  HorseResult,
  ChickenState,
  ChickenStepResult,
  ChickenCashoutResult,
  ChickenCurrent,
} from '@/types/db';

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

/** Sobe e Desce: deal a fresh random rung + its adapted odds. */
export function useHiloDeal() {
  return useMutation({
    mutationFn: async (): Promise<HiloDealResult> => {
      const { data, error } = await supabase.rpc('hilo_deal');
      if (error) throw error;
      return data;
    },
  });
}

/** Sobe e Desce: bet higher/lower than the dealt rung. */
export function useHiloBet() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; pick: HiLoPick }): Promise<HiloBetResult> => {
      const { data, error } = await supabase.rpc('hilo_bet', {
        p_stake: input.stake,
        p_pick: input.pick,
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

/** Baú do Tesouro (cup & ball): start a round — ball position + swap sequence. */
export function useCupsStart() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<CupsStartResult> => {
      const { data, error } = await supabase.rpc('cups_start', { p_stake: stake });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Baú do Tesouro: pick a cup; server settles whether it held the ball. */
export function useCupsPick() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (picked: number): Promise<CupsPickResult> => {
      const { data, error } = await supabase.rpc('cups_pick', { p_picked: picked });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Maior ou Menor: single die, bet High/Low or an exact number. */
export function useHighLow() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; pick: HighLowPick }): Promise<HighLowResult> => {
      const { data, error } = await supabase.rpc('play_highlow', {
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

/** Crash: launch a round (debits the stake; server draws the hidden crash point). */
export function useCrashStart() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; autoTarget: number | null }): Promise<CrashStartResult> => {
      const { data, error } = await supabase.rpc('crash_start', {
        p_stake: input.stake,
        p_auto_target: input.autoTarget,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Mines: start a round (debit + draw the hidden mine layout). */
export function useMinesStart() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; mines: number }): Promise<MinesState> => {
      const { data, error } = await supabase.rpc('mines_start', { p_stake: input.stake, p_mines: input.mines });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Mines: reveal a tile (safe → grow multiplier, mine → bust). */
export function useMinesPick() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (cell: number): Promise<MinesPickResult> => {
      const { data, error } = await supabase.rpc('mines_pick', { p_cell: cell });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Mines: cash out at the current multiplier. */
export function useMinesCashout() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (): Promise<MinesCashoutResult> => {
      const { data, error } = await supabase.rpc('mines_cashout');
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Mines: the in-progress round (or null), so the page can resume after leaving. */
export function useMinesCurrent() {
  return useQuery({
    queryKey: ['mines-current'],
    queryFn: async (): Promise<MinesCurrent | null> => {
      const { data, error } = await supabase.rpc('mines_current');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });
}

/** Frango: the in-progress round (or null), so the page can resume after leaving. */
export function useChickenCurrent() {
  return useQuery({
    queryKey: ['chicken-current'],
    queryFn: async (): Promise<ChickenCurrent | null> => {
      const { data, error } = await supabase.rpc('chicken_current');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });
}

/** Tigrinho: spin the 3×3 tiger slot. */
export function useTigrinho() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (stake: number): Promise<TigrinhoResult> => {
      const { data, error } = await supabase.rpc('play_tigrinho', { p_stake: stake, p_idempotency_key: crypto.randomUUID() });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Corrida de Cavalos: back a horse and run the race. */
export function useHorse() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; horse: number }): Promise<HorseResult> => {
      const { data, error } = await supabase.rpc('play_horse', { p_stake: input.stake, p_horse: input.horse, p_idempotency_key: crypto.randomUUID() });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Frango: start a crossing at a difficulty (draws the hidden survivable lanes). */
export function useChickenStart() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (input: { stake: number; difficulty: string }): Promise<ChickenState> => {
      const { data, error } = await supabase.rpc('chicken_start', { p_stake: input.stake, p_difficulty: input.difficulty });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Frango: step into the next lane (survive → grow, hit → lose). */
export function useChickenStep() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (): Promise<ChickenStepResult> => {
      const { data, error } = await supabase.rpc('chicken_step');
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Frango: cash out at the current lane. */
export function useChickenCashout() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (): Promise<ChickenCashoutResult> => {
      const { data, error } = await supabase.rpc('chicken_cashout');
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Crash: cash out (or settle a bust). Authoritative — pays out if still flying. */
export function useCrashCashout() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: async (roundId: number): Promise<CrashSettleResult> => {
      const { data, error } = await supabase.rpc('crash_cashout', { p_round_id: roundId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
