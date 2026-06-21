import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { invokePoker } from '@/features/poker/invoke';

export interface SuecaSeatView {
  seat: number;
  name: string;
  bot: boolean;
  isMe: boolean;
  present: boolean;
  cards: number;
}

export interface SuecaTableView {
  table_id: number;
  code: string;
  status: 'open' | 'playing' | 'closed';
  host: boolean;
  mySeat: number;
  match: [number, number];
  seats: SuecaSeatView[];
  trump?: number;
  trumpCard?: number;
  turn?: number;
  leader?: number;
  trick?: { seat: number; card: number }[];
  capturedA?: number;
  capturedB?: number;
  tricksPlayed?: number;
  trickComplete?: boolean;
  done?: boolean;
  result?: { teamAPoints: number; teamBPoints: number; winner: 0 | 1 | null; margin: string; games: number } | null;
  dealer?: number;
  log?: string[];
  myHand?: number[];
}

const call = (body: Record<string, unknown>) => invokePoker<{ view: SuecaTableView | null }>('sueca-table', body);

export interface MySuecaTable { table_id: number; code: string; status: string; player_count: number; is_host: boolean }

export function useMySuecaTables() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sueca-tables', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<MySuecaTable[]> => {
      const { data, error } = await supabase.rpc('list_my_sueca_tables');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSuecaTableState(tableId: number | null) {
  return useQuery({
    queryKey: ['sueca-table', tableId] as const,
    enabled: tableId != null,
    refetchInterval: 1500,
    queryFn: () => call({ op: 'state', tableId }),
  });
}

export function useSuecaActions() {
  const create = useMutation({ mutationFn: () => call({ op: 'create' }) });
  const join = useMutation({ mutationFn: (code: string) => call({ op: 'join', code }) });
  const seat = useMutation({ mutationFn: (v: { tableId: number; seat: number }) => call({ op: 'seat', ...v }) });
  const start = useMutation({ mutationFn: (tableId: number) => call({ op: 'start', tableId }) });
  const play = useMutation({ mutationFn: (v: { tableId: number; card: number }) => call({ op: 'play', ...v }) });
  const collect = useMutation({ mutationFn: (tableId: number) => call({ op: 'collect', tableId }) });
  const deal = useMutation({ mutationFn: (tableId: number) => call({ op: 'deal', tableId }) });
  const leave = useMutation({ mutationFn: (tableId: number) => call({ op: 'leave', tableId }) });
  return { create, join, seat, start, play, collect, deal, leave };
}
