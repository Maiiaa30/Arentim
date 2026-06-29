import { useMutation, useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { BattleshipResponse } from './board';

const MESSAGES: Record<string, string> = {
  unauthorized: 'A sessão expirou. Inicie sessão novamente.',
  'table not found': 'Mesa não encontrada.',
  'table full': 'A mesa já está cheia.',
  'already started': 'A partida já começou.',
  'leave your current game first': 'Já estás numa partida — sai dela primeiro.',
  'invalid fleet': 'Posicionamento inválido.',
  'wrong fleet': 'A frota não está completa.',
  'ships overlap': 'Os navios não podem sobrepor-se.',
  'already placed': 'Já posicionaste a frota.',
  'not your turn': 'Não é a tua vez.',
  'not in play': 'A partida não está a decorrer.',
  'already fired': 'Já disparaste aí.',
  'invalid cell': 'Alvo inválido.',
  conflict: 'Conflito — tenta outra vez.',
  'could not create table': 'Não foi possível abrir a mesa. Tenta novamente.',
  'bad request': 'Pedido inválido.',
  'unknown op': 'Operação desconhecida.',
};
const translate = (raw: string) => MESSAGES[raw.toLowerCase()] ?? raw;

/** Invoke the battleship-table function and surface its real error message. */
export async function invokeBattleship(body: Record<string, unknown>): Promise<BattleshipResponse> {
  const { data, error } = await supabase.functions.invoke('battleship-table', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let msg: string | null = null;
      try {
        const payload = await error.context.json();
        if (payload?.error) msg = translate(String(payload.error));
      } catch {
        /* body wasn't JSON */
      }
      throw new Error(msg ?? 'O servidor recusou a jogada. Tenta novamente.');
    }
    throw new Error(error.message || 'Não foi possível contactar o servidor.');
  }
  if (data?.error) throw new Error(translate(String(data.error)));
  return data as BattleshipResponse;
}

/** My current game (resume on load). */
export function useMyBattleship(enabled: boolean) {
  return useQuery({
    queryKey: ['battleship-mine'] as const,
    enabled,
    staleTime: 0,
    queryFn: () => invokeBattleship({ op: 'mine' }),
  });
}

/** Poll the live table state — fast, even when backgrounded, so the opponent's
 *  moves land promptly (the state is server-only, so realtime can't carry it). */
export function useBattleshipState(tableId: number | null) {
  return useQuery({
    queryKey: ['battleship-table', tableId] as const,
    enabled: tableId != null,
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
    queryFn: () => invokeBattleship({ op: 'state', tableId }),
  });
}

export function useBattleshipActions() {
  const find = useMutation({ mutationFn: () => invokeBattleship({ op: 'find' }) });
  const create = useMutation({ mutationFn: (isPublic: boolean) => invokeBattleship({ op: 'create', isPublic }) });
  const join = useMutation({ mutationFn: (code: string) => invokeBattleship({ op: 'join', code }) });
  const place = useMutation({ mutationFn: (v: { tableId: number; ships: number[][] }) => invokeBattleship({ op: 'place', ...v }) });
  const fire = useMutation({ mutationFn: (v: { tableId: number; cell: number }) => invokeBattleship({ op: 'fire', ...v }) });
  const timeout = useMutation({ mutationFn: (tableId: number) => invokeBattleship({ op: 'timeout', tableId }) });
  const rematch = useMutation({ mutationFn: (tableId: number) => invokeBattleship({ op: 'rematch', tableId }) });
  const leave = useMutation({ mutationFn: (tableId: number) => invokeBattleship({ op: 'leave', tableId }) });
  return { find, create, join, place, fire, timeout, rematch, leave };
}
