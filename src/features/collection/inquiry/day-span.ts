import type { TFunction } from 'i18next'

import { formatDay } from '@/core/util/date-format'

/**
 * A **day span** — the earliest and latest calendar day among several wire dates
 * (ticket 316, BackOffice 1993).
 *
 * Two of the four-filter contract's default columns are multi-valued, and the
 * contract draws both the same way — *min … max, or one date when they fall on the
 * same day; blank when there is none*:
 *
 * - an ACR's **Collection date** is its linked collections' collected-at
 *   (`firstCollectedAt` … `lastCollectedAt`, `null` on an idle ACR);
 * - a deposit's **Business date** is its lines' `acrDate` values (a deposit banks
 *   several ACRs, so several days).
 *
 * Pure — no React, no network. The server sends the values; this only reads the
 * DAY part of each and picks the two ends, so nothing is derived that the wire
 * does not already say.
 */
export interface DaySpan {
  from: string
  to: string
}

/**
 * The span over `values`, or `null` when none of them is a real day.
 *
 * ⚠️ `null`, `''` and the .NET `0001-01-01` sentinel are **absences**, skipped
 * rather than counted as the earliest day — `formatDay` already blanks all three.
 * The ends compare as `yyyy-MM-dd` text, which sorts chronologically.
 */
export function daySpan(values: readonly (string | null | undefined)[]): DaySpan | null {
  let from = ''
  let to = ''
  for (const value of values) {
    const day = formatDay(value)
    if (day === '') continue
    if (from === '' || day < from) from = day
    if (to === '' || day > to) to = day
  }
  return from === '' ? null : { from, to }
}

/**
 * What the cell reads: blank for no span, the one day when both ends fall on it,
 * and `from – to` otherwise — through `t`, so the separator is copy and not a
 * literal (i18n-zero-literal).
 */
export function daySpanText(t: TFunction, span: DaySpan | null): string {
  if (!span) return ''
  if (span.from === span.to) return span.from
  return t('grid.daySpan', { from: span.from, to: span.to })
}
