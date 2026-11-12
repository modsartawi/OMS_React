import { formatDay } from '@/core/charts/format'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { formatRange, fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { comparisonMatcher } from './previous-rows'
import { measureOf } from './wire'

/**
 * The same weeks last year beside a table, a bar, a line or a KPI (ticket 877; BackOffice spec 3587 B9, B11) — pure.
 * With `compareToLastYear` the server answers `result.lastYear` (the same query over the period 364 days back) and
 * `result.lastYearPeriod` (its dates). It is drawn wherever the previous period is, the same way (`./previous-rows`):
 * a table's column after each measure, a series beside a bar or a line, a figure under a KPI — each named with last
 * year's dates, so it reads apart from the previous period.
 *
 * Every figure is the server's, shown as sent. A figure whose area does not hold last year (`result.lastYearNotHeld`,
 * BackOffice 3606) has NO last-year figure — no column, no series, no KPI figure; it is never drawn as zero — and
 * {@link lastYearNotes} says the day its data starts.
 */

/** The key a measure's last-year value is kept under in a table row. */
export const lastYearKey = (measure: string): string => `${measure}:lastYear`

/** Last year's rows and dates, when the answer carries both (it was asked); `null` otherwise. */
export function lastYearOf(result: AnalyticsQueryResult): { rows: AnalyticsRow[]; period: { from: string; to: string } } | null {
  return result.lastYear && result.lastYearPeriod ? { rows: result.lastYear, period: result.lastYearPeriod } : null
}

/** Last year's dates as the screen writes them (`Oct 30, 2025 – Nov 5, 2025`): one plain string, isolated once by the caller. */
export function lastYearRange(result: AnalyticsQueryResult, lang: string): string {
  const period = lastYearOf(result)?.period
  return period ? formatRange(formatDay(period.from, lang) || period.from, formatDay(period.to, lang) || period.to) : ''
}

/** The measures whose area does not hold last year (B11): they have no last-year figure anywhere. */
export const notHeldMeasures = (result: AnalyticsQueryResult): Set<string> => new Set((result.lastYearNotHeld ?? []).flatMap((e) => e.measures))

/**
 * The measures that get a last-year figure: the query's own (a calculated column has none), when the answer has
 * last-year rows — as the previous period's (`./previous-rows` `previousMeasures`) — less the ones not held.
 */
export function lastYearMeasures(definition: AnalyticsViewDefinition, result: AnalyticsQueryResult): string[] {
  if ((lastYearOf(result)?.rows.length ?? 0) === 0) return []
  const notHeld = notHeldMeasures(result)
  return definition.query.measures.filter((m) => m.trim() !== '' && !notHeld.has(m))
}

/** Each current row's last-year row, matched as the previous period's is (`./previous-rows` `previousMatcher`). */
export function lastYearMatcher(
  result: AnalyticsQueryResult,
  dimKeys: readonly string[],
  model: AnalyticsModel,
  extraKeys: readonly string[] = [],
): (row: AnalyticsRow) => AnalyticsRow | undefined {
  return comparisonMatcher(result.rows, lastYearOf(result)?.rows ?? [], dimKeys, model, extraKeys)
}

// ── The "not held" note ──────────────────────────────────────────────────────────────────────────────────

/** The note's words, from the locale (`boards:view.lastYearNotHeld*`); every name and day arrives isolated. */
export interface LastYearNoteWords {
  /** "Last year is not shown for {{measures}}: the data starts on {{day}}." */
  notHeld: (v: { measures: string; day: string }) => string
  /** The same without a day, for an entry that names none. */
  notHeldNoDay: (v: { measures: string }) => string
}

/**
 * The panel note of an answer whose last year is not held somewhere (B11), in `lang`: one sentence per area, naming
 * its figures (the model's labels, one list) and the day its data starts. Empty when every area holds last year, and
 * when it was not asked. `model` is the panel's drawing model (its variant measures named).
 */
export function lastYearNotes(
  result: AnalyticsQueryResult | null | undefined,
  model: Pick<AnalyticsModel, 'measures'>,
  lang: string,
  words: LastYearNoteWords,
): string[] {
  return (result?.lastYearNotHeld ?? []).map((e) => {
    const measures = fsi(listText(e.measures.map((k) => saysIn(measureOf(model, k)?.label, lang) || k), lang))
    const day = formatDay(e.dataFrom, lang) || e.dataFrom
    return day ? words.notHeld({ measures, day: fsi(day) }) : words.notHeldNoDay({ measures })
  })
}
