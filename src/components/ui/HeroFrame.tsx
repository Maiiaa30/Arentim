import type { ReactNode } from 'react';
import { CornerBrackets } from './primitives';
import { ChipMark } from './ChipMark';

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
      {/* Drifting poker chips */}
      <ChipMark className="animate-floaty pointer-events-none absolute right-10 top-7 hidden h-20 w-20 sm:block" color="#C9A24B" opacity={0.16} />
      <ChipMark className="animate-floaty pointer-events-none absolute bottom-7 right-28 hidden h-12 w-12 sm:block" color="#C9A24B" opacity={0.1} style={{ animationDelay: '-1.6s' }} />
      <ChipMark className="animate-floaty pointer-events-none absolute right-44 top-20 hidden h-9 w-9 sm:block" color="#1f8a5b" opacity={0.12} style={{ animationDelay: '-0.8s' }} />
      <CornerBrackets />
      <div className="relative">{children}</div>
    </section>
  );
}
