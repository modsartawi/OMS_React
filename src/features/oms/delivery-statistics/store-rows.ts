/**
 * The per-store table's rows (ticket 487, brief 2641), by track (ticket 491, brief 2660). Pure, pinned
 * by `store-rows.test.ts`.
 *
 * 🚩 **A row is what the door sent for that store, flattened.** No figure is derived (Handed over
 * is the server's, never Delivered + Picked up) and the rows are never summed into the bands: the
 * totals are the door's own. A figure the server leaves out, or a `null` average, becomes `null`
 * here — never 0 — so the grid shows the dash and sorts it last.
 *
 * The table shows one of three views (491): **All** reads the store's own `flow`, `misses`,
 * `avgDeliveryMinutes` and `unspecified`; **Delivery** and **Pick-up** read that store's
 * `tracks.delivery` / `tracks.pickUp` as sent. A store row without `tracks` (an SIS.Api older than
 * 2660) reads `null` in every cell of those two views — never 0, never the store-wide figure.
 */
import type { DeliveryStatisticsStore, DeliveryStatisticsTrack, DeliveryTrackAdditions } from '@/core/models/delivery-statistics'
import { hasFigure } from './figures'
import { MISSES, NOT_ON_A_PICK_UP } from './misses-rows'

/**
 * The flow figures captioned under the flow band (`flow.*`), in order; Trips is not one — it has its own caption.
 * As on the till: the stages end at Handed over, and Delivered (DeliveryType D) and Picked up (P) follow it as
 * its two halves, never as a stage after Out for delivery.
 */
export const FLOW_FIGURES = ['cameIn', 'madeReady', 'outForDelivery', 'handedOver', 'delivered', 'pickedUp'] as const

/** The table's three views: every delivery of the store, or one track. */
export const TABLE_TRACKS = ['all', 'delivery', 'pickUp'] as const
export type TableTrack = (typeof TABLE_TRACKS)[number]

/**
 * The misses a pick-up can have, as 490's row reads them: the other three are left out of the Pick-up
 * columns, never hidden per row (a table cannot), and 490's row shows them when not zero.
 */
const PICK_UP_MISSES = MISSES.filter((id) => !NOT_ON_A_PICK_UP.has(id))

/**
 * Each view's figure columns, in order (after Store).
 * - **All:** the flow with Trips beside Out for delivery and Handed over before its two halves, then
 *   Unspecified as the last flow column (decision B), the misses, Avg hand-over.
 * - **Delivery:** the lane's stages with Trips beside Out for delivery, ending at Delivered (the lane's
 *   hand-over), the five misses, Avg time to deliver.
 * - **Pick-up:** the lane's stages ending at Picked up — no Out for delivery, no Trips — then Close
 *   requested, Closed / cancelled, and the lane's Avg delivery time (`tracks.pickUp.avgDeliveryMinutes`,
 *   entry to Made ready) — the field the Pick-up funnel reads, so the two never disagree (spec 811 review).
 */
export const TRACK_FIGURES = {
  // 816: All's average is the store-wide Avg delivery time (spec 811), no longer the entry-based Avg hand-over.
  all: ['cameIn', 'madeReady', 'outForDelivery', 'trips', 'handedOver', 'delivered', 'pickedUp', 'unspecified', ...MISSES, 'avgDeliveryMinutes'],
  // 816: after Delivered, the slot keeping (shares 0–1 as sent, No slot a count) and Delivered per trip; the
  // lane's average is its Avg delivery time.
  delivery: [
    'cameIn',
    'madeReady',
    'outForDelivery',
    'trips',
    'delivered',
    'inSlotShare',
    'outOfSlotShare',
    'noSlot',
    'deliveredPerTrip',
    ...MISSES,
    'avgDeliveryMinutes',
  ],
  pickUp: ['cameIn', 'madeReady', 'pickedUp', ...PICK_UP_MISSES, 'avgDeliveryMinutes'],
} as const

/** The All view's columns: today's (487), with Unspecified as the last flow column. */
export const STORE_FIGURES = TRACK_FIGURES.all

export type StoreFigure = (typeof TRACK_FIGURES)[TableTrack][number]

/** Each view's hand-over column: its default ranking, descending. */
export const HAND_OVER_FIGURE: Record<TableTrack, StoreFigure> = { all: 'handedOver', delivery: 'delivered', pickUp: 'pickedUp' }

