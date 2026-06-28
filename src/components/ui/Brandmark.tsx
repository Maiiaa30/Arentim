/**
 * Arentim brand mark — a gilded Ace-of-Spades card (paths, not text, so it
 * renders identically everywhere). The corner "A" reads as both the Ace and
 * Arentim; the spade makes it unmistakably casino. Sits next to the ARENTIM
 * wordmark in the header.
 */
export function Brandmark({ size = 38, className = '' }: { size?: number; className?: string }) {
  const gold = 'bm-gold';
  const sheen = 'bm-sheen';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Arentim"
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6e4ad" />
          <stop offset="46%" stopColor="#C9A24B" />
          <stop offset="100%" stopColor="#7a5f2e" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Card */}
      <rect x="7" y="2.5" width="26" height="35" rx="4.2" fill="#0c0b08" stroke={`url(#${gold})`} strokeWidth="1.6" />
      <rect x="7" y="2.5" width="26" height="35" rx="4.2" fill={`url(#${sheen})`} />

      {/* Corner "A" (Ace / Arentim) */}
      <g fill="none" stroke={`url(#${gold})`} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13.2 L11.7 7.8 L13.4 13.2" />
        <path d="M10.7 11.3 L12.7 11.3" />
      </g>

      {/* Centre spade pip */}
      <g transform="translate(20.5,23) scale(0.2)">
        <path
          d="M0,-38 C-15,-12 -40,-6 -40,12 C-40,26 -22,28 -10,18 C-13,30 -16,34 -22,38 L22,38 C16,34 13,30 10,18 C22,28 40,26 40,12 C40,-6 15,-12 0,-38 Z"
          fill={`url(#${gold})`}
        />
      </g>
    </svg>
  );
}
