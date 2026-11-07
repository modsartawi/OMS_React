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
 *
 * Ticket 814 (spec 811) makes the lanes funnels. Each stage carries a `bar`: its figure over the lane's
 * own Came in. That is GEOMETRY, never a figure — it is drawn as a bar's length and never written. An
 * absent stage, an absent Came in, or a Came in of 0 draws no bar (`null`); a stage past Came in (a
 * hand-over counted on its first event, of a delivery that came in before the period) carries its ratio
 * over 1 — `core/charts/StageBar` clamps it to a full bar, in that one place — while its figure reads as sent. The Delivery lane also carries its slot split, the server's counts
 * labelled with the server's shares; a pick-up has no slot. Each lane's average is its Avg delivery
 * time (`avgDeliveryMinutes`): Delivery from due, Pick-up entry to Made ready.
 */
import type { DeliveryStatisticsTracks, SlotKeeping } from '@/core/models/delivery-statistics'
import { hasFigure, readAverage, readFigure, readShare } from './figures'

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
  /** The bar's length, the lane's Came in being 1 (geometry only; `StageBar` clamps past 1); `null` draws no bar. */
  bar: number | null
}

export type SlotSegmentId = 'inSlot' | 'outOfSlot' | 'noSlot'

export interface SlotSegment {
  id: SlotSegmentId
  /** The server's count, the segment's weight; `null` when absent. */
  count: number | null
  /** The count as it reads, or the dash. */
  value: string
  /** The server's share as it reads; `null` when it sent none (No slot never has one). */
  share: string | null
}

export interface SlotSplit {
  /** Whether the bar is drawn: every count and both shares sent, and something delivered. */
  drawn: boolean
  segments: SlotSegment[]
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
  /** The Delivery lane's slot split; absent on the Pick-up lane, which has no slot. */
  slot?: SlotSplit
}

const average = (minutes: number | null | undefined, dash: string): LaneAverage => ({
  value: readAverage(minutes, dash),
  hasUnit: hasFigure(minutes),
})

/** A stage's bar: its figure over the lane's Came in (clamped by `StageBar`, not here); `null` with either absent or nothing came in. */
const bar = (value: number | undefined, cameIn: number | undefined): number | null =>
  hasFigure(value) && hasFigure(cameIn) && cameIn > 0 ? value / cameIn : null

const stage = (id: LaneStageId, value: number | undefined, cameIn: number | undefined, dash: string): LaneStage => ({
  id,
  value: readFigure(value, dash),
  bar: bar(value, cameIn),
})

const segment = (id: SlotSegmentId, count: number | undefined, share: number | undefined, dash: string): SlotSegment => ({
  id,
  count: hasFigure(count) ? count : null,
  value: readFigure(count, dash),
  share: hasFigure(share) ? readShare(share, dash) : null,
})

/** The slot split, read as sent: drawn only when every count and both shares came and something was delivered. */
function slotSplit(slot: SlotKeeping | undefined, dash: string): SlotSplit {
  const segments = [
    segment('inSlot', slot?.inSlot, slot?.inSlotShare, dash),
    segment('outOfSlot', slot?.outOfSlot, slot?.outOfSlotShare, dash),
    segment('noSlot', slot?.noSlot, undefined, dash),
  ]
  const counts = segments.map((s) => s.count)
  const drawn =
    counts.every((c) => c !== null) &&
    counts.some((c) => (c as number) > 0) &&
    hasFigure(slot?.inSlotShare) &&
    hasFigure(slot?.outOfSlotShare)
  return { drawn, segments }
}

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
        stage('cameIn', d?.cameIn, d?.cameIn, dash),
        stage('madeReady', d?.madeReady, d?.cameIn, dash),
        { ...stage('outForDelivery', d?.outForDelivery, d?.cameIn, dash), trips: readFigure(d?.trips, dash) },
        stage('delivered', d?.handedOver, d?.cameIn, dash),
      ],
      average: average(delivery?.avgDeliveryMinutes, dash),
      slot: slotSplit(delivery?.slot, dash),
    },
    {
      track: 'pickUp',
      stages: [
        stage('cameIn', p?.cameIn, p?.cameIn, dash),
        stage('madeReady', p?.madeReady, p?.cameIn, dash),
        stage('pickedUp', p?.handedOver, p?.cameIn, dash),
      ],
      average: average(pickUp?.avgDeliveryMinutes, dash),
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
