import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { usePoker, usePokerState, type PokerResult } from '@/features/poker/usePoker';
import { PokerTable, ResultBanner } from '@/features/poker/PokerTable';
import { PokerActionBar } from '@/features/poker/PokerActionBar';
import { TurnTimer } from '@/features/poker/TurnTimer';
import type { PokerView } from '@/features/poker/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const DIFFICULTY_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

const BUYIN_PRESETS = [100, 200, 500, 1000, 2500];

/** Randomised pause between each bot's replayed move, so they don't all act at
 *  once (and the table feels like real opponents thinking). */
const botDelay = () => 480 + Math.random() * 1120;
/** Seconds the player gets to act before the table auto-checks/folds for them. */
const TURN_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PokerPage() {
  const { data: profile } = useProfile();
  const { data: resumed } = usePokerState();
  const { sit, act, deal, leave } = usePoker();

  const [view, setView] = useState<PokerView | null>(null);
  const [buyIn, setBuyIn] = useState(200);
  const [botCount, setBotCount] = useState(5); // default: a full table
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [raiseTo, setRaiseTo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  // An in-progress table from a previous visit, if any. We DON'T auto-jump into
  // it — the lobby offers a "Retomar" button instead, so opening this page always
  // lets you set up a fresh game rather than silently dropping you into a hand.
  const resumable = view ? null : resumed?.view ?? null;

  const balance = profile?.balance ?? 0;
  const you = view?.players.find((p) => p.id === 'you');
  const myTurn = view?.toActId === 'you' && !view.handOver;
  const owe = view ? view.currentBet - (you?.committed ?? 0) : 0;
  const busy = sit.isPending || act.isPending || deal.isPending || leave.isPending || animating;

  // Raise range: a normal min-raise, capped by going all-in. Short stacks that
  // can't make a full raise can still shove (min collapses to the all-in total).
  const allInTo = (you?.stack ?? 0) + (you?.committed ?? 0);
  const minRaiseTo = Math.min(view ? view.currentBet + view.minRaise : 0, allInTo);
  const maxRaiseTo = allInTo;
  const canRaise = !!view && allInTo > view.currentBet && !!myTurn;
  const effRaiseTo = Math.max(minRaiseTo, Math.min(raiseTo || minRaiseTo, maxRaiseTo));

  // Reset the chosen raise whenever it becomes the player's turn or the spot
  // changes, so a stale amount from a previous street is never reused.
  useEffect(() => {
    setRaiseTo(0);
  }, [view?.toActId, view?.street, view?.currentBet]);

  // A countdown to act: start the clock each time it lands on the player, and
  // auto-check (or fold facing a bet) if it runs out, so a hand can't stall.
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null);
  useEffect(() => {
    setTurnDeadline(myTurn && !animating ? new Date(Date.now() + TURN_MS).toISOString() : null);
  }, [myTurn, animating, view?.toActId, view?.street, view?.currentBet]);

  // Keep the latest auto-action in a ref so the timeout effect can depend only
  // on the deadline (and not reset every render via fresh closures).
  const autoActRef = useRef<() => void>(() => {});
  autoActRef.current = () => {
    if (!myTurn || busy) return;
    void run(() => act.mutateAsync(owe > 0 ? { action: 'fold', raiseTo: 0 } : { action: 'check', raiseTo: 0 }));
  };
  useEffect(() => {
    if (!turnDeadline) return;
    const id = window.setTimeout(() => autoActRef.current(), Math.max(0, Date.parse(turnDeadline) - Date.now()));
    return () => window.clearTimeout(id);
  }, [turnDeadline]);

  // Quick bet-sizing presets, clamped to the legal range and de-duplicated.
  const quickBets = (() => {
    if (!view || !canRaise) return [];
    const clamp = (n: number) => Math.max(minRaiseTo, Math.min(n, maxRaiseTo));
    const raw = [
      { label: 'Mín', to: minRaiseTo },
      { label: '½ Pote', to: clamp(view.currentBet + Math.round(view.pot * 0.5)) },
      { label: 'Pote', to: clamp(view.currentBet + view.pot) },
      { label: 'All-in', to: maxRaiseTo },
    ];
    const seen = new Set<number>();
    return raw.filter((q) => (seen.has(q.to) ? false : (seen.add(q.to), true)));
  })();

  async function run(fn: () => Promise<PokerResult>) {
    setError(null);
    try {
      const res = await fn();
      const trail = res.trail ?? [];
      if (trail.length === 0) {
        setView(res.view);
        return;
      }
      // Replay the hand one move at a time so the bots don't all act instantly.
      setAnimating(true);
      for (const step of trail) {
        setView(step);
        await sleep(botDelay());
      }
      setView(res.view);
      setAnimating(false);
    } catch (e) {
      setAnimating(false);
      setError(e instanceof Error ? e.message : 'A ação falhou.');
    }
  }

  async function onSit() {
    if (buyIn > balance) return setError('Saldo insuficiente para essa entrada.');
    if (buyIn < 100) return setError('A entrada mínima é 100.');
    // Discard any table left over from a previous visit (cashing its chips back)
    // so the server lets us sit at a fresh one.
    if (resumable) {
      try { await leave.mutateAsync(); } catch { /* nothing to leave */ }
    }
    await run(() => sit.mutateAsync({ buyIn, botCount, difficulty }));
  }
  async function onLeave() {
    setError(null);
    try {
      await leave.mutateAsync();
      setView(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível sair.');
    }
  }

  // ---- Lobby ----
  if (!view) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <Link to="/poker" className="font-sans text-sm text-muted-2 hover:text-text">← Poker</Link>
          <div className="mt-4">
            <Eyebrow>Contra bots</Eyebrow>
            <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Poker</h1>
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted">
              Texas Hold'em contra bots. O servidor distribui; os bots não podem ser espreitados.
            </p>
          </div>
        </div>
        {resumable && (
          <div className="card mx-auto flex max-w-md items-center justify-between gap-3 p-4">
            <p className="font-sans text-sm text-muted">Tem uma mesa por terminar.</p>
            <Button variant="secondary" onClick={() => setView(resumable)} disabled={busy}>Retomar mesa</Button>
          </div>
        )}
        <div className="card mx-auto max-w-md space-y-5 p-6">
          <div>
            <label htmlFor="buyin" className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
              Entrada (fichas para a mesa)
            </label>
            <Input
              id="buyin" type="number" min={100} value={buyIn}
              onChange={(e) => setBuyIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {BUYIN_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBuyIn(amt)}
                  disabled={amt > balance}
                  className={`focus-ring rounded-full border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-30 ${
                    buyIn === amt ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {formatAmount(amt)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setBuyIn(balance)}
                disabled={balance < 100}
                className="focus-ring rounded-full border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-text disabled:opacity-30"
              >
                Máx
              </button>
            </div>
            <p className="mt-1.5 font-sans text-[11px] text-muted-2">Saldo: {formatAmount(balance)} Tostões</p>
          </div>
          <div>
            <label className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Adversários</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setBotCount(n)}
                  className={`focus-ring min-h-[44px] flex-1 rounded border py-2 font-mono text-sm transition-colors ${botCount === n ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Dificuldade</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`focus-ring min-h-[44px] flex-1 rounded border py-2 font-sans text-sm transition-colors ${difficulty === d ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" onClick={onSit} disabled={busy || buyIn > balance || buyIn < 100} className="w-full">
            {busy ? 'A distribuir…' : `Sentar · ${formatAmount(buyIn)}`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    );
  }

  // ---- Table ----
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-medium text-text sm:text-[32px]">Poker</h1>
        <Button variant="secondary" onClick={onLeave} disabled={busy}>
          {leave.isPending ? 'A sair…' : `Sair · levantar ${formatAmount(you?.stack ?? 0)} tós`}
        </Button>
      </div>

      <PokerTable view={view} youId="you" myTurn={!!myTurn} resultBanner={<ResultBanner view={view} />} />

      {/* Actions */}
      <div className="card space-y-3 p-4">
        {myTurn ? (
          <div className="space-y-3">
            {turnDeadline && !busy && <TurnTimer deadline={turnDeadline} />}
            <PokerActionBar
              owe={owe}
              callAmount={Math.min(owe, you?.stack ?? 0)}
              raiseTo={effRaiseTo}
              minRaiseTo={minRaiseTo}
              maxRaiseTo={maxRaiseTo}
              canRaise={canRaise}
              busy={busy}
              quickBets={quickBets}
              onFold={() => run(() => act.mutateAsync({ action: 'fold', raiseTo: 0 }))}
              onCheck={() => run(() => act.mutateAsync({ action: 'check', raiseTo: 0 }))}
              onCall={() => run(() => act.mutateAsync({ action: 'call', raiseTo: 0 }))}
              onRaise={() => run(() => act.mutateAsync({ action: 'raise', raiseTo: effRaiseTo }))}
              onRaiseChange={setRaiseTo}
            />
          </div>
        ) : view.handOver ? (
          <div className="flex justify-center gap-2">
            {(you?.stack ?? 0) > 0 ? (
              <Button variant="primary" onClick={() => run(() => deal.mutateAsync())} disabled={busy}>Próxima mão</Button>
            ) : (
              <p className="font-sans text-sm text-muted">Ficou sem fichas. Saia para acertar contas.</p>
            )}
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-muted">À espera dos adversários…</p>
        )}
        {error && <p className="text-center font-sans text-sm text-negative">{error}</p>}
      </div>

      {view.log.length > 0 && (
        <p className="text-center font-sans text-xs text-muted">{view.log.join(' · ')}</p>
      )}
    </div>
  );
}
