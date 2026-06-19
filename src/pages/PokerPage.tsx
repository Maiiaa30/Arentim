import { useEffect, useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { usePoker, usePokerState } from '@/features/poker/usePoker';
import { PokerCard } from '@/features/poker/PokerCard';
import type { PokerView, PokerPlayerView } from '@/features/poker/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

function Seat({ p, isTurn, isYou }: { p: PokerPlayerView; isTurn: boolean; isYou: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isTurn ? 'border-gold bg-gold/10' : 'border-border bg-surface'
      } ${p.status === 'folded' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text">
          {p.name}
          {isYou && <span className="text-muted"> (you)</span>}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <CoinIcon className="h-3 w-3" /> {formatAmount(p.stack)}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {p.hole.length === 0
          ? <span className="text-xs text-muted">—</span>
          : p.hole.map((c, i) => <PokerCard key={i} card={c} small />)}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="capitalize text-muted">{p.status === 'allin' ? 'all-in' : p.status}</span>
        {p.committed > 0 && <span className="tabular-nums text-gold">{formatAmount(p.committed)}</span>}
      </div>
    </div>
  );
}

export function PokerPage() {
  const { data: profile } = useProfile();
  const { data: resumed } = usePokerState();
  const { sit, act, deal, leave } = usePoker();

  const [view, setView] = useState<PokerView | null>(null);
  const [buyIn, setBuyIn] = useState(1000);
  const [botCount, setBotCount] = useState(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [raiseTo, setRaiseTo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resumed?.view && !view) setView(resumed.view);
  }, [resumed, view]);

  const balance = profile?.balance ?? 0;
  const you = view?.players.find((p) => p.id === 'you');
  const myTurn = view?.toActId === 'you' && !view.handOver;
  const owe = view ? view.currentBet - (you?.committed ?? 0) : 0;
  const busy = sit.isPending || act.isPending || deal.isPending || leave.isPending;

  async function run(fn: () => Promise<{ view: PokerView }>) {
    setError(null);
    try {
      const res = await fn();
      setView(res.view);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    }
  }

  async function onSit() {
    if (buyIn > balance) return setError('Not enough Tostões for that buy-in.');
    await run(() => sit.mutateAsync({ buyIn, botCount, difficulty }));
  }
  async function onLeave() {
    setError(null);
    try {
      await leave.mutateAsync();
      setView(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave.');
    }
  }

  // ---- Lobby ----
  if (!view) {
    return (
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Poker</h1>
          <p className="mt-1 text-sm text-muted">Texas Hold'em vs bots. Server deals; bots can't be peeked.</p>
        </div>
        <div className="card mx-auto max-w-md space-y-4 p-6">
          <Input
            id="buyin" type="number" label="Buy-in" min={100} value={buyIn}
            onChange={(e) => setBuyIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Opponents</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setBotCount(n)}
                  className={`focus-ring flex-1 rounded-lg border py-2 text-sm ${botCount === n ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`focus-ring flex-1 rounded-lg border py-2 text-sm capitalize ${difficulty === d ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={onSit} disabled={busy || buyIn > balance || buyIn < 100} className="w-full">
            {busy ? 'Dealing…' : `Sit down · ${formatAmount(buyIn)}`}
          </Button>
          {error && <p className="text-sm text-negative">{error}</p>}
        </div>
      </div>
    );
  }

  // ---- Table ----
  const bots = view.players.filter((p) => p.id !== 'you');
  const minRaiseTo = view.currentBet + view.minRaise;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text">Poker</h1>
        <Button variant="secondary" onClick={onLeave} disabled={busy}>Leave table</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bots.map((p) => (
          <Seat key={p.id} p={p} isTurn={view.toActId === p.id} isYou={false} />
        ))}
      </div>

      {/* Board + pot */}
      <div className="card flex flex-col items-center gap-3 p-6">
        <span className="flex items-center gap-1 text-sm text-muted">
          Pot <CoinIcon className="h-3.5 w-3.5" />
          <span className="font-semibold text-text">{formatAmount(view.pot)}</span>
        </span>
        <div className="flex gap-2">
          {view.community.length === 0
            ? <span className="text-sm text-muted">Pre-flop</span>
            : view.community.map((c, i) => <PokerCard key={i} card={c} />)}
        </div>
        {view.result && (
          <p className="text-center text-sm font-semibold text-positive">
            {view.result.winners.map((w) => {
              const name = view.players.find((p) => p.id === w.id)?.name ?? w.id;
              return `${name} wins ${formatAmount(w.amount)}`;
            }).join(' · ')}
          </p>
        )}
      </div>

      {/* You */}
      {you && (
        <div className="mx-auto max-w-md">
          <Seat p={you} isTurn={!!myTurn} isYou />
        </div>
      )}

      {/* Actions */}
      <div className="card space-y-3 p-4">
        {myTurn ? (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="danger" onClick={() => run(() => act.mutateAsync({ action: 'fold', raiseTo: 0 }))} disabled={busy}>
                Fold
              </Button>
              {owe === 0 ? (
                <Button variant="secondary" onClick={() => run(() => act.mutateAsync({ action: 'check', raiseTo: 0 }))} disabled={busy}>
                  Check
                </Button>
              ) : (
                <Button onClick={() => run(() => act.mutateAsync({ action: 'call', raiseTo: 0 }))} disabled={busy}>
                  Call {formatAmount(Math.min(owe, you?.stack ?? 0))}
                </Button>
              )}
              <Button
                onClick={() => run(() => act.mutateAsync({ action: 'raise', raiseTo: Math.max(raiseTo, minRaiseTo) }))}
                disabled={busy || (you?.stack ?? 0) <= owe}
              >
                Raise to {formatAmount(Math.max(raiseTo, minRaiseTo))}
              </Button>
            </div>
            <Input
              id="raise" type="range" min={minRaiseTo} max={(you?.stack ?? 0) + (you?.committed ?? 0)}
              value={Math.max(raiseTo, minRaiseTo)} onChange={(e) => setRaiseTo(Number(e.target.value))}
            />
          </>
        ) : view.handOver ? (
          <div className="flex justify-center gap-2">
            {(you?.stack ?? 0) > 0 ? (
              <Button onClick={() => run(() => deal.mutateAsync())} disabled={busy}>Next hand</Button>
            ) : (
              <p className="text-sm text-muted">You're out of chips. Leave to settle up.</p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Waiting for opponents…</p>
        )}
        {error && <p className="text-center text-sm text-negative">{error}</p>}
      </div>

      {view.log.length > 0 && (
        <p className="text-center text-xs text-muted">{view.log.join(' · ')}</p>
      )}
    </div>
  );
}