/** One store's row in a view: its code and that view's figures, `null` where the server sent none. */
export type StoreRow = { storeCode: string } & Partial<Record<StoreFigure, number | null>>

const figure = (value: unknown): number | null => (hasFigure(value) ? value : null)

/** Where each figure of a view comes from in one store's answer, read as sent. */
function sourceOf(s: DeliveryStatisticsStore, track: TableTrack): Partial<Record<StoreFigure, unknown>> {
  if (track === 'all') return { ...s.flow, ...s.misses, avgDeliveryMinutes: s.avgDeliveryMinutes, unspecified: s.unspecified }
  // A store without `tracks` (older than 2660), or a 2658 track without misses: read defensively, so each reads null.
  const lane: (DeliveryStatisticsTrack<{ handedOver?: number }> & DeliveryTrackAdditions) | undefined = s.tracks?.[track]
  // The lane's `handedOver` is its own hand-over point: Delivered or Picked up, the view's hand-over column.
  return {
    ...lane?.flow,
    [HAND_OVER_FIGURE[track]]: lane?.flow?.handedOver,
    ...lane?.misses,
    // 816 (spec 811): the Delivery track's slot keeping and Delivered per trip, and either lane's Avg delivery time, as sent.
    inSlotShare: lane?.slot?.inSlotShare,
    outOfSlotShare: lane?.slot?.outOfSlotShare,
    noSlot: lane?.slot?.noSlot,
    deliveredPerTrip: lane?.deliveredPerTrip,
    avgDeliveryMinutes: lane?.avgDeliveryMinutes,
  }
}

/**
 * `Stores[]` → one view's rows, in the server's order, one per store. Each row carries exactly that
 * view's figures (`TRACK_FIGURES[track]`): a lane's `handedOver` lands in Delivered or Picked up, and
 * a figure the view has no column for is not read.
 */
export function storeRows(stores: readonly DeliveryStatisticsStore[] | undefined, track: TableTrack = 'all'): StoreRow[] {
  return (stores ?? []).map((s) => {
    const source = sourceOf(s, track)
    const row: StoreRow = { storeCode: s.storeCode }
    for (const key of TRACK_FIGURES[track]) row[key] = figure(source[key])
    return row
  })
}

/**
 * The view the table opens on (816, spec 811): with a courier chosen, Delivery — a courier's figures are
 * home deliveries only, and the slot columns are where its problem stores show; with all couriers
 * (`''`), All, as today.
 */
export function defaultTableTrack(courier: string): TableTrack {
  return courier !== '' ? 'delivery' : 'all'
}

/** A view's opening ranking. Descending, an absent figure last either way (the grid's `compareFigures`). */
export interface TableSort {
  figure: StoreFigure
  direction: 'desc'
}

/**
 * A view's opening sort (816): under a chosen courier the Delivery view ranks by Out of slot %, worst
 * first; every other view, and every view with all couriers, by its hand-over column (today's).
 */
export function defaultSort(track: TableTrack, courier: string): TableSort {
  return { figure: courier !== '' && track === 'delivery' ? 'outOfSlotShare' : HAND_OVER_FIGURE[track], direction: 'desc' }
}

/**
 * The columns drawn as in-cell bars (816): Out of slot %, Delivered per trip and Avg delivery time. A bar
 * makes the outliers stand out and says nothing of good or bad (low per-trip and high out-of-slot are
 * both the bad end), so it is drawn in ink, never a status colour.
 */
export const CELL_BAR_FIGURES = ['outOfSlotShare', 'deliveredPerTrip', 'avgDeliveryMinutes'] as const
export type CellBarFigure = (typeof CELL_BAR_FIGURES)[number]

/**
 * Each bar column's largest value as sent — the bar's reference, so a bar's length is geometry over a
 * server figure, never a figure itself. An absent value adds nothing; a column with none is 0 (no bars).
 */
export function columnMaxima(rows: readonly StoreRow[]): Record<CellBarFigure, number> {
  const maxima = { outOfSlotShare: 0, deliveredPerTrip: 0, avgDeliveryMinutes: 0 }
  for (const row of rows)
    for (const key of CELL_BAR_FIGURES) {
      const value = row[key]
      if (hasFigure(value)) maxima[key] = Math.max(maxima[key], Math.abs(value))
    }
  return maxima
}
