/**
 * The per-store table's rows (ticket 487, brief 2641). Pure, pinned by `store-rows.test.ts`.
 *
 * 🚩 **A row is what the door sent for that store, flattened.** No figure is derived (Handed over
 * is the server's, never Delivered + Picked up) and the rows are never summed into the bands: the
 * totals are the door's own. A figure the server leaves out, or a `null` average, becomes `null`
 * here — never 0 — so the grid shows the dash and sorts it last.
 */
import type { DeliveryStatisticsStore } from '@/core/models/delivery-statistics'
import { hasFigure } from './figures'

/**
 * The flow figures captioned under the flow band (`flow.*`), in order; Trips is not one — it has its own caption.
 * As on the till: the stages end at Handed over, and Delivered (DeliveryType D) and Picked up (P) follow it as
 * its two halves, never as a stage after Out for delivery.
 */
export const FLOW_FIGURES = ['cameIn', 'madeReady', 'outForDelivery', 'handedOver', 'delivered', 'pickedUp'] as const

/** The table's figure columns, in order: the flow with Trips beside Out for delivery and Handed over before its two halves, the misses, Avg hand-over. */
export const STORE_FIGURES = [
  'cameIn',
  'madeReady',
  'outForDelivery',
  'trips',
  'handedOver',
  'delivered',
  'pickedUp',
  'returnedBack',
  'rejected',
  'rescheduled',
  'closeRequested',
  'closedOrCancelled',
  'avgHandOverMinutes',
] as const

export type StoreFigure = (typeof STORE_FIGURES)[number]

/** One store's row: its code and every figure, `null` where the server sent none. */
export type StoreRow = { storeCode: string } & Record<StoreFigure, number | null>

const figure = (value: unknown): number | null => (hasFigure(value) ? value : null)

/** `Stores[]` → the table's rows, in the server's order, one per store. */
export function storeRows(stores: readonly DeliveryStatisticsStore[] | undefined): StoreRow[] {
  return (stores ?? []).map((s) => {
    const flow = s.flow ?? {}
    const misses = s.misses ?? {}
    return {
      storeCode: s.storeCode,
      cameIn: figure(flow.cameIn),
      madeReady: figure(flow.madeReady),
      outForDelivery: figure(flow.outForDelivery),
      trips: figure(flow.trips),
      delivered: figure(flow.delivered),
      pickedUp: figure(flow.pickedUp),
      handedOver: figure(flow.handedOver),
      returnedBack: figure(misses.returnedBack),
      rejected: figure(misses.rejected),
      rescheduled: figure(misses.rescheduled),
      closeRequested: figure(misses.closeRequested),
      closedOrCancelled: figure(misses.closedOrCancelled),
      avgHandOverMinutes: figure(s.avgHandOverMinutes),
    }
  })
}

/**
 * A figure column's comparator, numeric, with an absent figure LAST in both directions.
 *
 * AG Grid negates the comparator's answer for a descending sort, so a `null` has to answer by
 * direction: after every number ascending, and "before" (negated: after) descending.
 */
export function compareFigures(a: number | null, b: number | null, isDescending: boolean): number {
  if (a === null || b === null) {
    if (a === b) return 0
    const absentLast = a === null ? 1 : -1
    return isDescending ? -absentLast : absentLast
  }
  return a - b
}
