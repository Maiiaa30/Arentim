import { useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * A win burst that rains confetti across the whole screen. Rendered in a portal
 * at <body> so no `overflow-hidden` ancestor clips it. A normal win gets a
 * modest shower; a jackpot gets an over-the-top one plus a gold screen flash.
 * Freezes (no clutter) under prefers-reduced-motion via index.css.
 */
const NORMAL_COLORS = ['#C9A24B', '#f3dca0', '#e7b73d', '#7bbf95', '#b0303a', '#2b4a8b', '#ffffff'];
const JACKPOT_COLORS = ['#C9A24B', '#f3dca0', '#e7b73d', '#fff0b8', '#ffffff', '#b8902f'];

export function WinCelebration({ jackpot = false }: { jackpot?: boolean }) {
  const pieces = useMemo(() => {
    const count = jackpot ? 90 : 28;
    const colors = jackpot ? JACKPOT_COLORS : NORMAL_COLORS;
    return Array.from({ length: count }, (_, i) => {
      const w = 6 + Math.round(Math.random() * 6);
      return {
        left: Math.random() * 100,
        w,
        h: w + Math.round(Math.random() * 8),
        color: colors[Math.floor(Math.random() * colors.length)]!,
        delay: Math.random() * (jackpot ? 0.8 : 0.4),
        dur: 2.4 + Math.random() * (jackpot ? 2.2 : 1.4),
        round: Math.random() < 0.3,
        tilt: Math.round(Math.random() * 360),
        key: i,
      };
    });
  }, [jackpot]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {jackpot && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(60% 50% at 50% 40%, rgba(201,162,75,0.55), transparent 70%)',
            animation: 'win-flash 1s ease-out forwards',
          }}
        />
      )}
      {pieces.map((p) => (
        <span
          key={p.key}
          className="absolute top-0 will-change-transform"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? '50%' : '1px',
            transform: `rotate(${p.tilt}deg)`,
            animation: `confetti-fall ${p.dur}s ${p.delay}s linear forwards`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
