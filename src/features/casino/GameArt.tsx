/**
 * Lightweight animated artwork for the lobby game tiles. Pure CSS/SVG —
 * transform/opacity only, GPU-friendly, no image downloads — so the floor has
 * life without slowing the page. Animations freeze under prefers-reduced-motion
 * (see index.css). Each scene fills the card's ~120px artwork band.
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

function Roulette() {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="h-[88px] w-[88px] animate-spin-slow rounded-full border border-gold/40"
        style={{
          background:
            'repeating-conic-gradient(#b0303a 0 30deg, #100e09 30deg 60deg)',
          boxShadow: 'inset 0 0 0 6px #13110a, inset 0 0 0 7px rgba(201,162,75,0.4)',
        }}
      />
    </div>
  );
}

function PlayingCardArt({ rank, suit, red, className = '' }: { rank: string; suit: string; red?: boolean; className?: string }) {
  return (
    <div
      className={`flex h-[64px] w-[44px] flex-col justify-between rounded border border-gold/30 bg-[#f3edde] p-1 ${className}`}
    >
      <span className={`font-display text-xs font-semibold ${red ? 'text-[#b0303a]' : 'text-black'}`}>{rank}</span>
      <span className={`text-center text-sm ${red ? 'text-[#b0303a]' : 'text-black'}`}>{suit}</span>
    </div>
  );
}

function Blackjack() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-floaty">
        <div className="flex">
          <PlayingCardArt rank="A" suit="♠" className="-rotate-12" />
          <PlayingCardArt rank="K" suit="♥" red className="-ml-3 rotate-6" />
        </div>
      </div>
    </div>
  );
}

function Slots() {
  const strip = ['🪙', '7', '🍷', '🐓', '🐟'];
  return (
    <div className="flex h-full items-center justify-center gap-1.5">
      {[0, 1, 2].map((r) => (
        <div key={r} className="h-[70px] w-[40px] overflow-hidden rounded border border-gold/30 bg-bg">
          <div className="animate-reel" style={{ animationDelay: `${r * -0.6}s` }}>
            {[...strip, ...strip].map((s, i) => (
              <div key={i} className="flex h-[35px] items-center justify-center text-lg">{s}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Coinflip() {
  return (
    <div className="flex h-full items-center justify-center" style={{ perspective: '300px' }}>
      <div
        className="flex h-[72px] w-[72px] animate-coin3d items-center justify-center rounded-full font-display text-2xl font-bold text-bg"
        style={{ background: 'linear-gradient(140deg,#f3dca0,#C9A24B,#6b542a)' }}
      >
        A
      </div>
    </div>
  );
}

function Poker() {
  return (
    <div className="flex h-full items-center justify-center gap-2">
      <div className="animate-floaty flex">
        <PlayingCardArt rank="A" suit="♦" red className="-rotate-6" />
        <PlayingCardArt rank="A" suit="♣" className="-ml-3 rotate-6" />
      </div>
      <div className="flex flex-col-reverse gap-0.5" style={{ animationDelay: '-1s' }}>
        {['#b0303a', '#2b4a8b', '#1f8a5b'].map((c, i) => (
          <span key={i} className="h-2 w-7 rounded-full border border-black/30" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

function Football() {
  return (
    <div className="relative h-full overflow-hidden" style={{ background: 'radial-gradient(120px 60px at 50% 120%, #1f8a5b55, transparent)' }}>
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-positive-felt/40" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ball text-xl">⚽</div>
    </div>
  );
}

function Dice() {
  const pip = 'absolute h-1.5 w-1.5 rounded-full bg-[#1a1712]';
  return (
    <div className="flex h-full items-center justify-center gap-2">
      {[0, 1].map((d) => (
        <div
          key={d}
          className="animate-floaty relative h-12 w-12 rounded-[10px] border border-gold/30 bg-gradient-to-br from-[#f7efe0] to-[#d9cdb4]"
          style={{ animationDelay: `${d * -0.7}s` }}
        >
          <span className={`${pip} left-2 top-2`} />
          <span className={`${pip} bottom-2 right-2`} />
          {d === 1 && <span className={`${pip} left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`} />}
        </div>
      ))}
    </div>
  );
}

function SobeDesce() {
  return (
    <div className="flex h-full items-end justify-center gap-1.5 pb-4">
      {[28, 44, 60, 44, 72, 56, 84].map((h, i) => (
        <span
          key={i}
          className="w-2.5 rounded-t bg-gradient-to-t from-gold/30 to-gold animate-floaty"
          style={{ height: h, animationDelay: `${i * -0.3}s` }}
        />
      ))}
    </div>
  );
}

function Wheel() {
  const cells = ['#4a3b22', '#2b6f4e', '#1a1712', '#C9A24B', '#4a3b22', '#b0303a', '#1a1712', '#2b6f4e'];
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="animate-floaty flex gap-1">
        {cells.map((c, i) => (
          <span key={i} className="h-12 w-9 shrink-0 rounded" style={{ background: c }} />
        ))}
      </div>
      <span className="absolute left-1/2 top-1 -translate-x-1/2 border-x-[6px] border-t-[9px] border-x-transparent border-t-gold" />
    </div>
  );
}

function Crash() {
  return (
    <div className="relative h-full overflow-hidden">
      <svg viewBox="0 0 120 80" className="h-full w-full" preserveAspectRatio="none">
        <path d="M6 74 C40 70 70 50 110 8" fill="none" stroke="#C9A24B" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
      </svg>
      <span className="animate-floaty absolute right-3 top-2 text-2xl">🚀</span>
    </div>
  );
}

function Chest() {
  return (
    <div className="relative flex h-full items-end justify-center gap-3 pb-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-floaty inline-block h-10 w-9"
          style={{
            animationDelay: `${i * -0.4}s`,
            background: 'linear-gradient(180deg,#c9952f,#7a5320)',
            clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)',
          }}
        />
      ))}
      <span className="absolute bottom-3 text-base">💎</span>
    </div>
  );
}

function HighLow() {
  return (
    <div className="flex h-full items-center justify-center gap-2">
      <span className="font-display text-2xl font-bold text-positive">▲</span>
      <div className="animate-floaty flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#f7efe0] to-[#cdbf9f] text-2xl">🎲</div>
      <span className="font-display text-2xl font-bold text-negative">▼</span>
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
