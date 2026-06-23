/**
 * Typed access to the real Onze de Ouro dataset (Liga Portugal squads, 2005–2020).
 * Built by scripts/build-onze-data.mjs from open FIFA ratings data (fifaindex via
 * lbenz730/fifa_model).
 *
 * The dataset is ~674 KB. We load it with a dynamic `import()` + top-level await
 * so it lands in its OWN chunk (separate from the Onze page/logic code), kept out
 * of the main app bundle and only fetched when the Onze route is opened. The
 * synchronous API below is preserved — module evaluation simply awaits the data.
 */
const raw = (await import('./data/onzeData.json')).default;

export type Line = 'GK' | 'DF' | 'MF' | 'FW';

/** A player as stored in the dataset (compact keys to keep the bundle small). */
export interface RawPlayer {
  n: string; // name
  r: number; // overall rating
  p: string; // preferred positions, e.g. "RM/CM"
  l: Line[]; // lines the player can fill (GK/DF/MF/FW)
  ph: string | null; // headshot url
  nat: string | null; // nationality
}
export interface DataClub {
  rating: number; // squad strength (avg of best XI)
  players: RawPlayer[];
}
export type Season = Record<string, DataClub>;

interface OnzeData {
  years: number[];
  byYear: Record<string, Season>;
}

const DATA = raw as OnzeData;

export const YEARS: number[] = [...DATA.years].sort((a, b) => a - b);
export const MIN_YEAR = YEARS[0]!;
export const MAX_YEAR = YEARS[YEARS.length - 1]!;

export const getSeason = (year: number): Season => DATA.byYear[String(year)] ?? {};
export const clubNames = (year: number): string[] => Object.keys(getSeason(year));

/** Years available within an inclusive [start, end] range. */
export const yearsInRange = (start: number, end: number): number[] =>
  YEARS.filter((y) => y >= Math.min(start, end) && y <= Math.max(start, end));

/** Football-season label for a dataset year, e.g. 2021 -> "20/21". */
export const seasonLabel = (y: number): string =>
  `${String((y - 1) % 100).padStart(2, '0')}/${String(y % 100).padStart(2, '0')}`;
