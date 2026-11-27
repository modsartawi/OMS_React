/**
 * The store record's read door (oms-react ticket 969, BackOffice spec 4354 §6 and §14; BackOffice 4373):
 * `GET SourcingAdvisor/StoreRecords?store=&mode=` → `StoreRecordListReply` (`StoreRecordService.cs`). One row per pair —
 * a store with a mode that keeps a record (`DAWAA_NOW`, `SLOT`, `PICK_UP`) — as last night's pass left it, keeping the
 * counts behind every rate. A mode with no record is refused (`STORE-RECORD-400`); the carrier modes and beyond the
 * border are never listed: they sit on the neutral default.
 *
 * Reconciled with BackOffice 4373 / 4385 at pricing2 35a4e56be. The reply goes through `EndpointHelpers.ExecuteAsync`
 * with ASP.NET Core's web defaults, not the run record's options: camelCase, nulls WRITTEN, and every time ISO 8601
 * with a `T` and no zone (`2026-11-27T02:14:09`; a date reads `2026-08-29T00:00:00`). Rates are fractions (0.0377 =
 * 3.77%). `windowTo` is the window's last day, inclusive.
 *
 * SERVER GAP (spec 4354) — the door does not send what ticket 969 lists beside the rates: the store's name, each
 * measure's failure price and its cost or credit, the pair's record cost, the like stores' share of till moves marked
 * "Customer", and what is "shown, not charged" (the last count, the count factor, a donor's refusals). The screen shows
 * the store's code and city, and says the cost is worked out per run.
 */

/** The like-store bands of deliveries in the window, by the server's index (`StoreRecordMath.BandOf`: 0 to 3). */
export const RECORD_BANDS = ['UNDER_30', 'FROM_30', 'FROM_100', 'FROM_300'] as const
export type RecordBand = (typeof RECORD_BANDS)[number]

/** A band's word key from the server's index; null for an index the screen does not know. */
export const bandOf = (index: number): RecordBand | null => RECORD_BANDS[index] ?? null

/** One measure of a pair (`StoreRecordMeasureView`). */
export interface StoreRecordMeasure {
  /** `StoreRecordMeasures`: `LATE`, `RETURNED`, `CANCELLED` (slot); `NEVER_READY`, `CANCELLED`, `READY_LATE` (pick-up); `CALLOUT_IGNORED` (Dawaa Now). */
  measure: string
  /** Which channel list it counts: `COST` (the app, the site and the call centre) or `TIMING` (the app and the site). */
  channels: string
  /** The list's own channels (`IOS`, `ROID`, `WEB`) and categories (`category C`, the call centre). */
  countedChannels: string[]
  /** The bad endings among the deliveries: at most one per delivery, never the customer's. */
  badEndings: number
  deliveries: number
  /** The like-store band (0 to 3, `bandOf`) and the deliveries that placed the store in it. */
  band: number
  bandCount: number
  bandBadEndings: number
  bandDeliveries: number
  /** The store's own rate (bad endings ÷ deliveries). */
  storeRate: number
  /** The band's pooled rate. */
  likeRate: number
  /** The store's rate steadied toward the like stores'. */
  steadiedRate: number
  steadyingCount: number
  /** Nothing counted: the measure sits on the like-store rate (the neutral default). */
  isNeutral: boolean
}

/** A made-ready time or a courier wait, in minutes: the store's own, its like stores', and the steadied figures. */
export interface StoreRecordFigure {
  count: number
  usual: number
  cautious: number
  likeUsual: number
  likeCautious: number
  steadiedUsual: number
  steadiedCautious: number
  /** `STORE`, `LIKE_STORES`, `CITY`, `CHAIN` or `STAND_IN`. */
  source: string
}

/** Slot delivery's moves and slot shape (BackOffice 4385). `usualSlot` 0 = none. */
export interface StoreRecordSlot {
  lateCustomerMovesFollowed: number
  lateTillMovesHeld: number
  tillMoves: number
  tillMovesCustomer: number
  tillMovesAvailability: number
  tillMovesDelivery: number
  tillMovesOther: number
  slotDeliveries: number
  /** The hours regular slots start at, comma-separated (`"10,12,14,18"`); empty when none. */
  regularSlotHours: string
  storeSlots: number
  usualSlot: number
}

/** One pair's record (`StoreRecordPairView`). */
export interface StoreRecordPair {
  storeCode: string
  /** A mode that keeps a record. */
  mode: string
  city: string
  /** The mode's counted-from date: no earlier day counts (Dawaa Now from 2026-11-02). */
  countedFrom: string
  /** The deliveries the cost measures count, and the ones the timing measures count. */
  costDeliveries: number
  timingDeliveries: number
  /** Deliveries that reached the store as the callout's fallback: left out of its record, and counted. */
  fallbackDeliveries: number
  /** Null for pick-up. */
  madeReady: StoreRecordFigure | null
  /** Dawaa Now only. */
  courierWait: StoreRecordFigure | null
  /** Slot delivery only. */
  slot: StoreRecordSlot | null
  measures: StoreRecordMeasure[]
}

/** `GET SourcingAdvisor/StoreRecords`'s `data`. `builtAt` is null while the nightly pass has never run. */
export interface StoreRecordReply {
  builtAt: string | null
  windowFrom: string | null
  windowTo: string | null
  pairs: StoreRecordPair[]
}
