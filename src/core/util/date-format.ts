/** Date/time formatting helpers shared across the OMS screens. */

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Whether a parsed date should render as blank — an invalid date, or the .NET
 * `DateTime` default (`0001-01-01`) the API emits for unset timestamps.
 */
function isBlankDate(date: Date): boolean {
  return Number.isNaN(date.getTime()) || date.getFullYear() <= 1
}

/** Format an ISO datetime as `yyyy-MM-dd HH:mm` — the Screen 1 grid format. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (isBlankDate(date)) return ''
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * Format a Date as a local `yyyy-MM-dd` calendar date for the FromDate/ToDate
 * query params. Local parts (not `toISOString`) — the estate is single-timezone
 * local time and a UTC round-trip would shift the day (no-utc-time rule).
 */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Full month names, indexed by `Date.getMonth()`. */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * Format an ISO datetime as a long date — `May 22, 2026` — the Screen 2 header
 * "Date" field.
 */
export function formatLongDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (isBlankDate(date)) return ''
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/**
 * Format an ISO datetime as `dd/MM/yyyy hh:mm tt` (12-hour + AM/PM) — the
 * Screen 2 Log and Jobs timestamp format.
 */
export function formatLogDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (isBlankDate(date)) return ''
  const hours24 = date.getHours()
  const period = hours24 < 12 ? 'AM' : 'PM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` +
    ` ${pad(hours12)}:${pad(date.getMinutes())} ${period}`
  )
}

/** Parse a `yyyy-MM-dd` input value into a local Date; blank/invalid → null. */
export function fromIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}
