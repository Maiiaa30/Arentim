import { useEffect, useRef, useState } from 'react';
import { formatAmount } from '@/lib/format';

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  className?: string;
}

/**
 * Counts from the previous value to the new one when `value` changes, so
 * balance changes feel tangible. Respects prefers-reduced-motion.
 */
export function AnimatedNumber({ value, durationMs = 600, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, durationMs]);

  return <span className={`tabular-nums ${className ?? ''}`}>{formatAmount(display)}</span>;
}
