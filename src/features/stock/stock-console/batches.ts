/**
 * A batch row's marks (oms 941, BackOffice spec 4157 stories 31–33) — pure, `today` passed in. The expiry cell says
 * whether the batch is expired or expires within 90 days (the Batches filter's own words); a placeholder batch is
 * marked as Stock Visibility's rule found it. Ticket 944 adds the scan's expiry beside these.
 */
import type { StockConsoleBatchRow } from '@/core/models/stock-console'
import { addDays, type LocalDate } from '@/core/util/date-window'

/** The window the "expires within 90 days" filter and mark share. */
export const EXPIRING_DAYS = 90

export type ExpiryMark = 'expired' | 'within90' | 'ok' | 'none'

/** The marks drawn beside an expiry (`batches.expiry.<mark>`); `ok` and `none` draw the day alone. */
export const EXPIRY_MARKS = ['expired', 'within90'] as const

export interface ExpiryCell {
  /** The expiry as a day, or null when the row has none (or not a day). */
  day: LocalDate | null
  mark: ExpiryMark
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Expired: before today. Within 90 days: today up to today + 90. Days compare as `yyyy-MM-dd` strings. */
export function expiryCell(expiry: string | null | undefined, today: LocalDate): ExpiryCell {
  const day = (expiry ?? '').trim().slice(0, 10)
  if (!DAY.test(day)) return { day: null, mark: 'none' }
  if (day < today) return { day, mark: 'expired' }
  return { day, mark: day <= addDays(today, EXPIRING_DAYS) ? 'within90' : 'ok' }
}

export interface BatchMarks {
  placeholder: boolean
  expiry: ExpiryCell
}

export const batchMarks = (row: StockConsoleBatchRow, today: LocalDate): BatchMarks => ({
  placeholder: row.placeholder === true,
  expiry: expiryCell(row.expiry, today),
})
