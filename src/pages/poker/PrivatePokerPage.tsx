import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import {
  useMyPokerTables,
  usePokerTableActions,
  usePokerTableState,
} from '@/features/poker/usePokerTable';
import { PokerCard } from '@/features/poker/PokerCard';
import type { PokerPlayerView } from '@/features/poker/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

function Seat({ p, isTurn, isYou }: { p: PokerPlayerView; isTurn: boolean; isYou: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${isTurn ? 'border-gold bg-gold/10' : 'border-border bg-surface'} ${p.status === 'folded' ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text">{p.name}{isYou && <span className="text-muted"> (you)</span>}</span>
        <span className="flex items-center gap-1 text-xs text-muted"><CoinIcon className="h-3 w-3" /> {formatAmount(p.stack)}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {p.hole.length === 0 ? <span className="text-xs text-muted">—</span> : p.hole.map((c, i) => <PokerCard key={i} card={c} small />)}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="capitalize text-muted">{p.status === 'allin' ? 'all-in' : p.status}</span>
        {p.committed > 0 && <span className="tabular-nums text-gold">{formatAmount(p.committed)}</span>}
      </div>
    </div>
  );
}

export function PrivatePokerPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: myTables } = useMyPokerTables();
  const { create, join, addBot, start, deal, act, leave } = usePokerTableActions();

  const [tableId, setTableId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [buyIn, setBuyIn] = useState(1000);
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
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
  };

  async function onCreate() {
    if (buyIn > balance) return setError('Not enough Tostões.');
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
      <div className="animate-fade-in space-y-6">
        <div>
          <Link to="/poker" className="text-sm text-muted hover:text-text">← Poker</Link>
          <h1 className="font-display text-2xl font-bold text-text">Private table</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-3 p-6">
            <h2 className="font-display font-semibold text-text">Create a table</h2>
            <Input id="buyin" type="number" label="Buy-in" min={100} value={buyIn}
              onChange={(e) => setBuyIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            <Button onClick={onCreate} disabled={busy || buyIn > balance || buyIn < 100} className="w-full">Create</Button>
          </div>
          <div className="card space-y-3 p-6">
            <h2 className="font-display font-semibold text-text">Join with a code</h2>
            <Input id="code" label="Table code" placeholder="ABC123" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)} />
            <Button onClick={onJoin} disabled={busy || joinCode.trim().length < 4} className="w-full">Join</Button>
          </div>
        </div>
        {myTables && myTables.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted">Your tables</h2>
            {myTables.map((t) => (
              <button key={t.table_id} onClick={() => setTableId(t.table_id)}
                className="card flex w-full items-center justify-between p-3 text-left hover:border-accent/50">
                <span className="text-sm text-text">Table {t.code} · {t.player_count} seated</span>
                <span className="text-xs capitalize text-muted">{t.status}{t.is_host ? ' · host' : ''}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-negative">{error}</p>}
      </div>
    );
  }

  // ---- Table ----
  const me = view.players.find((p) => p.id === user?.id);
  const myTurn = view.toActId === user?.id && !view.handOver;
  const owe = view.currentBet - (me?.committed ?? 0);
  const others = view.players.filter((p) => p.id !== user?.id);
  const minRaiseTo = view.currentBet + view.minRaise;
  const inLobby = view.street === 'idle';

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Private table</h1>
          {code && <p className="text-sm text-muted">Invite code: <span className="font-mono font-semibold text-gold">{code}</span></p>}
        </div>
        <Button variant="secondary" onClick={onLeave} disabled={busy}>Leave</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((p) => <Seat key={p.id} p={p} isTurn={view.toActId === p.id} isYou={false} />)}
      </div>

      <div className="card flex flex-col items-center gap-3 p-6">
        <span className="flex items-center gap-1 text-sm text-muted">
          Pot <CoinIcon className="h-3.5 w-3.5" /><span className="font-semibold text-text">{formatAmount(view.pot)}</span>
        </span>
        <div className="flex gap-2">
          {view.community.length === 0 ? <span className="text-sm text-muted">{inLobby ? 'Waiting to start' : 'Pre-flop'}</span>
            : view.community.map((c, i) => <PokerCard key={i} card={c} />)}
        </div>
        {view.result && (
          <p className="text-center text-sm font-semibold text-positive">
            {view.result.winners.map((w) => `${view.players.find((p) => p.id === w.id)?.name ?? w.id} wins ${formatAmount(w.amount)}`).join(' · ')}
          </p>
        )}
      </div>

      {me && <div className="mx-auto max-w-md"><Seat p={me} isTurn={!!myTurn} isYou /></div>}

      {/* Controls */}
      <div className="card space-y-3 p-4">
        {inLobby ? (
          <div className="flex flex-wrap justify-center gap-2">
            {isHost && <Button variant="secondary" onClick={() => wrap(() => addBot.mutateAsync({ tableId, difficulty: 'medium' }))} disabled={busy}>Add bot</Button>}
            {isHost && <Button onClick={() => wrap(() => start.mutateAsync(tableId))} disabled={busy || view.players.length < 2}>Start hand</Button>}
            {!isHost && <p className="text-sm text-muted">Waiting for the host to start…</p>}
          </div>
        ) : myTurn ? (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="danger" onClick={() => wrap(() => act.mutateAsync({ tableId, action: 'fold', raiseTo: 0 }))} disabled={busy}>Fold</Button>
              {owe === 0 ? (
                <Button variant="secondary" onClick={() => wrap(() => act.mutateAsync({ tableId, action: 'check', raiseTo: 0 }))} disabled={busy}>Check</Button>
              ) : (
                <Button onClick={() => wrap(() => act.mutateAsync({ tableId, action: 'call', raiseTo: 0 }))} disabled={busy}>Call {formatAmount(Math.min(owe, me?.stack ?? 0))}</Button>
              )}
              <Button onClick={() => wrap(() => act.mutateAsync({ tableId, action: 'raise', raiseTo: Math.max(raiseTo, minRaiseTo) }))} disabled={busy || (me?.stack ?? 0) <= owe}>
                Raise to {formatAmount(Math.max(raiseTo, minRaiseTo))}
              </Button>
            </div>
            <Input id="raise" type="range" min={minRaiseTo} max={(me?.stack ?? 0) + (me?.committed ?? 0)}
              value={Math.max(raiseTo, minRaiseTo)} onChange={(e) => setRaiseTo(Number(e.target.value))} />
          </>
        ) : view.handOver ? (
          <div className="flex justify-center gap-2">
            {isHost ? <Button onClick={() => wrap(() => deal.mutateAsync(tableId))} disabled={busy}>Next hand</Button>
              : <p className="text-sm text-muted">Hand over — waiting for the host.</p>}
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Waiting for {view.players.find((p) => p.id === view.toActId)?.name ?? 'others'}…</p>
        )}
        {error && <p className="text-center text-sm text-negative">{error}</p>}
      </div>

      {view.log.length > 0 && <p className="text-center text-xs text-muted">{view.log.join(' · ')}</p>}
    </div>
  );
}
