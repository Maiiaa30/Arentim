import { useDuels, useDuelActions } from './useDuels';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/format';
import type { DuelRow } from '@/types/db';

function ResultLine({ d, meId }: { d: DuelRow; meId: string | undefined }) {
  if (d.status === 'settled') {
    const won = d.winner === meId;
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 p-3">
        <span className="font-sans text-sm text-text">
          {won ? 'Ganhaste' : 'Perdeste'} contra <span className="text-muted">{d.other_name}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-2">
            {d.my_roll}<span className="text-faint"> vs </span>{d.their_roll}
          </span>
          <span className={`font-mono text-sm font-semibold ${won ? 'text-positive' : 'text-negative'}`}>
            {won ? `+${formatAmount(d.stake)}` : `−${formatAmount(d.stake)}`}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="card flex items-center justify-between gap-2 p-3 opacity-70">
      <span className="font-sans text-sm text-muted">
        Duelo com {d.other_name} — {d.status === 'declined' ? 'recusado' : 'cancelado'}
      </span>
      <span className="font-mono text-xs text-muted-2">{formatAmount(d.stake)}</span>
    </div>
  );
}

/** The "Duelos" tab: incoming challenges, sent challenges, and recent results. */
export function DuelsPanel({ meId }: { meId: string | undefined }) {
  const { data: duels } = useDuels();
  const { respond, cancel } = useDuelActions();

  const incoming = (duels ?? []).filter((d) => d.status === 'pending' && d.role === 'opponent');
  const outgoing = (duels ?? []).filter((d) => d.status === 'pending' && d.role === 'challenger');
  const past = (duels ?? []).filter((d) => d.status !== 'pending');

  return (
    <div className="space-y-6">
      <p className="font-sans text-[12.5px] text-muted">
        Desafia um amigo: ambos apostam o mesmo, cada um tira um número de 1 a 100, o maior leva o pote. Cria um
        duelo no separador <span className="text-text">Amigos</span> (⚔️ Desafiar).
      </p>

      <div className="space-y-2">
        <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
          Desafios recebidos{incoming.length ? ` (${incoming.length})` : ''}
        </h2>
        {incoming.length === 0 ? (
          <p className="font-sans text-sm text-muted-2">Nenhum.</p>
        ) : (
          incoming.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="min-w-0 font-sans text-sm text-text">
                {d.other_name} · <span className="font-mono text-gold">{formatAmount(d.stake)} tós</span>
              </span>
              <div className="flex gap-2">
                <Button variant="primary" className="!px-4 !py-2" disabled={respond.isPending}
                  onClick={() => respond.mutate({ duelId: d.id, accept: true })}>
                  Aceitar
                </Button>
                <Button variant="ghost" className="!px-4 !py-2" disabled={respond.isPending}
                  onClick={() => respond.mutate({ duelId: d.id, accept: false })}>
                  Recusar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Enviados</h2>
        {outgoing.length === 0 ? (
          <p className="font-sans text-sm text-muted-2">Nenhum.</p>
        ) : (
          outgoing.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="min-w-0 font-sans text-sm text-text">
                {d.other_name} · <span className="font-mono text-gold">{formatAmount(d.stake)} tós</span>
                <span className="ml-1 text-muted-2">à espera…</span>
              </span>
              <Button variant="ghost" className="!px-4 !py-2" disabled={cancel.isPending}
                onClick={() => cancel.mutate(d.id)}>
                Cancelar
              </Button>
            </div>
          ))
        )}
      </div>

      {past.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Recentes</h2>
          {past.map((d) => (
            <ResultLine key={d.id} d={d} meId={meId} />
          ))}
        </div>
      )}
    </div>
  );
}
