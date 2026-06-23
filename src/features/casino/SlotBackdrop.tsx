/**
 * A subtle themed scene painted behind a machine's reels, keyed by machine.
 * Kept low-contrast so the reels stay readable. Pure SVG, no downloads.
 * Unknown keys render nothing (the cabinet's gradient shows through).
 */
function Backdrop({ k }: { k: string }) {
  switch (k) {
    case 'classico': // art-deco gold rays
      return (
        <g opacity="0.5">
          <g stroke="#C9A24B" strokeWidth="0.6" opacity="0.5">
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={i} x1="340" y1="120" x2={340 + 600 * Math.cos((i / 16) * Math.PI * 2)} y2={120 + 600 * Math.sin((i / 16) * Math.PI * 2)} />
            ))}
          </g>
          <circle cx="340" cy="120" r="60" fill="none" stroke="#C9A24B" strokeWidth="1" opacity="0.4" />
        </g>
      );
    case 'frutaria': // orchard leaves
      return (
        <g opacity="0.45" fill="#1f8a5b">
          {[[60, 60], [600, 90], [120, 240], [560, 250], [330, 30]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="48" ry="22" transform={`rotate(${i * 40} ${x} ${y})`} opacity="0.5" />
          ))}
        </g>
      );
    case 'tasca': // warm tavern glow + barrel staves
      return (
        <g opacity="0.5">
          <ellipse cx="340" cy="40" rx="320" ry="120" fill="#b0303a" opacity="0.18" />
          <g stroke="#8a5a2c" strokeWidth="6" opacity="0.25">
            {[120, 240, 360, 480].map((x) => <line key={x} x1={x} y1="40" x2={x} y2="300" />)}
          </g>
        </g>
      );
    case 'pirata': // night sea, moon, distant isle
      return (
        <g opacity="0.6">
          <circle cx="560" cy="70" r="46" fill="#cfe0f5" opacity="0.25" />
          <path d="M0 200 q80 -26 160 0 t160 0 t160 0 t160 0 V300 H0 Z" fill="#2b4a8b" opacity="0.3" />
          <path d="M0 235 q80 -22 160 0 t160 0 t160 0 t160 0 V300 H0 Z" fill="#1c3360" opacity="0.4" />
          <path d="M250 200 q40 -60 90 0 Z" fill="#0f1f3a" opacity="0.5" />
        </g>
      );
    case 'aurelia': // royal columns + laurel (purple/gold)
      return (
        <g opacity="0.62">
          <rect x="40" y="20" width="34" height="280" rx="4" fill="#9d6be0" opacity="0.22" />
          <rect x="606" y="20" width="34" height="280" rx="4" fill="#9d6be0" opacity="0.22" />
          <g stroke="#C9A24B" strokeWidth="1.2" opacity="0.34" fill="none">
            <path d="M250 50 q90 40 180 0" />
            <path d="M270 40 q70 36 140 0" />
          </g>
          <circle cx="340" cy="40" r="7" fill="#C9A24B" opacity="0.45" />
        </g>
      );
    case 'pote': // molten gold pot of riches
      return (
        <g opacity="0.6">
          <ellipse cx="340" cy="60" rx="320" ry="120" fill="#e3b53b" opacity="0.16" />
          {[[150, 250], [340, 270], [530, 250], [240, 120], [440, 120]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={14 - i} fill="#f2cf6a" opacity="0.3" />
          ))}
        </g>
      );
    case 'vegas': // neon vegas glow
      return (
        <g opacity="0.55">
          <ellipse cx="340" cy="40" rx="300" ry="90" fill="#e24355" opacity="0.18" />
          <g stroke="#ffd54a" strokeWidth="1" opacity="0.3">
            {[90, 200, 480, 590].map((x) => <line key={x} x1={x} y1="20" x2={x} y2="300" />)}
          </g>
          <circle cx="340" cy="60" r="40" fill="none" stroke="#e24355" strokeWidth="2" opacity="0.3" />
        </g>
      );
    default:
      return null;
  }
}

export function SlotBackdrop({ machineKey }: { machineKey: string }) {
  return (
    <svg
      viewBox="0 0 680 300"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <Backdrop k={machineKey} />
    </svg>
  );
}
