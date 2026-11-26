/**
 * The top of the results page (ticket 971, spec 4354 §17, results ticket decision 1): one sentence and one bar of six
 * segments, a bracket above the first two ("the stores only: same stores") and one under the first ("the whole plan:
 * same plan"), so the two figures are two readings of one bar.
 *
 * Pure. Every count and share is the reply's as sent: the model never recomputes a share, it only checks that the parts
 * add up to the whole the server sent (`addsUp`, `bracketsMatch`), which the page says when they do not.
 */
import type { ResultsSegment, ResultsTop } from '@/core/models/sourcing-results'
import { segmentInk } from './inks'

/** The spec's order (§17); the orders that break the nesting, when there are any, come last. */
export const SEGMENT_ORDER: readonly ResultsSegment[] = [
  'SAME_PLAN',
  'SAME_STORES_OTHER_WAY',
  'ANOTHER_STORE',
  'CALLOUT_FALLBACK',
  'OUTSIDE_RULES',
  'NOT_COMPARABLE',
  'BREAKS_NESTING',
]

export interface BarSegment {
  segment: ResultsSegment
  count: number
  percent: number
  /** The `--results-*` token the segment is drawn in; colours rank nothing. */
  ink: string
  /** The callout fallback is counted apart: routing chose nothing. */
  hatched: boolean
}

export interface ResultsBar {
  sentence: { orders: number; storesPercent: number; planPercent: number }
  /** Only the segments with orders, in the spec's order. */
  segments: BarSegment[]
  /** How many leading drawn segments each bracket spans, and the share it reads. */
  brackets: { stores: { columns: number; percent: number }; plan: { columns: number; percent: number } }
  addsUp: boolean
  bracketsMatch: boolean
  empty: boolean
}

export function resultsBar(top: ResultsTop): ResultsBar {
  const sent = new Map(top.segments.map((s) => [s.segment, s]))
  const segments: BarSegment[] = SEGMENT_ORDER.flatMap((segment) => {
    const s = sent.get(segment)
    if (!s || !(s.count > 0)) return []
    return [{ segment, count: s.count, percent: s.percent, ink: segmentInk(segment), hatched: segment === 'CALLOUT_FALLBACK' }]
  })
  const countOf = (segment: ResultsSegment) => sent.get(segment)?.count ?? 0
  const sum = top.segments.reduce((total, s) => total + (s.count > 0 ? s.count : 0), 0)
  const storesColumns = segments.filter((s) => s.segment === 'SAME_PLAN' || s.segment === 'SAME_STORES_OTHER_WAY').length
  const planColumns = segments.some((s) => s.segment === 'SAME_PLAN') ? 1 : 0
  return {
    sentence: { orders: top.ordersCompared, storesPercent: top.sameStores.percent, planPercent: top.samePlan.percent },
    segments,
    brackets: {
      stores: { columns: storesColumns, percent: top.sameStores.percent },
      plan: { columns: planColumns, percent: top.samePlan.percent },
    },
    addsUp: sum === top.ordersCompared,
    bracketsMatch:
      top.samePlan.count === countOf('SAME_PLAN') &&
      top.sameStores.count === countOf('SAME_PLAN') + countOf('SAME_STORES_OTHER_WAY'),
    empty: segments.length === 0,
  }
}
