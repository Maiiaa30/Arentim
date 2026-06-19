/** Maps a machine's `accent` token to a concrete hue for inline theming
 *  (dynamic Tailwind class names can't be safely purged, so we use hex). */
const ACCENTS: Record<string, string> = {
  gold: '#C9A24B',
  'positive-felt': '#1f8a5b',
  'chip-ruby': '#b0303a',
  'chip-navy': '#2b4a8b',
};

export const accentHex = (token: string): string => ACCENTS[token] ?? ACCENTS.gold!;
