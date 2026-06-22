import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import { invokePoker } from './invoke';
import type { MyPokerTable } from '@/types/db';
import type { PokerView } from './types';

interface TableResponse {
  view: PokerView | null;
  host?: boolean;
  table_id?: number;
  code?: string;
  /** Intermediate snapshots (one per bot action) to replay with a delay. */
  trail?: PokerView[];
  /** ISO deadline for the player currently to act (null when none/bot). */
  turnDeadline?: string | null;
}

/** Args for creating a private table: buy-in plus how many bot seats to fill. */
export interface CreateTableArgs {
  buyIn: number;
  botCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const call = (body: Record<string, unknown>): Promise<TableResponse> =>
  invokePoker<TableResponse>('poker-table', body);

/** Tables the user is currently seated at. */
export function useMyPokerTables() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['poker-tables', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<MyPokerTable[]> => {
      const { data, error } = await supabase.rpc('list_my_poker_tables');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Live table state, polled so all seats stay in sync (the table row is never
 * exposed to clients — hole cards stay server-side — so we can't use Realtime).
 * Polls a bit faster than before and KEEPS polling when the tab is in the
 * background, so a second player watching from another window/tab doesn't go
 * stale ("não está live nas 2 contas").
 */
export function usePokerTableState(tableId: number | null) {
  return useQuery({
    queryKey: ['poker-table', tableId] as const,
    enabled: tableId != null,
    refetchInterval: 1300,
    refetchIntervalInBackground: true,
    queryFn: () => call({ op: 'state', tableId }),
  });
}

export function usePokerTableActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refreshBalance = () => {
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['poker-tables', user?.id] });
  };

  const create = useMutation({
    mutationFn: (v: CreateTableArgs) =>
      call({ op: 'create', buyIn: v.buyIn, botCount: v.botCount, difficulty: v.difficulty }),
    onSuccess: refreshBalance,
  });
  const join = useMutation({
    mutationFn: (code: string) => call({ op: 'join', code }),
    onSuccess: refreshBalance,
  });
  const addBot = useMutation({
    mutationFn: (v: { tableId: number; difficulty: string }) => call({ op: 'add_bot', ...v }),
  });
  const start = useMutation({ mutationFn: (tableId: number) => call({ op: 'start', tableId }) });
  const deal = useMutation({ mutationFn: (tableId: number) => call({ op: 'deal', tableId }) });
  const act = useMutation({
    mutationFn: (v: { tableId: number; action: string; raiseTo: number }) => call({ op: 'act', ...v }),
  });
  const leave = useMutation({
    mutationFn: (tableId: number) => call({ op: 'leave', tableId }),
    onSuccess: refreshBalance,
  });
  const rebuy = useMutation({
    mutationFn: (v: { tableId: number; amount: number }) => call({ op: 'rebuy', ...v }),
    onSuccess: refreshBalance,
  });

  return { create, join, addBot, start, deal, act, leave, rebuy };
}
