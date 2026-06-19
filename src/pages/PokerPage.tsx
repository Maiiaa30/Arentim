import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { usePoker, usePokerState } from '@/features/poker/usePoker';
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
      setError(e instanceof Error ? e.message : 'A ação falhou.');
    }
  }

  async function onSit() {
    if (buyIn > balance) return setError('Saldo insuficiente para essa entrada.');
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
          <Link to="/poker" className="font-sans text-sm text-muted-2 hover:text-text">← Póquer</Link>
          <div className="mt-4">
            <Eyebrow>Contra bots</Eyebrow>
            <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Póquer</h1>
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted">
              Texas Hold'em contra bots. O servidor distribui; os bots não podem ser espreitados.
            </p>
          </div>
        </div>
        <div className="card mx-auto max-w-md space-y-5 p-6">
          <Input
            id="buyin" type="number" label="Entrada" min={100} value={buyIn}
            onChange={(e) => setBuyIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
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
  const minRaiseTo = view.currentBet + view.minRaise;
  const maxRaiseTo = (you?.stack ?? 0) + (you?.committed ?? 0);
  const effRaiseTo = Math.max(raiseTo, minRaiseTo);
  const canRaise = (you?.stack ?? 0) > owe;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-medium text-text sm:text-[32px]">Póquer</h1>
        <Button variant="secondary" onClick={onLeave} disabled={busy}>Sair da mesa</Button>
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
