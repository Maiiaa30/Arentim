/**
 * Arentim brand mark — a gilded coin/medallion with a refined "A" monogram
 * (paths, not text, so it renders identically everywhere). Cleaner and more
 * premium than the old diamond crest; reads as a casino token at any size.
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
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Coin body */}
      <circle cx="20" cy="20" r="18.2" fill="#0c0b08" stroke={`url(#${gold})`} strokeWidth="1.7" />
      {/* Top sheen for a minted-metal feel */}
      <circle cx="20" cy="20" r="18.2" fill={`url(#${sheen})`} />
      {/* Inner hairline ring */}
      <circle cx="20" cy="20" r="13.8" fill="none" stroke="rgba(201,162,75,0.32)" strokeWidth="0.8" />

      {/* Refined "A" monogram */}
      <g fill="none" stroke={`url(#${gold})`} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 27.5 L20 12 L26 27.5" />
        <path d="M16.4 22.2 L23.6 22.2" />
      </g>
    </svg>
  );
}
