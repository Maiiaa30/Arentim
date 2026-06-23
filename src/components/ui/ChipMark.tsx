import type { CSSProperties } from 'react';

/**
 * A stylised poker-chip mark (rim spots + inner rings) used as faint casino
 * decoration on the hero and the app background. Pure SVG, currentColor-friendly
 * via the `color` prop. Decorative only — always aria-hidden by the caller.
 */
export function ChipMark({
  className = '',
  color = '#C9A24B',
  opacity = 1,
  style,
}: {
  className?: string;
  color?: string;
  opacity?: number;
  style?: CSSProperties;
}) {
  const spots = Array.from({ length: 8 }, (_, i) => (i / 8) * 360);
  return (
    <svg viewBox="0 0 100 100" className={className} style={{ opacity, ...style }} aria-hidden>
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="2.5" />
      {spots.map((deg) => (
        <rect key={deg} x="45.5" y="3" width="9" height="13" rx="2.5" fill={color} transform={`rotate(${deg} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="33" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="50" r="20" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 5" />
    </svg>
  );
}
