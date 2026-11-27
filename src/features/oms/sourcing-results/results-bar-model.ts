/**
 * The top of the results page (ticket 971, spec 4354 §17, results ticket decision 1): one sentence and one bar, a
 * bracket above for "the stores only: same stores" and one under for "the whole plan: same plan", so the two figures
 * are two readings of one bar. BO 4393 sends seven segments, "breaks the nesting" (whole plan the same, stores only not)
 * first, and names the segments each bracket spans.
 *
 * Pure. Every count and share is the reply's as sent: the model never recomputes a share, it only checks that the parts
 * add up to the whole the server sent (`addsUp`, `bracketsMatch`), which the page says when they do not.
 */
import { RESULTS_SEGMENTS, type ResultsBracket, type ResultsSegment, type ResultsTopReply } from '@/core/models/sourcing-results'
import { segmentInk } from './inks'

export interface BarSegment {
  segment: ResultsSegment
  count: number
  percent: number
  /** The `--results-*` token the segment is drawn in; colours rank nothing. */
  ink: string
  /** The callout fallback is counted apart: routing chose nothing. */
  hatched: boolean
}

/** A bracket over the drawn segments: its first column (1-based), how many it spans, and the figure as sent. */
export interface BarBracket {
  start: number
  columns: number
  orders: number
  percent: number
}

export interface ResultsBar {
  sentence: { orders: number; storesPercent: number; planPercent: number }
  /** Only the segments with orders, in the bar's order. */
  segments: BarSegment[]
  /** Null where none of the bracket's segments is drawn. */
  brackets: { stores: BarBracket | null; plan: BarBracket | null }
  addsUp: boolean
  bracketsMatch: boolean
  empty: boolean
}

export function resultsBar(top: ResultsTopReply): ResultsBar {
  const sent = new Map(top.segments.map((s) => [s.code, s]))
  const segments: BarSegment[] = RESULTS_SEGMENTS.flatMap((segment) => {
    const s = sent.get(segment)
    if (!s || !(s.orders > 0)) return []
    return [{ segment, count: s.orders, percent: s.percent, ink: segmentInk(segment), hatched: segment === 'CALLOUT_FALLBACK' }]
  })

  const bracket = (b: ResultsBracket): BarBracket | null => {
    const at = segments.flatMap((s, i) => (b.segments.includes(s.segment) ? [i] : []))
    if (at.length === 0) return null
    return { start: Math.min(...at) + 1, columns: at.length, orders: b.orders, percent: b.percent }
  }
  const matches = (b: ResultsBracket) => b.segments.reduce((n, code) => n + (sent.get(code)?.orders ?? 0), 0) === b.orders
  const sum = top.segments.reduce((total, s) => total + (s.orders > 0 ? s.orders : 0), 0)

  return {
    sentence: { orders: top.ordersCompared, storesPercent: top.storesOnly.percent, planPercent: top.wholePlan.percent },
    segments,
    brackets: { stores: bracket(top.storesOnly), plan: bracket(top.wholePlan) },
    addsUp: sum === top.ordersCompared,
    bracketsMatch: matches(top.storesOnly) && matches(top.wholePlan),
    empty: segments.length === 0,
  }
}
