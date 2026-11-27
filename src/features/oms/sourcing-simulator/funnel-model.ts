/**
 * The funnel (ticket 966, BackOffice spec 4354 §4; SIMT "a run with a cut says so on the funnel"): every store × mode
 * pair, then each filter step in the run's order with the pairs still standing after it. A step opens to the pairs it
 * removed, each with its code's figures; the screen writes the rule's words. Pure.
 *
 * The figures are the record's: `before` and `after` per step, the cut's `cap`, and `solve.pairs` for the pairs cut and
 * offered. A step's count is `before − after`; the list under it is what the record carries (the middle level lists
 * the nearest five out of reach, the full level every store).
 */
import type { AdviseFilterStep, AdviseRemovedPair, AdviseReply } from '@/core/models/sourcing-run'

export interface FunnelRow {
  /** `ALL` is the top bar: every pair before any step. */
  step: number | 'CUT' | 'ALL'
  code: string | null
  /** The pairs still standing after this step. */
  standing: number
  removedCount: number
  removed: AdviseRemovedPair[]
  /** The bar's length: `standing` as a share of every pair. */
  fraction: number
}

export interface FunnelCut {
  cap: number | null
  /** The pairs the cap cut (`solve.pairs.cut`); 0 when the run had no more pairs than the cap. */
  pairs: number
  code: string
  /** The cut pairs the record lists. */
  listed: AdviseRemovedPair[]
}

export interface Funnel {
  total: number
  rows: FunnelRow[]
  cut: FunnelCut | null
  /** The pairs the solver was offered, as the solve sent it. */
  offered: number
}

const isCut = (s: AdviseFilterStep) => s.step === 'CUT'

/** The funnel of a reply at the middle level or above; `null` when the reply carries no filter steps. */
export function funnelOf(reply: Pick<AdviseReply, 'filterSteps' | 'solve'>): Funnel | null {
  const steps = reply.filterSteps
  if (!steps?.length) return null
  const total = steps[0].before
  const share = (n: number) => (total > 0 ? n / total : 0)
  const rows: FunnelRow[] = [
    { step: 'ALL', code: null, standing: total, removedCount: 0, removed: [], fraction: 1 },
    ...steps.map((s) => ({
      step: s.step,
      code: s.code,
      standing: s.after,
      removedCount: Math.max(0, s.before - s.after),
      removed: s.removed ?? [],
      fraction: share(s.after),
    })),
  ]
  const cutStep = steps.find(isCut)
  const cut: FunnelCut | null = cutStep
    ? { cap: cutStep.cap ?? null, pairs: reply.solve.pairs.cut, code: cutStep.code, listed: cutStep.removed ?? [] }
    : reply.solve.pairs.cut > 0
      ? { cap: null, pairs: reply.solve.pairs.cut, code: 'OVER_PAIR_CAP', listed: [] }
      : null
  return { total, rows, cut, offered: reply.solve.pairs.offered }
}
