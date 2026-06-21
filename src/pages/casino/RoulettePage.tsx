import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useRouletteRoom } from '@/features/casino/useRouletteRoom';
import { secondsLeft } from '@/features/casino/liveRoom';
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
import type { RouletteBetPayload } from '@/types/db';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

const CHIPS = [5, 10, 25, 50, 100];

function betLabel(b: RouletteBet): string {
  if (b.kind === 'straight') return `Pleno ${b.selection}`;
  if (b.kind === 'split') return `Split ${b.numbers?.join('/')}`;
  if (b.kind === 'corner') return `Canto ${b.numbers?.join('/')}`;
  const labels: Record<RouletteBetKind, string> = {
    straight: 'Pleno', split: 'Split', corner: 'Canto', red: 'Vermelho', black: 'Preto',
    even: 'Par', odd: 'Ímpar', low: '1–18', high: '19–36',
    dozen1: '1.ª dúzia', dozen2: '2.ª dúzia', dozen3: '3.ª dúzia',
    col1: 'Coluna 1', col2: 'Coluna 2', col3: 'Coluna 3',
  };
  return labels[b.kind];
}

const colorLabel: Record<string, string> = { red: 'vermelho', black: 'preto', green: 'verde' };
const colorText: Record<string, string> = { red: 'text-negative', black: 'text-text', green: 'text-positive' };

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

function humanize(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('apostas fechadas')) return 'As apostas desta ronda já fecharam.';
  if (m.includes('já apostaste')) return 'Já apostaste nesta ronda.';
  if (m.includes('insufficient')) return 'Tostões insuficientes.';
  return 'Não foi possível registar a aposta.';
}

