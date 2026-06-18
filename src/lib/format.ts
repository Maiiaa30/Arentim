/**
 * Display formatting for Tostões.
 *
 * Amounts are whole-integer Tostões. We display them with Portuguese-style
 * thousands grouping (a dot), e.g. 1250 -> "1.250", 5000 -> "5.000".
 */

/**
 * Format a raw integer amount as a grouped number string, e.g. 1250 -> "1.250".
 * Grouping is implemented explicitly (dot every three digits) so output is
 * deterministic regardless of the host's ICU locale data.
 */
export function formatAmount(amount: number): string {
  const n = Math.abs(Math.trunc(amount));
  const sign = amount < 0 ? '-' : '';
  return sign + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Format with the currency name, e.g. 1250 -> "1.250 Tostões". */
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
