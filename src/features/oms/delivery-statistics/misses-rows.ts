/**
 * The page's two "Did not go to plan" rows, one per track (ticket 490, BackOffice brief 2660, spec
 * 2657). Pure, pinned by `misses-rows.test.ts`.
 *
 * As on the till's Statistics tabs, so a closed pick-up is never read as a failed delivery: the
 * Delivery row shows all five misses, always. The Pick-up row always shows Close requested and
 * Closed / cancelled; Returned back, Rejected and Rescheduled are bad data on a pick-up (it is not
 * driven), so they are hidden at 0 and when the server did not send them, and shown when not zero so
 * the bad data stays visible.
 *
 * 🚩 **Every figure is the server's `tracks.*.misses`, read as sent.** The store-wide `misses` is not
 * drawn here (it stays on the wire for the table's All view), and the rows are not expected to add up
 * to it: a miss on an Unspecified delivery is in the store-wide figure only (owner's call on 2659).
 * A server older than 2659 sends no per-track `misses`: every shown figure reads the dash, never 0.
 */
import type { DeliveryStatisticsMisses, DeliveryStatisticsTracks } from '@/core/models/delivery-statistics'
import { hasFigure, readFigure } from './figures'
import type { LaneTrack } from './lanes'

export type MissId = keyof DeliveryStatisticsMisses

/** The five misses, in the till's order. */
export const MISSES: readonly MissId[] = ['returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled']

/** The misses a pick-up cannot have (it is never driven): shown on the Pick-up row only when not zero. */
export const NOT_ON_A_PICK_UP: ReadonlySet<MissId> = new Set<MissId>(['returnedBack', 'rejected', 'rescheduled'])

export interface MissFigure {
  id: MissId
  /** The figure as it reads, or the dash. */
  value: string
}

export interface MissesRow {
  track: LaneTrack
  misses: MissFigure[]
}

/** `tracks` → the two misses rows, Delivery then Pick-up, each figure read or dashed. */
export function readMissesRows(tracks: DeliveryStatisticsTracks | null | undefined, dash: string): MissesRow[] {
  // Read defensively, as the lanes are: a partial answer draws dashes, not a crash.
  const delivery = tracks?.delivery?.misses
  const pickUp = tracks?.pickUp?.misses
  return [
    { track: 'delivery', misses: MISSES.map((id) => ({ id, value: readFigure(delivery?.[id], dash) })) },
    {
      track: 'pickUp',
      misses: MISSES.filter((id) => !NOT_ON_A_PICK_UP.has(id) || isNotZero(pickUp?.[id])).map((id) => ({
        id,
        value: readFigure(pickUp?.[id], dash),
      })),
    },
  ]
}

/** A sent figure other than 0 — the till's hide-when-zero, which also hides a figure not sent. */
const isNotZero = (value: unknown): boolean => hasFigure(value) && value !== 0
