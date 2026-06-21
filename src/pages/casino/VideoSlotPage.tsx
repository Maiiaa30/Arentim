import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useVideoSlot } from '@/features/casino/useVideoSlot';
import { SymbolArt } from '@/features/casino/slotSymbols';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';
import {
  STRIP,
  SYMBOLS,
  LINES,
  PAYTABLE,
  spinGrid,
  type Sym,
  type VideoSlotResult,
} from '@/features/casino/videoSlot';

const GOLD = '#C9A24B';
const MIN_BET = 5;
const MAX_BET = 1000;
const BET_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000];

/** Distinct payline colours so overlapping lines stay readable. */
const LINE_COLORS = [
  '#C9A24B', '#5aa9e6', '#7bbf95', '#e0555f', '#c084fc',
  '#f0a93b', '#4fd1c5', '#f472b6', '#a3e635',
];

/**
 * Five jackpot tiers, mapped to the five highest-paying symbols. Each plate's
 * live value is computed truthfully from the engine: a 5-of-a-kind on a line
 * pays `PAYTABLE[sym][2]` per line and the machine divides the summed line
 * multiplier by `LINES.length`, so the prize at the current bet is
 * `floor(stake × PAYTABLE[sym][2] / 9)`.
 */
const JACKPOT_TIERS: { key: string; label: string; symbol: Sym; color: string }[] = [
  { key: 'mega', label: 'MEGA', symbol: 'seven', color: '#e7b73d' },
  { key: 'grand', label: 'GRAND', symbol: 'diamond', color: '#e0555f' },
  { key: 'major', label: 'MAJOR', symbol: 'crown', color: '#7bbf95' },
  { key: 'minor', label: 'MINOR', symbol: 'ring', color: '#5aa9e6' },
  { key: 'mini', label: 'MINI', symbol: 'ruby', color: '#c084fc' },
];

type ReelMode = 'idle' | 'spin' | 'land';

/** Win tiers escalate the celebration by the total multiplier. */
function winTier(jackpot: boolean, mult: number): { label: string; coins: number; big: boolean } | null {
  if (jackpot) return { label: '✦ JACKPOT ✦', coins: 40, big: true };
  if (mult <= 0) return null;
  if (mult >= 50) return { label: 'MEGA PRÉMIO', coins: 30, big: true };
  if (mult >= 15) return { label: 'GRANDE PRÉMIO', coins: 20, big: false };
  if (mult >= 4) return { label: 'BELO PRÉMIO', coins: 12, big: false };
  return { label: 'GANHOU', coins: 7, big: false };
}

/* ------------------------------------------------------------------ */
/* Inline control-icon SVGs (no emoji as functional UI).               */
/* ------------------------------------------------------------------ */

function SpinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M20 4v4.5h-4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AutoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M20 11a8 8 0 0 0-13.66-5.66M4 7V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13a8 8 0 0 0 13.66 5.66M20 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 3v4h-4M4 21v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SoundIcon({ muted, className }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 9v6h3l5 4V5L7 9H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CoinsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <ellipse cx="9" cy="7" rx="6" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 7v4c0 1.66 2.69 3 6 3s6-1.34 6-3V7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 14v3c0 1.66 2.69 3 6 3s6-1.34 6-3v-4" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="15" cy="10" rx="6" ry="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Branded gilded wordmark "FORTUNA DE OURO" — a stacked, gradient-filled logo
 * with a drop shadow and a small ✦, sitting over the scene like a real game
 * logo. Defined in SVG so the gold gradient renders crisply at any size.
 */
function TitleArt() {
  return (
    <div className="select-none text-left leading-none" aria-label="Fortuna de Ouro">
      <p className="mb-1 font-sans text-[8px] uppercase tracking-[0.42em] text-gold-light/70">Arentim Slots ✦</p>
      <svg viewBox="0 0 220 92" className="h-auto w-[150px] drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)] sm:w-[190px]" aria-hidden>
        <defs>
          <linearGradient id="vsLogo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3c6" />
            <stop offset="45%" stopColor="#f0cf6c" />
            <stop offset="75%" stopColor={GOLD} />
            <stop offset="100%" stopColor="#7e6126" />
          </linearGradient>
        </defs>
        <g
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="700"
          fill="url(#vsLogo)"
          stroke="#3a2c10"
          strokeWidth="0.8"
          textAnchor="middle"
        >
          <text x="110" y="34" fontSize="38" letterSpacing="1">FORTUNA</text>
          <text x="68" y="74" fontSize="34" letterSpacing="1">DE</text>
          <text x="150" y="80" fontSize="40" letterSpacing="1">OURO</text>
        </g>
      </svg>
    </div>
  );
}

/**
 * Jackpot / prize ladder — five stacked coloured plates (MEGA → MINI), each
 * showing the live prize for landing a 5-of-a-kind of its symbol at the current
 * bet. `flash` highlights the tier the player just landed.
 */
function JackpotLadder({
  stake,
  flash,
  className,
}: {
  stake: number;
  flash: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      {JACKPOT_TIERS.map(({ key, label, symbol, color }) => {
        const value = Math.floor((stake * PAYTABLE[symbol][2]) / LINES.length);
        const lit = flash === key;
        return (
          <div
            key={key}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-shadow ${lit ? 'animate-jackpot-flash' : ''}`}
            style={{
              borderColor: `${color}aa`,
              background: `linear-gradient(95deg, ${color}33, rgba(10,9,7,0.78))`,
              boxShadow: lit ? `0 0 22px 2px ${color}` : `inset 0 0 14px ${color}22`,
            }}
          >
            <SymbolArt id={symbol} className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[8.5px] font-bold uppercase tracking-[0.18em]" style={{ color }}>
                {label}
              </p>
              <p className="truncate font-mono text-[13px] font-bold leading-tight text-gold-light tabular-nums">
                {formatAmount(value)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Themed backdrop: a gilded "temple of riches" scene — columns, a radiant arch
 * and a treasure glow — drawn behind the translucent reel cells at low opacity
 * so the symbols stay legible while the frame reads as an immersive video slot.
 */
function VaultBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id="vsGlow" cx="50%" cy="32%" r="70%">
          <stop offset="0" stopColor="#1a3a2c" stopOpacity="0.95" />
          <stop offset="42%" stopColor="#16271a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0a0907" stopOpacity="1" />
        </radialGradient>
        <linearGradient id="vsCol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2c10" />
          <stop offset="50%" stopColor="#6b531f" />
          <stop offset="100%" stopColor="#241a08" />
        </linearGradient>
        <radialGradient id="vsTreasure" cx="50%" cy="100%" r="60%">
          <stop offset="0" stopColor="#e7b73d" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#e7b73d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="240" fill="url(#vsGlow)" />
      {/* radiant rays from the crown of the arch */}
      <g opacity="0.16">
        {Array.from({ length: 17 }, (_, i) => (
          <path key={i} d="M200 70 L196 -40 L204 -40 Z" fill={GOLD} transform={`rotate(${(i - 8) * 13} 200 70)`} />
        ))}
      </g>
      {/* arch */}
      <path
        d="M70 200 L70 96 A130 130 0 0 1 330 96 L330 200"
        fill="none"
        stroke={GOLD}
        strokeOpacity="0.35"
        strokeWidth="4"
      />
      <path
        d="M86 200 L86 100 A114 114 0 0 1 314 100 L314 200"
        fill="none"
        stroke={GOLD}
        strokeOpacity="0.16"
        strokeWidth="2"
      />
      {/* flanking columns */}
      {[44, 356].map((x) => (
        <g key={x}>
          <rect x={x - 13} y="78" width="26" height="150" fill="url(#vsCol)" opacity="0.85" />
          <rect x={x - 18} y="70" width="36" height="12" rx="2" fill={GOLD} opacity="0.5" />
          <rect x={x - 18} y="222" width="36" height="14" rx="2" fill={GOLD} opacity="0.5" />
          {[0, 1, 2, 3].map((f) => (
            <line key={f} x1={x - 8 + f * 5} y1="84" x2={x - 8 + f * 5} y2="220" stroke="#1c1407" strokeWidth="1.5" opacity="0.6" />
          ))}
        </g>
      ))}
      {/* treasure glow + coins at the base */}
      <rect x="0" y="150" width="400" height="90" fill="url(#vsTreasure)" />
      {Array.from({ length: 22 }, (_, i) => (
        <circle
          key={i}
          cx={60 + ((i * 53) % 280) + (i % 3) * 9}
          cy={206 + ((i * 7) % 24)}
          r={4 + (i % 3)}
          fill="#f0cf6c"
          opacity="0.4"
          stroke="#9a7322"
          strokeOpacity="0.4"
        />
      ))}
    </svg>
  );
}

/** A shower of falling coins over the frame on a win. */
function CoinShower({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="animate-coin-fall absolute top-0 text-xl"
          style={{
            left: `${(i * 97 + 7) % 100}%`,
            animationDelay: `${(i % 6) * 0.16}s`,
            animationDuration: `${1.2 + (i % 5) * 0.18}s`,
          }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}

/** Full-screen takeover for the biggest wins (mega / jackpot). */
function BigWinOverlay({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 animate-fade-in" style={{ background: 'radial-gradient(circle at 50% 45%, transparent 24%, rgba(0,0,0,0.6))' }} />
      <svg className="animate-spin-slow absolute h-[170vmax] w-[170vmax] opacity-40" viewBox="0 0 200 200" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} d="M100 100 L97 0 L103 0 Z" fill={GOLD} opacity={i % 2 ? 0.5 : 0.18} transform={`rotate(${i * 15} 100 100)`} />
        ))}
      </svg>
      <CoinShower count={44} />
      <div className="relative animate-win-burst px-4 text-center">
        <p className="font-display text-[42px] font-bold leading-none sm:text-7xl" style={{ color: GOLD, textShadow: `0 0 44px ${GOLD}` }}>
          {label}
        </p>
        <p className="mt-3 font-display text-3xl font-bold text-gold-light sm:text-5xl">+{formatAmount(amount)} tós</p>
      </div>
    </div>
  );
}

/**
 * One reel column: a vertical strip of 3-row cells. 'spin' scrolls a blurred
 * loop; 'land' decelerates a fresh strip onto the result rows so the player
 * watches symbols flick past and settle — the result never flashes early.
 */
function ReelColumn({
  reelTarget,
  mode,
  winRows,
  spinSeq,
}: {
  reelTarget: [string, string, string];
  mode: ReelMode;
  winRows: Set<number>;
  /** Increments once per spin — keeps the landing strip/animation stable across
   *  the win-state re-renders that happen after the reels settle (otherwise the
   *  strip rebuilt every render and the land animation replayed = a "refresh"). */
  spinSeq: number;
}) {
  // The strip that scrolls during 'spin' (captured from STRIP so it never leaks
  // the incoming result), and the landing strip = fillers + the 3 result rows.
  const spinStrip = useMemo(() => {
    const s: string[] = [];
    for (let i = 0; i < 3; i++) s.push(...STRIP);
    return s;
  }, []);
  // Built once per spin (deps on spinSeq, not the per-render reelTarget array).
  const landStrip = useMemo(() => {
    const fillers: string[] = [];
    for (let i = 0; i < 9; i++) fillers.push(STRIP[Math.floor(Math.random() * STRIP.length)]!);
    return [...fillers, ...reelTarget];
  }, [spinSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const cell = (id: string, row: number, key: number, isResult: boolean) => (
    <div
      className="flex aspect-square items-center justify-center"
      key={key}
      style={{ borderTop: '1px solid rgba(201,162,75,0.14)' }}
    >
      <div className="relative flex h-[82%] w-[82%] items-center justify-center">
        {isResult && winRows.has(row) && (
          <span
            className="absolute inset-0 rounded-full animate-symbol-throb"
            style={{ background: `radial-gradient(circle, ${GOLD}55, transparent 70%)` }}
          />
        )}
        <SymbolArt id={id} className={`relative h-full w-full ${isResult && winRows.has(row) ? 'animate-symbol-throb' : ''}`} />
      </div>
    </div>
  );

  return (
    <div className="relative flex-1 overflow-hidden" style={{ borderLeft: '1px solid rgba(201,162,75,0.18)' }}>
      {/* glass shading for depth */}
      <span className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/50" />

      {mode === 'idle' ? (
        <div className="animate-pop">
          {reelTarget.map((id, r) => cell(id, r, r, true))}
        </div>
      ) : mode === 'spin' ? (
        <div className="animate-reel-roll blur-[1.5px] will-change-transform">
          {spinStrip.map((id, i) => cell(id, i % 3, i, false))}
        </div>
      ) : (
        <div
          key={`land-${spinSeq}`}
          className="will-change-transform"
          style={{ animation: 'reel-land-3 0.85s cubic-bezier(0.15,0.85,0.25,1) forwards' }}
        >
          {landStrip.map((id, i) => {
            const isResult = i >= landStrip.length - 3;
            const row = i - (landStrip.length - 3);
            return cell(id, isResult ? row : i % 3, i, isResult);
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Draws the winning paylines as coloured polylines across the grid. Uses a
 * normalised 0..1 viewBox so it scales with the frame at any size.
 */
function PaylineOverlay({ lines }: { lines: { line: number; len: number }[] }) {
  if (lines.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 z-[18] h-full w-full" viewBox="0 0 5 3" preserveAspectRatio="none" aria-hidden>
      {lines.map(({ line, len }, idx) => {
        const rows = LINES[line]!;
        const pts = rows.slice(0, len).map((row, reel) => `${reel + 0.5},${row + 0.5}`).join(' ');
        const color = LINE_COLORS[line % LINE_COLORS.length]!;
        return (
          <polyline
            key={`${line}-${idx}`}
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="0.07"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
            style={{ filter: `drop-shadow(0 0 0.05px ${color})` }}
            className="animate-payline-pulse"
          />
        );
      })}
    </svg>
  );
}

/** Paytable overlay — the 9 symbols × [3,4,5] pays, toggled by the info button. */
function PaytableOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[40] flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border p-4 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        style={{ borderColor: `${GOLD}55`, background: 'rgba(16,14,9,0.96)' }}
        role="dialog"
        aria-label="Tabela de prémios"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold" style={{ color: GOLD }}>Tabela de prémios</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-2 hover:text-text"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 font-sans text-[11px] text-muted-2">× a aposta · por linha · runs alinhados à esquerda (≥3).</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SYMBOLS.map((sym) => {
            const [p3, p4, p5] = PAYTABLE[sym];
            const top = sym === 'seven';
            return (
              <div
                key={sym}
                className="flex items-center gap-3 rounded border px-3 py-2"
                style={{ borderColor: top ? `${GOLD}88` : 'rgba(201,162,75,0.16)', background: top ? `${GOLD}14` : 'transparent' }}
              >
                <SymbolArt id={sym} className="h-9 w-9 shrink-0" />
                <div className="font-mono text-xs text-text">
                  <div className="flex justify-between gap-3"><span className="text-muted-2">3×</span><span>{formatAmount(p3)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-2">4×</span><span>{formatAmount(p4)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-2">5×</span><span style={top ? { color: GOLD } : undefined}>{formatAmount(p5)}</span></div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 font-sans text-[11px] leading-relaxed text-muted-2">
          9 linhas fixas. Cada linha paga a maior sequência de iguais a contar da esquerda (≥3). Os prémios somam-se e
          dividem-se pelas 9 linhas. Cinco{' '}
          <SymbolArt id="seven" className="inline-block h-3.5 w-3.5 align-text-bottom" /> numa linha = JACKPOT.
        </p>
      </div>
    </div>
  );
}

export function VideoSlotPage() {
  const { data: profile } = useProfile();
  const play = useVideoSlot();
  const balance = profile?.balance ?? 0;

  const [stake, setStake] = useState(MIN_BET);
  const [grid, setGrid] = useState<string[][]>(() => spinGrid([0, 8, 16, 24, 32]));
  const [spinSeq, setSpinSeq] = useState(0);
  const [modes, setModes] = useState<ReelMode[]>(['idle', 'idle', 'idle', 'idle', 'idle']);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VideoSlotResult | null>(null);
  const [winAlert, setWinAlert] = useState<{ amount: number; jackpot: boolean; mult: number; id: number } | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [jackpotFlash, setJackpotFlash] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const spinId = useRef(0);
  // Latest onSpin in a ref so the autoplay effect can call it without re-subscribing.
  const spinRef = useRef<() => void>(() => {});

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const settled = !busy && result != null;
  const won = settled && result!.payout > 0;
  // Which (reel,row) cells are part of a winning line — for cell glow.
  const winRowsByReel = useMemo(() => {
    const map: Set<number>[] = [new Set(), new Set(), new Set(), new Set(), new Set()];
    if (!won) return map;
    for (const ln of result!.lines) {
      const rows = LINES[ln.line]!;
      for (let reel = 0; reel < ln.len; reel++) map[reel]!.add(rows[reel]!);
    }
    return map;
  }, [won, result]);

  const tier = winAlert ? winTier(winAlert.jackpot, winAlert.mult) : null;
  const bigWin = !!(winAlert && tier?.big);

  async function onSpin() {
    if (busy || stake > balance || stake < MIN_BET) return;
    setError(null);
    setResult(null);
    setWinAlert(null);
    setJackpotFlash(null);
    setBusy(true);
    setModes(['spin', 'spin', 'spin', 'spin', 'spin']);
    const startedAt = performance.now();
    try {
      const res = await play.mutateAsync(stake);
      setGrid(res.grid);
      setSpinSeq((n) => n + 1); // fresh landing strip for this spin only
      const id = ++spinId.current;
      const base = Math.max(0, 700 - (performance.now() - startedAt));
      const GAP = 260; // stop reels left→right
      const SETTLE = 850;
      for (let r = 0; r < 5; r++) {
        timers.current.push(
          window.setTimeout(() => setModes((s) => s.map((m, i) => (i === r ? 'land' : m))), base + GAP * r),
        );
      }
      timers.current.push(
        window.setTimeout(() => {
          setBusy(false);
          setResult(res);
          setLastWin(res.payout);
          if (res.payout > 0) {
            setWinAlert({ amount: res.payout, jackpot: res.jackpot, mult: res.multiplier, id });
            // Flash the jackpot tier whose top symbol the player landed 5-in-a-row of.
            const landedTier = JACKPOT_TIERS.find((t) =>
              res.lines.some((ln) => ln.symbol === t.symbol && ln.len === 5),
            );
            if (landedTier) {
              setJackpotFlash(landedTier.key);
              timers.current.push(window.setTimeout(() => setJackpotFlash((f) => (f === landedTier.key ? null : f)), 3000));
            }
            timers.current.push(window.setTimeout(() => setWinAlert((w) => (w?.id === id ? null : w)), 3000));
          }
        }, base + GAP * 4 + SETTLE),
      );
    } catch (e) {
      setModes(['idle', 'idle', 'idle', 'idle', 'idle']);
      setBusy(false);
      setError(e instanceof Error ? e.message : 'A rodada falhou.');
    }
  }
  spinRef.current = onSpin;

  const canSpin = !busy && stake <= balance && stake >= MIN_BET;

  // Autoplay: while toggled on, spin every ~1.4s once the reels settle, until
  // the player toggles off or the balance can no longer cover the bet.
  useEffect(() => {
    if (!autoplay) return;
    if (busy) return;
    if (stake > balance || stake < MIN_BET) {
      setAutoplay(false);
      return;
    }
    const t = window.setTimeout(() => spinRef.current(), 1400);
    return () => window.clearTimeout(t);
  }, [autoplay, busy, stake, balance]);

  const stepBet = (dir: 1 | -1) => {
    setStake((s) => {
      const idx = BET_STEPS.findIndex((b) => b >= s);
      let next: number;
      if (dir === 1) next = BET_STEPS[Math.min(BET_STEPS.length - 1, (idx < 0 ? BET_STEPS.length - 1 : idx) + 1)]!;
      else next = BET_STEPS[Math.max(0, (idx < 0 ? 0 : idx) - 1)]!;
      return Math.min(MAX_BET, Math.max(MIN_BET, next));
    });
  };

  return (
    <div className="animate-fade-in space-y-4">
      {bigWin && tier && <BigWinOverlay label={tier.label} amount={winAlert!.amount} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <span className="font-sans text-[11px] uppercase tracking-[0.24em] text-muted-2">Fortuna de Ouro</span>
      </div>

      {/* The cabinet — a wide gilded frame holding a full-bleed themed scene */}
      <div
        className="relative mx-auto max-w-6xl rounded-[24px] p-[3px] shadow-[0_34px_100px_rgba(0,0,0,0.65)]"
        style={{ background: `linear-gradient(155deg, #f7e4ad, ${GOLD}, #5b4824)` }}
      >
        <div
          className="relative overflow-hidden rounded-[21px]"
          style={{ background: 'radial-gradient(120% 90% at 50% 0%, #16271a, #0a0907 72%)' }}
        >
          {/* full-bleed themed scene behind everything */}
          <div className="absolute inset-0">
            <VaultBackdrop />
          </div>

          {/* zones overlaid on the scene */}
          <div className="relative grid grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-[170px_minmax(0,1fr)_120px]">
            {/* LEFT COLUMN — logo + jackpot ladder (collapses to a row below lg) */}
            <div className="order-1 flex flex-col gap-3 lg:order-none">
              <TitleArt />
              <JackpotLadder
                stake={stake}
                flash={jackpotFlash}
                className="hidden gap-1.5 sm:flex sm:flex-row sm:flex-wrap lg:flex lg:flex-col"
              />
            </div>

            {/* CENTRE — the reel cabinet (visual centre of mass) */}
            <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-none">
              <div
                className="relative overflow-hidden rounded-xl"
                style={{
                  aspectRatio: '5 / 3',
                  boxShadow: 'inset 0 0 0 2px rgba(201,162,75,0.5), inset 0 0 60px rgba(0,0,0,0.78)',
                  background: 'rgba(8,7,5,0.42)',
                }}
              >
                <VaultBackdrop />
                {/* the reels — translucent so the backdrop glows through */}
                <div className="absolute inset-0 flex">
                  {grid.map((reelTarget, r) => (
                    <ReelColumn
                      key={r}
                      reelTarget={[reelTarget[0]!, reelTarget[1]!, reelTarget[2]!]}
                      mode={modes[r]!}
                      winRows={winRowsByReel[r]!}
                      spinSeq={spinSeq}
                    />
                  ))}
                </div>
                <PaylineOverlay lines={won ? result!.lines : []} />
                {winAlert && <CoinShower count={tier?.coins ?? 8} />}
                {won && result && <WinCelebration key={result.payout + spinId.current} jackpot={result.jackpot} />}

                {/* Win banner */}
                {winAlert && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-4" aria-live="polite">
                    <div
                      className="animate-win-burst rounded-2xl border-2 px-7 py-3 text-center shadow-[0_12px_55px_rgba(201,162,75,0.55)] backdrop-blur-sm"
                      style={{ borderColor: GOLD, background: 'rgba(10,9,7,0.82)' }}
                    >
                      <p className={`font-sans text-[10px] uppercase tracking-[0.34em] text-gold-light ${winAlert.jackpot ? 'animate-jackpot-flash' : ''}`}>
                        {tier?.label ?? 'Ganhou'}
                      </p>
                      <p className="font-display text-[32px] font-bold leading-none sm:text-[40px]" style={{ color: GOLD }}>
                        +{formatAmount(winAlert.amount)} tós
                      </p>
                    </div>
                  </div>
                )}

                {showPaytable && <PaytableOverlay onClose={() => setShowPaytable(false)} />}
              </div>

              {/* Outcome line */}
              <div className="flex h-7 items-center justify-center text-center">
                {busy ? (
                  <p className="font-sans text-sm text-muted">A rodar…</p>
                ) : result?.jackpot ? (
                  <p className="animate-pop font-display text-2xl font-bold" style={{ color: GOLD }}>✦ JACKPOT ✦ {formatAmount(result.payout)} Tostões!</p>
                ) : won && result ? (
                  <p className="animate-pop font-display text-lg font-bold text-positive">
                    {result.lines.length} linha{result.lines.length > 1 ? 's' : ''} · +{formatAmount(result.payout)} Tostões
                  </p>
                ) : result ? (
                  <p className="font-sans text-sm text-muted">Sem prémio — gire outra vez.</p>
                ) : (
                  <p className="font-sans text-sm text-muted-2">Faça a sua aposta e gire.</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — SPIN · AUTO · coins (stacks below the grid on mobile) */}
            <div className="order-3 flex items-center justify-center gap-4 lg:order-none lg:flex-col lg:justify-center">
              <button
                type="button"
                onClick={() => setAutoplay((v) => !v)}
                disabled={busy && !autoplay}
                aria-pressed={autoplay}
                aria-label="Rodadas automáticas"
                className={`focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-40 ${autoplay ? 'animate-jackpot-flash text-bg' : 'text-gold-light'}`}
                style={
                  autoplay
                    ? { background: `radial-gradient(circle at 40% 32%, #f7e4ad, ${GOLD} 72%)`, borderColor: GOLD }
                    : { borderColor: `${GOLD}66`, background: 'rgba(10,9,7,0.6)' }
                }
              >
                <AutoGlyph className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={onSpin}
                disabled={!canSpin}
                aria-label="Girar"
                className="focus-ring flex h-[96px] w-[96px] shrink-0 flex-col items-center justify-center rounded-full text-bg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 sm:h-[108px] sm:w-[108px]"
                style={{ background: `radial-gradient(circle at 40% 32%, #f7e4ad, ${GOLD} 72%)`, boxShadow: `0 8px 26px ${GOLD}77` }}
              >
                {busy ? (
                  <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-bg/30 border-t-bg" />
                ) : (
                  <>
                    <SpinGlyph className="h-9 w-9" />
                    <span className="mt-0.5 font-display text-xs font-bold uppercase tracking-wide">Girar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPaytable((v) => !v)}
                aria-label="Moedas e tabela de prémios"
                className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-gold-light transition-colors hover:text-text"
                style={{ borderColor: `${GOLD}66`, background: 'rgba(10,9,7,0.6)' }}
              >
                <CoinsGlyph className="h-6 w-6" />
              </button>
            </div>

            {/* Jackpot ladder — slim mobile row shown only below sm */}
            <JackpotLadder
              stake={stake}
              flash={jackpotFlash}
              className="order-4 grid grid-cols-5 gap-1 sm:hidden lg:hidden"
            />
          </div>

          {/* BOTTOM BAR — CRÉDITO · ÚLTIMO GANHO · APOSTA · icons */}
          <div
            className="relative z-10 flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            style={{ borderColor: `${GOLD}33`, background: 'rgba(8,7,5,0.72)' }}
          >
            {/* Crédito + último ganho */}
            <div className="flex items-center justify-around gap-4 sm:justify-start sm:gap-6">
              <div>
                <p className="font-sans text-[8.5px] uppercase tracking-[0.22em] text-muted-2">Crédito</p>
                <p className="flex items-center gap-1 font-mono text-base font-bold text-text tabular-nums">
                  <CoinIcon className="h-4 w-4" /> {formatAmount(balance)}
                </p>
              </div>
              <div>
                <p className="font-sans text-[8.5px] uppercase tracking-[0.22em] text-muted-2">Último ganho</p>
                <p className="font-mono text-base font-bold tabular-nums" style={{ color: lastWin > 0 ? GOLD : '#9d927a' }}>
                  {formatAmount(lastWin)}
                </p>
              </div>
            </div>

            {/* Aposta stepper */}
            <div className="flex flex-col items-center gap-1">
              <span className="font-sans text-[8.5px] uppercase tracking-[0.22em] text-muted-2">Aposta</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy || stake <= MIN_BET}
                  onClick={() => stepBet(-1)}
                  aria-label="Diminuir aposta"
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-border font-mono text-lg text-text disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-[78px] text-center font-mono text-lg font-bold tabular-nums text-gold-light">{formatAmount(stake)}</span>
                <button
                  type="button"
                  disabled={busy || stake >= MAX_BET}
                  onClick={() => stepBet(1)}
                  aria-label="Aumentar aposta"
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-border font-mono text-lg text-text disabled:opacity-30"
                >
                  ＋
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStake(Math.max(MIN_BET, Math.min(MAX_BET, balance)))}
                  className="focus-ring rounded-full border border-border px-2.5 py-1.5 font-sans text-[10px] uppercase tracking-wider text-muted-2 hover:text-text disabled:opacity-40"
                >
                  Máx
                </button>
              </div>
            </div>

            {/* Sound · info · menu */}
            <div className="flex items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                aria-pressed={muted}
                aria-label={muted ? 'Ativar som' : 'Silenciar'}
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-2 hover:text-text"
              >
                <SoundIcon muted={muted} className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowPaytable((v) => !v)}
                aria-pressed={showPaytable}
                aria-label="Tabela de prémios"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-2 hover:text-text"
              >
                <InfoIcon className="h-5 w-5" />
              </button>
              <Link
                to="/casino"
                aria-label="Menu do casino"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-2 hover:text-text"
              >
                <MenuIcon className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* status / errors */}
      {stake > balance && <p className="mx-auto max-w-6xl text-center font-sans text-xs text-negative">Saldo insuficiente para esta aposta.</p>}
      {error && <p className="mx-auto max-w-6xl text-center font-sans text-sm text-negative">{error}</p>}

      <p className="mx-auto max-w-6xl px-1 font-sans text-[11px] leading-relaxed text-muted-2">
        9 linhas fixas. Cada linha paga a maior sequência de iguais a contar da esquerda (≥3). Os prémios somam-se e
        dividem-se pelas 9 linhas. Cinco{' '}
        <SymbolArt id="seven" className="inline-block h-3.5 w-3.5 align-text-bottom" /> numa linha = JACKPOT. Toque em{' '}
        <InfoIcon className="inline-block h-3.5 w-3.5 align-text-bottom" /> para a tabela completa.
      </p>
    </div>
  );
}
