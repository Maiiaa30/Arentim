/**
 * Arentim brand mark — a gilded diamond crest with a drawn "A" (paths, not text,
 * so it renders identically everywhere). Replaces the old plain rotated square.
 */
export function Brandmark({ size = 38, className = '' }: { size?: number; className?: string }) {
  const id = 'bm-gold';
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
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3dca0" />
          <stop offset="50%" stopColor="#C9A24B" />
          <stop offset="100%" stopColor="#6b542a" />
        </linearGradient>
      </defs>
      {/* Gilded diamond crest */}
      <rect
        x="7.5"
        y="7.5"
        width="25"
        height="25"
        rx="7"
        transform="rotate(45 20 20)"
        fill="#0c0b08"
        stroke={`url(#${id})`}
        strokeWidth="1.5"
      />
      <rect
        x="11"
        y="11"
        width="18"
        height="18"
        rx="5"
        transform="rotate(45 20 20)"
        fill="none"
        stroke="rgba(201,162,75,0.25)"
        strokeWidth="0.8"
      />
      {/* Drawn "A" */}
      <g fill="none" stroke={`url(#${id})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 27 L20 13 L26 27" />
        <path d="M16.5 22 L23.5 22" />
      </g>
    </svg>
  );
}