export function RoulettePage() {
  const { data: profile } = useProfile();
  const { state, roomBets, history, placeBet } = useRouletteRoom();

  const [chip, setChip] = useState(CHIPS[1]!);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [lastBets, setLastBets] = useState<RouletteBet[]>([]); // previous confirmed slip, for "Repetir"
  const [chipHistory, setChipHistory] = useState<{ key: string; amount: number }[]>([]); // chip order, for "Anular"
  const [error, setError] = useState<string | null>(null);

  // Wheel animation, driven by the shared room phase.
  const [spinToken, setSpinToken] = useState(0);
  const [wheelResult, setWheelResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [winId, setWinId] = useState(0);
  const spunRoom = useRef<number | null>(null);
  const settledRoom = useRef<number | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (state?.server_now) offsetRef.current = new Date(state.server_now).getTime() - Date.now();
  }, [state?.server_now]);

  const status = state?.status ?? null;
  const betting = status === 'betting';
  const mine = state?.mine ?? null;
  const roomId = state?.room_id ?? null;

  // New round → clear the local slip.
  useEffect(() => {
    setBets([]);
    setError(null);
  }, [roomId]);

  // Phase → wheel.
  useEffect(() => {
    if (!state) return;
    if (state.status === 'betting') {
      if (spunRoom.current !== state.room_id) {
        setSpinning(false);
        setLanded(false);
        setWheelResult(null);
      }
    } else if (state.status === 'spinning' && state.number != null && spunRoom.current !== state.room_id) {
      spunRoom.current = state.room_id;
      setWheelResult(state.number);
      setSpinning(true);
      setLanded(false);
      setSpinToken((t) => t + 1);
    } else if (state.status === 'done') {
      setSpinning(false);
      setLanded(true);
      if (state.number != null) setWheelResult(state.number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, state?.number, state?.room_id]);

  // Win celebration when my slip settles as a winner.
  useEffect(() => {
    if (status === 'done' && mine?.settled && mine.payout > 0 && settledRoom.current !== roomId) {
      settledRoom.current = roomId;
      setWinId((n) => n + 1);
    }
  }, [status, mine?.settled, mine?.payout, roomId]);

  const staked = totalStake(bets);
  const balance = profile?.balance ?? 0;
  const serverNow = Date.now() + offsetRef.current;
  const bettingLeft = state ? secondsLeft(state.betting_ends_at, serverNow) : 0;
  const nextLeft = status === 'done' && state ? secondsLeft(state.reveal_at, serverNow - 6000) : 0;

  const stakeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of bets) m[betCellKey(b.kind, b.selection, b.numbers)] = b.stake;
    return m;
  }, [bets]);

  const bonusSet = useMemo(() => new Set(state?.bonus?.numbers ?? []), [state?.bonus]);
  const boardDisabled = !betting || !!mine;

  const jackpotWin = !!mine && mine.settled && (mine.payout >= Math.max(mine.stake * 6, 1) || mine.bonus_hit);

  function placeChip(kind: RouletteBetKind, selection: number | null, numbers?: number[]) {
    if (boardDisabled) return;
    setError(null);
    if (staked + chip > balance) {
      setError('Tostões insuficientes para essa ficha.');
      return;
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
    setChipHistory((h) => [...h, { key: k, amount: chip }]);
  }

  function clearBets() {
    if (boardDisabled) return;
    setBets([]);
    setChipHistory([]);
    setError(null);
  }

  /** Remove the last chip placed (reduce a bet without clearing everything). */
  function undoChip() {
    if (boardDisabled || chipHistory.length === 0) return;
    const last = chipHistory[chipHistory.length - 1]!;
    setChipHistory((h) => h.slice(0, -1));
    setBets((prev) => {
      const idx = prev.findIndex((b) => betCellKey(b.kind, b.selection, b.numbers) === last.key);
      if (idx < 0) return prev;
      const next = [...prev];
      const stake = next[idx]!.stake - last.amount;
      if (stake <= 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx]!, stake };
      return next;
    });
    setError(null);
  }

  /** Re-place the previous confirmed slip in one tap. */
  function repeatBet() {
    if (!betting || mine || lastBets.length === 0) return;
    if (totalStake(lastBets) > balance) { setError('Saldo insuficiente para repetir a aposta.'); return; }
    setBets(lastBets.map((b) => ({ ...b })));
    setChipHistory([]); // repeated slip is cleared with Limpar, not chip-by-chip
    setError(null);
  }

  async function confirm() {
    if (!betting || mine || bets.length === 0) return;
    setError(null);
    setLastBets(bets.map((b) => ({ ...b }))); // remember for "Repetir"
    try {
      await placeBet.mutateAsync(bets as RouletteBetPayload[]);
      // Keep the slip on the board so the chips stay visible while the wheel
      // spins; the new-round effect clears them when the next window opens.
      setChipHistory([]);
    } catch (e) {
      setError(humanize(e));
    }
  }

  // Auto-bet: if the betting window is about to close and chips are placed but
  // not yet confirmed, submit them automatically (once per round) so a player who
  // forgot to press "Confirmar" still gets the bet they set up. Fires ~1s early so
  // the request lands before the server closes the window.
  const autoBetRoom = useRef<number | null>(null);
  useEffect(() => {
    if (!betting || mine || bets.length === 0 || placeBet.isPending) return;
    if (bettingLeft > 1) return;
    if (autoBetRoom.current === roomId) return;
    autoBetRoom.current = roomId;
    void confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betting, mine, bets.length, bettingLeft, roomId, placeBet.isPending]);

  return (
    <div className="animate-fade-in space-y-6">
      {status === 'done' && mine?.settled && mine.payout > 0 && <WinCelebration key={winId} jackpot={jackpotWin} />}

      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão · Mesa ao vivo</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Roleta</h1>
        <p className="mt-2 font-sans text-sm text-muted">Uma só roda para todos. Aposta durante a janela — todos veem a mesma bola cair.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Wheel + result */}
        <div className="felt felt-rail relative flex flex-col items-center gap-4 overflow-hidden rounded-lg p-5 sm:p-6">
          <RouletteWheel spinToken={spinToken} result={wheelResult} spinning={spinning} landed={landed} />

          <div className="flex h-12 items-center text-center">
            {betting ? (
              <p className="font-display text-base font-bold text-gold-light">
                Apostas abertas · <span className="font-mono">{bettingLeft}s</span>
              </p>
            ) : spinning ? (
              <p className="font-sans text-sm text-gold-light animate-floaty">A roda gira…</p>
            ) : landed && wheelResult !== null ? (
              <div className="animate-fade-in">
                <p className={`font-display text-lg font-bold ${colorText[colorOf(wheelResult)]}`}>
                  {wheelResult} · {colorLabel[colorOf(wheelResult)]}
                </p>
                {mine?.settled ? (
                  <p className={`font-sans text-sm font-semibold ${mine.payout > 0 ? 'text-positive' : 'text-muted'}`}>
                    {mine.payout > 0 ? `Ganhaste ${formatAmount(mine.payout)} tós` : 'Sem prémio desta vez'}
                    {mine.bonus_hit && <span className="ml-1 text-gold">⭐</span>}
                  </p>
                ) : (
                  <p className="font-sans text-sm text-muted-2">Próxima ronda em {nextLeft}s</p>
                )}
              </div>
            ) : (
              <p className="font-sans text-sm text-muted">A preparar a roda…</p>
            )}
          </div>

          {history.length > 0 && (
            <div className="w-full">
              <p className="mb-1.5 text-center font-sans text-[9px] uppercase tracking-[0.2em] text-muted-2">Últimos resultados</p>
              <div className="flex flex-wrap justify-center gap-1.5">{history.map((n, i) => numberBadge(n, `${n}-${i}`))}</div>
            </div>
          )}

          <HotCold recent={history} />
        </div>

        {/* Board + slip */}
        <div className="space-y-4">
          {bonusSet.size > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/[0.08] px-3 py-2 text-center">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">⭐ Números em destaque</span>
              <span className="flex gap-1.5">{[...bonusSet].map((n) => numberBadge(n, `lucky-${n}`))}</span>
              <span className="font-sans text-[11px] text-muted">— os números a seguir nesta ronda</span>
            </div>
          )}

          <div className="felt felt-rail overflow-x-auto rounded-lg p-3 sm:p-4">
            <div className="min-w-[300px]">
              <BettingBoard onPlace={placeChip} stakes={stakeMap} bonus={bonusSet} disabled={boardDisabled} />
            </div>
          </div>

          {/* Live bets from everyone */}
          {roomBets.length > 0 && (
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-sm font-medium text-text">Apostas da mesa</span>
                <span className="font-mono text-xs text-muted-2">{roomBets.length}</span>
              </div>
              <ul className="space-y-1.5">
                {roomBets.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-sans text-text">{b.display_name}</span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-muted-2">{formatAmount(b.stake)}</span>
                      {b.settled && (
                        <span className={b.payout > 0 ? 'text-positive' : 'text-muted'}>
                          {b.payout > 0 ? `+${formatAmount(b.payout)}` : '—'}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                    disabled={boardDisabled}
                    className={`focus-ring rounded-full transition-transform disabled:opacity-40 ${
                      chip === c ? 'scale-110 ring-2 ring-gold ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Chip value={c} size={42} />
                  </button>
                ))}
              </div>
            </div>

            {mine ? (
              <p className="py-2 font-sans text-sm text-positive">Apostaste {formatAmount(mine.stake)} tós nesta ronda. A aguardar a roda…</p>
            ) : bets.length === 0 ? (
              <p className="py-2 font-sans text-sm text-muted">
                {betting ? 'Escolhe uma ficha e toca na mesa para apostar.' : 'Aguarda a próxima janela de apostas.'}
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
                <span className="font-mono tabular-nums font-semibold text-text">{formatAmount(mine ? mine.stake : staked)}</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={repeatBet} disabled={!betting || !!mine || lastBets.length === 0}>
                  Repetir
                </Button>
                <Button variant="ghost" onClick={undoChip} disabled={boardDisabled || chipHistory.length === 0}>
                  Anular
                </Button>
                <Button variant="ghost" onClick={clearBets} disabled={boardDisabled || bets.length === 0}>
                  Limpar
                </Button>
                <Button variant="primary" onClick={confirm} disabled={!betting || !!mine || bets.length === 0 || placeBet.isPending || staked > balance}>
                  {placeBet.isPending ? 'A apostar…' : 'Confirmar aposta'}
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
