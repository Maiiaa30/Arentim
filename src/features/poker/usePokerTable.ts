import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, pruneStalePublicTablesOnce } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import { invokePoker } from './invoke';
import type { MyPokerTable, PublicPokerTable } from '@/types/db';
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

/** Spectator snapshot of a public table (no membership, no hole cards). */
export interface WatchResponse {
  view: PokerView | null;
  buyIn?: number;
  /** True when there's an open seat you could sit at (between hands). */
  seatsOpen?: boolean;
  seated?: number;
}

/** Args for creating a table: buy-in, bot seats, difficulty, and public/private. */
export interface CreateTableArgs {
  buyIn: number;
  botCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  isPublic: boolean;
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

/** Open public tables anyone can browse, spectate, or sit at. */
export function usePublicPokerTables() {
  return useQuery({
    queryKey: ['poker-public-tables'] as const,
    refetchInterval: 5000,
    queryFn: async (): Promise<PublicPokerTable[]> => {
      // Opportunistically retire abandoned, empty, stale public tables once per
      // session so the lobby doesn't fill up with week-old rows (no cron). Fire
      // and forget — list-freshness already hides stale tables regardless.
      pruneStalePublicTablesOnce();
      const { data, error } = await supabase.rpc('list_public_poker_tables');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Spectator poll for a public table (used when you're watching, not seated). */
export function useWatchPokerTable(tableId: number | null) {
  return useQuery({
    queryKey: ['poker-watch', tableId] as const,
    enabled: tableId != null,
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
    queryFn: () => invokePoker<WatchResponse>('poker-table', { op: 'watch', tableId }),
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
    // Fast during a live hand; back off between hands so an idle/background tab
    // isn't billing an Edge invocation every 1.3s forever.
    refetchInterval: (q) => (q.state.data?.view?.handOver ? 4000 : 1300),
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
      call({ op: 'create', buyIn: v.buyIn, botCount: v.botCount, difficulty: v.difficulty, isPublic: v.isPublic }),
    onSuccess: refreshBalance,
  });
  const join = useMutation({
    mutationFn: (code: string) => call({ op: 'join', code }),
    onSuccess: refreshBalance,
  });
  /** Sit at a public table by id (from the lobby). */
  const joinTable = useMutation({
    mutationFn: (tableId: number) => call({ op: 'join', tableId }),
    onSuccess: refreshBalance,
  });
  /** Host removes a player or bot. */
  const kick = useMutation({
    mutationFn: (v: { tableId: number; targetId: string }) => call({ op: 'kick', ...v }),
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

  return { create, join, joinTable, kick, addBot, start, deal, act, leave, rebuy };
}
