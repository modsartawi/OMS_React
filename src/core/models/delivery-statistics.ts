// Wire shape for GET SdDocumentWeb/StoreStatistics (BackOffice 2641, ADR 0081; brief 2641).
// 🚩 The door is NOT built yet: this is the brief's agreed shape, field for field, in the
// camelCase every other `SdDocumentWeb/*` door emits. Ticket 488 confirms it against the live door.
//
// The COUNTING RULES are the server's (each delivery once, on its first event; deliveries only).
// The client reads these figures and never derives one: Handed over is not Delivered + Picked up
// here, the totals are not a sum of `stores`, and an average is never averaged again.
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
}

export interface DeliveryStatistics {
  /** When the server's numbers were last brought up to date (at most 5 minutes behind). */
  asOf: string | null
  flow: DeliveryStatisticsFlow
  misses: DeliveryStatisticsMisses
  /** Minutes from creation to hand-over; `null` when nothing was handed over. */
  avgHandOverMinutes: number | null
  series: DeliveryStatisticsBucket[]
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
