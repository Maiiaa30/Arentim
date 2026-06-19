/**
 * A struck casino chip rendered as crisp SVG: coloured base, white edge spots,
 * inset ring and the denomination in the centre. Denomination colours follow
 * the usual casino convention. Reused by roulette (chip selector) and blackjack
 * (bet stack).
 */
const CHIP_COLORS: Record<number, string> = {
  5: '#b0303a', // red
  10: '#2b4a8b', // navy
  25: '#1f8a5b', // green
  50: '#C9A24B', // gold
  100: '#6b2d8a', // purple
  250: '#9a2d5a', // magenta
};

const chipColor = (value: number): string => CHIP_COLORS[value] ?? '#C9A24B';

export function Chip({ value, size = 44 }: { value: number; size?: number }) {
  const color = chipColor(value);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]">
      <circle cx="50" cy="50" r="48" fill={color} />
      {/* white edge spots */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="#fff" strokeWidth="9" strokeDasharray="17 20.7" opacity="0.9" />
      <circle cx="50" cy="50" r="37" fill={color} />
      <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeDasharray="3 6" />
      <circle cx="50" cy="50" r="30" fill="rgba(0,0,0,0.16)" />
      <text
        x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fontSize={value >= 100 ? 26 : 32} fontWeight="700" fill="#fff"
        fontFamily="'DM Mono', ui-monospace, monospace"
      >
        {value}
      </text>
    </svg>
  );
}
