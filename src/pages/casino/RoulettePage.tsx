import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useRoulette, useRecentRoulette, useRouletteBonus } from '@/features/casino/useRoulette';
import { RouletteWheel } from '@/features/casino/RouletteWheel';
import { BettingBoard } from '@/features/casino/BettingBoard';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Chip } from '@/features/casino/Chip';
import {
  colorOf,
  totalStake,
  betCellKey,
  type RouletteBet,
  type RouletteBetKind,
} from '@/features/casino/roulette';
import type { RouletteSpinResult } from '@/types/db';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

const CHIPS = [5, 10, 25, 50, 100];

/** How long the wheel visibly spins before the result is unveiled. */
const SPIN_MS = 4300;

function betLabel(b: RouletteBet): string {
  if (b.kind === 'straight') return `Pleno ${b.selection}`;
  if (b.kind === 'split') return `Split ${b.numbers?.join('/')}`;
  if (b.kind === 'corner') return `Canto ${b.numbers?.join('/')}`;
  const labels: Record<RouletteBetKind, string> = {
    straight: 'Pleno',
    split: 'Split',
    corner: 'Canto',
    red: 'Vermelho',
    black: 'Preto',
    even: 'Par',
    odd: 'Ímpar',
    low: '1–18',
    high: '19–36',
    dozen1: '1.ª dúzia',
    dozen2: '2.ª dúzia',
    dozen3: '3.ª dúzia',
    col1: 'Coluna 1',
    col2: 'Coluna 2',
    col3: 'Coluna 3',
  };
  return labels[b.kind];
}

const colorLabel: Record<string, string> = {
  red: 'vermelho',
  black: 'preto',
  green: 'verde',
};

const colorText: Record<string, string> = {
  red: 'text-negative',
  black: 'text-text',
  green: 'text-positive',
};

