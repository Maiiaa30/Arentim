import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Map the Edge Function's English error strings to PT-PT player-facing copy.
 * Anything unmapped falls through verbatim (better than a generic crash).
 */
const MESSAGES: Record<string, string> = {
  unauthorized: 'A sessão expirou. Inicie sessão novamente.',
  'insufficient balance': 'Saldo insuficiente para essa entrada.',
  'leave your current table first': 'Já está sentado noutra mesa — saia dela primeiro.',
  'invalid buy-in': 'Entrada inválida.',
  'could not create table': 'Não foi possível abrir a mesa. Tente novamente.',
  'no active table': 'Não há nenhuma mesa ativa.',
  'no table': 'Mesa não encontrada.',
  'table not found': 'Mesa não encontrada.',
  'hand in progress': 'Mão em curso — aguarde um momento.',
  'hand in progress — try again shortly': 'Mão em curso — tente novamente daqui a pouco.',
  'table full': 'A mesa está cheia.',
  'host only': 'Só o anfitrião pode fazer isso.',
  'need at least 2 players': 'São precisos pelo menos 2 jogadores.',
  'cannot add bot now': 'Não é possível adicionar bots agora.',
  'finish the hand before leaving': 'Termine a mão antes de sair.',
  'bad action': 'Ação inválida.',
  'bad request': 'Pedido inválido.',
  'unknown op': 'Operação desconhecida.',
};

const translate = (raw: string): string => MESSAGES[raw.toLowerCase()] ?? raw;

/**
 * Invoke a poker Edge Function and unwrap its real error message. supabase-js
 * collapses any non-2xx response into the opaque "Edge Function returned a
 * non-2xx status code"; the actual `{ error }` body lives on
 * `FunctionsHttpError.context` (the Response). We read it so the player sees
 * why the action failed instead of a generic crash.
 */
export async function invokePoker<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let msg: string | null = null;
      try {
        const payload = await error.context.json();
        if (payload?.error) msg = translate(String(payload.error));
      } catch {
        /* body wasn't JSON — fall back to a generic message */
      }
      throw new Error(msg ?? 'A mesa recusou a jogada. Tente novamente.');
    }
    throw new Error(error.message || 'Não foi possível contactar o servidor de póquer.');
  }
  if (data?.error) throw new Error(translate(String(data.error)));
  return data as T;
}
