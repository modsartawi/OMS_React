/**
 * The Later slots tab (ticket 972, results ticket decision 12): one sentence — how many orders with a slot delivery had a
 * later slot the weight set prices lower than the earliest, and their share — and a bar per hour the order came in,
 * labelled "evidence for phase 2". Read, never a limit (spec 4354 §18). BO 4393 sends every hour with both counts.
 *
 * SERVER GAP (spec 4354) — the decision's "middle difference" (how much later the cheaper slot starts) is not on the
 * summary row (BO 4393 build notes), so the sentence says none.
 *
 * Pure. Figures as sent; an hour the reply left out stands at nought.
 */
import type { ResultsLaterSlotsReply } from '@/core/models/sourcing-results'

export interface LaterSlotHour {
  hour: number
  /** `00` to `23`, the bar's label. */
  label: string
  /** Orders of the hour that had a later slot cheaper: the bar. */
  cheaper: number
  /** Orders of the hour with a slot delivery. */
  withSlot: number
}

export interface LaterSlots {
  sentence: { cheaper: number; withSlot: number; percent: number }
  hours: LaterSlotHour[]
  /** The hour with the most orders with a later slot cheaper (the first, on a tie); null when there is none. */
  peak: number | null
  addsUp: boolean
  empty: boolean
}

export function laterSlots(reply: ResultsLaterSlotsReply): LaterSlots {
  const byHour = new Map(reply.byHour.filter((h) => Number.isInteger(h.hour) && h.hour >= 0 && h.hour < 24).map((h) => [h.hour, h]))
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: String(hour).padStart(2, '0'),
    cheaper: byHour.get(hour)?.laterSlotCheaper ?? 0,
    withSlot: byHour.get(hour)?.orders ?? 0,
  }))
  const most = Math.max(...hours.map((h) => h.cheaper))
  return {
    sentence: { cheaper: reply.laterSlotCheaper, withSlot: reply.ordersWithSlot, percent: reply.percent },
    hours,
    peak: most > 0 ? hours.findIndex((h) => h.cheaper === most) : null,
    addsUp: hours.reduce((n, h) => n + h.cheaper, 0) === reply.laterSlotCheaper,
    empty: !(reply.laterSlotCheaper > 0),
  }
}
