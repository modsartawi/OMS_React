/**
 * The page's two lanes, one per track, Delivery and Pick-up (ticket 489, BackOffice brief 2660, spec 2657).
 * Pure, pinned by `lanes.test.ts`.
 *
 * As on the till's Statistics tabs: the Delivery lane runs Came in → Made ready → Out for delivery
 * (Trips as its sub-caption) → Delivered; the Pick-up lane runs Came in → Made ready → Picked up, and
 * has NO Out for delivery stage — a pick-up never goes out. Each lane then carries its own average,
 * which the page draws after the stages, not as one more stage.
 *
 * 🚩 **Every lane figure is the server's `tracks`, read as sent.** Nothing here is derived: a lane is
 * never a total minus the other lane, the two lanes are never added into a total, and an average is
 * never averaged again. The tracks are not expected to add up to the store-wide figures (a stray
 * out-for-delivery on a pick-up is in the store-wide figure only, by decision). A server older than
 * 2658 sends no `tracks`: both lanes are still drawn, every figure reading the dash, never 0.
 */
import type { DeliveryStatisticsTracks } from '@/core/models/delivery-statistics'
import { hasFigure, readAverage, readFigure } from './figures'

/** A track, as the page draws its lane: Delivery, then Pick-up. */
export type LaneTrack = 'delivery' | 'pickUp'

/** A stage's caption key under `flow.*`: each lane's last stage is named for its own hand-over. */
export type LaneStageId = 'cameIn' | 'madeReady' | 'outForDelivery' | 'delivered' | 'pickedUp'

export interface LaneStage {
  id: LaneStageId
  /** The figure as it reads, or the dash. */
  value: string
  /** Out for delivery's sub-caption figure (the Delivery lane only); absent on every other stage. */
  trips?: string
}

export interface LaneAverage {
  /** The minutes as they read, or the dash. */
  value: string
  /** Whether a unit sits beside it: a unit beside the dash would read as a value. */
  hasUnit: boolean
}

export interface Lane {
  track: LaneTrack
  stages: LaneStage[]
  average: LaneAverage
}

const average = (minutes: number | null | undefined, dash: string): LaneAverage => ({
  value: readAverage(minutes, dash),
  hasUnit: hasFigure(minutes),
})

/** `tracks` → the two lanes, Delivery then Pick-up, each figure read or dashed. */
export function readLanes(tracks: DeliveryStatisticsTracks | null | undefined, dash: string): Lane[] {
  // Read defensively, as the store rows are: a partial answer draws dashes, not a crash.
  const delivery = tracks?.delivery
  const pickUp = tracks?.pickUp
  const d = delivery?.flow
  const p = pickUp?.flow
  return [
    {
      track: 'delivery',
      stages: [
        { id: 'cameIn', value: readFigure(d?.cameIn, dash) },
        { id: 'madeReady', value: readFigure(d?.madeReady, dash) },
        { id: 'outForDelivery', value: readFigure(d?.outForDelivery, dash), trips: readFigure(d?.trips, dash) },
        { id: 'delivered', value: readFigure(d?.handedOver, dash) },
      ],
      average: average(delivery?.avgHandOverMinutes, dash),
    },
    {
      track: 'pickUp',
      stages: [
        { id: 'cameIn', value: readFigure(p?.cameIn, dash) },
        { id: 'madeReady', value: readFigure(p?.madeReady, dash) },
        { id: 'pickedUp', value: readFigure(p?.handedOver, dash) },
      ],
      average: average(pickUp?.avgHandOverMinutes, dash),
    },
  ]
}

/**
 * Whether the Unspecified tile shows: only for a number above zero. Hidden at 0 (a normal day) and
 * when the server did not send it (an older server), as on the till's rail.
 */
export function showsUnspecified(value: unknown): value is number {
  return hasFigure(value) && value > 0
}
