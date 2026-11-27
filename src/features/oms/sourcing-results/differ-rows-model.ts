/**
 * "Where the plans differ" (ticket 971, results ticket decision 3): for one view, a row per class that differs and
 * "same plan" last as the reference, in the order BO 4393 sends them. Beside each, the advisor's plan ESTIMATED
 * (minutes against what happened, both timed by the advisor's rules: a dot for the middle order and a bar for the middle
 * half, on one axis with a zero line) and what happened MEASURED (one endings bar, the customer's own cancellation
 * hatched, shown and not counted).
 *
 * The wire's minus is the advisor's plan EARLIER (`ResultsMath.Estimate`): the axis runs from earlier to later.
 *
 * Pure. "Outside the advisor's rules" and the callout fallback have no estimate, and the row says why: the model never
 * draws one for them even when a reply carries one. Figures are the reply's as sent; positions are geometry only.
 */
import { RESULTS_ENDINGS, type ResultsDifferCode, type ResultsDifferReply, type ResultsDifferRow, type ResultsEnding } from '@/core/models/sourcing-results'
import { classInk, endingInk } from './inks'

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
  ending: ResultsEnding
  count: number
  ink: string
  /** The customer's own cancellation: shown, not counted. */
  hatched: boolean
}

export interface DifferRow {
  cls: ResultsDifferCode
  ink: string
  orders: number
  reference: boolean
  estimate: EstimateCell
  endings: EndingSegment[]
}

export interface DifferTable {
  /** Minutes at each end of the shared axis (earlier at `from`), and where zero stands (percent from its start). */
  axis: { from: number; to: number; zero: number }
  rows: DifferRow[]
}

const STEP = 30
const NO_ESTIMATE: readonly ResultsDifferCode[] = ['OUTSIDE_RULES', 'CALLOUT_FALLBACK']

function axisOf(rows: readonly ResultsDifferRow[]): { from: number; to: number } {
  const ends = rows.flatMap((r) => (r.estimate && !NO_ESTIMATE.includes(r.code) ? [r.estimate.low, r.estimate.high] : []))
  const from = Math.floor(Math.min(0, ...ends) / STEP) * STEP
  const to = Math.ceil(Math.max(0, ...ends) / STEP) * STEP
  return { from: from === 0 ? -STEP : from, to: to === 0 ? STEP : to }
}

function endingsOf(row: ResultsDifferRow): EndingSegment[] {
  const sent = new Map(row.endings.map((e) => [e.code, e.orders]))
  return RESULTS_ENDINGS.map((ending) => ({
    ending,
    count: sent.get(ending) ?? 0,
    ink: endingInk(ending),
    hatched: ending === 'CUSTOMER_CANCELLED',
  }))
}

export function differRows(reply: ResultsDifferReply): DifferTable {
  const differing = reply.rows.filter((r) => r.code !== 'SAME_PLAN' && r.orders > 0)
  const same = reply.rows.find((r) => r.code === 'SAME_PLAN')
  const { from, to } = axisOf(differing)
  const at = (minutes: number) => ((minutes - from) / (to - from)) * 100

  const estimateOf = (r: ResultsDifferRow): EstimateCell => {
    if (r.code === 'OUTSIDE_RULES') return { kind: 'none', why: 'rules' }
    if (r.code === 'CALLOUT_FALLBACK') return { kind: 'none', why: 'fallback' }
    if (!r.estimate) return { kind: 'none', why: 'missing' }
    const { middle, low, high } = r.estimate
    const way = middle < 0 ? 'earlier' : middle > 0 ? 'later' : 'same'
    return { kind: 'estimate', middle, low, high, says: { way, minutes: Math.abs(middle) }, at: { middle: at(middle), start: at(low), width: at(high) - at(low) } }
  }

  const rowOf = (r: ResultsDifferRow, reference: boolean): DifferRow => ({
    cls: r.code,
    ink: classInk(r.code),
    orders: r.orders,
    reference,
    estimate: reference ? { kind: 'reference' } : estimateOf(r),
    endings: endingsOf(r),
  })

  return {
    axis: { from, to, zero: at(0) },
    rows: [...differing.map((r) => rowOf(r, false)), ...(same ? [rowOf(same, true)] : [])],
  }
}
