import type { ReactNode } from 'react';
import { CornerBrackets } from './primitives';

/**
 * A richer hero panel than FramedPanel: layered gold/felt glows, a faint suit
 * watermark and a couple of drifting "chip" rings — a casino-floor backdrop for
 * the headline. Decoration is all pointer-events-none and hidden on small
 * screens, so it never gets in the way of the copy.
 */
export function HeroFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-lg border border-gold/30 p-8 sm:p-12 ${className}`}
      style={{ background: 'linear-gradient(120deg,#17130b 0%,#0d0b07 58%,#0b0e0b 100%)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(640px 340px at 86% -18%, rgba(201,162,75,0.22), transparent 60%), radial-gradient(460px 320px at -5% 120%, rgba(31,138,91,0.13), transparent 60%)',
        }}
      />
      {/* Suit watermark */}
      <div
        className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 select-none font-display text-[210px] leading-none text-gold/[0.045] sm:block"
        aria-hidden
      >
        ♠
      </div>
      {/* Drifting chip rings */}
      <span
        className="animate-floaty pointer-events-none absolute right-12 top-9 hidden h-16 w-16 rounded-full border-[3px] border-dashed border-gold/25 sm:block"
        aria-hidden
      />
      <span
        className="animate-floaty pointer-events-none absolute bottom-9 right-32 hidden h-10 w-10 rounded-full border-[3px] border-dashed border-gold/15 sm:block"
        style={{ animationDelay: '-1.6s' }}
        aria-hidden
      />
      <CornerBrackets />
      <div className="relative">{children}</div>
    </section>
  );
}
