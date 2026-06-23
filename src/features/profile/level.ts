/**
 * Casino XP / level curve. Mirrored in SQL
 * (supabase/migrations/20260628300000_casino_levels.sql) — keep both in sync.
 * 1 Tostão wagered = 1 XP.
 */

export const MAX_LEVEL = 200;

/** XP to advance FROM level k to k+1 (k >= 1): arithmetic, +750 per level. */
export function levelStep(k: number): number {
  return 1500 + (k - 1) * 750;
}

/** Cumulative XP required to BE at level L (the level's floor). L >= 1. */
export function levelThreshold(L: number): number {
  if (L <= 1) return 0;
  const n = L - 1;
  return 1500 * n + 375 * n * (n - 1);
}

/** Reward (tós) granted for REACHING level L (L >= 2). */
export function levelReward(L: number): number {
  return 100 + (L - 1) * 20;
}

/** Total reward for claiming levels (fromLevel+1 .. toLevel). */
export function rewardBetween(fromLevel: number, toLevel: number): number {
  let sum = 0;
  for (let L = fromLevel + 1; L <= toLevel; L++) sum += levelReward(L);
  return sum;
}

export function levelFromWagered(wagered: number): number {
  const w = Math.max(0, Math.floor(wagered));
  let L = 1;
  while (L < MAX_LEVEL && levelThreshold(L + 1) <= w) L++;
  return L;
}

export function tierName(level: number): string {
  if (level >= 50) return 'Mítico';
  if (level >= 30) return 'Lenda';
  if (level >= 20) return 'Mestre';
  if (level >= 15) return 'Veterano';
  if (level >= 10) return 'Habitué';
  if (level >= 5) return 'Aprendiz';
  return 'Novato';
}

export type LevelInfo = {
  level: number;
  tier: string;
  intoLevel: number;
  span: number;
  progressPct: number;
  currentFloor: number;
  nextFloor: number;
};

export function levelInfo(wagered: number): LevelInfo {
  const w = Math.max(0, Math.floor(wagered));
  const level = levelFromWagered(w);
  const currentFloor = levelThreshold(level);
  const nextFloor = levelThreshold(level + 1);
  const span = Math.max(1, nextFloor - currentFloor);
  const intoLevel = w - currentFloor;
  return {
    level,
    tier: tierName(level),
    intoLevel,
    span,
    progressPct: Math.min(100, Math.round((intoLevel / span) * 100)),
    currentFloor,
    nextFloor,
  };
}
