import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import {
  useMyPokerTables,
  usePokerTableActions,
  usePokerTableState,
} from '@/features/poker/usePokerTable';
import { PokerTable, ResultBanner } from '@/features/poker/PokerTable';
import { PokerActionBar } from '@/features/poker/PokerActionBar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';

const STATUS_LABEL: Record<string, string> = {
  active: 'ativo',
  folded: 'desistiu',
  allin: 'all-in',
  out: 'fora',
  waiting: 'à espera',
  open: 'aberta',
  playing: 'a jogar',
  done: 'terminada',
};

export function PrivatePokerPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: myTables } = useMyPokerTables();
  const { create, join, addBot, start, deal, act, leave } = usePokerTableActions();

  const [tableId, setTableId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [buyIn, setBuyIn] = useState(200);
  const [raiseTo, setRaiseTo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: state } = usePokerTableState(tableId);
  const view = state?.view ?? null;
  const isHost = state?.host ?? false;
  const balance = profile?.balance ?? 0;
  const busy = create.isPending || join.isPending || act.isPending || start.isPending || deal.isPending || addBot.isPending || leave.isPending;

  // If already seated somewhere, auto-select it.
  useEffect(() => {
    if (tableId == null && myTables && myTables.length > 0) setTableId(myTables[0]!.table_id);
  }, [myTables, tableId]);

  const wrap = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'A ação falhou.'); }
  };

  async function onCreate() {
    if (buyIn > balance) return setError('Saldo insuficiente.');
    await wrap(async () => {
      const res = await create.mutateAsync(buyIn);
      setTableId(res.table_id ?? null);
      setCode(res.code ?? '');
    });
  }
  async function onJoin() {
    await wrap(async () => {
      const res = await join.mutateAsync(joinCode.toUpperCase().trim());
      setTableId(res.table_id ?? null);
    });
  }
  async function onLeave() {
    if (tableId == null) return;
    await wrap(async () => { await leave.mutateAsync(tableId); setTableId(null); setCode(''); });
  }

  // ---- Lobby ----
  if (tableId == null || !view) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <Link to="/poker" className="font-sans text-sm text-muted-2 hover:text-text">← Poker</Link>
          <div className="mt-4">
            <Eyebrow>Só para convidados</Eyebrow>
            <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Mesa privada</h1>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-text">Criar uma mesa</h2>
            <Input id="buyin" type="number" label="Entrada" min={100} value={buyIn}
              onChange={(e) => setBuyIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            <Button variant="primary" onClick={onCreate} disabled={busy || buyIn > balance || buyIn < 100} className="w-full">Criar</Button>
          </div>
          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-text">Entrar com um código</h2>
            <Input id="code" label="Código da mesa" placeholder="ABC123" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)} />
            <Button variant="primary" onClick={onJoin} disabled={busy || joinCode.trim().length < 4} className="w-full">Entrar</Button>
          </div>
        </div>
        {myTables && myTables.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">As suas mesas</h2>
            {myTables.map((t) => (
              <button key={t.table_id} onClick={() => setTableId(t.table_id)}
                className="card card-hover focus-ring flex w-full items-center justify-between p-3 text-left">
                <span className="font-sans text-sm text-text">Mesa {t.code} · {t.player_count} sentados</span>
                <span className="font-sans text-xs text-muted">{STATUS_LABEL[t.status] ?? t.status}{t.is_host ? ' · anfitrião' : ''}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    );
  }

  // ---- Table ----
  const me = view.players.find((p) => p.id === user?.id);
  const myTurn = view.toActId === user?.id && !view.handOver;
  const owe = view.currentBet - (me?.committed ?? 0);
  const allInTo = (me?.stack ?? 0) + (me?.committed ?? 0);
  const minRaiseTo = Math.min(view.currentBet + view.minRaise, allInTo);
  const maxRaiseTo = allInTo;
  const effRaiseTo = Math.max(minRaiseTo, Math.min(raiseTo || minRaiseTo, maxRaiseTo));
  const canRaise = allInTo > view.currentBet && !!myTurn;
  const quickBets = canRaise
    ? (() => {
        const clamp = (n: number) => Math.max(minRaiseTo, Math.min(n, maxRaiseTo));
        const raw = [
          { label: 'Mín', to: minRaiseTo },
          { label: '½ Pote', to: clamp(view.currentBet + Math.round(view.pot * 0.5)) },
          { label: 'Pote', to: clamp(view.currentBet + view.pot) },
          { label: 'All-in', to: maxRaiseTo },
        ];
        const seen = new Set<number>();
        return raw.filter((q) => (seen.has(q.to) ? false : (seen.add(q.to), true)));
      })()
    : [];
  const inLobby = view.street === 'idle';

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-text sm:text-[32px]">Mesa privada</h1>
          {code && <p className="font-sans text-sm text-muted">Código da mesa: <span className="font-mono font-semibold text-gold">{code}</span></p>}
        </div>
        <Button variant="secondary" onClick={onLeave} disabled={busy}>Sair da mesa</Button>
      </div>

      <PokerTable
        view={view}
        youId={user?.id ?? '__me__'}
        myTurn={!!myTurn}
        resultBanner={<ResultBanner view={view} />}
      />

      {/* Controls */}
      <div className="card space-y-3 p-4">
        {inLobby ? (
          <div className="flex flex-wrap justify-center gap-2">
            {isHost && <Button variant="secondary" onClick={() => wrap(() => addBot.mutateAsync({ tableId, difficulty: 'medium' }))} disabled={busy}>Adicionar bot</Button>}
            {isHost && <Button variant="primary" onClick={() => wrap(() => start.mutateAsync(tableId))} disabled={busy || view.players.length < 2}>Iniciar mão</Button>}
            {!isHost && <p className="font-sans text-sm text-muted">À espera de o anfitrião iniciar…</p>}
          </div>
        ) : myTurn ? (
          <PokerActionBar
            owe={owe}
            callAmount={Math.min(owe, me?.stack ?? 0)}
            raiseTo={effRaiseTo}
            minRaiseTo={minRaiseTo}
            maxRaiseTo={maxRaiseTo}
            canRaise={canRaise}
            busy={busy}
            quickBets={quickBets}
            onFold={() => wrap(() => act.mutateAsync({ tableId, action: 'fold', raiseTo: 0 }))}
            onCheck={() => wrap(() => act.mutateAsync({ tableId, action: 'check', raiseTo: 0 }))}
            onCall={() => wrap(() => act.mutateAsync({ tableId, action: 'call', raiseTo: 0 }))}
            onRaise={() => wrap(() => act.mutateAsync({ tableId, action: 'raise', raiseTo: effRaiseTo }))}
            onRaiseChange={setRaiseTo}
          />
        ) : view.handOver ? (
          <div className="flex justify-center gap-2">
            {isHost ? <Button variant="primary" onClick={() => wrap(() => deal.mutateAsync(tableId))} disabled={busy}>Próxima mão</Button>
              : <p className="font-sans text-sm text-muted">Mão terminada — à espera do anfitrião.</p>}
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-muted">À espera de {view.players.find((p) => p.id === view.toActId)?.name ?? 'outros'}…</p>
        )}
        {error && <p className="text-center font-sans text-sm text-negative">{error}</p>}
      </div>

      {view.log.length > 0 && <p className="text-center font-sans text-xs text-muted">{view.log.join(' · ')}</p>}
    </div>
  );
}
