import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { usePoker, usePokerState, type PokerResult } from '@/features/poker/usePoker';
import { PokerTable, ResultBanner } from '@/features/poker/PokerTable';
import { PokerActionBar } from '@/features/poker/PokerActionBar';
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

/** Pause between each bot's move when replaying a hand's trail. */
const BOT_STEP_MS = 650;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PokerPage() {
  const { data: profile } = useProfile();
  const { data: resumed } = usePokerState();
  const { sit, act, deal, leave } = usePoker();

  const [view, setView] = useState<PokerView | null>(null);
  const [buyIn, setBuyIn] = useState(200);
  const [botCount, setBotCount] = useState(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [raiseTo, setRaiseTo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  // Resume an in-progress table exactly once (on first load). Without the guard
  // the resume would re-populate the table the instant you leave it.
  const resumeApplied = useRef(false);
  useEffect(() => {
    if (!resumeApplied.current && resumed?.view) {
      resumeApplied.current = true;
      setView(resumed.view);
    }
  }, [resumed]);

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
      resumeApplied.current = true; // we now own the live view; don't let resume override it
      const trail = res.trail ?? [];
      if (trail.length === 0) {
        setView(res.view);
        return;
      }
      // Replay the hand one move at a time so the bots don't all act instantly.
      setAnimating(true);
      for (const step of trail) {
        setView(step);
        await sleep(BOT_STEP_MS);
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
          {leave.isPending ? 'A sair…' : 'Sair da mesa'}
        </Button>
      </div>

      <PokerTable view={view} youId="you" myTurn={!!myTurn} resultBanner={<ResultBanner view={view} />} />

      {/* Actions */}
      <div className="card space-y-3 p-4">
        {myTurn ? (
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
