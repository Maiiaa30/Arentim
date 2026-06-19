import { useEffect, useRef, useState } from 'react';
import { WHEEL_SEQUENCE, colorOf } from './roulette';

const N = WHEEL_SEQUENCE.length; // 37 pockets
const SEG = 360 / N; // ~9.73° per pocket
const CX = 150;
const CY = 150;
const R_OUTER = 146; // gilded rim outer edge
const R_RIM = 138; // inner edge of the gold rim
const R_POCKET = 132; // pocket outer radius
const R_INNER = 96; // pocket inner radius (cone begins)
const R_CONE = 90; // central cone outer radius
const R_HUB = 40; // gold hub
const R_BALL_TRACK = 113; // radius the ball rides at
const BALL_R = 6;

const segColor: Record<string, string> = {
  green: '#1f8a5b',
  red: '#b0303a',
  black: '#14110c',
};

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

/** Annular sector path (a pocket) between two radii. */
function pocketPath(i: number): string {
  const start = i * SEG;
  const end = (i + 1) * SEG;
  const [ox1, oy1] = polar(start, R_POCKET);
  const [ox2, oy2] = polar(end, R_POCKET);
  const [ix2, iy2] = polar(end, R_INNER);
  const [ix1, iy1] = polar(start, R_INNER);
  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${R_POCKET} ${R_POCKET} 0 0 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${R_INNER} ${R_INNER} 0 0 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    'Z',
  ].join(' ');
}

interface RouletteWheelProps {
  /** Increments to trigger a spin once the target is known. */
  spinToken: number;
  /** Winning number 0–36, or null before the first spin. */
  result: number | null;
  spinning: boolean;
  /** True once the wheel has settled — gates the hub number reveal. */
  landed: boolean;
}

/** Rotating European single-zero wheel with a ball that lands the winner. */
export function RouletteWheel({ spinToken, result, spinning, landed }: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0); // wheel rotation
  const [ballRotation, setBallRotation] = useState(0); // ball rotation (counter-spin)
  const rotationRef = useRef(0);
  const ballRef = useRef(0);

  useEffect(() => {
    if (result === null || spinToken === 0) return;
    const pos = WHEEL_SEQUENCE.indexOf(result);
    if (pos < 0) return;

    // Wheel spins clockwise several turns and parks the winning pocket centre
    // under the top pointer (angle 0 = top).
    const pocketAngle = pos * SEG + SEG / 2;
    const wheelBase = Math.ceil(rotationRef.current / 360) * 360;
    const wheelNext = wheelBase + 360 * 5 - pocketAngle;
    rotationRef.current = wheelNext;
    setRotation(wheelNext);

    // Ball travels the opposite way (counter-clockwise) more turns, ending at
    // the top so it visually rests in the winning pocket once both settle.
    const ballBase = Math.floor(ballRef.current / 360) * 360;
    const ballNext = ballBase - 360 * 8;
    ballRef.current = ballNext;
    setBallRotation(ballNext);
  }, [spinToken, result]);

  const spinTransition = 'transform 4.1s cubic-bezier(0.18, 0.72, 0.16, 1)';

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      {/* Pointer */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[2px]">
        <div className="h-0 w-0 border-x-[9px] border-t-[16px] border-x-transparent border-t-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]" />
      </div>

      <svg viewBox="0 0 300 300" className="h-full w-full">
        <defs>
          <radialGradient id="rw-rim" cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#f3dca0" />
            <stop offset="45%" stopColor="#C9A24B" />
            <stop offset="100%" stopColor="#6b542a" />
          </radialGradient>
          <radialGradient id="rw-cone" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#2a2519" />
            <stop offset="100%" stopColor="#0c0a06" />
          </radialGradient>
          <radialGradient id="rw-hub" cx="50%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#f3dca0" />
            <stop offset="55%" stopColor="#C9A24B" />
            <stop offset="100%" stopColor="#7a5f2e" />
          </radialGradient>
          <radialGradient id="rw-ball" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e4e2da" />
            <stop offset="100%" stopColor="#9a978c" />
          </radialGradient>
          <radialGradient id="rw-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
          </radialGradient>
        </defs>

        {/* Outer gilded rim */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="url(#rw-rim)" />
        <circle cx={CX} cy={CY} r={R_RIM} fill="#0c0a06" />

        {/* Rotating wheel */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '150px 150px',
            transition: spinning ? spinTransition : 'none',
          }}
        >
          {WHEEL_SEQUENCE.map((n, i) => {
            const mid = i * SEG + SEG / 2;
            const [tx, ty] = polar(mid, (R_POCKET + R_INNER) / 2 + 4);
            return (
              <g key={n}>
                <path
                  d={pocketPath(i)}
                  fill={segColor[colorOf(n)]}
                  stroke="rgba(201,162,75,0.55)"
                  strokeWidth="0.6"
                />
                <text
                  x={tx}
                  y={ty}
                  fill={colorOf(n) === 'black' ? '#e8e4d8' : '#fff'}
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="'DM Mono', ui-monospace, monospace"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${mid}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`}
                >
                  {n}
                </text>
              </g>
            );
          })}

          {/* Central cone with radial fret spokes */}
          <circle cx={CX} cy={CY} r={R_CONE} fill="url(#rw-cone)" stroke="rgba(201,162,75,0.4)" strokeWidth="1" />
          {Array.from({ length: 8 }, (_, k) => {
            const a = k * 45;
            const [x1, y1] = polar(a, R_HUB + 2);
            const [x2, y2] = polar(a, R_CONE - 2);
            return (
              <line
                key={a}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(201,162,75,0.55)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Ball — rotates on its own track so it appears to circle the rim. */}
        <g
          style={{
            transform: `rotate(${ballRotation}deg)`,
            transformOrigin: '150px 150px',
            transition: spinning ? spinTransition : 'none',
          }}
        >
          <circle cx={CX} cy={CY - R_BALL_TRACK} r={BALL_R} fill="url(#rw-ball)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
        </g>

        {/* Gold hub + gated result */}
        <circle cx={CX} cy={CY} r={R_HUB} fill="url(#rw-hub)" />
        <circle cx={CX} cy={CY} r={R_HUB - 6} fill="#0c0a06" stroke="rgba(201,162,75,0.5)" strokeWidth="1" />
        <text
          x={CX}
          y={CY}
          fill={landed && result !== null ? '#f3dca0' : 'rgba(243,220,160,0.35)'}
          fontSize="24"
          fontWeight="700"
          fontFamily="'Playfair Display', serif"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {landed && result !== null ? result : '—'}
        </text>

        {/* Soft vignette for depth */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="url(#rw-vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
