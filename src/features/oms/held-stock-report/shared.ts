/**
 * What both held-stock reports share (BackOffice ticket 3873): the stores box, a strict calendar day, and a feed age.
 * Pure, pinned by `shared.test.ts`.
 */
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
export function realDay(value: string): Date | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? date : null
}

/** The stores box as the door reads it: codes split on commas, semicolons or spaces, upper-cased, de-duplicated. */
export function normalizeStores(value: string): string {
  const codes = value
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return [...new Set(codes)].join(',')
}

/** The day `by` days from `day`, or `''` for a blank or impossible day. */
export function stepDay(day: string, by: number): string {
  const date = realDay(day)
  return date ? toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + by)) : ''
}

/** True while `day` is before the day `now` falls in. */
export function canStepForward(day: string, now: Date): boolean {
  return day !== '' && day < toIsoDate(now)
}

/** A feed age (whole seconds) as `h:mm:ss`, hours uncapped — a machine value. No age (null, negative, NaN) is blank. */
export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return ''
  const s = Math.floor(seconds)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
