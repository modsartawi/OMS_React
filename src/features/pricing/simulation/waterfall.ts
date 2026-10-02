import type { SimulationResultCondition, SimulationResultItem } from '@/core/models/simulation'
import { conditionBadge } from './aggregate'

/* PROTOTYPE 372 — throwaway (branch prototype/372-sim-waterfall).
 *
 * A result line's price as a WATERFALL, derived from the line's raw `conditions` —
 * the rows every run already returns (`includeConditions` is always on). The elements
 * trace is NOT needed: on all nine 098 captures the conditions alone foot exactly,
 * `Σ before-net = netValue` and `Σ after-net = taxValue`.
 *
 * The one judgement in here is WHERE NET FALLS. It is not read off a type code
 * (`MWST`), it is read off the engine's own arithmetic: the split is the smallest
 * index k such that the rows before it foot to `netValue`, the rows from it foot to
 * `taxValue`, and none of the rows from it is a promotion or a hand-entered
 * condition. A line where no such k exists does not foot, and says so with a `gap`
 * step rather than drawing a waterfall that lies.
 */

export type WfKind =
  /** The first price row — drawn from zero. */
  | 'base'
  /** Any other price-building row before net (a surcharge, a header condition). */
  | 'price'
  /** A promotion (`P`/`B`) that moved the price. */
  | 'promo'
  /** A promotion row that moved NOTHING on this line — a buy line's prerequisite. */
  | 'buy'
  /** A hand-entered (`M`) condition. */
  | 'manual'
  /** The net subtotal — derived, drawn from zero. Only when something sat between
   *  base and net; on a plain line it would repeat the base. */
  | 'net'
  /** A row after net — tax. */
  | 'tax'
  /** The line's net total, the wire's own figure, drawn from zero. */
  | 'total'
  /** The conditions do not foot to the wire's net: the difference, named. */
  | 'gap'
  /** A statistical row — listed, never drawn: it moves no price. */
  | 'stat'

export interface WfStep {
  kind: WfKind
  /** SAP condition type, or '' for a derived step. */
  code: string
  /** Server description (data), or '' for a derived step — the renderer labels those. */
  description: string
  /** Raw rows folded into this step (consecutive, same type/rate/unit/origin/bby). */
  count: number
  rate: number | null
  rateUnit: string
  /** Σ of the folded rows' condition base — the "of what" for a rate. */
  base: number | null
  /** The running figure before and after this step. For a from-zero step, from = 0. */
  from: number
  to: number
  /** The signed amount the step moved (to − from for a delta, the figure for a from-zero step). */
  amount: number
  bby: string | null
  /** The buy↔get join — lets a buy row name the line its discount lands on. */
  conditionKey: string | null
}

export interface LineWaterfall {
  steps: WfStep[]
  /** The largest figure any bar reaches — the line's own scale. */
  peak: number
  /** The conditions foot to the wire's net and tax. */
  foots: boolean
}

const EPS = 0.005
const same = (a: number, b: number) => Math.abs(a - b) < EPS
const sum = (rows: SimulationResultCondition[]) => rows.reduce((s, r) => s + r.conditionValue, 0)

function isPromoOrManual(c: SimulationResultCondition) {
  const b = conditionBadge(c.conditionOrigin)
  return b === 'promotion' || b === 'manual' || c.isBonusBuy
}

/** Consecutive rows that are the same rule applied N times fold into one step (×N). */
function fold(rows: SimulationResultCondition[]): SimulationResultCondition[][] {
  const groups: SimulationResultCondition[][] = []
  for (const r of rows) {
    const g = groups[groups.length - 1]
    const h = g?.[0]
    if (
      h &&
      h.conditionType === r.conditionType &&
      h.conditionRate === r.conditionRate &&
      h.conditionRateUnit === r.conditionRateUnit &&
      h.conditionOrigin === r.conditionOrigin &&
      (h.bbyNumber ?? '') === (r.bbyNumber ?? '') &&
      // a zero row never folds with a moving one — a buy line is not a get line
      same(h.conditionValue, 0) === same(r.conditionValue, 0)
    )
      g.push(r)
    else groups.push([r])
  }
  return groups
}

function kindOf(head: SimulationResultCondition, value: number, first: boolean): WfKind {
  const badge = conditionBadge(head.conditionOrigin)
  if (badge === 'manual') return 'manual'
  if (badge === 'promotion' || head.isBonusBuy) return same(value, 0) ? 'buy' : 'promo'
  return first ? 'base' : 'price'
}

function stepOf(group: SimulationResultCondition[], kind: WfKind, from: number): WfStep {
  const h = group[0]
  const value = sum(group)
  const fromZero = kind === 'base'
  return {
    kind,
    code: h.conditionType,
    description: h.description,
    count: group.length,
    rate: h.conditionRate,
    rateUnit: h.conditionRateUnit ?? '',
    base: group.reduce((s, r) => s + r.conditionBaseValue, 0),
    from: fromZero ? 0 : from,
    to: fromZero ? value : from + value,
    amount: value,
    bby: h.bbyNumber ?? null,
    conditionKey: h.conditionKey ?? null,
  }
}

function derived(kind: WfKind, from: number, to: number): WfStep {
  return { kind, code: '', description: '', count: 1, rate: null, rateUnit: '', base: null, from, to, amount: to - from, bby: null, conditionKey: null }
}

/** `null` for a line that did not price — it has no arithmetic to draw. */
export function lineWaterfall(item: SimulationResultItem): LineWaterfall | null {
  const status = (item.pricingStatus ?? '').trim()
  if (status === 'E' || status === 'W') return null

  const live = item.conditions.filter((c) => !c.isStatistics)
  const stats = item.conditions.filter((c) => c.isStatistics)

  // Where net falls — the smallest k that foots both halves with no promotion after it.
  let k = -1
  for (let i = 0; i <= live.length; i++) {
    const pre = live.slice(0, i)
    const post = live.slice(i)
    if (same(sum(pre), item.netValue) && same(sum(post), item.taxValue) && !post.some(isPromoOrManual)) {
      k = i
      break
    }
  }
  const foots = k !== -1
  // Not footing: fall back to "the trailing run of non-promotion rows is after net",
  // and let the `gap` step carry the difference out loud.
  if (!foots) {
    k = live.length
    while (k > 1 && !isPromoOrManual(live[k - 1])) k--
  }
  const preRows = live.slice(0, k)
  const postRows = live.slice(k)

  const steps: WfStep[] = []
  let run = 0
  fold(preRows).forEach((g, i) => {
    const s = stepOf(g, kindOf(g[0], sum(g), i === 0), run)
    steps.push(s)
    run = s.to
  })
  if (!same(run, item.netValue)) {
    steps.push(derived('gap', run, item.netValue))
    run = item.netValue
  }
  // Net is only worth a bar when something sat between the base and it.
  if (steps.some((s) => s.kind !== 'base' && !same(s.amount, 0))) steps.push(derived('net', 0, item.netValue))
  run = item.netValue
  for (const g of fold(postRows)) {
    const s = stepOf(g, 'tax', run)
    steps.push(s)
    run = s.to
  }
  steps.push(derived('total', 0, item.netTotal))
  for (const g of fold(stats)) steps.push({ ...stepOf(g, 'stat', 0), from: 0, to: 0 })

  const peak = Math.max(0, ...steps.filter((s) => s.kind !== 'stat').flatMap((s) => [s.from, s.to]))
  return { steps, peak, foots }
}

/** A "nice" axis step for a peak, aiming at 4–6 ticks. */
export function tickStep(peak: number): number {
  if (peak <= 0) return 1
  const raw = peak / 5
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return nice * mag
}
