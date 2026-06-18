import { useEffect, useRef, useState } from 'react';
import { WHEEL_SEQUENCE, colorOf } from './roulette';

const SEG = 360 / WHEEL_SEQUENCE.length; // ~9.73° per pocket
const R = 140;
const CX = 150;
const CY = 150;

const segColor: Record<string, string> = {
  green: '#3FB97A',
  red: '#E5484D',
  black: '#16181F',
};

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function segmentPath(i: number): string {
  const start = i * SEG;
  const end = (i + 1) * SEG;
  const [x1, y1] = polar(start, R);
  const [x2, y2] = polar(end, R);
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

interface RouletteWheelProps {
  /** Increments to trigger a spin once the target is known. */
  spinToken: number;
  /** Winning number 0–36, or null before the first spin. */
  result: number | null;
  spinning: boolean;
}

/** Rotating European wheel. Lands the winning pocket under the top pointer. */
export function RouletteWheel({ spinToken, result, spinning }: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);

  useEffect(() => {
    if (result === null || spinToken === 0) return;
    const pos = WHEEL_SEQUENCE.indexOf(result);
    if (pos < 0) return;
    // Angle that places pocket centre under the top pointer, plus several turns.
    const target = 360 * 6 - (pos * SEG + SEG / 2);
    const base = Math.ceil(rotationRef.current / 360) * 360;
    const next = base + target;
    rotationRef.current = next;
    setRotation(next);
  }, [spinToken, result]);

  return (
    <div className="relative mx-auto h-[300px] w-[300px]">
      {/* Pointer */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <div className="h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-gold" />
      </div>

      <svg viewBox="0 0 300 300" className="h-full w-full drop-shadow-lg">
        <circle cx={CX} cy={CY} r={R + 6} fill="#232733" />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '150px 150px',
            transition: spinning ? 'transform 4.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          }}
        >
          {WHEEL_SEQUENCE.map((n, i) => {
            const [tx, ty] = polar(i * SEG + SEG / 2, R - 16);
            return (
              <g key={n}>
                <path d={segmentPath(i)} fill={segColor[colorOf(n)]} stroke="#0B0C10" strokeWidth="0.5" />
                <text
                  x={tx}
                  y={ty}
                  fill="#E6E8EE"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${i * SEG + SEG / 2}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`}
                >
                  {n}
                </text>
              </g>
            );
          })}
        </g>
        <circle cx={CX} cy={CY} r="34" fill="#16181F" stroke="#D4A24A" strokeWidth="2" />
        <text x={CX} y={CY} fill="#D4A24A" fontSize="22" fontWeight="700" textAnchor="middle" dominantBaseline="central">
          {result === null ? '—' : result}
        </text>
      </svg>
    </div>
  );
}
