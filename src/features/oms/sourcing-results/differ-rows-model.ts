/**
 * "Where the plans differ" (ticket 971, results ticket decision 3): for one view, a row per class that differs and
 * "same plan" last as the reference. Beside each, the advisor's plan ESTIMATED (minutes against what happened, both
 * timed by the advisor's rules: a dot for the middle order and a bar for the middle half, on one axis with a zero line)
 * and what happened MEASURED (one endings bar, the customer's own cancellation hatched, shown and not counted).
 *
 * Pure. "Outside the advisor's rules" and the callout fallback have no estimate, and the row says why: the model never
 * draws one for them even when a reply carries one. The figures are the reply's as sent; positions are geometry only.
 */
import type { ResultsClass, ResultsDifferRow, ResultsEnding, ResultsView } from '@/core/models/sourcing-results'
import { classInk, endingInk } from './inks'

/** The order the classes that differ are listed in; "same plan" follows as the reference. */
const DIFFERING: readonly ResultsClass[] = [
  'ANOTHER_STORE',
  'ANOTHER_MODE',
  'FEWER_SHIPMENTS',
  'MORE_SHIPMENTS',
  'CALLOUT_FALLBACK',
  'OUTSIDE_RULES',
]

export type EstimateCell =
  | {
      kind: 'estimate'
      middle: number
      low: number
      high: number
      /** The short sentence under it: "arrives N min earlier" / "later" / "at the same time". */
      says: { way: 'earlier' | 'later' | 'same'; minutes: number }
      /** Positions on the view's axis, percent of its width from its start. */
      at: { middle: number; start: number; width: number }
    }
  | { kind: 'none'; why: 'rules' | 'fallback' | 'missing' }
  | { kind: 'reference' }

export interface EndingSegment {
  ending: Exclude<ResultsEnding, 'NOT_ENDED'>
  percent: number
  ink: string
  /** The customer's own cancellation: shown, not counted. */
  hatched: boolean
}

export interface DifferRow {
  cls: ResultsClass
  ink: string
  orders: number
  percent: number
  reference: boolean
  estimate: EstimateCell
  endings: EndingSegment[]
}

export interface DifferTable {
  /** Minutes at each end of the shared axis, and where zero stands (percent from its start). */
  axis: { from: number; to: number; zero: number }
  rows: DifferRow[]
}

const STEP = 30

function axisOf(rows: readonly ResultsDifferRow[]): { from: number; to: number } {
  const ends = rows.flatMap((r) => (r.estimate && r.cls !== 'OUTSIDE_RULES' && r.cls !== 'CALLOUT_FALLBACK' ? [r.estimate.low, r.estimate.high] : []))
  const from = Math.floor(Math.min(0, ...ends) / STEP) * STEP
  const to = Math.ceil(Math.max(0, ...ends) / STEP) * STEP
  // A view with nothing estimated still gets an axis, one step either side of zero.
  return from === to ? { from: -STEP, to: STEP } : { from: from === 0 ? -STEP : from, to: to === 0 ? STEP : to }
}

function endingsOf(row: ResultsDifferRow): EndingSegment[] {
  const e = row.endings
  const parts: [EndingSegment['ending'], number][] = [
    ['ON_TIME', e.onTime],
    ['LATE', e.late],
    ['RETURNED', e.returned],
    ['CANCELLED', e.cancelled],
    ['CUSTOMER_CANCELLED', e.customerCancelled],
  ]
  return parts.map(([ending, percent]) => ({ ending, percent, ink: endingInk(ending), hatched: ending === 'CUSTOMER_CANCELLED' }))
}

export function differRows(all: readonly ResultsDifferRow[], view: ResultsView): DifferTable {
  const inView = all.filter((r) => r.view === view)
  const differing = DIFFERING.flatMap((cls) => inView.filter((r) => r.cls === cls && r.orders > 0))
  const same = inView.find((r) => r.cls === 'SAME_PLAN')
  const { from, to } = axisOf(differing)
  const at = (minutes: number) => ((minutes - from) / (to - from)) * 100

  const estimateOf = (r: ResultsDifferRow): EstimateCell => {
    if (r.cls === 'OUTSIDE_RULES') return { kind: 'none', why: 'rules' }
    if (r.cls === 'CALLOUT_FALLBACK') return { kind: 'none', why: 'fallback' }
    if (!r.estimate) return { kind: 'none', why: 'missing' }
    const { middle, low, high } = r.estimate
    const way = middle > 0 ? 'earlier' : middle < 0 ? 'later' : 'same'
    return { kind: 'estimate', middle, low, high, says: { way, minutes: Math.abs(middle) }, at: { middle: at(middle), start: at(low), width: at(high) - at(low) } }
  }

  const rowOf = (r: ResultsDifferRow, reference: boolean): DifferRow => ({
    cls: r.cls,
    ink: classInk(r.cls),
    orders: r.orders,
    percent: r.percent,
    reference,
    estimate: reference ? { kind: 'reference' } : estimateOf(r),
    endings: endingsOf(r),
  })

  return {
    axis: { from, to, zero: at(0) },
    rows: [...differing.map((r) => rowOf(r, false)), ...(same ? [rowOf(same, true)] : [])],
  }
}
