/**
 * The dispatch scorecard's figure logic (ticket 543; rulings 2948 D4–D7, 2950 point 3). Pure, pinned by
 * `figures.test.ts`.
 *
 * 🚩 Every figure, rank and estate median is the door's: nothing here computes one. What lives here is
 * how the grid reads them — which columns rank (and their better direction), how a ranked column sorts
 * (`compareFigures`, absent last, too-few rows last either way), which figure each link drills, how a
 * figure reads, and where a bid row leads.
 */
import type {
  DispatchScorecardBetter,
  DispatchScorecardCardMeasure,
  DispatchScorecardDrillRow,
  DispatchScorecardFigure,
  DispatchScorecardMeasure,
  DispatchScorecardStaffRow,
  DispatchScorecardStoreRow,
} from '@/core/models/dispatch-scorecard'
import { compareFigures } from '@/core/util/compare-figures'

/** One grid column after the name: its field, whether it ranks (and which way is better), whether it drills. */
export interface ScorecardColumn<F extends string> {
  field: F
  /** One of the ranked measures: sortable, labelled with its better direction. */
  ranked: boolean
  /** Only a ranked column sorts: best and worst are its two directions; a context column never ranks. */
  sortable: boolean
  better?: DispatchScorecardBetter
  /** The figure the cell's link opens in the drill drawer; absent = not a link. */
  drill?: DispatchScorecardFigure
}

type StoreField = keyof DispatchScorecardStoreRow & string
type StaffField = keyof DispatchScorecardStaffRow & string

const ranked = <F extends string>(field: F & DispatchScorecardMeasure, better: DispatchScorecardBetter): ScorecardColumn<F> => ({
  field,
  ranked: true,
  sortable: true,
  better,
  drill: field,
})

const context = <F extends string>(field: F, drill?: DispatchScorecardFigure): ScorecardColumn<F> => ({
  field,
  ranked: false,
  sortable: false,
  ...(drill ? { drill } : {}),
})

/** The Stores tab after Store: the five ranked measures (D4), then the context, never ranked (D5). */
export const STORE_COLUMNS: readonly ScorecardColumn<StoreField>[] = [
  ranked('ignoreRate', 'lower'),
  ranked('medianAnswerSeconds', 'lower'),
  ranked('slowQuarterAnswerSeconds', 'lower'),
  ranked('winRate', 'higher'),
  ranked('declineRate', 'lower'),
  context('bids'),
  context('beaten'),
  // Lost races is the one context figure that drills (2950 point 3); its near misses ride beside it.
  context('lostRaces', 'lostRaces'),
  context('passedShort'),
  context('passedUnknown'),
  context('darkOffers'),
  context('unseen'),
  context('medianKm'),
  context('fallbacksReceived'),
  context('releasedAfterAward'),
]

/**
 * The Staff tab after Staff and Stores (D6): their own Takes and Passes, ranked on the two answer times
 * only. Won, lost races and Passed with stock drill to that person's own bids but never rank.
 */
export const STAFF_COLUMNS: readonly ScorecardColumn<StaffField>[] = [
  context('won', 'won'),
  context('lostRaces', 'lostRaces'),
  context('passedWithStock', 'passedWithStock'),
  { ...ranked('medianAnswerSeconds', 'lower') },
  { ...ranked('slowQuarterAnswerSeconds', 'lower') },
  context('answers'),
]

/** Each ranked store measure's rank field, as the door names it. */
export const STORE_RANK_FIELD: Record<DispatchScorecardMeasure, StoreField> = {
  ignoreRate: 'ignoreRateRank',
  medianAnswerSeconds: 'medianAnswerRank',
  slowQuarterAnswerSeconds: 'slowQuarterAnswerRank',
  winRate: 'winRateRank',
  declineRate: 'declineRateRank',
}

/** The i18n key of a measure's better-direction label. */
export function directionLabelKey(better: DispatchScorecardBetter): string {
  return better === 'higher' ? 'direction.higher' : 'direction.lower'
}

/**
 * A ranked column's comparator: a "too few" row LAST in both directions (D7: it never appears as best
 * or worst), then `compareFigures` — numeric, an absent figure last in both directions.
 *
 * AG Grid negates the answer for a descending sort, so the too-few rule answers by direction, as
 * `compareFigures` does for an absent figure.
 */
export function compareRanked(a: number | null, b: number | null, aTooFew: boolean, bTooFew: boolean, isDescending: boolean): number {
  if (aTooFew !== bTooFew) {
    const fewLast = aTooFew ? 1 : -1
    return isDescending ? -fewLast : fewLast
  }
  return compareFigures(a, b, isDescending)
}

/** The rows in the server's order with the "too few" ones after the rest (the grid's unsorted order). */
export function tooFewLast<T extends { tooFew: boolean }>(rows: readonly T[]): T[] {
  return [...rows.filter((r) => !r.tooFew), ...rows.filter((r) => r.tooFew)]
}

const RATES = new Set<string>(['ignoreRate', 'winRate', 'declineRate'])
const TIMES = new Set<string>(['medianAnswerSeconds', 'slowQuarterAnswerSeconds'])

/** Seconds as `42 s` under a minute, else `m:ss`. */
export function formatSeconds(seconds: number): string {
  const whole = Math.round(seconds)
  if (whole < 60) return `${whole} s`
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** A ranked measure as it reads: a rate (0..1 as sent) as a percent, a time as seconds; absent = the dash. */
export function formatMeasure(measure: string, value: number | null | undefined, dash: string): string {
  if (value == null || !Number.isFinite(value)) return dash
  if (RATES.has(measure)) return `${(value * 100).toFixed(1)}%`
  if (TIMES.has(measure)) return formatSeconds(value)
  return String(value)
}

/** The card's "#n of m": the rank and count exactly as sent, or unranked. */
export function cardRank(m: DispatchScorecardCardMeasure): { ranked: true; rank: string; of: string } | { ranked: false } {
  return m.rank == null ? { ranked: false } : { ranked: true, rank: String(m.rank), of: String(m.of) }
}

/** The card's estate median, as sent, formatted as its measure. */
export function cardMedianText(m: DispatchScorecardCardMeasure, dash: string): string {
  return formatMeasure(m.measure, m.estateMedian, dash)
}

/** Where a drill row leads: the delivery's details (its Activity), or nowhere for any other subject. */
export function drillPath(row: DispatchScorecardDrillRow): string | null {
  const id = row.subjectId?.trim()
  if (row.subjectType !== 'DELIVERY' || !id) return null
  return `/oms/delivery/${encodeURIComponent(id)}`
}
