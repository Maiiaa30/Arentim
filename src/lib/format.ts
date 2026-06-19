/**
 * Display formatting for Tostões (PT-PT).
 *
 * Amounts are whole-integer Tostões. Thousands are grouped with a narrow
 * no-break space (e.g. 12500 -> "12 500"), matching the Aretim design. The
 * compact suffix is "tós"; prose uses the full word "Tostões".
 */

/** Narrow no-break space (U+202F) — groups digits without allowing a line break. */
export const GROUP_SEP = ' ';

/** Format a raw integer amount with thin-space grouping, e.g. 12500 -> "12 500". */
export function formatAmount(amount: number): string {
  const n = Math.abs(Math.trunc(amount));
  const sign = amount < 0 ? '-' : '';
  return sign + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEP);
}

/** The compact currency suffix shown after grouped amounts. */
export const CURRENCY_SUFFIX = 'tós';

/** Compact currency, e.g. 12500 -> "12 500 tós". Used for balances, odds, stakes. */
export function formatTos(amount: number): string {
  return `${formatAmount(amount)} ${CURRENCY_SUFFIX}`;
}

/** Prose currency with the full word, e.g. 1 -> "1 Tostão", 1250 -> "1 250 Tostões". */
export function formatTostoes(amount: number): string {
  const value = Math.abs(Math.trunc(amount));
  const label = value === 1 ? 'Tostão' : 'Tostões';
  return `${formatAmount(amount)} ${label}`;
}

/** Format a signed delta with an explicit + / − prefix, e.g. +150, −80. */
export function formatDelta(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return `${sign}${formatAmount(Math.abs(amount))}`;
}
