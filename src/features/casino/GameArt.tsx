import type { CSSProperties } from 'react';

/**
 * Lightweight crafted artwork for the lobby game tiles. Pure CSS/SVG —
 * transform/opacity animation only, GPU-friendly, no image downloads — so the
 * floor has life without slowing the page. Animations freeze under
 * prefers-reduced-motion (see index.css). Each scene fills the card's ~128px
 * artwork band and shares one gold house palette for a cohesive set.
 */

export type GameArtKind =
  | 'roulette'
  | 'blackjack'
  | 'slots'
  | 'coinflip'
  | 'poker'
  | 'football'
  | 'dice'
  | 'sobedesce'
  | 'wheel'
  | 'crash'
  | 'chest'
  | 'highlow';

const GOLD = '#C9A24B';
const GOLD_LIGHT = '#f3dca0';
const RED = '#b0303a';

/* ---------- shared building blocks ---------------------------------------- */

/** A clean playing card with corner indices and a centre suit. */
function MiniCard({
  rank,
  suit,
  red = false,
  className = '',
  style,
}: {
  rank: string;
  suit: string;
  red?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ink = red ? 'text-[#b0303a]' : 'text-[#1a1712]';
  return (
    <div
      className={`relative h-[68px] w-[48px] rounded-md bg-gradient-to-br from-white to-[#ece4d2] shadow-[0_8px_18px_rgba(0,0,0,0.45)] ring-1 ring-black/10 ${className}`}
      style={style}
    >
      <span className={`absolute left-1.5 top-1 font-display text-[13px] font-bold leading-none ${ink}`}>{rank}</span>
      <span className={`absolute inset-0 flex items-center justify-center text-[20px] ${ink}`}>{suit}</span>
      <span className={`absolute bottom-1 right-1.5 rotate-180 font-display text-[13px] font-bold leading-none ${ink}`}>{rank}</span>
    </div>
  );
}

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** A pipped die face. */
function Die({ value, className = '', style }: { value: number; className?: string; style?: CSSProperties }) {
  const on = new Set(PIP_MAP[value] ?? []);
  return (
    <div
      className={`grid h-12 w-12 grid-cols-3 grid-rows-3 gap-0.5 rounded-[11px] border border-black/10 bg-gradient-to-br from-[#f7efe0] to-[#d9cdb4] p-1.5 shadow-[0_6px_14px_rgba(0,0,0,0.4)] ${className}`}
      style={style}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {on.has(i) && <span className="h-1.5 w-1.5 rounded-full bg-[#1a1712]" />}
        </span>
      ))}
    </div>
  );
}

function Chevron({ up = false, small = false }: { up?: boolean; small?: boolean }) {
  return (
    <span className={`font-display font-bold ${small ? 'text-base' : 'text-2xl'} ${up ? 'text-positive' : 'text-negative'}`}>
      {up ? '▲' : '▼'}
    </span>
  );
}

/** A striped casino chip edge stack. */
function ChipStack() {
  const colors = [RED, '#2b4a8b', '#1f8a5b', GOLD];
  return (
    <div className="flex flex-col-reverse">
      {colors.map((c, i) => (
        <span
          key={i}
          className="-mt-1 h-3 w-9 rounded-[3px] border-x border-black/30"
          style={{ background: `repeating-linear-gradient(90deg, ${c} 0 4px, rgba(255,255,255,0.28) 4px 6px, ${c} 6px 10px)` }}
        />
      ))}
    </div>
  );
}

/* ---------- scenes -------------------------------------------------------- */

function Crash() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox="0 0 120 80" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="ga-crash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8c2b" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#ff8c2b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 40, 60].map((y) => (
          <line key={y} x1="0" y1={y} x2="120" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        ))}
        <path d="M6 74 C44 70 74 48 112 8 L112 80 L6 80 Z" fill="url(#ga-crash)" />
        <path d="M6 74 C44 70 74 48 112 8" fill="none" stroke="#ff8c2b" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <RocketSvg className="animate-floaty absolute right-2 top-1.5 h-7 w-7" />
    </div>
  );
}

function RocketSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={{ transform: 'rotate(10deg)' }} aria-hidden>
      <path d="M20 4c4 4 4.6 10 1.6 16h-7C11.4 14 12 8 16 4c1.2-1.1 2.8-1.1 4 0Z" fill="#e9e6dd" stroke="#b9b4a6" strokeWidth="0.8" />
      <circle cx="18" cy="11" r="2.3" fill="#7cc6ff" stroke="#3a6c92" strokeWidth="0.6" />
      <path d="M14.5 17 L10 22 L14.5 20.5 Z" fill={GOLD} />
      <path d="M21.5 17 L26 22 L21.5 20.5 Z" fill={GOLD} />
      <path d="M15.5 20.5 h5 L18 29 Z" fill="#ff8c2b" />
    </svg>
  );
}

function Roulette() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-[94px] w-[94px]">
        <div
          className="absolute inset-0 animate-spin-slow rounded-full"
          style={{
            background: 'repeating-conic-gradient(#b0303a 0 18deg, #14110c 18deg 36deg)',
            boxShadow: 'inset 0 0 0 5px #C9A24B, inset 0 0 0 7px #0c0a06, inset 0 0 16px rgba(0,0,0,0.6)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle at 38% 32%, ${GOLD_LIGHT}, #6b542a)`, boxShadow: '0 0 0 2px #0c0a06' }}
        />
        <span className="absolute left-1/2 top-[3px] h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
        <span className="absolute left-1/2 top-[-6px] -translate-x-1/2 border-x-[5px] border-t-[8px] border-x-transparent border-t-gold" />
      </div>
    </div>
  );
}

function Slots() {
  const strip = ['7', '★', '♦', '♣', '♠'];
  return (
    <div className="flex h-full items-center justify-center gap-2">
      {[0, 1, 2].map((r) => (
        <div
          key={r}
          className="relative h-[76px] w-[42px] overflow-hidden rounded-md border border-gold/30 bg-gradient-to-b from-[#171206] to-[#0b0905] shadow-[inset_0_0_10px_rgba(0,0,0,0.7)]"
        >
          <div className="animate-reel" style={{ animationDelay: `${r * -0.6}s` }}>
            {[...strip, ...strip].map((s, i) => (
              <div
                key={i}
                className="flex h-[38px] items-center justify-center font-display text-xl font-bold"
                style={{ color: s === '♦' ? RED : GOLD_LIGHT }}
              >
                {s}
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gold/40" />
        </div>
      ))}
    </div>
  );
}

function Coinflip() {
  return (
    <div className="flex h-full items-center justify-center" style={{ perspective: '320px' }}>
      <div
        className="relative h-[76px] w-[76px] animate-coin3d rounded-full"
        style={{
          background: `radial-gradient(circle at 38% 30%, #f7e7bd, ${GOLD} 55%, #6b542a)`,
          boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.22), 0 8px 18px rgba(0,0,0,0.5)',
        }}
      >
        <span className="absolute inset-[6px] rounded-full border border-[#8a6c34]/60" />
        <span className="absolute inset-0 flex items-center justify-center font-display text-[32px] font-bold text-[#5a431f]">A</span>
      </div>
    </div>
  );
}

function Poker() {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <div className="animate-floaty flex">
        <MiniCard rank="A" suit="♠" className="-rotate-[10deg]" />
        <MiniCard rank="A" suit="♥" red className="-ml-4 rotate-[10deg]" />
      </div>
      <ChipStack />
    </div>
  );
}

function Blackjack() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-floaty flex">
        <MiniCard rank="A" suit="♠" className="-rotate-[8deg]" />
        <MiniCard rank="K" suit="♥" red className="-ml-4 rotate-[8deg]" />
      </div>
    </div>
  );
}

