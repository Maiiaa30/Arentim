/**
 * A short, GPU-friendly win burst: a shower of coins/sparkles over the play
 * surface. Drop it inside a `relative` container and key it by the round id so
 * it replays on every win. Freezes under prefers-reduced-motion (index.css).
 */
const PIECES = ['🪙', '💰', '✨', '🎉', '💎', '⭐'];

export function WinCelebration({ jackpot = false }: { jackpot?: boolean }) {
  const count = jackpot ? 30 : 16;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 61) % 100;
        const delay = (i % 7) * 0.09;
        const dur = 1.1 + (i % 5) * 0.22;
        return (
          <span
            key={i}
            className="absolute -top-3 text-lg will-change-transform"
            style={{ left: `${left}%`, animation: `confetti ${dur}s ${delay}s linear forwards` }}
          >
            {PIECES[i % PIECES.length]}
          </span>
        );
      })}
    </div>
  );
}
