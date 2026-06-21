import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useHorseRoom } from '@/features/casino/useHorseRoom';
import { secondsLeft } from '@/features/casino/liveRoom';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const ODDS = [2.4, 4, 6, 9, 14, 28];
const COLORS = ['#C9A24B', '#b0303a', '#2b6f4e', '#2b4a8b', '#9a5cc2', '#c97f2a'];

/** Deterministic per-horse pace from the room id, so every client sees the same
 * race; the winner runs at full pace and leads to the line. */
function paces(roomId: number, winner: number): number[] {
  return Array.from({ length: 6 }, (_, i) => (i === winner ? 1 : 0.6 + ((roomId * 31 + i * 17) % 32) / 100));
}

/** A racing horse (the detailed OS jockey glyph) with a ground shadow + gallop bob. */
function RaceHorse({ galloping = false }: { galloping?: boolean }) {
  return (
    <span className="relative inline-block">
      <span
        className={`block text-[40px] leading-none ${galloping ? 'animate-floaty' : ''}`}
        style={{ filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.45))' }}
      >
        🏇
      </span>
      <span className="absolute -bottom-1 left-1/2 h-1.5 w-9 -translate-x-1/2 rounded-[50%] bg-black/35 blur-[2px]" aria-hidden />
    </span>
  );
}

