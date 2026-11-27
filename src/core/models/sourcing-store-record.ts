/**
 * The store record's read door (oms-react ticket 969, BackOffice spec 4354 §6 and §14; BackOffice 4373: "A read door
 * lists every pair's record for the simulator's store record list"). One row per pair — a store with a delivery mode —
 * over the last 90 whole local days, keeping the counts behind every rate.
 *
 * ⚠ BackOffice 4373 is open and names the content only, not one field: every name below is ours.
 * PROVISIONAL (spec 4354: not specified) — the whole shape. Reconcile here when the door lands.
 *
 * Rates are fractions (0.0377 = 3.77%), riyals to three decimals, dates local `yyyy-MM-dd`. Every total is sent with
 * its parts, as rounded: no reader adds up for itself (BackOffice 4281 decision 28).
 */

/** The like-store bands of deliveries in the window (BackOffice 4373: under 30; 30 to 99; 100 to 299; 300 or more). */
export const RECORD_BANDS = ['UNDER_30', 'FROM_30', 'FROM_100', 'FROM_300'] as const
export type RecordBand = (typeof RECORD_BANDS)[number]

/**
 * Why a measure sits on the neutral default: no delivery in the window, a mode that keeps no record, or the measure
 * switched off. PROVISIONAL (spec 4354: not specified) — the codes.
 */
export type RecordNeutralWhy = 'NO_DELIVERIES' | 'NO_RECORD' | 'SWITCHED_OFF'

/** One measure of a pair (spec 4354 §14). PROVISIONAL (spec 4354: not specified) — every field name. */
export interface StoreRecordMeasure {
  /** `late`, `returned`, `cancelled` (slot); `neverMadeReady`, `cancelled`, `readyLate` (pick-up); `calloutIgnored` (Dawaa Now). */
  measure: string
  /** The store's steadied rate; null on the neutral default. */
  rate: number | null
  /** The store's own rate before steadying (bad endings ÷ deliveries); null with no delivery. */
  ownRate: number | null
  /** The band's pooled rate: stores of the same mode in the same band, counted on the measure's own channels. */
  likeStores: number
  /** The deliveries behind the rate. */
  count: number
  /** The bad endings among them: at most one per delivery, never the customer's. */
  bad: number
  /** The measure's failure price (spec 4354 §6), riyals. */
  price: number
  /** Failure price × (steadied rate − like-store rate); below zero a credit; zero on the neutral default. */
  cost: number
  neutral: RecordNeutralWhy | null
  /** The channels the measure counts (`APP`, `SITE`, `CALL_CENTRE`). */
  channels: string[]
}

/** One pair's record. PROVISIONAL (spec 4354: not specified) — every field name. */
export interface StoreRecordPair {
  store: string
  storeName: string
  /** A delivery mode code (`SLOT`, `PICK_UP`, `DAWAA_NOW`, the carrier modes, `BEYOND_BORDER`). */
  mode: string
  /** Null for a mode that keeps no record. */
  band: RecordBand | null
  deliveries: number
  /** The mode's counted-from date: no earlier day counts (Dawaa Now from 2026-11-02). */
  countedFrom: string
  /** Deliveries that reached the store as the callout's fallback: left out of its record, and counted. */
  fallbackLeftOut: number
  /** The pair's record cost, sent with its parts (the measures' costs). */
  cost: number
  /** Empty for a mode that keeps no record. */
  measures: StoreRecordMeasure[]
  /** Slot delivery: the store's usual slot (deliveries standing in one slot) and its regular slot hours. */
  slot?: { usual: number; regularHours: { from: string; to: string }[] } | null
  /** Slot delivery: the share of the store's till moves marked "Customer", beside like stores'. */
  tillMoves?: { customerShare: number; likeStores: number; moves: number } | null
}

/** Shown, not charged (spec 4354 §6: the shelf-chance factors ship switched off), per store. */
export interface StoreRecordShown {
  store: string
  /** The store's last full count, or null when none is on file. */
  lastCount: string | null
  countFactor: number
  /** A donor's refusals for no stock. */
  donorRefusals: number
}

/**
 * `GET SourcingAdvisor/StoreRecord`'s `data`. `builtAt` is null while the nightly pass has never run.
 * PROVISIONAL (spec 4354: not specified) — the door and every field name.
 */
export interface StoreRecordReply {
  builtAt: string | null
  windowFrom: string | null
  windowTo: string | null
  pairs: StoreRecordPair[]
  shown: StoreRecordShown[]
}