function Football() {
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(130px 80px at 50% 130%, rgba(31,138,91,0.32), transparent 70%)' }} />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-positive-felt/40" />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-positive-felt/25" />
      <BallSvg className="animate-ball absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

function BallSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#f5f3ee" stroke="#cfcabb" strokeWidth="1" />
      <polygon points="16,9 21,13 19,19 13,19 11,13" fill="#1a1712" />
      <g stroke="#1a1712" strokeWidth="1" fill="none">
        <path d="M16 2 L16 9" />
        <path d="M30 16 L21 13" />
        <path d="M24 28 L19 19" />
        <path d="M8 28 L13 19" />
        <path d="M2 16 L11 13" />
      </g>
    </svg>
  );
}

function Dice() {
  return (
    <div className="flex h-full items-center justify-center gap-2.5">
      <Die value={5} className="animate-floaty -rotate-[8deg]" />
      <Die value={3} className="animate-floaty rotate-[8deg]" style={{ animationDelay: '-0.7s' }} />
    </div>
  );
}

function HighLow() {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <Chevron up />
      <Die value={4} className="animate-floaty" />
      <Chevron />
    </div>
  );
}

function SobeDesce() {
  return (
    <div className="flex h-full items-center justify-center gap-2.5">
      <div className="flex flex-col items-center gap-1.5">
        <Chevron up small />
        <Chevron small />
      </div>
      <MiniCard rank="7" suit="♦" red className="animate-floaty" />
    </div>
  );
}

function Wheel() {
  const cells: { c: string; m: string }[] = [
    { c: '#1f8a5b', m: '2×' },
    { c: '#14110c', m: '3×' },
    { c: GOLD, m: '5×' },
    { c: '#6b542a', m: '2×' },
    { c: RED, m: '×' },
    { c: '#14110c', m: '3×' },
    { c: '#2b6f4e', m: '2×' },
  ];
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="animate-floaty flex gap-1.5">
        {cells.map((cell, i) => (
          <span
            key={i}
            className="flex h-14 w-9 shrink-0 items-center justify-center rounded-md font-display text-[11px] font-bold text-white/85 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.35)]"
            style={{ background: `linear-gradient(160deg, ${cell.c}, rgba(0,0,0,0.45))` }}
          >
            {cell.m}
          </span>
        ))}
      </div>
      <span className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-gold/40" />
      <span className="absolute left-1/2 top-0 -translate-x-1/2 border-x-[7px] border-t-[11px] border-x-transparent border-t-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]" />
    </div>
  );
}

function Cup({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`relative inline-block h-11 w-9 ${className}`} style={style}>
      <span
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg,#d9a84a,#7a5320)',
          clipPath: 'polygon(16% 0,84% 0,100% 100%,0 100%)',
          boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.35)',
        }}
      />
      <span
        className="absolute inset-x-0 top-0 h-1.5 bg-[#f3dca0]/70"
        style={{ clipPath: 'polygon(16% 0,84% 0,86% 100%,14% 100%)' }}
      />
    </span>
  );
}

function Chest() {
  return (
    <div className="relative flex h-full items-end justify-center gap-3 pb-5">
      {[0, 1, 2].map((i) => (
        <Cup key={i} className="animate-floaty" style={{ animationDelay: `${i * -0.4}s` }} />
      ))}
      <span
        className="absolute bottom-4 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${GOLD})`, boxShadow: '0 0 8px rgba(201,162,75,0.6)' }}
      />
    </div>
  );
}

const SCENES: Record<GameArtKind, () => JSX.Element> = {
  roulette: Roulette,
  blackjack: Blackjack,
  slots: Slots,
  coinflip: Coinflip,
  poker: Poker,
  football: Football,
  dice: Dice,
  sobedesce: SobeDesce,
  wheel: Wheel,
  crash: Crash,
  chest: Chest,
  highlow: HighLow,
};

export function GameArt({ kind }: { kind: GameArtKind }) {
  const Scene = SCENES[kind];
  return <Scene />;
}
