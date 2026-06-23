/** Maps a machine's `accent` token to a concrete hue for inline theming
 *  (dynamic Tailwind class names can't be safely purged, so we use hex). */
const ACCENTS: Record<string, string> = {
  gold: '#C9A24B',
  'positive-felt': '#1f8a5b',
  'chip-ruby': '#b0303a',
  'chip-navy': '#2b4a8b',
};

export const accentHex = (token: string): string => ACCENTS[token] ?? ACCENTS.gold!;

/** A richer, distinct hue per machine KEY so every cabinet has its own identity
 *  (several machines share the same `accent` token). Falls back to the token. */
const MACHINE_HEX: Record<string, string> = {
  classico: '#C9A24B', // gold
  frutaria: '#2fae73', // orchard green
  tasca: '#c23b46', // tavern red
  pirata: '#3f74d6', // ocean blue
  aurelia: '#9d6be0', // royal purple
  pote: '#e3b53b', // molten gold
  vegas: '#e24355', // vegas red
};
export const machineHex = (key: string, accentToken: string): string =>
  MACHINE_HEX[key] ?? accentHex(accentToken);
