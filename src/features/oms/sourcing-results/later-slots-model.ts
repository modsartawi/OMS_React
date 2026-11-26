/**
 * The Later slots tab (ticket 972, results ticket decision 12): one sentence — how many orders had a later slot the
 * weight set prices lower than the earliest, their share of orders with a slot delivery, the middle difference — and a
 * bar per hour the order came in, labelled "evidence for phase 2". Read, never a limit (spec 4354 §18).
 *
 * Pure. Figures as sent; every hour of the day gets its bar, an hour the reply left out at nought.
 */
import type { ResultsLaterSlotsReply } from '@/core/models/sourcing-results'

export interface LaterSlotHour {
  hour: number
  /** `00` to `23`, the bar's label. */
  label: string
  orders: number
}

export interface LaterSlots {
  sentence: { orders: number; slotOrders: number; percent: number; middleLaterMinutes: number | null }
  hours: LaterSlotHour[]
  /** The hour with the most orders (the first, on a tie); null when there is none. */
  peak: number | null
  addsUp: boolean
  empty: boolean
}

export function laterSlots(reply: ResultsLaterSlotsReply): LaterSlots {
  const byHour = new Map<number, number>()
  for (const h of reply.byHour) if (Number.isInteger(h.hour) && h.hour >= 0 && h.hour < 24) byHour.set(h.hour, h.orders)
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, label: String(hour).padStart(2, '0'), orders: byHour.get(hour) ?? 0 }))
  const most = Math.max(...hours.map((h) => h.orders))
  const sum = hours.reduce((n, h) => n + h.orders, 0)
  return {
    sentence: { orders: reply.orders, slotOrders: reply.slotOrders, percent: reply.percent, middleLaterMinutes: reply.middleLaterMinutes },
    hours,
    peak: most > 0 ? hours.findIndex((h) => h.orders === most) : null,
    addsUp: sum === reply.orders,
    empty: !(reply.orders > 0),
  }
}
