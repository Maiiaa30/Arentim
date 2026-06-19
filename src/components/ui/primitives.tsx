import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Aretim reusable style primitives (design handoff). Assemble pages from these:
 * top rule → header → framed hero (eyebrow + Playfair headline) → cards +
 * section headers + ghost buttons. Dark canvas, gold accents, PT-PT copy.
 */

/** 1. Top accent rule — 3px gilded bar with a slow travelling sheen. */
export function TopAccentRule() {
  return <div className="top-accent-rule" role="presentation" />;
}

/** 6. Eyebrow — gold uppercase overline above big Playfair headings. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** 4. Section header — Playfair H3 + flexible hairline + optional right label. */
export function SectionHeader({
  title,
  right,
  className = '',
}: {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <h3 className="shrink-0 font-display text-2xl font-medium text-text">{title}</h3>
      <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      {right && (
        <span className="shrink-0 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
          {right}
        </span>
      )}
    </div>
  );
}

/** 5. Card — warm surface, hairline border; pass `hover` for the lift+gild. */
export function Card({
  children,
  hover = false,
  className = '',
  ...rest
}: { children: ReactNode; hover?: boolean; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

const RING = {
  gold: 'linear-gradient(140deg,#C9A24B,#6b542a)',
  muted: 'linear-gradient(140deg,#5a5240,#2a2519)',
} as const;

/** 7. Ring avatar — gradient ring around a dark disc with initials. */
export function RingAvatar({
  initials,
  size = 42,
  tone = 'gold',
  presence,
}: {
  initials: string;
  size?: number;
  tone?: 'gold' | 'muted';
  presence?: 'online' | 'away' | 'offline';
}) {
  const presenceColor =
    presence === 'online' ? '#1f8a5b' : presence === 'away' ? '#C9A24B' : '#5a5240';
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{ background: RING[tone], padding: 2 }}
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-surface-raised font-display text-text"
          style={{ fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      </span>
      {presence && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg"
          style={{ background: presenceColor }}
        />
      )}
    </span>
  );
}

/** 8. Corner brackets — thin gold L-shapes framing a panel (top-left + bottom-right). */
export function CornerBrackets() {
  const arm = 'absolute h-5 w-5 border-gold/60';
  return (
    <>
      <span className={`${arm} left-3 top-3 border-l border-t`} aria-hidden />
      <span className={`${arm} bottom-3 right-3 border-b border-r`} aria-hidden />
    </>
  );
}

/** Framed hero/profile panel: hero gradient, gold border, corner brackets, glow. */
export function FramedPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded border border-gold/30 p-8 sm:p-10 ${className}`}
      style={{ background: 'linear-gradient(120deg,#16120b 0%,#0d0b07 62%,#0c0f0c 100%)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(600px 300px at 88% -10%, rgba(201,162,75,0.16), transparent 60%)' }}
        aria-hidden
      />
      <CornerBrackets />
      <div className="relative">{children}</div>
    </section>
  );
}

/** Diamond monogram — gold-bordered square rotated 45° with a counter-rotated letter. */
export function Monogram({ letter = 'A', size = 42 }: { letter?: string; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[3px] border border-gold"
      style={{ width: size, height: size, transform: 'rotate(45deg)' }}
    >
      <span className="font-display text-lg font-semibold text-gold" style={{ transform: 'rotate(-45deg)' }}>
        {letter}
      </span>
    </span>
  );
}
