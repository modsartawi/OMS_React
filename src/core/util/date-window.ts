import { fromIsoDate, toIsoDate } from './date-format'

// The date-only search window of the delivery-rail monitors: `from` and `to` both included, at most
// N days, and — where a contract names them — a floor and a ceiling on the dates. Graduated from the
// Deliverect orders monitor (ticket 478) by ticket 556, when the HungerStation orders monitor became
// its second reader. Pure: no React, no `t`.

/** A date-only value, `yyyy-MM-dd`. */
type LocalDate = string

/**
 * Today as the browser's LOCAL calendar date, built from its parts (`toIsoDate` reads
 * getFullYear / getMonth / getDate) — never `toISOString()`, which would hand back yesterday
 * after midnight in Riyadh.
 */
export function localToday(now: Date = new Date()): LocalDate {
  return toIsoDate(now)
}

/** A strict `yyyy-MM-dd` that names a real day (no 2026-02-30), else `null`. */
function validDate(value: string | null): LocalDate | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value?.trim() ? toIsoDate(date) : null
}

/** The calendar day `n` days from `date` (negative goes back). `date` must be a real day. */
export function addDays(date: LocalDate, n: number): LocalDate {
  const d = fromIsoDate(date)
  if (!d) return date
  // From the date parts at noon, so no clock change can push the step across a day boundary.
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12))
}

/** The window's day count, both ends included; `null` when either end is not a date. */
export function windowDays(from: LocalDate, to: LocalDate): number | null {
  const a = fromIsoDate(from)
  const b = fromIsoDate(to)
  if (!a || !b) return null
  // Calendar days from the date parts, so no clock change can make a day 23 or 25 hours long.
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  return day(b) - day(a) + 1
}

/** Why a window may not be sent, or `null` when it may. */
export type WindowProblem = 'invalid' | 'reversed' | 'tooLong' | 'outOfBounds'

export interface WindowRule {
  /** The longest window, both ends counted. */
  maxDays: number
  /** `from` may not be before this day. */
  earliest?: LocalDate
  /** `to` may not be after this day. */
  latest?: LocalDate
}

/**
 * The window rule, checked before any call: both dates real, `from` ≤ `to`, at most `maxDays`
 * days, and inside the bounds when the rule names them. Dates compare as `yyyy-MM-dd` text, which
 * orders exactly as the calendar does once both are valid.
 */
export function windowProblem(from: LocalDate, to: LocalDate, rule: WindowRule): WindowProblem | null {
  const days = windowDays(from, to)
  if (days === null || validDate(from) === null || validDate(to) === null) return 'invalid'
  if (days < 1) return 'reversed'
  if (days > rule.maxDays) return 'tooLong'
  if ((rule.earliest && from < rule.earliest) || (rule.latest && to > rule.latest)) return 'outOfBounds'
  return null
}
