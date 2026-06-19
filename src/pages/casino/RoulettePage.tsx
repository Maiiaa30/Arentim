import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useRoulette } from '@/features/casino/useRoulette';
import { RouletteWheel } from '@/features/casino/RouletteWheel';
import { BettingBoard } from '@/features/casino/BettingBoard';
import { WinCelebration } from '@/features/casino/WinCelebration';
import {
  colorOf,
  totalStake,
  type RouletteBet,
  type RouletteBetKind,
} from '@/features/casino/roulette';
import type { RouletteSpinResult } from '@/types/db';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

const CHIPS = [5, 10, 25, 50, 100];

function betLabel(b: RouletteBet): string {
  if (b.kind === 'straight') return `Pleno ${b.selection}`;
  const labels: Record<RouletteBetKind, string> = {
    straight: 'Pleno',
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

export function RoulettePage() {
  const { data: profile } = useProfile();
  const roulette = useRoulette();

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

  const staked = totalStake(bets);
  const balance = profile?.balance ?? 0;
  const canSpin = bets.length > 0 && !spinning && staked <= balance;

  function placeBet(kind: RouletteBetKind, selection: number | null) {
    if (spinning) return;
    setError(null);
    if (staked + chip > balance) {
      setError('Tostões insuficientes para essa ficha.');
      return;
    }
    setBets((prev) => {
      const idx = prev.findIndex((b) => b.kind === kind && b.selection === selection);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, stake: next[idx]!.stake + chip };
        return next;
      }
      return [...prev, { kind, selection, stake: chip }];
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
      setResult(res);
      setSpinToken((t) => t + 1);
      setRecent((r) => [res.number, ...r].slice(0, 12));
      landTimer.current = window.setTimeout(() => {
        setSpinning(false);
        setLanded(true);
        setBets([]);
      }, 4300);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'Não foi possível liquidar a jogada.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">
            ← Casino
          </Link>
          <Eyebrow className="mt-3">O Salão</Eyebrow>
          <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Roleta</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Wheel + result */}
        <div className="felt felt-rail relative flex flex-col items-center gap-4 overflow-hidden rounded-lg p-6">
          {landed && result && result.payout > 0 && <WinCelebration key={spinToken} />}
          <RouletteWheel spinToken={spinToken} result={result?.number ?? null} spinning={spinning} />

          <div className="h-12 text-center">
            {landed && result && (
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
              </div>
            )}
            {spinning && <p className="font-sans text-sm text-muted">A rodar…</p>}
          </div>

          {recent.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {recent.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${
                    colorOf(n) === 'red'
                      ? 'bg-negative'
                      : colorOf(n) === 'green'
                        ? 'bg-positive'
                        : 'bg-black/70'
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Board + slip */}
        <div className="space-y-4">
          <div className="felt felt-rail rounded-lg p-4">
            <BettingBoard onPlace={placeBet} disabled={spinning} />
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-sm font-medium text-muted">Tamanho da ficha</span>
              <div className="flex gap-1.5">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChip(c)}
                    className={`focus-ring rounded px-3 py-1 font-mono text-sm font-semibold transition-colors ${
                      chip === c ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'
                    }`}
                  >
                    {c}
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
