/**
 * The queue's filters (ticket 434, spec 430 D12). Pure.
 *
 * They narrow the LOADED lines: the read is a work queue with no filters of its own. As WPF's
 * `FailedDonorTransfersController.Keeps`: a store matches trimmed and case-insensitive, the day
 * range is on the job's last attempt, and a line with no attempt time is never hidden by it.
 */
import { toIsoDate } from '@/core/util/date-format'
import type { FailedLine } from './failed-line'

export interface LineFilter {
  donorStore: string
  orderStore: string
  /** `yyyy-MM-dd`, inclusive; `''` is unbounded. */
  from: string
  to: string
}

export const EMPTY_FILTER: LineFilter = { donorStore: '', orderStore: '', from: '', to: '' }

const matches = (filter: string, value: string | null | undefined) =>
  !filter.trim() || filter.trim().toLowerCase() === (value ?? '').trim().toLowerCase()

export function keepsLine(line: FailedLine, f: LineFilter): boolean {
  if (!matches(f.donorStore, line.row.donorStore) || !matches(f.orderStore, line.row.orderStore)) return false
  if (line.lastAttemptAt === null) return true
  // The attempt's local calendar day, as the day pickers mean it (no UTC round trip).
  const day = toIsoDate(new Date(line.lastAttemptAt))
  return (!f.from || day >= f.from) && (!f.to || day <= f.to)
}

/** A day range that ends before it starts: it hides every line with an attempt, so the bar says so. */
export function isReversed(f: LineFilter): boolean {
  return !!f.from && !!f.to && f.from > f.to
}

/** Whether any filter is set, so the status bar can say how many lines the filters hide. */
export function isFiltering(f: LineFilter): boolean {
  return !!(f.donorStore.trim() || f.orderStore.trim() || f.from || f.to)
}
