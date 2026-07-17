/** Numeric formatting helpers shared across the OMS screens. */

/**
 * Format a money amount with a fixed 2 decimals. Non-numeric renders as `''`.
 * The single money formatter for the app — the Angular prototype duplicated
 * this inline in its grid columns (403 do-not-copy list).
 */
export function formatMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : ''
}

/**
 * Format a plain number for display — an integer stays integral, a fractional
 * value keeps its decimals. Non-numeric renders as `''`.
 */
export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}
