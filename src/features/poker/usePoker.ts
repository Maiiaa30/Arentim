import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import { invokePoker } from './invoke';
import type { PokerView } from './types';

/** A move result: the final view, plus an optional trail of intermediate
 *  snapshots (one per bot action) the page replays with a delay. */
export type PokerResult = { view: PokerView; trail?: PokerView[] };

type SitArgs = { buyIn: number; botCount: number; difficulty: 'easy' | 'medium' | 'hard' };
type Op =
  | { op: 'sit'; buyIn: number; botCount: number; difficulty: string }
  | { op: 'act'; action: string; raiseTo: number }
  | { op: 'deal' }
  | { op: 'leave' }
  | { op: 'state' };

const call = <T>(body: Op): Promise<T> => invokePoker<T>('poker-bots', body);

/** Resume an in-progress table (if any) on load. */
export function usePokerState() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['poker', 'state', user?.id] as const,
    enabled: !!user,
    queryFn: () => call<{ view: PokerView | null }>({ op: 'state' }),
  });
}

export function usePoker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refreshBalance = () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };

  const sit = useMutation({
    mutationFn: (a: SitArgs) =>
      call<PokerResult>({ op: 'sit', buyIn: a.buyIn, botCount: a.botCount, difficulty: a.difficulty }),
    onSuccess: refreshBalance,
  });
  const act = useMutation({
    mutationFn: (a: { action: string; raiseTo: number }) =>
      call<PokerResult>({ op: 'act', action: a.action, raiseTo: a.raiseTo }),
  });
  const deal = useMutation({
    mutationFn: () => call<PokerResult>({ op: 'deal' }),
  });
  const leave = useMutation({
    mutationFn: () => call<{ left: boolean; cashOut: number }>({ op: 'leave' }),
    onSuccess: () => {
      refreshBalance();
      // Clear the resumable-table cache so a later remount doesn't resurrect the
      // table we just left.
      qc.setQueryData(['poker', 'state', user?.id], { view: null });
    },
  });

  return { sit, act, deal, leave };
}
