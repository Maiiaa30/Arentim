/**
 * Sportsbook odds math and outcome derivation. Pure logic mirrored from the
 * SQL (place_bet / fixture_market_result). The server is authoritative; this
 * drives the bet slip preview and labels.
 */

export type Market = '1x2' | 'ou25' | 'btts';
export type Selection = 'home' | 'draw' | 'away' | 'over' | 'under' | 'yes' | 'no';

/** Decimal odds for all supported markets on a fixture. */
export interface FixtureOdds {
  '1x2'?: { home: number; draw: number; away: number };
  ou25?: { over: number; under: number };
  btts?: { yes: number; no: number };
}

/** Combined decimal odds for a parlay (product), rounded to 4 dp like the SQL. */
export function combineOdds(odds: readonly number[]): number {
  const product = odds.reduce((acc, o) => acc * o, 1);
  return Math.round(product * 10000) / 10000;
}

/** Potential total return for a stake at the given combined odds (floored). */
export function potentialPayout(stake: number, combinedOdds: number): number {
  return Math.floor(stake * combinedOdds);
}

/** Winning selection for a market given the final score. Mirrors SQL. */
export function marketResult(market: Market, home: number, away: number): Selection {
  switch (market) {
    case '1x2':
      return home > away ? 'home' : home < away ? 'away' : 'draw';
    case 'ou25':
      return home + away > 2 ? 'over' : 'under'; // 2.5 line
    case 'btts':
      return home > 0 && away > 0 ? 'yes' : 'no';
  }
}

const MARKET_LABELS: Record<Market, string> = {
  '1x2': 'Match result',
  ou25: 'Over/Under 2.5',
  btts: 'Both teams to score',
};

export function marketLabel(market: Market): string {
  return MARKET_LABELS[market];
}

export function selectionLabel(market: Market, selection: Selection, home?: string, away?: string): string {
  if (market === '1x2') {
    if (selection === 'home') return home ?? 'Home';
    if (selection === 'away') return away ?? 'Away';
    return 'Draw';
  }
  if (market === 'ou25') return selection === 'over' ? 'Over 2.5' : 'Under 2.5';
  return selection === 'yes' ? 'BTTS: Yes' : 'BTTS: No';
}
