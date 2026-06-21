import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useSlotMachines, usePlaySlot } from '@/features/casino/useSlotMachines';
import { accentHex } from '@/features/casino/slotTheme';
import { SymbolArt } from '@/features/casino/slotSymbols';
import { SlotBackdrop } from '@/features/casino/SlotBackdrop';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Chip } from '@/features/casino/Chip';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';
import type { SlotMachineMeta } from '@/types/db';

const DENOMS = [5, 10, 25, 50, 100, 250];

type ReelMode = 'idle' | 'spin' | 'land';

const ITEM = 'flex h-36 items-center justify-center sm:h-44';
const SYMBOL = 'h-[78px] w-[78px] sm:h-24 sm:w-24';

/** Tween a number towards `value`, so the progressive pool visibly ticks up. */
function useCountUp(value: number | null, duration = 700): number | null {
  const [display, setDisplay] = useState<number | null>(value);
  const fromRef = useRef<number | null>(value);
  useEffect(() => {
    if (value == null) {
      setDisplay(null);
      fromRef.current = null;
      return;
    }
    const from = fromRef.current ?? value;
    if (from === value) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

/** Build the landing strip: a run of random symbols ending on the target. */
function makeLandStrip(ids: string[], target: string): string[] {
  const strip: string[] = [];
  for (let i = 0; i < 6; i++) strip.push(ids[Math.floor(Math.random() * ids.length)]!);
  strip.push(target);
  return strip;
}

/**
 * A real reel window: a vertical strip of symbols. 'spin' scrolls it seamlessly
 * (three identical copies → -33.33% loops), 'land' decelerates a fresh strip
 * onto the target so you watch the other symbols flick past and settle.
 */
function Reel({
  ids,
  target,
  mode,
  won,
  winning,
  accent,
  glyphById,
}: {
  ids: string[];
  target: string;
  mode: ReelMode;
  won: boolean;
  /** This specific reel is part of the winning line (throb its symbol). */
  winning: boolean;
  accent: string;
  glyphById: Record<string, string>;
}) {
  // Begin the spinning strip on the symbol shown WHEN the spin starts (the
  // previous result), captured once so the incoming result can't leak into the
  // strip mid-spin — that leak was flashing the result before the reel landed.
  const prevMode = useRef<ReelMode>(mode);
  const spinHead = useRef(target);
  if (mode === 'spin' && prevMode.current !== 'spin') spinHead.current = target;
  prevMode.current = mode;
  const spinStrip = [spinHead.current, ...ids, ...ids, ...ids];
  // Landing strip is 6 fillers + the result; the reel-land keyframe scrolls to
  // the last item. Rebuilt only when we (re)enter land with a new target, so a
  // fresh mount always animates from the top — never flashing the result first.
  const landStrip = useMemo(() => makeLandStrip(ids, target), [ids, target]);

  const tile = (id: string, key: number) => (
    <div className={ITEM} key={key}>
      <SymbolArt id={id} glyph={glyphById[id]} className={SYMBOL} />
    </div>
  );

  return (
    <div
      className={`relative h-36 w-[82px] overflow-hidden rounded border-2 bg-bg/80 transition-colors sm:h-44 sm:w-32 ${
        won && mode !== 'spin' ? 'border-gold animate-glow' : 'border-gold/25'
      }`}
      style={won && mode !== 'spin' ? { boxShadow: `inset 0 0 30px ${accent}55` } : undefined}
    >
      {/* top/bottom vignette + glass shading for depth */}
      <span className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
      <span className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-white/[0.07] to-transparent" />

      {mode === 'idle' ? (
        <div className="flex h-full items-center justify-center animate-pop">
          <SymbolArt id={target} glyph={glyphById[target]} className={SYMBOL} />
        </div>
      ) : mode === 'spin' ? (
        <div className="animate-reel-roll blur-[1.5px] will-change-transform">
          {spinStrip.map(tile)}
        </div>
      ) : (
        <div
          key={target}
          className="will-change-transform"
          style={{ animation: 'reel-land 0.85s cubic-bezier(0.15,0.85,0.25,1) forwards' }}
        >
          {landStrip.map(tile)}
        </div>
      )}

      {/* Winning-symbol throb — only after the spin fully settles (won ⇒ !busy),
          so it never flashes the result before the reel lands. */}
      {winning && (
        <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center">
          <span
            className="absolute h-[78px] w-[78px] rounded-full sm:h-24 sm:w-24"
            style={{ background: `radial-gradient(circle, ${accent}66, transparent 68%)` }}
          />
          <SymbolArt id={target} glyph={glyphById[target]} className={`${SYMBOL} animate-symbol-throb relative`} />
        </div>
      )}
    </div>
  );
}

/** Win tiers escalate the celebration by how big the multiplier is. */
function winTier(jackpot: boolean, mult: number): { label: string; coins: number } | null {
  if (jackpot) return { label: '✦ JACKPOT ✦', coins: 28 };
  if (mult <= 0) return null;
  if (mult >= 40) return { label: 'MEGA PRÉMIO', coins: 22 };
  if (mult >= 18) return { label: 'GRANDE PRÉMIO', coins: 16 };
  if (mult >= 3) return { label: 'BOA!', coins: 10 };
  return { label: 'GANHOU', coins: 6 };
}

/** Chasing marquee bulbs around the cabinet, like a real machine's light frame. */
function MarqueeBulbs({ accent, lit }: { accent: string; lit: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {/* top + bottom rows */}
      {[0, 1].map((row) => (
        <div key={row} className={`absolute inset-x-3 flex justify-between ${row === 0 ? 'top-1.5' : 'bottom-1.5'}`}>
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${lit ? 'animate-bulb-chase' : ''}`}
              style={{
                background: lit ? accent : `${accent}55`,
                boxShadow: lit ? `0 0 6px ${accent}` : 'none',
                animationDelay: `${(i % 4) * 0.22}s`,
              }}
            />
          ))}
        </div>
      ))}
      {/* left + right columns */}
      {[0, 1].map((col) => (
        <div key={col} className={`absolute inset-y-5 flex flex-col justify-between ${col === 0 ? 'left-1.5' : 'right-1.5'}`}>
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${lit ? 'animate-bulb-chase' : ''}`}
              style={{
                background: lit ? accent : `${accent}55`,
                boxShadow: lit ? `0 0 6px ${accent}` : 'none',
                animationDelay: `${(i % 4) * 0.22}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A shower of falling coins over the cabinet on a win. */
function CoinShower({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="animate-coin-fall absolute top-0 text-xl"
          style={{ left: `${(i * 97 + 7) % 100}%`, animationDelay: `${(i % 6) * 0.16}s`, animationDuration: `${1.2 + (i % 5) * 0.18}s` }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}

/**
 * Full-screen takeover for the biggest wins (mega / jackpot). Rotating gold rays,
 * a heavy coin rain and a giant prize readout, over a darkened screen. The parent
 * mounts it only for the top tiers and unmounts it when the win alert clears.
 */
function BigWinOverlay({ label, amount, accent }: { label: string; amount: number; accent: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 animate-fade-in" style={{ background: 'radial-gradient(circle at 50% 45%, transparent 24%, rgba(0,0,0,0.6))' }} />
      <svg className="animate-spin-slow absolute h-[170vmax] w-[170vmax] opacity-40" viewBox="0 0 200 200" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} d="M100 100 L97 0 L103 0 Z" fill={accent} opacity={i % 2 ? 0.5 : 0.18} transform={`rotate(${i * 15} 100 100)`} />
        ))}
      </svg>
      <CoinShower count={40} />
      <div className="relative animate-win-burst px-4 text-center">
        <p className="font-display text-[42px] font-bold leading-none sm:text-7xl" style={{ color: accent, textShadow: `0 0 44px ${accent}` }}>
          {label}
        </p>
        <p className="mt-3 font-display text-3xl font-bold text-gold-light sm:text-5xl">+{formatAmount(amount)} tós</p>
      </div>
    </div>
  );
}

/** The chrome side lever of a classic cabinet; the knob dips while spinning. */
function Lever({ pulled }: { pulled: boolean }) {
  return (
    <div className="pointer-events-none absolute -right-3 top-10 z-30 hidden sm:block" aria-hidden>
      <div className="relative h-44 w-3">
        <div className="absolute inset-x-0 bottom-0 h-12 rounded-full" style={{ background: 'linear-gradient(90deg,#9aa3ab,#e8eef2,#79828b)' }} />
        <div
          className="absolute inset-x-[-3px] rounded-full transition-[top] duration-300 ease-out"
          style={{ top: pulled ? '70px' : '0px', height: '70px', background: 'linear-gradient(90deg,#8a939b,#dfe6ec,#6b747c)' }}
        />
        <div
          className="absolute left-1/2 h-7 w-7 -translate-x-1/2 rounded-full transition-[top] duration-300 ease-out"
          style={{ top: pulled ? '64px' : '-6px', background: 'radial-gradient(circle at 36% 30%, #ff8b8b, #b0303a 70%)', boxShadow: '0 3px 8px rgba(0,0,0,0.5)' }}
        />
      </div>
    </div>
  );
}

function MachineScreen({ m }: { m: SlotMachineMeta }) {
  const { data: profile } = useProfile();
  const play = usePlaySlot();
  const hex = accentHex(m.accent);

  const glyphById = useMemo(
    () => Object.fromEntries(m.symbols.map((s) => [s.id, s.glyph])),
    [m.symbols],
  );
  const allIds = useMemo(() => m.symbols.map((s) => s.id), [m.symbols]);
  const jackpotGlyph = glyphById[m.jackpot_symbol] ?? '✦';
  const maxVisible = useMemo(
    () => Math.max(0, ...m.paytable.filter((r) => r.mult != null).map((r) => r.mult as number)),
    [m.paytable],
  );

  const betOptions = useMemo(() => {
    const set = new Set<number>([m.min_bet, m.max_bet, ...DENOMS.filter((d) => d >= m.min_bet && d <= m.max_bet)]);
    return [...set].sort((a, b) => a - b);
  }, [m.min_bet, m.max_bet]);

  const balance = profile?.balance ?? 0;
  const [stake, setStake] = useState(m.min_bet);
  const initial = m.symbols.slice(0, 3).map((s) => s.id);
  const [targets, setTargets] = useState<string[]>([initial[0]!, initial[1]!, initial[2]!]);
  const [modes, setModes] = useState<[ReelMode, ReelMode, ReelMode]>(['idle', 'idle', 'idle']);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ payout: number; jackpot: boolean; mult: number; id: number } | null>(null);
  const [winAlert, setWinAlert] = useState<{ amount: number; jackpot: boolean; mult: number; id: number } | null>(null);
  const [pool, setPool] = useState<number | null>(m.progressive ? m.jackpot_pool ?? null : null);
  const displayPool = useCountUp(pool);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const spinId = useRef(0);

  // Clamp the stake into range when the machine changes; clear pending timers.
  useEffect(() => {
    setStake((s) => Math.min(m.max_bet, Math.max(m.min_bet, s)));
  }, [m.min_bet, m.max_bet]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const won = !busy && (result?.payout ?? 0) > 0;
  // Which reels form the winning line (three-of-a-kind → all; paying pair → the
  // matched two). Only set once the spin has settled (won ⇒ !busy).
  const winIndices = useMemo(() => {
    const s = new Set<number>();
    if (!won) return s;
    const [a, b, c] = targets;
    if (a === b && b === c) return new Set([0, 1, 2]);
    if (a === b) { s.add(0); s.add(1); }
    else if (a === c) { s.add(0); s.add(2); }
    else if (b === c) { s.add(1); s.add(2); }
    return s;
  }, [won, targets]);
  const tier = winAlert ? winTier(winAlert.jackpot, winAlert.mult) : null;
  const classic = m.cabinet === 'classic';
  // The biggest tiers (mega / jackpot) trigger a full-screen takeover.
  const bigWin = !!(winAlert && tier && tier.coins >= 22);
  // Cabinet skins: chrome-and-gold drum for classic, ornate gilded for video.
  const frameBg = classic
    ? 'linear-gradient(150deg,#eef3f6,#b9c2c9 32%,#727b84 64%,#cfd6dc)'
    : `linear-gradient(155deg, #f7e4ad, ${hex}, #5b4824)`;
  const innerBg = classic
    ? 'radial-gradient(135% 90% at 50% -10%, rgba(120,130,140,0.28), transparent 55%), linear-gradient(180deg, #16191e, #0a0b0d 75%)'
    : `radial-gradient(135% 90% at 50% -10%, ${hex}38, transparent 55%), linear-gradient(180deg, #171309, #0a0907 75%)`;

  async function onSpin() {
    if (busy || stake > balance || stake < m.min_bet) return;
    setError(null);
    setResult(null);
    setWinAlert(null);
    setBusy(true);
    setModes(['spin', 'spin', 'spin']); // all three spin together while the server rolls
    const startedAt = performance.now();
    try {
      const res = await play.mutateAsync({ machine: m.key, stake });
      setTargets(res.reels);
      const id = ++spinId.current;
      // Keep all reels spinning in sync for at least ~750ms, then stop them
      // left→right with a clear gap so you see one land before the next.
      const base = Math.max(0, 750 - (performance.now() - startedAt));
      const GAP = 470;
      const SETTLE = 900;
      timers.current.push(
        window.setTimeout(() => setModes((s) => ['land', s[1], s[2]]), base),
        window.setTimeout(() => setModes((s) => [s[0], 'land', s[2]]), base + GAP),
        window.setTimeout(() => setModes((s) => [s[0], s[1], 'land']), base + GAP * 2),
        window.setTimeout(() => {
          setBusy(false);
          setResult({ payout: res.payout, jackpot: res.jackpot, mult: res.multiplier, id });
          // A win pops a big animated alert over the cabinet; it self-dismisses.
          if (res.payout > 0) {
            setWinAlert({ amount: res.payout, jackpot: res.jackpot, mult: res.multiplier, id });
            timers.current.push(window.setTimeout(() => setWinAlert((w) => (w?.id === id ? null : w)), 2800));
          }
          // Reveal the new pool with the outcome: a losing spin visibly fattens
          // the pot, a jackpot win drains it back to the seed.
          if (m.progressive && res.jackpot_pool != null) setPool(res.jackpot_pool);
        }, base + GAP * 2 + SETTLE),
      );
    } catch (e) {
      setModes(['idle', 'idle', 'idle']);
      setBusy(false);
      setError(e instanceof Error ? e.message : 'A rodada falhou.');
    }
  }

  const canSpin = !busy && stake <= balance && stake >= m.min_bet;

  return (
    <div className="animate-fade-in space-y-5">
      {bigWin && tier && <BigWinOverlay label={tier.label} amount={winAlert!.amount} accent={hex} />}
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <Link to="/casino/slots" className="font-sans text-sm text-muted-2 hover:text-text">← Todas as slots</Link>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: hex }} />
          <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-2">{m.name}</span>
        </span>
      </div>

      {/* Cabinet — chrome drum (classic) or ornate gilded frame (video) */}
      <div
        className="relative mx-auto max-w-3xl rounded-[20px] p-1 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
        style={{ background: frameBg }}
      >
        {classic && <Lever pulled={busy} />}
        <div
          className="relative overflow-hidden rounded-[16px] p-3 sm:p-10"
          style={{ background: innerBg }}
        >
          <SlotBackdrop machineKey={m.key} />
          {/* Chasing marquee bulbs around the cabinet — light up on spin & win. */}
          <MarqueeBulbs accent={hex} lit={busy || won} />
          {winAlert && <CoinShower count={tier?.coins ?? 8} />}
          {winAlert && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-5 sm:pt-8" aria-live="polite">
              <div
                className="animate-win-burst rounded-2xl border-2 px-7 py-3.5 text-center shadow-[0_12px_55px_rgba(201,162,75,0.55)] backdrop-blur-sm"
                style={{ borderColor: hex, background: 'rgba(10,9,7,0.82)' }}
              >
                <p className={`font-sans text-[10px] uppercase tracking-[0.34em] text-gold-light ${winAlert.jackpot ? 'animate-jackpot-flash' : ''}`}>
                  {tier?.label ?? 'Ganhou'}
                </p>
                <p className="font-display text-[34px] font-bold leading-none sm:text-[40px]" style={{ color: hex }}>
                  +{formatAmount(winAlert.amount)} tós
                </p>
              </div>
            </div>
          )}
          <div className="relative z-10">
            {/* Marquee */}
            <div className="mb-6 text-center">
              <p className="font-sans text-[10px] uppercase tracking-[0.45em] text-muted-2">Arentim Slots</p>
              <h1
                className="font-display text-[40px] font-bold leading-tight sm:text-[52px]"
                style={{ color: hex, textShadow: `0 0 26px ${hex}77` }}
              >
                {m.name}
              </h1>
              <p className="mt-1.5 font-sans text-[12px] uppercase tracking-[0.24em] text-gold-light">
                Prémios até {maxVisible}× · Jackpot{' '}
                <span className="font-bold">{m.progressive && displayPool != null ? `${formatAmount(displayPool)} tós` : '???'}</span>
              </p>
            </div>

            {/* Mystery jackpot meter */}
            <div
              className={`mx-auto mb-7 flex max-w-md items-center justify-center gap-4 rounded border px-5 py-2.5 ${
                result?.jackpot ? 'animate-jackpot-flash' : ''
              }`}
              style={{ borderColor: `${hex}66`, background: `linear-gradient(180deg, ${hex}22, transparent)` }}
            >
              <SymbolArt id={m.jackpot_symbol} glyph={jackpotGlyph} className="h-11 w-11 drop-shadow-[0_0_8px_rgba(201,162,75,0.6)]" />
              <div className="text-center">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-2">
                  {m.progressive ? 'Jackpot Progressivo' : 'Jackpot Mistério'}
                </p>
                <p className="font-display text-2xl font-bold" style={{ color: hex }}>
                  {result?.jackpot
                    ? `${formatAmount(result.payout)} tós!`
                    : m.progressive && displayPool != null
                      ? `${formatAmount(displayPool)} tós`
                      : '? ? ?'}
                </p>
              </div>
            </div>
            {m.progressive && (
              <p className="-mt-4 mb-7 text-center font-sans text-[11px] text-muted-2">
                Cresce a cada jogada — cada aposta perdida engorda o pote, que sai por inteiro quem acertar nos três{' '}
                <SymbolArt id={m.jackpot_symbol} glyph={jackpotGlyph} className="inline-block h-3.5 w-3.5 align-text-bottom" />.
              </p>
            )}

            {/* Reel housing with a gilded centre payline */}
            <div
              className="relative mx-auto max-w-xl rounded-md p-2 sm:p-3.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.3))',
                boxShadow: 'inset 0 0 0 1px rgba(201,162,75,0.35), inset 0 0 36px rgba(0,0,0,0.6)',
              }}
            >
              <div className="relative flex justify-center gap-2 sm:gap-4">
                <span
                  className={`pointer-events-none absolute inset-x-1 top-1/2 z-[14] h-[2px] -translate-y-1/2 ${won ? 'animate-payline-pulse' : ''}`}
                  style={{
                    background: `linear-gradient(90deg, transparent, ${hex}, transparent)`,
                    boxShadow: won ? `0 0 12px ${hex}` : 'none',
                  }}
                  aria-hidden
                />
                <Reel ids={allIds} target={targets[0]!} mode={modes[0]} won={won} winning={winIndices.has(0)} accent={hex} glyphById={glyphById} />
                <Reel ids={allIds} target={targets[1]!} mode={modes[1]} won={won} winning={winIndices.has(1)} accent={hex} glyphById={glyphById} />
                <Reel ids={allIds} target={targets[2]!} mode={modes[2]} won={won} winning={winIndices.has(2)} accent={hex} glyphById={glyphById} />
                {won && result && <WinCelebration key={result.id} jackpot={result.jackpot} />}
              </div>
            </div>

            {/* LCD credit meter — Créditos · Aposta · Ganho, like a real cabinet. */}
            <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2">
              {[
                { label: 'Créditos', value: formatAmount(balance), win: false },
                { label: 'Aposta', value: formatAmount(stake), win: false },
                { label: 'Ganho', value: won && result ? `+${formatAmount(result.payout)}` : '—', win: won },
              ].map((seg) => (
                <div
                  key={seg.label}
                  className={`rounded border bg-black/55 px-2 py-1.5 text-center shadow-[inset_0_1px_6px_rgba(0,0,0,0.7)] ${seg.win ? 'animate-jackpot-flash' : ''}`}
                  style={{ borderColor: seg.win ? hex : 'rgba(201,162,75,0.22)' }}
                >
                  <p className="font-sans text-[8px] uppercase tracking-[0.25em] text-muted-2">{seg.label}</p>
                  <p className="font-mono text-base font-bold tabular-nums" style={{ color: seg.win ? hex : '#f3dca0' }}>
                    {seg.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Outcome line */}
            <div className="mt-6 flex h-11 items-center justify-center text-center">
              {busy ? (
                <p className="font-sans text-base text-muted">A rodar…</p>
              ) : result?.jackpot ? (
                <p className="animate-pop font-display text-3xl font-bold" style={{ color: hex }}>
                  ✦ JACKPOT ✦ {formatAmount(result.payout)} Tostões!
                </p>
              ) : result && result.payout > 0 ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  Ganhou {formatAmount(result.payout)} Tostões! ({result.mult}×)
                </p>
              ) : result ? (
                <p className="font-sans text-base text-muted">Sem prémio — gire outra vez.</p>
              ) : (
                <p className="font-sans text-base text-muted-2">Faça a sua aposta e gire.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control bar — balance · bet chips · SPIN */}
      <div className="mx-auto max-w-3xl">
        <div className="card flex flex-col items-center gap-4 p-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted-2">Saldo</span>
            <span className="flex items-center gap-1 font-mono text-text">
              <CoinIcon className="h-4 w-4" /> {formatAmount(balance)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted-2">Aposta</span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {betOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy || c > balance}
                  onClick={() => setStake(c)}
                  aria-label={`Aposta de ${c}`}
                  className={`focus-ring rounded-full transition-transform disabled:opacity-30 ${
                    stake === c ? 'scale-110 ring-2 ring-gold ring-offset-2 ring-offset-surface' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Chip value={c} size={36} />
                </button>
              ))}
            </div>
            {/* Custom bet — type any amount within the machine's range. */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={m.min_bet}
                max={m.max_bet}
                value={stake}
                disabled={busy}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value) || 0);
                  setStake(Math.min(m.max_bet, Math.max(m.min_bet, v)));
                }}
                aria-label="Aposta personalizada"
                className="focus-ring w-24 rounded border border-border bg-bg px-2 py-1 text-center font-mono text-sm text-text"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => setStake(Math.max(m.min_bet, Math.min(m.max_bet, balance)))}
                className="focus-ring rounded-full border border-border px-2.5 py-1 font-sans text-[11px] uppercase tracking-wider text-muted-2 hover:text-text disabled:opacity-40"
              >
                Máx
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onSpin}
            disabled={!canSpin}
            aria-label="Girar"
            className="focus-ring flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-full font-display text-base font-bold uppercase tracking-wide text-bg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 sm:h-[104px] sm:w-[104px]"
            style={{ background: `radial-gradient(circle at 40% 32%, #f7e4ad, ${hex} 72%)`, boxShadow: `0 8px 26px ${hex}77` }}
          >
            {busy ? (
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-bg/30 border-t-bg" />
            ) : (
              'Girar'
            )}
          </button>
        </div>
        {stake > balance && <p className="mt-2 text-center font-sans text-xs text-negative">Saldo insuficiente para esta aposta.</p>}
        {error && <p className="mt-2 text-center font-sans text-sm text-negative">{error}</p>}
      </div>

      {/* Paytable */}
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
          Tabela de prémios <span className="text-faint">(× a aposta)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {m.paytable.map((row) => {
            const isJackpot = row.id === m.jackpot_symbol;
            return (
              <div
                key={row.id}
                className="flex flex-col items-center gap-1 rounded border px-3 py-2"
                style={{
                  borderColor: isJackpot ? `${hex}88` : 'rgba(201,162,75,0.16)',
                  background: isJackpot ? `${hex}14` : 'transparent',
                }}
              >
                <span className="flex">
                  <SymbolArt id={row.id} glyph={row.glyph} className="h-6 w-6" />
                  <SymbolArt id={row.id} glyph={row.glyph} className="h-6 w-6" />
                  <SymbolArt id={row.id} glyph={row.glyph} className="h-6 w-6" />
                </span>
                {isJackpot ? (
                  <span className="font-display text-xs font-bold" style={{ color: hex }}>
                    {m.progressive ? 'JACKPOT' : 'JACKPOT ?'}
                  </span>
                ) : (
                  <span className="font-mono text-xs text-text">{row.mult}×</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 font-sans text-[11px] leading-relaxed text-muted-2">
          {m.progressive
            ? 'Três iguais pagam o prémio cheio; alguns pares também pagam. Os três símbolos do jackpot levam o pote inteiro.'
            : 'Três iguais pagam o prémio cheio; alguns pares também pagam. O jackpot é o segredo da casa.'}
        </p>
      </div>
    </div>
  );
}

export function SlotMachinePage() {
  const { key } = useParams<{ key: string }>();
  const { data: machines, isLoading } = useSlotMachines();
  const machine = machines?.find((m) => m.key === key);

  if (isLoading) return <p className="py-16 text-center text-muted">A acender a máquina…</p>;
  if (!machine) {
    return (
      <div className="animate-fade-in space-y-4 py-12 text-center">
        <p className="text-muted">Essa máquina não existe.</p>
        <Link to="/casino/slots" className="font-sans text-sm text-gold hover:underline">← Voltar às Slots</Link>
      </div>
    );
  }
  return <MachineScreen m={machine} />;
}