export function HorsePage() {
  const { data: profile } = useProfile();
  const { state, bets, history, placeBet } = useHorseRoom();

  const [stake, setStake] = useState(25);
  const [horse, setHorse] = useState(0);
  const [pos, setPos] = useState<number[]>(Array(6).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [winId, setWinId] = useState(0);
  const offsetRef = useRef(0);
  const wonRef = useRef<number | null>(null);

  useEffect(() => {
    if (state?.server_now) offsetRef.current = new Date(state.server_now).getTime() - Date.now();
  }, [state?.server_now]);

  const status = state?.status ?? null;
  const betting = status === 'betting';
  const racing = status === 'racing';
  const done = status === 'done';
  const mine = state?.mine ?? null;
  const roomId = state?.room_id ?? null;
  const balance = profile?.balance ?? 0;
  const serverNow = Date.now() + offsetRef.current;
  const bettingLeft = state ? secondsLeft(state.betting_ends_at, serverNow) : 0;
  const nextLeft = done && state ? secondsLeft(state.finish_at, serverNow - 6000) : 0;

  // Animate the synced race.
  useEffect(() => {
    if (!state) return;
    if (state.status === 'betting') { setPos(Array(6).fill(0)); return; }
    const winner = state.winner ?? 0;
    const p = paces(state.room_id, winner);
    const raceStart = new Date(state.race_start_at).getTime();
    const dur = Math.max(1, (new Date(state.finish_at).getTime() - raceStart) / 1000);
    if (state.status === 'done') { setPos(p.map((x) => Math.min(90, x * 90))); return; }
    let raf = 0;
    const tick = () => {
      const now = Date.now() + offsetRef.current;
      const frac = Math.min(1, Math.max(0, (now - raceStart) / 1000) / dur);
      setPos(p.map((x) => Math.min(90, frac * x * 90)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, state?.race_start_at, state?.winner, state?.room_id]);

  // Win confetti once when my horse wins.
  useEffect(() => {
    if (done && mine?.settled && mine.payout > 0 && wonRef.current !== roomId) {
      wonRef.current = roomId;
      setWinId((n) => n + 1);
    }
  }, [done, mine?.settled, mine?.payout, roomId]);

  async function bet() {
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    try {
      await placeBet.mutateAsync({ horse, stake });
    } catch (e) {
      setError(e instanceof Error && e.message.includes('já apostaste') ? 'Já apostaste nesta corrida.' : 'Não foi possível apostar.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {done && mine?.settled && mine.payout > 0 && <WinCelebration key={winId} jackpot={ODDS[mine.horse]! >= 10} />}

      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão · Corrida ao vivo</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Corrida de Cavalos</h1>
        <p className="mt-2 font-sans text-sm text-muted">Uma só corrida para todos. Aposta na janela — todos veem os mesmos cavalos a correr.</p>
      </div>

      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Vencedores</span>
          {history.map((w, i) => (
            <span key={i} className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white" style={{ background: COLORS[w] }}>{w + 1}</span>
          ))}
        </div>
      )}

      {/* Racetrack scene */}
      <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-black/50 shadow-[0_10px_36px_rgba(0,0,0,0.45)]">
        {/* Sky + grandstand */}
        <div className="relative h-[72px] overflow-hidden" style={{ background: 'linear-gradient(180deg,#5b86c4 0%,#84a7d8 55%,#bcd0ea 100%)' }}>
          <div className="absolute right-12 top-2 h-10 w-10 rounded-full bg-[#fff4cf] shadow-[0_0_24px_12px_rgba(255,244,207,0.5)]" />
          {/* clouds */}
          <div className="absolute left-8 top-3 h-4 w-16 rounded-full bg-white/70 blur-[3px]" />
          <div className="absolute left-1/2 top-2 h-3 w-12 rounded-full bg-white/60 blur-[3px]" />
          <div className="absolute right-1/4 top-5 h-3 w-14 rounded-full bg-white/50 blur-[3px]" />
          {/* grandstand roof + stand */}
          <div className="absolute inset-x-0 bottom-0 h-10" style={{ background: 'linear-gradient(180deg,#5a4636,#33271c)', clipPath: 'polygon(0 38%, 100% 0, 100% 100%, 0 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 flex h-7 items-end gap-[3px] overflow-hidden px-2 pb-1">
            {Array.from({ length: 96 }, (_, i) => (
              <span key={i} className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ['#d8b0a0', '#b0c0a0', '#a0b0d0', '#d0c090', '#c0c0c0', '#e0b8b8'][i % 6], opacity: 0.8 }} />
            ))}
          </div>
          <span className="absolute left-3 top-2 font-display text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Hipódromo Arentim</span>
          <span className="absolute right-3 top-2 rounded bg-black/35 px-2 py-0.5 font-sans text-[11px] uppercase tracking-[0.14em] text-white">
            {betting ? `Apostas · ${bettingLeft}s` : racing ? 'A correr' : done ? `Próxima · ${nextLeft}s` : 'A preparar'}
          </span>
        </div>

        {/* Turf track — realistic mowing stripes */}
        <div
          className="relative"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg,#2f7d53 0 34px,#2a734c 34px 68px)' }}
        >
          {/* light/shade gradient over the turf */}
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.22))' }} aria-hidden />
          {/* white running rails (top + bottom) */}
          <span className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1.5 bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1.5 bg-white/80 shadow-[0_-1px_2px_rgba(0,0,0,0.4)]" />
          {/* finish line + banner */}
          <div className="pointer-events-none absolute inset-y-0 right-10 z-20 w-2.5 opacity-95" style={{ backgroundImage: 'repeating-conic-gradient(#fff 0% 25%, #111 0% 50%)', backgroundSize: '5px 5px' }} aria-hidden />
          <span className="pointer-events-none absolute right-1.5 top-1 z-20 rounded bg-[#b0303a] px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-white shadow">Meta</span>

          {ODDS.map((odd, i) => {
            const isWin = done && state?.winner === i;
            const mineHere = mine?.horse === i;
            return (
              <div key={i} className={`relative flex h-[60px] items-center border-b border-white/15 ${isWin ? 'bg-gold/15' : ''}`}>
                <span className="absolute left-2.5 z-[6] flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold text-white shadow ring-2 ring-black/40" style={{ background: COLORS[i] }}>
                  {i + 1}
                </span>
                <span className="absolute right-2.5 z-[6] font-mono text-[11px] text-white/75">{odd}×</span>
                {mineHere && <span className="absolute left-12 top-1.5 z-[6] rounded bg-gold/30 px-1 text-[10px] font-semibold text-gold">tu</span>}
                <div className="absolute z-[5]" style={{ left: `calc(${pos[i]}% + 46px)`, transform: 'translateX(-50%)' }}>
                  <RaceHorse galloping={racing} />
                </div>
                {isWin && <span className="absolute right-14 top-1/2 z-[6] -translate-y-1/2 animate-pop text-2xl">🏆</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[1.75rem] text-center">
        {!state ? (
          <p className="font-sans text-sm text-muted-2 animate-floaty">A ligar à corrida…</p>
        ) : betting ? (
          <p className="font-display text-base font-bold text-gold-light">Apostas abertas · <span className="font-mono">{bettingLeft}s</span></p>
        ) : racing ? (
          <p className="font-sans text-sm text-gold-light animate-floaty">E partem…</p>
        ) : done ? (
          <p className={`font-display text-lg font-bold ${mine?.settled && mine.payout > 0 ? 'text-positive' : 'text-negative'}`}>
            Venceu o cavalo {(state.winner ?? 0) + 1}
            {mine ? (mine.payout > 0 ? ` — ganhaste ${formatAmount(mine.payout)} tós!` : ' — desta vez não.') : ''}
            <span className="ml-1 font-sans text-sm font-normal text-muted-2">Próxima em {nextLeft}s</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Bet panel */}
        <div className="card space-y-4 p-5">
          <div>
            <span className="mb-2 block font-sans text-sm font-medium text-muted">O teu cavalo</span>
            <div className="flex flex-wrap gap-2">
              {ODDS.map((odd, i) => (
                <button key={i} onClick={() => setHorse(i)} disabled={!betting || !!mine}
                  className={`focus-ring flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-sm disabled:opacity-50 ${horse === i ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}>
                  <span style={{ color: horse === i ? undefined : COLORS[i] }}>#{i + 1}</span>
                  <span className="text-[11px] opacity-80">{odd}×</span>
                </button>
              ))}
            </div>
          </div>
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={!betting || !!mine} />
          <Button variant="primary" onClick={bet} disabled={!betting || !!mine || placeBet.isPending || stake > balance} className="w-full">
            {mine ? `Apostaste no #${mine.horse + 1} · ${formatAmount(mine.stake)} tós` : !state ? 'A ligar…' : !betting ? 'Aguarda a próxima corrida…' : stake > balance ? 'Saldo insuficiente' : `Apostar no #${horse + 1} · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>

        {/* Live bets */}
        <div className="card flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-sm font-medium text-text">Apostas da corrida</span>
            <span className="font-mono text-xs text-muted-2">{bets.length}</span>
          </div>
          {bets.length === 0 ? (
            <p className="py-6 text-center font-sans text-sm text-muted-2">Ainda sem apostas.</p>
          ) : (
            <ul className="space-y-1.5">
              {bets.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-bold text-white" style={{ background: COLORS[b.horse] }}>{b.horse + 1}</span>
                    <span className="truncate font-sans text-text">{b.display_name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-2">
                    {formatAmount(b.stake)}
                    {b.settled && b.payout > 0 && <span className="text-positive"> +{formatAmount(b.payout)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
