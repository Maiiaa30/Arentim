import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { MyPokerTable } from '@/types/db';
import type { PokerView } from './types';

interface TableResponse {
  view: PokerView | null;
  host?: boolean;
  table_id?: number;
  code?: string;
}

async function call(body: Record<string, unknown>): Promise<TableResponse> {
  const { data, error } = await supabase.functions.invoke('poker-table', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as TableResponse;
}

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

/** Live table state, polled so all seats stay in sync (no row exposure). */
export function usePokerTableState(tableId: number | null) {
  return useQuery({
    queryKey: ['poker-table', tableId] as const,
    enabled: tableId != null,
    refetchInterval: 2000,
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
    mutationFn: (buyIn: number) => call({ op: 'create', buyIn }),
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

  return { create, join, addBot, start, deal, act, leave };
}
