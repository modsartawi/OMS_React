/**
 * A line planned on a short stock figure (ticket 965, BackOffice spec 4354 §6, story 37; 4281 decision 25, the
 * `FIGURE_SHORT` line mark). The screen says it in a plain sentence with the line's own chance — "About N in 100 such
 * lines are not handed over at this store" — never "out of stock", and shows the mark's figures beside it.
 */
import type { AdviseLineMark, AdvisePlan } from '@/core/models/sourcing-run'

export interface ShortFigure {
  lineNo: number
  store: string
  stockClass: string
  /** The chance as a whole number in 100. */
  inHundred: number
  figures: AdviseLineMark['figures']
  row: number
  factor: number
  cost: number
}

export function shortFigures(plan: AdvisePlan): ShortFigure[] {
  return plan.lineMarks
    .filter((m) => m.code === 'FIGURE_SHORT')
    .map((m) => ({
      lineNo: m.lineNo,
      store: m.store,
      stockClass: m.stockClass,
      inHundred: Math.round(m.chance * 100),
      figures: m.figures,
      row: m.row,
      factor: m.factor,
      cost: m.cost,
    }))
}
