import { useEffect, useState } from 'react';
import { useDuels, useDuelActions } from './useDuels';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/format';
import type { DuelRow, DuelRespondResult } from '@/types/db';

/** One rolling number panel (you / opponent). */
function RollCard({ label, value, rolling, highlight }: { label: string; value: number; rolling: boolean; highlight: boolean }) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${highlight ? 'border-positive bg-positive/10' : 'border-border bg-bg/50'}`}>
      <p className="truncate font-sans text-[11px] text-muted-2">{label}</p>
      <p className={`font-mono text-4xl font-bold tabular-nums ${rolling ? 'text-muted' : highlight ? 'text-positive' : 'text-text'}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Suspense modal for an accepted duel: the rolls cycle for a beat before landing
 * on the real result, so the win/loss isn't an instant text flash.
 */
function DuelReveal({ result, opponentName, stake, onClose }: {
  result: DuelRespondResult; opponentName: string; stake: number; onClose: () => void;
}) {
  const myFinal = result.opponent_roll ?? 0; // the accepter is the "opponent" seat
  const theirFinal = result.challenger_roll ?? 0;
  const won = result.won ?? false;
  const [phase, setPhase] = useState<'rolling' | 'done'>('rolling');
  const [my, setMy] = useState(1);
  const [their, setTheir] = useState(1);

  useEffect(() => {
    const iv = setInterval(() => {
      setMy(1 + Math.floor(Math.random() * 100));
      setTheir(1 + Math.floor(Math.random() * 100));
    }, 80);
    const to = setTimeout(() => {
      clearInterval(iv);
      setMy(myFinal);
      setTheir(theirFinal);
      setPhase('done');
    }, 1600);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [myFinal, theirFinal]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={phase === 'done' ? onClose : undefined}
    >
      <div className="card animate-pop relative w-full max-w-sm overflow-hidden p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-2">Duelo · 1 a 100</p>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <RollCard label="Tu" value={my} rolling={phase === 'rolling'} highlight={phase === 'done' && won} />
          <span className="font-display text-lg text-muted-2">vs</span>
          <RollCard label={opponentName} value={their} rolling={phase === 'rolling'} highlight={phase === 'done' && !won} />
        </div>
        {phase === 'rolling' ? (
          <p className="mt-5 animate-floaty font-sans text-sm text-gold-light">A lançar os dados…</p>
        ) : (
          <div className="animate-win-burst mt-5">
            <p className={`font-display text-2xl font-bold ${won ? 'text-positive' : 'text-negative'}`}>
              {won ? '🏆 Ganhaste!' : 'Perdeste'}
            </p>
            <p className={`mt-1 font-mono text-sm font-semibold ${won ? 'text-positive' : 'text-negative'}`}>
              {won ? `+${formatAmount(stake)}` : `−${formatAmount(stake)}`} tós
            </p>
            <Button variant="ghost" className="mt-4" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [flash, setFlash] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ result: DuelRespondResult; name: string; stake: number } | null>(null);

  async function accept(d: DuelRow) {
    setFlash(null);
    try {
      const r = await respond.mutateAsync({ duelId: d.id, accept: true });
      // A duel settles on accept; play the roll reveal instead of an instant flash.
      if (r.status === 'settled') setReveal({ result: r, name: d.other_name, stake: d.stake });
    } catch {
      setFlash('Não foi possível responder ao duelo.');
    }
  }

  const incoming = (duels ?? []).filter((d) => d.status === 'pending' && d.role === 'opponent');
  const outgoing = (duels ?? []).filter((d) => d.status === 'pending' && d.role === 'challenger');
  const past = (duels ?? []).filter((d) => d.status !== 'pending');

  return (
    <div className="space-y-6">
      <p className="font-sans text-[12.5px] text-muted">
        Desafia um amigo: ambos apostam o mesmo, cada um tira um número de 1 a 100, o maior leva o pote. Cria um
        duelo no separador <span className="text-text">Amigos</span> (Desafiar). Ao aceitar, o duelo resolve-se na hora.
      </p>

      {flash && <p className="font-sans text-sm font-medium text-gold">{flash}</p>}

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
                  onClick={() => accept(d)}>
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

      {reveal && (
        <DuelReveal
          result={reveal.result}
          opponentName={reveal.name}
          stake={reveal.stake}
          onClose={() => setReveal(null)}
        />
      )}
    </div>
  );
}
