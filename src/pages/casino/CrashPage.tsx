import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useCrashRoom } from '@/features/casino/useCrashRoom';
import { CrashGraph } from '@/features/casino/CrashGraph';
import { crashMult, secondsLeft } from '@/features/casino/liveRoom';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { CrashBetRow } from '@/types/db';

/** Colour a (past) crash multiplier for the history strip. */
function crashColor(m: number): string {
  if (m < 2) return '#e0555f';
  if (m < 5) return '#2b6f4e';
  return '#C9A24B';
}

function humanize(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('apostas fechadas')) return 'As apostas desta ronda já fecharam.';
  if (m.includes('já entraste')) return 'Já entraste nesta ronda.';
  if (m.includes('insufficient')) return 'Saldo insuficiente.';
  return 'Algo correu mal. Tenta de novo.';
}

export function CrashPage() {
  const { data: profile } = useProfile();
  const { state, bets, history, placeBet, cashout } = useCrashRoom();

  const [stake, setStake] = useState(25);
  const [autoOn, setAutoOn] = useState(false);
  const [autoTarget, setAutoTarget] = useState(2);
  const [displayMult, setDisplayMult] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [winId, setWinId] = useState(0);
  const [result, setResult] = useState<{ won: boolean; mult: number; payout: number } | null>(null);

  const offsetRef = useRef(0);
  const settledRef = useRef(false);

  // Keep a server-clock offset so the rocket is in sync across browsers.
  useEffect(() => {
    if (state?.server_now) offsetRef.current = new Date(state.server_now).getTime() - Date.now();
  }, [state?.server_now]);

  const status = state?.status ?? null;
  const roomId = state?.room_id ?? null;
  const mine = state?.mine ?? null;

  // Reset per-round local result tracking when the round changes.
  useEffect(() => {
    settledRef.current = false;
    setResult(null);
    setError(null);
  }, [roomId]);

  // Drive the multiplier: flat at 1 while betting, RAF while flying, crash on bust.
  useEffect(() => {
    if (!state) return;
    if (state.status === 'betting') {
      setDisplayMult(1);
      return;
    }
    if (state.status === 'busted') {
      setDisplayMult(Number(state.crash ?? state.mult ?? 1));
      return;
    }
    const flyStart = new Date(state.fly_start_at).getTime();
    let raf = 0;
    const tick = () => {
      const now = Date.now() + offsetRef.current;
      setDisplayMult(crashMult((now - flyStart) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Restart only when the round/phase changes — not on every 250ms poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, state?.fly_start_at, state?.crash]);

  // Fire confetti / capture my result the moment my bet settles (auto or bust).
  useEffect(() => {
    if (mine && mine.settled && !settledRef.current) {
      settledRef.current = true;
      const won = mine.payout > 0;
      setResult({ won, mult: Number(mine.cashout ?? state?.crash ?? 1), payout: mine.payout });
      if (won) setWinId((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.settled]);

  const balance = profile?.balance ?? 0;
  const serverNow = Date.now() + offsetRef.current;

  const betting = status === 'betting';
  const flying = status === 'flying';
  const busted = status === 'busted';
  const inFlight = !!mine && !mine.settled; // I have a live, un-cashed bet
  const exploded = busted;

  const bettingLeft = state ? secondsLeft(state.betting_ends_at, serverNow) : 0;
  const nextLeft = busted && state?.bust_at ? secondsLeft(state.bust_at, serverNow - 5000) : 0;

  async function enter() {
    setError(null);
    if (stake > balance) {
      setError('Saldo insuficiente.');
      return;
    }
    try {
      await placeBet.mutateAsync({ stake, autoTarget: autoOn ? autoTarget : null });
    } catch (e) {
      setError(humanize(e));
    }
  }

  async function doCashout() {
    try {
      const res = await cashout.mutateAsync();
      settledRef.current = true;
      setResult({ won: res.won, mult: res.mult, payout: res.payout });
      if (res.won) setWinId((n) => n + 1);
    } catch {
      setError('A retirada falhou — tenta outra vez.');
    }
  }

  const multColor = exploded
    ? 'text-negative'
    : flying
      ? 'text-gold-light'
      : result?.won
        ? 'text-positive'
        : 'text-text';

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão · Sala ao vivo</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Crash</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Uma só ronda para todos. Entra durante a janela de apostas e retira antes de rebentar — todos veem o mesmo foguetão.
        </p>
      </div>

      {/* Recent crashes */}
      {history.length > 0 && (
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-1.5">
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Anteriores</span>
          {history.map((h, i) => (
            <span key={i} className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ color: crashColor(h), background: `${crashColor(h)}1a` }}>
              {h.toFixed(2)}×
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Stage */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-8 text-center sm:px-8">
          {result?.won && <WinCelebration key={winId} jackpot={result.mult >= 10} />}

          <div className="relative mx-auto h-72 w-full sm:h-80">
            <CrashGraph mult={displayMult} exploded={exploded} flying={flying} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {betting ? (
                <>
                  <span className="font-mono text-5xl font-bold tabular-nums text-text sm:text-6xl" style={{ textShadow: '0 0 30px rgba(0,0,0,0.65)' }}>
                    {bettingLeft}s
                  </span>
                  <span className="mt-1 font-sans text-sm text-gold-light">Apostas abertas</span>
                </>
              ) : (
                <span className={`font-mono text-6xl font-bold tabular-nums sm:text-7xl ${multColor}`} style={{ textShadow: '0 0 30px rgba(0,0,0,0.65)' }}>
                  {displayMult.toFixed(2)}×
                </span>
              )}
            </div>
          </div>

          {/* Status line */}
          <div className="mt-4 flex min-h-[2.5rem] items-center justify-center px-2 text-center">
            {busted ? (
              <p className="font-display text-lg font-bold text-negative">
                Rebentou a {Number(state?.crash ?? 0).toFixed(2)}×.
                <span className="ml-1 font-sans text-sm font-normal text-muted-2">Próxima ronda em {nextLeft}s…</span>
              </p>
            ) : flying && inFlight ? (
              <p className="font-sans text-sm text-muted">{mine?.auto_target ? `Saída automática a ${Number(mine.auto_target).toFixed(2)}×` : 'A subir — retira quando quiseres.'}</p>
            ) : flying && mine?.settled ? (
              <p className="font-display text-base font-bold text-positive">Saíste a {Number(mine.cashout).toFixed(2)}× — a ver até onde vai…</p>
            ) : flying ? (
              <p className="font-sans text-sm text-muted-2">Ronda a decorrer — entra na próxima.</p>
            ) : betting && mine ? (
              <p className="font-sans text-sm text-positive">Estás dentro com {formatAmount(mine.stake)} tós. A descolar em {bettingLeft}s.</p>
            ) : betting ? (
              <p className="font-sans text-sm text-muted">Faz a tua aposta antes da descolagem.</p>
            ) : (
              <p className="font-sans text-sm text-muted-2">A preparar a próxima ronda…</p>
            )}
          </div>

          {/* Cash-out while flying */}
          {flying && inFlight && (
            <Button variant="primary" onClick={doCashout} disabled={cashout.isPending} className="mx-auto w-full max-w-sm text-base">
              Retirar {formatAmount(Math.floor((mine?.stake ?? 0) * displayMult))} tós
            </Button>
          )}
        </div>

        {/* Players in this round */}
        <div className="card flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-sm font-medium text-text">Jogadores nesta ronda</span>
            <span className="font-mono text-xs text-muted-2">{bets.length}</span>
          </div>
          {bets.length === 0 ? (
            <p className="py-6 text-center font-sans text-sm text-muted-2">Ainda sem apostas. Sê o primeiro.</p>
          ) : (
            <ul className="space-y-1.5">
              {bets.map((b) => (
                <PlayerRow key={b.id} bet={b} status={status} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bet controls */}
      <div className="card mx-auto max-w-2xl space-y-4 p-5 sm:p-6">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="font-sans text-[12px] text-muted">Saída automática</span>
          <input type="checkbox" checked={autoOn} disabled={!!mine} onChange={(e) => setAutoOn(e.target.checked)} className="h-4 w-4 accent-gold" />
        </label>
        {autoOn && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-sans text-[11px] text-muted-2">Sair em</span>
              <span className="font-mono text-sm text-gold">{autoTarget.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={1.1} max={20} step={0.1} value={autoTarget} disabled={!!mine}
              onChange={(e) => setAutoTarget(Number(e.target.value))}
              className="h-2 w-full cursor-pointer rounded-full accent-gold disabled:opacity-50"
              aria-label="Alvo de saída automática"
            />
          </div>
        )}
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={!betting || !!mine} />
        <Button variant="primary" onClick={enter} disabled={!betting || !!mine || placeBet.isPending || stake > balance} className="w-full">
          {mine ? 'Já entraste nesta ronda' : !betting ? 'Aguarda a próxima ronda…' : stake > balance ? 'Saldo insuficiente' : `Entrar · ${formatAmount(stake)} tós`}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}

function PlayerRow({ bet, status }: { bet: CrashBetRow; status: string | null }) {
  let icon = '•';
  let text = 'entrou';
  let cls = 'text-muted-2';
  if (status === 'betting') {
    icon = '•'; text = 'pronto'; cls = 'text-muted-2';
  } else if (bet.settled && bet.payout > 0) {
    icon = '✓'; text = `${Number(bet.cashout).toFixed(2)}×`; cls = 'text-positive';
  } else if (bet.settled) {
    icon = '💥'; text = 'rebentou'; cls = 'text-negative';
  } else {
    icon = '⏳'; text = 'a voar'; cls = 'text-gold-light';
  }
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className={cls}>{icon}</span>
        <span className="truncate font-sans text-text">{bet.display_name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-muted-2">{formatAmount(bet.stake)}</span>
        <span className={`font-mono text-[11px] tabular-nums ${cls}`}>{text}</span>
      </span>
    </li>
  );
}
