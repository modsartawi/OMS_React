// Wire shape for GET SdDocumentWeb/StoreStatistics (BackOffice 2641, ADR 0081; brief 2641).
// 🚩 The door is NOT built yet: this is the brief's agreed shape, field for field, in the
// camelCase every other `SdDocumentWeb/*` door emits. Ticket 488 confirms it against the live door.
//
// The COUNTING RULES are the server's (each delivery once, on its first event; deliveries only).
// The client reads these figures and never derives one: Handed over is not Delivered + Picked up
// here, the totals are not a sum of `stores`, and an average is never averaged again.
//
// Brief 2660 adds the optional `tracks` and `unspecified`, on the totals and on every store row.
//
// Every figure is OPTIONAL on purpose: a server that does not send one (an older SIS.Api without
// `trips`) must render "—", never 0, and an optional type makes the compiler force that choice.

/** The flow band: where the period's deliveries got to. */
export interface DeliveryStatisticsFlow {
  cameIn?: number
  madeReady?: number
  outForDelivery?: number
  /** The one EVENT count: how many times deliveries left the store (a Trip). */
  trips?: number
  delivered?: number
  pickedUp?: number
  handedOver?: number
}

/** The "did not go to plan" band. */
export interface DeliveryStatisticsMisses {
  returnedBack?: number
  rejected?: number
  rescheduled?: number
  closeRequested?: number
  closedOrCancelled?: number
}

/**
 * The Delivery track's flow (BackOffice 2658): home deliveries only. `handedOver` is the lane's own
 * hand-over, Delivered.
 */
export interface DeliveryTrackFlow {
  cameIn?: number
  madeReady?: number
  outForDelivery?: number
  /** The one EVENT count, read against home deliveries only. */
  trips?: number
  handedOver?: number
}

/**
 * The Pick-up track's flow: pick in store only. `handedOver` is Picked up. 🚩 There is NO
 * `outForDelivery`: a pick-up never goes out, and a stray one is counted in the store-wide flow only.
 */
export interface PickUpTrackFlow {
  cameIn?: number
  madeReady?: number
  handedOver?: number
}

/** One track's figures. `misses` is absent from a server older than 2659. */
export interface DeliveryStatisticsTrack<F> {
  // Optional, as every figure is: a partial answer reads "—", never a crash.
  flow?: F
  misses?: DeliveryStatisticsMisses
  /**
   * Minutes from entry to the track's hand-over point — Delivered for a home delivery, Made ready
   * for a pick-up; `null` when there is nothing to average.
   */
  avgHandOverMinutes?: number | null
}

/**
 * The period split by track (BackOffice spec 2657, brief 2660). Absent from a server older than
 * 2658 — every lane figure then reads "—". The tracks are NOT expected to add up to the store-wide
 * figures (a stray out-for-delivery on a pick-up, an Unspecified delivery), and nothing here does.
 */
export interface DeliveryStatisticsTracks {
  delivery: DeliveryStatisticsTrack<DeliveryTrackFlow>
  pickUp: DeliveryStatisticsTrack<PickUpTrackFlow>
}

/** One bucket of the series: an hour of a day, or a day of a range. Every bucket, zeros included. */
export interface DeliveryStatisticsBucket {
  bucket: string
  cameIn: number
  handedOver: number
}

/** One store's own figures, for the per-store table. */
export interface DeliveryStatisticsStore {
  storeCode: string
  flow: DeliveryStatisticsFlow
  misses: DeliveryStatisticsMisses
  /** Minutes from creation to hand-over; `null` when nothing was handed over. */
  avgHandOverMinutes: number | null
  /** That store's split by track; absent from a server older than 2660. */
  tracks?: DeliveryStatisticsTracks
  /** That store's deliveries of neither track that came in. */
  unspecified?: number
}

export interface DeliveryStatistics {
  /** When the server's numbers were last brought up to date (at most 5 minutes behind). */
  asOf: string | null
  flow: DeliveryStatisticsFlow
  misses: DeliveryStatisticsMisses
  /** Minutes from creation to hand-over; `null` when nothing was handed over. */
  avgHandOverMinutes: number | null
  series: DeliveryStatisticsBucket[]
  /** The period split by track; absent from a server older than 2658. */
  tracks?: DeliveryStatisticsTracks
  /** Deliveries of neither track (a blank or unknown DeliveryType) that came in: bad data, in no lane. */
  unspecified?: number
  stores: DeliveryStatisticsStore[]
}

/** The door's `Granularity`: by the hour for one day, by the day for a range. */
export type StatisticsGranularity = 'hour' | 'day'

/**
 * The door's query, named as the door names it. A `type`, not an `interface`, so it passes as
 * `@/core/api`'s params record. `StoreCode` absent = all stores; `LeaveOutTypes` absent = none.
 */
export type StoreStatisticsQuery = {
  StoreCode?: string
  /** Local `yyyy-MM-dd`, inclusive. */
  From: string
  /** Local `yyyy-MM-dd`, inclusive. */
  To: string
  Granularity: StatisticsGranularity
  LeaveOutChurned: boolean
  /** Comma-joined order-type codes. */
  LeaveOutTypes?: string
}
