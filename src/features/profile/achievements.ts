import type { Profile } from '@/types/db';

/**
 * Achievements are derived purely from the profile's lifetime aggregates, so
 * they need no storage or triggers — evaluate on read. Each has a target; an
 * achievement is unlocked once its value reaches the target.
 */
export type Achievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  value: (p: Profile) => number;
};

export const ACHIEVEMENTS: Achievement[] = [
  { key: 'first', title: 'Primeiro Passo', description: 'Joga a tua primeira ronda', icon: '🎲', target: 1, value: (p) => p.games_played },
  { key: 'regular', title: 'Habitué', description: 'Joga 100 rondas', icon: '🃏', target: 100, value: (p) => p.games_played },
  { key: 'veteran', title: 'Veterano', description: 'Joga 1.000 rondas', icon: '🎖️', target: 1000, value: (p) => p.games_played },
  { key: 'winner', title: 'Vencedor Nato', description: 'Vence 100 rondas', icon: '🏆', target: 100, value: (p) => p.games_won },
  { key: 'lucky', title: 'Sortudo', description: 'Ganha 1.000 tós num só lance', icon: '🍀', target: 1000, value: (p) => p.biggest_win },
  { key: 'highroller', title: 'Magnata', description: 'Ganha 10.000 tós num só lance', icon: '💎', target: 10000, value: (p) => p.biggest_win },
  { key: 'streak', title: 'Em Chamas', description: 'Sequência diária de 7', icon: '🔥', target: 7, value: (p) => p.streak_count },
  { key: 'wagered', title: 'Apostador', description: 'Aposta 100.000 tós no total', icon: '🎰', target: 100000, value: (p) => p.total_wagered },
  { key: 'rich', title: 'Cofre Cheio', description: 'Acumula 50.000 tós em saldo', icon: '🤑', target: 50000, value: (p) => p.balance },
];

export type AchievementState = Achievement & { current: number; unlocked: boolean; pct: number };

/** Evaluate every achievement against a profile, sorted unlocked-first. */
export function evaluateAchievements(p: Profile): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const current = Math.max(0, a.value(p));
    const unlocked = current >= a.target;
    return { ...a, current, unlocked, pct: Math.min(1, a.target === 0 ? 1 : current / a.target) };
  }).sort((x, y) => Number(y.unlocked) - Number(x.unlocked) || y.pct - x.pct);
}

/** How many achievements a profile has unlocked. */
export function unlockedCount(p: Profile): number {
  return ACHIEVEMENTS.reduce((n, a) => n + (a.value(p) >= a.target ? 1 : 0), 0);
}
