import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GameArt, type GameArtKind } from './GameArt';

export interface GameTile {
  to: string;
  name: string;
  desc: string;
  art: GameArtKind;
  badge?: string;
  /** Tailwind gradient classes for the artwork band, e.g. "from-gold/30 to-bg". */
  tone: string;
  range?: string;
  cta?: string;
}

/** Image filename key — the last path segment ('/casino/crash' → 'crash'). */
const imageKey = (to: string) => to.split('/').filter(Boolean).pop() ?? '';

/**
 * Shared lobby card — used by Home, the casino lobby and the landing showcase.
 * Compact 3:4 portrait tile. Uses a real image from /public/games/<key>.webp
 * (cropped to fill), with the title over a scrim along the bottom. Falls back to
 * the SVG art if no image.
 */
export function GameCard({ g, featured = false }: { g: GameTile; featured?: boolean }) {
  const [noImg, setNoImg] = useState(false);
  const key = imageKey(g.to);

  return (
    <Link
      to={g.to}
      className={`card card-hover focus-ring group relative block ${featured ? 'aspect-[16/9]' : 'aspect-[3/4]'} overflow-hidden transition-transform duration-300 ease-aretim hover:-translate-y-1`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${g.tone}`}>
        {noImg ? (
          <GameArt kind={g.art} />
        ) : (
          <img
            src={`/games/${key}.webp`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setNoImg(true)}
          />
        )}
      </div>

      {/* Sweeping sheen on hover */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-aretim group-hover:translate-x-full"
        aria-hidden
      />
      {/* Bottom scrim so the title reads over the art */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg via-bg/55 to-transparent" aria-hidden />

      {g.badge && (
        <span className="absolute left-2.5 top-2.5 rounded-full border border-gold/40 bg-bg/70 px-2 py-0.5 font-sans text-[8.5px] font-medium uppercase tracking-[0.16em] text-gold backdrop-blur-sm">
          {g.badge}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="truncate font-display text-[19px] font-semibold leading-tight text-text transition-colors group-hover:text-gold">
          {g.name}
        </h3>
      </div>
    </Link>
  );
}
