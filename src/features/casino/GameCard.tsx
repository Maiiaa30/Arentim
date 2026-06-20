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

/**
 * Shared premium lobby card — used by Home, the casino lobby and the landing
 * showcase so they stay in lockstep. Hover lifts the card, slides a sheen across
 * the artwork, lights a gold top-edge, and fills the CTA.
 */
export function GameCard({ g, featured = false }: { g: GameTile; featured?: boolean }) {
  return (
    <Link
      to={g.to}
      className="card card-hover focus-ring group relative flex flex-col overflow-hidden transition-transform duration-300 ease-aretim hover:-translate-y-1"
    >
      <div className={`relative ${featured ? 'h-[150px]' : 'h-[128px]'} overflow-hidden bg-gradient-to-br ${g.tone}`}>
        <GameArt kind={g.art} />
        {/* Sweeping sheen on hover */}
        <div
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-aretim group-hover:translate-x-full"
          aria-hidden
        />
        {/* Gold top edge on hover */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        />
        {g.badge && (
          <span className="absolute left-3 top-3 rounded-full border border-gold/40 bg-bg/70 px-2.5 py-0.5 font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-gold backdrop-blur-sm">
            {g.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-[23px] font-semibold leading-tight text-text transition-colors group-hover:text-gold">
          {g.name}
        </h3>
        <p className="mt-1.5 flex-1 font-sans text-[12.5px] leading-relaxed text-muted">{g.desc}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-2">{g.range ?? '5 – 500 tós'}</span>
          <span className="inline-flex min-h-[36px] items-center rounded border border-gold/40 px-4 py-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-gold transition-colors group-hover:bg-gold group-hover:text-bg">
            {g.cta ?? 'Entrar'}
          </span>
        </div>
      </div>
    </Link>
  );
}
