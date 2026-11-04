/**
 * The "Closes after a take" report (ticket 758, spec 3326): every delivery closed or cancelled after a
 * store took it, estate-wide, with who caused it and the reason as given. Pure, pinned by
 * `closes.test.ts`.
 *
 * 🚩 Nothing here computes a figure: "who caused it" is one label per outcome, and the counts above the
 * grid are a count of the rows the door sent (display, not a measure). The reason is the 714 rule —
 * exactly as sent, never translated, mapped or concluded; never "no stock".
 */
import type { DispatchScorecardDrillRow } from '@/core/models/dispatch-scorecard'
import { filtersFromParams, filtersToParams, type ScorecardFilters } from './range'

/** The outcomes the screen knows, in the order the chips list them (the two failed-take kinds first). */
export const CLOSE_OUTCOMES = [
  'StoreClosed',
  'CourierBlamedStore',
  'FallbackStoreClosed',
  'CourierOtherReason',
  'CourierNoReason',
  'OtherClose',
] as const

/** The two failed-take kinds: the report's default outcome filter. */
export const FAILED_TAKE_OUTCOMES: readonly string[] = ['StoreClosed', 'CourierBlamedStore']

const KNOWN: ReadonlySet<string> = new Set<string>(CLOSE_OUTCOMES)

/** The i18n key of where a close points; an outcome the screen does not know reads "Unclear". */
export function causeKey(outcome: string): string {
  return KNOWN.has(outcome) ? `closes.cause.${outcome}` : 'closes.cause.unknown'
}

/** Whether an outcome counts against the taker (spec 3326): a store close, or a courier cancel naming the store. */
export function isFailedTakeOutcome(outcome: string): boolean {
  return FAILED_TAKE_OUTCOMES.includes(outcome)
}

/**
 * The rows the report lists: the takes won in the range (`figure=failedTakeRate`) that were closed after
 * the take (`afterTakeOutcome` not `''`), plus the fallback stores' closes (`figure=fallbackCancels`),
 * oldest offer first.
 *
 * A fallback close comes from the fallback read only: the same callout's won bid (an award released, then
 * the fallback store closed it) carries the callout's outcome too, and would list it a second time against
 * the store that let it go.
 */
export function closedRows(
  taken: readonly DispatchScorecardDrillRow[],
  fallbackCancels: readonly DispatchScorecardDrillRow[],
): DispatchScorecardDrillRow[] {
  const closed = taken.filter((r) => (r.afterTakeOutcome ?? '') !== '' && r.afterTakeOutcome !== 'FallbackStoreClosed')
  return [...closed, ...fallbackCancels.filter((r) => (r.afterTakeOutcome ?? '') !== '')].sort((a, b) =>
    (a.offeredAt ?? '').localeCompare(b.offeredAt ?? ''),
  )
}

/** The reason a row gives, for counting: its text without surrounding spaces, `null` = "No reason given". */
export function reasonOf(row: Pick<DispatchScorecardDrillRow, 'afterTakeReason'>): string | null {
  const text = (row.afterTakeReason ?? '').trim()
  return text === '' ? null : text
}

export interface ReasonCount {
  /** The text exactly as given (trimmed), `null` = "No reason given". */
  reason: string | null
  count: number
}

/**
 * The reasons ranked by how many rows give the identical text ("Order Not Found in branch × 37"), most
 * first, a tie in the order first met. Counting the rows the door sent is display, not a figure. Text is
 * never folded, translated or mapped: only the spaces around it are dropped.
 */
export function reasonCounts(rows: readonly Pick<DispatchScorecardDrillRow, 'afterTakeReason'>[]): ReasonCount[] {
  const counts = new Map<string | null, number>()
  for (const row of rows) {
    const reason = reasonOf(row)
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  // `sort` is stable, so a tie keeps the Map's insertion order (first met).
  return [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
}

export interface OutcomeCount {
  outcome: string
  count: number
}

/** Rows per outcome, for the chips: every known outcome (0 included) in the known order, then any unknown one sent. */
export function outcomeCounts(rows: readonly Pick<DispatchScorecardDrillRow, 'afterTakeOutcome'>[]): OutcomeCount[] {
  const counts = new Map<string, number>(CLOSE_OUTCOMES.map((o) => [o, 0]))
  for (const row of rows) {
    const outcome = row.afterTakeOutcome ?? ''
    if (outcome !== '') counts.set(outcome, (counts.get(outcome) ?? 0) + 1)
  }
  return [...counts].map(([outcome, count]) => ({ outcome, count }))
}

/** The rows whose outcome is picked; none picked lists none. */
export function withOutcomes<R extends Pick<DispatchScorecardDrillRow, 'afterTakeOutcome'>>(rows: readonly R[], outcomes: readonly string[]): R[] {
  const picked = new Set(outcomes)
  return rows.filter((r) => picked.has(r.afterTakeOutcome ?? ''))
}

export const CLOSES_TABS = ['closes', 'refused'] as const
export type ClosesTab = (typeof CLOSES_TABS)[number]

/**
 * The report's whole query, as its URL holds it: the scorecard's range and filters (`./range`), the tab,
 * and the picked outcomes (`outcome=A,B`; absent = the two failed-take kinds, `outcome=` = none picked).
 */
export type ClosesFilters = Omit<ScorecardFilters, 'tab'> & { tab: ClosesTab; outcomes: string[] }

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

/** The report's filters a URL describes. Anything unknown reads as its default; an unknown outcome is kept. */
export function closesFiltersFromParams(params: URLSearchParams): ClosesFilters {
  const { tab: _scorecardTab, ...filters } = filtersFromParams(params)
  const outcome = params.get('outcome')
  return {
    ...filters,
    tab: params.get('tab') === 'refused' ? 'refused' : 'closes',
    outcomes:
      outcome === null
        ? [...FAILED_TAKE_OUTCOMES]
        : outcome
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
  }
}

/** The report's filters as its URL: `tab` (Refused only), each non-blank filter, then `outcome` unless the default. */
export function closesFiltersToParams(filters: ClosesFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'closes') qs.set('tab', filters.tab)
  for (const [key, value] of filtersToParams({ ...filters, tab: 'stores' })) qs.set(key, value)
  if (!sameSet(filters.outcomes, FAILED_TAKE_OUTCOMES)) qs.set('outcome', filters.outcomes.join(','))
  return qs
}