function numberBadge(n: number, key: string) {
  const c = colorOf(n);
  return (
    <span
      key={key}
      className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-semibold text-white ring-1 ring-inset ring-gold/30 ${
        c === 'red' ? 'bg-[#b0303a]' : c === 'green' ? 'bg-[#1f8a5b]' : 'bg-[#14110c]'
      }`}
    >
      {n}
    </span>
  );
}

/** Hot (most frequent) and cold (absent) numbers over the recent spins. */
function HotCold({ recent }: { recent: number[] }) {
  if (recent.length < 4) return null;
  const counts = new Map<number, number>();
  recent.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
  const hot = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || recent.indexOf(a[0]) - recent.indexOf(b[0]))
    .slice(0, 4)
    .map((e) => e[0]);
  const cold = Array.from({ length: 37 }, (_, i) => i).filter((n) => !counts.has(n)).slice(0, 4);

  return (
    <div className="grid w-full grid-cols-2 gap-3 border-t border-gold/20 pt-3">
      <div>
        <p className="mb-1.5 font-sans text-[9px] uppercase tracking-[0.2em] text-negative">Quentes</p>
        <div className="flex gap-1">{hot.map((n, i) => numberBadge(n, `h${n}-${i}`))}</div>
      </div>
      <div>
        <p className="mb-1.5 font-sans text-[9px] uppercase tracking-[0.2em] text-positive">Frios</p>
        <div className="flex gap-1">{cold.map((n, i) => numberBadge(n, `c${n}-${i}`))}</div>
      </div>
    </div>
  );
}

export function RoulettePage() {
  const { data: profile } = useProfile();
  const roulette = useRoulette();
  const { data: rouletteHistory } = useRecentRoulette();
  const { data: bonus } = useRouletteBonus();
  const seededHistory = useRef(false);

  const [chip, setChip] = useState(CHIPS[1]!);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [spinToken, setSpinToken] = useState(0);
  const [result, setResult] = useState<RouletteSpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [recent, setRecent] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const landTimer = useRef<number | null>(null);

  useEffect(() => () => { if (landTimer.current) window.clearTimeout(landTimer.current); }, []);

  // Seed the recent-results strip from the DB once, so "últimos resultados"
  // survive a page reload (each spin is recorded in game_rounds).
  useEffect(() => {
    if (!seededHistory.current && rouletteHistory && rouletteHistory.length) {
      seededHistory.current = true;
      setRecent((r) => (r.length ? r : rouletteHistory));
    }
  }, [rouletteHistory]);

  const staked = totalStake(bets);
  const balance = profile?.balance ?? 0;
  const canSpin = bets.length > 0 && !spinning && staked <= balance;

  // Per-cell stake map so the board can render chip badges on placed bets.
  const stakeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of bets) m[betCellKey(b.kind, b.selection, b.numbers)] = b.stake;
    return m;
  }, [bets]);

  const bonusSet = useMemo(() => new Set(bonus?.numbers ?? []), [bonus]);
  const bonusMult = bonus?.mult ?? 2;

  // A straight-up hit (or a hefty multiple of the stake) earns the jackpot burst.
  const jackpotWin =
    (!!result && result.payout > 0 && result.payout >= Math.max(result.stake * 6, 1)) || !!result?.bonus_hit;

  function placeBet(kind: RouletteBetKind, selection: number | null, numbers?: number[]) {
    if (spinning) return;
    setError(null);
    if (staked + chip > balance) {
      setError('Tostões insuficientes para essa ficha.');
      return;
    }
    // Clear a settled result the moment the player starts a fresh slip.
    if (landed) {
      setLanded(false);
      setResult(null);
    }
    const k = betCellKey(kind, selection, numbers);
    setBets((prev) => {
      const idx = prev.findIndex((b) => betCellKey(b.kind, b.selection, b.numbers) === k);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, stake: next[idx]!.stake + chip };
        return next;
      }
      return [...prev, { kind, selection, stake: chip, ...(numbers ? { numbers } : {}) }];
    });
  }

  function clearBets() {
    if (spinning) return;
    setBets([]);
    setError(null);
  }

  async function spin() {
    if (!canSpin) return;
    setError(null);
    setLanded(false);
    setSpinning(true);
    try {
      const res = await roulette.mutateAsync(bets);
      // Hand the target to the wheel so it can animate toward it. The number,
      // payout and history stay hidden until the wheel actually settles.
      setResult(res);
      setSpinToken((t) => t + 1);
      landTimer.current = window.setTimeout(() => {
        setSpinning(false);
        setLanded(true);
        setRecent((r) => [res.number, ...r].slice(0, 12));
        setBets([]);
      }, SPIN_MS);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'Não foi possível liquidar a jogada.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {landed && result && result.payout > 0 && (
        <WinCelebration key={spinToken} jackpot={jackpotWin} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">
            ← Casino
          </Link>
          <Eyebrow className="mt-3">O Salão</Eyebrow>
          <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Roleta</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Wheel + result */}
        <div className="felt felt-rail relative flex flex-col items-center gap-4 overflow-hidden rounded-lg p-5 sm:p-6">
          <RouletteWheel
            spinToken={spinToken}
            result={result?.number ?? null}
            spinning={spinning}
            landed={landed}
          />

          <div className="flex h-12 items-center text-center">
            {spinning ? (
              <p className="font-sans text-sm text-gold-light animate-floaty">A roda gira…</p>
            ) : landed && result ? (
              <div className="animate-fade-in">
                <p className={`font-display text-lg font-bold ${colorText[colorOf(result.number)]}`}>
                  {result.number} · {colorLabel[colorOf(result.number)]}
                </p>
                <p
                  className={`font-sans text-sm font-semibold ${
                    result.payout > 0 ? 'text-positive' : 'text-muted'
                  }`}
                >
                  {result.payout > 0
                    ? `Ganhou ${formatAmount(result.payout)} Tostões`
                    : 'Sem prémio desta vez'}
                </p>
                {result.bonus_hit && (
                  <p className="animate-pop font-display text-sm font-bold text-gold">⭐ Número da sorte! Prémio a dobrar</p>
                )}
              </div>
            ) : (
              <p className="font-sans text-sm text-muted">Faça as suas apostas.</p>
            )}
          </div>

          {recent.length > 0 && (
            <div className="w-full">
              <p className="mb-1.5 text-center font-sans text-[9px] uppercase tracking-[0.2em] text-muted-2">Últimos resultados</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {recent.map((n, i) => numberBadge(n, `${n}-${i}`))}
              </div>
            </div>
          )}

          <HotCold recent={recent} />
        </div>

        {/* Board + slip */}
        <div className="space-y-4">
          {/* Lucky-number mini-game banner */}
          {bonus && bonusSet.size > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/[0.08] px-3 py-2 text-center">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">⭐ Números da sorte</span>
              <span className="flex gap-1.5">{[...bonusSet].map((n) => numberBadge(n, `lucky-${n}`))}</span>
              <span className="font-sans text-[11px] text-muted">— um pleno num destes paga <span className="font-bold text-gold-light">{bonusMult}×</span></span>
            </div>
          )}

          <div className="felt felt-rail overflow-x-auto rounded-lg p-3 sm:p-4">
            <div className="min-w-[300px]">
              <BettingBoard onPlace={placeBet} stakes={stakeMap} bonus={bonusSet} disabled={spinning} />
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3">
              <span className="mb-2 block font-sans text-sm font-medium text-muted">Tamanho da ficha</span>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChip(c)}
                    aria-label={`Ficha de ${c}`}
                    aria-pressed={chip === c}
                    className={`focus-ring rounded-full transition-transform ${
                      chip === c ? 'scale-110 ring-2 ring-gold ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Chip value={c} size={42} />
                  </button>
                ))}
              </div>
            </div>

            {bets.length === 0 ? (
              <p className="py-2 font-sans text-sm text-muted">
                Escolha uma ficha e toque na mesa para apostar.
              </p>
            ) : (
              <ul className="mb-3 space-y-1">
                {bets.map((b, i) => (
                  <li key={`${b.kind}-${b.selection}-${i}`} className="flex justify-between text-sm">
                    <span className="font-sans text-text">{betLabel(b)}</span>
                    <span className="font-mono tabular-nums text-muted">{formatAmount(b.stake)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="flex items-center gap-1 font-sans text-sm text-muted">
                Total <CoinIcon className="h-3.5 w-3.5" />
                <span className="font-mono tabular-nums font-semibold text-text">{formatAmount(staked)}</span>
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={clearBets} disabled={spinning || bets.length === 0}>
                  Limpar
                </Button>
                <Button variant="primary" onClick={spin} disabled={!canSpin}>
                  {spinning ? 'A rodar…' : 'Rodar'}
                </Button>
              </div>
            </div>

            {error && <p className="mt-2 font-sans text-sm text-negative">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
