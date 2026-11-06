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
// Spec 811 (ticket 812) adds slot keeping, Delivered per trip, Avg delivery time and the previous
// block. ⚠ A web proposal, filed as BackOffice spec 3404 (draft; BackOffice owns the final wire): every
// field is optional, so an older server reads "—", and later slices only read them.
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
  /**
   * Spec 811: Avg delivery time. On the Delivery track from DUE (the later of entry and the held slot's
   * start; entry when there is no slot) to Delivered, an early delivery counting 0; on the Pick-up track
   * entry to Made ready, as `avgHandOverMinutes`. `null` when there is nothing to average.
   */
  avgDeliveryMinutes?: number | null
}

/**
 * Spec 811: slot keeping, on the Delivery track. Counts of Delivered, judged against the slot the
 * delivery held when it was delivered; before the slot's end is in slot (early is in slot). The shares
 * are 0–1 out of Delivered, absent when nothing was delivered.
 */
export interface SlotKeeping {
  inSlot?: number
  outOfSlot?: number
  noSlot?: number
  inSlotShare?: number
  outOfSlotShare?: number
}

/** Spec 811: what the Delivery track carries beyond the shared track figures. */
export interface DeliveryTrackAdditions {
  slot?: SlotKeeping
  /** Delivered over Trips, the server's; absent (or `null`) when there were no trips. */
  deliveredPerTrip?: number | null
}

/**
 * The period split by track (BackOffice spec 2657, brief 2660). Absent from a server older than
 * 2658 — every lane figure then reads "—". The tracks are NOT expected to add up to the store-wide
 * figures (a stray out-for-delivery on a pick-up, an Unspecified delivery), and nothing here does.
 */
export interface DeliveryStatisticsTracks {
  delivery: DeliveryStatisticsTrack<DeliveryTrackFlow> & DeliveryTrackAdditions
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
  /**
   * Minutes from entry to each track's own hand-over point — Delivered for a home delivery, Made ready
   * for a pick-up (BackOffice 2659), both tracks together; `null` when there is nothing to average. It
   * is NOT an average over Delivered + Picked up.
   */
  avgHandOverMinutes: number | null
  /** Spec 811: that store's Avg delivery time, both tracks together, each from its own start. */
  avgDeliveryMinutes?: number | null
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
  /**
   * Minutes from entry to each track's own hand-over point — Delivered for a home delivery, Made ready
   * for a pick-up (BackOffice 2659), both tracks together; `null` when there is nothing to average. It
   * is NOT an average over Delivered + Picked up.
   */
  avgHandOverMinutes: number | null
  /** Spec 811: Avg delivery time, both tracks together, each from its own start; `null` = nothing to average. */
  avgDeliveryMinutes?: number | null
  /** Spec 811: the six headline figures in the compared window; absent from an older server. */
  previous?: StatisticsPrevious
  series: DeliveryStatisticsBucket[]
  /** The period split by track; absent from a server older than 2658. */
  tracks?: DeliveryStatisticsTracks
  /** Deliveries of neither track (a blank or unknown DeliveryType) that came in: bad data, in no lane. */
  unspecified?: number
  stores: DeliveryStatisticsStore[]
}

/**
 * Spec 811: one headline figure in the compared window. `value` is the previous period's figure;
 * `change` and `changePct` are the server's own subtraction and percentage (0–1, like a share),
 * `changePct` absent when the previous value is 0. The page never computes either.
 */
export interface PreviousFigure {
  value?: number | null
  change?: number | null
  changePct?: number | null
}

/**
 * Spec 811: the compared window and its six figures. Today → the same weekday last week up to the
 * same time (`until`); Yesterday → the same weekday a week before; Range → the equal-length range
 * ending the day before `From`.
 */
export interface StatisticsPrevious {
  /** Local `yyyy-MM-dd`, inclusive. */
  from: string
  /** Local `yyyy-MM-dd`, inclusive. */
  to: string
  /** Today's cut-off time of day (`HH:mm`), absent for a closed period. */
  until?: string
  cameIn?: PreviousFigure
  handedOver?: PreviousFigure
  inSlotShare?: PreviousFigure
  outOfSlotShare?: PreviousFigure
  deliveredPerTrip?: PreviousFigure
  avgDeliveryMinutes?: PreviousFigure
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
