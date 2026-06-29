/**
 * Maps a casino mini-game route to the transaction `game` key(s) it records and
 * a display label. Used by the GameSessionTracker to show a session-summary
 * popup when the player leaves a game. Poker / Sueca / Sportsbook are excluded —
 * they have their own buy-in / settle-later models, not a quick-play session.
 */
export type GameMeta = { keys: string[]; label: string };

const EXACT: Record<string, GameMeta> = {
  '/casino/roulette': { keys: ['roulette'], label: 'Roleta' },
  '/casino/fortuna': { keys: ['vslots'], label: 'Fortuna de Ouro' },
  '/casino/coinflip': { keys: ['coinflip'], label: 'Moeda' },
  '/casino/blackjack': { keys: ['blackjack'], label: 'Blackjack' },
  '/casino/dice': { keys: ['dice'], label: 'Dados' },
  '/casino/sobe-e-desce': { keys: ['sobedesce'], label: 'Sobe e Desce' },
  '/casino/wheel': { keys: ['wheel'], label: 'Fita da Sorte' },
  '/casino/crash': { keys: ['crash'], label: 'Crash' },
  '/casino/chest': { keys: ['chest'], label: 'Jogo dos Copos' },
  '/casino/maior-menor': { keys: ['highlow'], label: 'Maior ou Menor' },
  '/casino/mines': { keys: ['mines'], label: 'Mines' },
  '/casino/tigrinho': { keys: ['tigrinho'], label: 'Tigrinho' },
  '/casino/corrida': { keys: ['horse'], label: 'Corrida de Cavalos' },
  '/casino/frango': { keys: ['chicken'], label: 'Atravessa!' },
  '/casino/plinko': { keys: ['plinko'], label: 'Plinko' },
  '/casino/balatro': { keys: ['balatro'], label: 'Balatró' },
  '/casino/batalha-naval': { keys: ['batalha_naval'], label: 'Batalha Naval' },
};

/** Resolve a pathname to its mini-game, or null if it isn't a tracked game. */
export function matchGame(pathname: string): GameMeta | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (EXACT[p]) return EXACT[p];
  // Themed slot machines live at /casino/slots/:key (the bare /casino/slots is
  // the lobby, not a game).
  if (/^\/casino\/slots\/[^/]+$/.test(p)) return { keys: ['slots'], label: 'Slots' };
  return null;
}
