/**
 * The sourcing advisor's wire shapes (spec 734 D20; BackOffice BO-2, unbuilt). camelCase, as ASP.NET
 * Core emits. A shape change goes into the BO-2 contract first, then here.
 *
 * 🚩 Read-only, and never a coordinate: replies carry km and city only (D17, D3).
 *
 * ⚠️ Two readings D20 leaves open, settled here until BO-2 builds the door (both are in 738's report):
 * - `onTime` is `true`, `false`, or `null` for "on time: unknown" (D18). Anything else reads unknown.
 * - `storeName` rides beside `store` (the code) so a store reads as a `code · name` pair (D21). It is
 *   optional: without it the code stands alone.
 */

/** `GET SourcingAdvisor/Access` → `{ canView }`, grant `BackOfficeScreen[SourcingAdvisor, 01]`. */
export interface SourcingAdvisorAccess {
  canView: boolean
}

/** D18: on time, late, or unknown (`null`, no history for the store). */
export type SourcingOnTimeWire = boolean | null

/** D16: the stock evidence behind a candidate, best first. */
export type SourcingStockEvidence = 'recorded' | 'estimated'

/** `actual` and `best`: one store's estimate. */
export interface SourcingStoreEstimate {
  store: string
  storeName?: string | null
  km: number | null
  cost: number | null
  onTime: SourcingOnTimeWire
  readyMins: number | null
  travelMins: number | null
}

/** D17: a candidate's cost, by part. */
export interface SourcingCostParts {
  courier: number | null
  pick: number | null
  split: number | null
  express: number | null
}

/** One of up to 15 candidate rows. */
export interface SourcingCandidate {
  store: string
  storeName?: string | null
  km: number | null
  cost: number | null
  costParts?: Partial<SourcingCostParts> | null
  onTime: SourcingOnTimeWire
  stockEvidence: SourcingStockEvidence | string
}

/** `GET SourcingAdvisor/Explain?orderNo=`. */
export interface SourcingExplainReply {
  orderNo: string
  deliveryType: string
  city: string
  /** The promised slot's end, local wall-clock `yyyy-MM-ddTHH:mm:ss`. */
  promisedBy: string | null
  actual: SourcingStoreEstimate | null
  best: SourcingStoreEstimate | null
  candidates: SourcingCandidate[]
  /** SAR, actual minus best; absent when there is no cheaper on-time candidate. */
  saving: number | null
  /** Reason codes (D21: the screen builds the sentences, never server free text). */
  reasons: string[]
  rateVersion: string
  placeholderRates: boolean
}

/** D20's refusal codes. */
export const SOURCING_REFUSALS = ['SOURCING-401', 'SOURCING-402', 'SOURCING-403', 'SOURCING-404'] as const

/** `GET SourcingAdvisor/Summary`'s query (D20): the range as local `yyyy-MM-dd` days, both ends inclusive. */
export interface SourcingSummaryQuery {
  from: string
  to: string
  city: string
  channel: string
  deliveryType: string
}

/**
 * One row of `byCity[]`, `byChannel[]` or `byDeliveryType[]`.
 *
 * ⚠️ D20 names the lists but not their rows. Settled here until BO-2 builds the door: `key` is the
 * city, the channel or the delivery type, and the four figures are the headline's own.
 */
export interface SourcingSummaryBreakdownRow {
  key: string
  orders: number
  ordersWithSaving: number
  totalSaving: number | null
  avgSaving: number | null
}

/**
 * One of up to 50 top-savings orders. `actualStoreName` / `bestStoreName` are D20a's optional
 * `storeName` beside each store code, under the field's own prefix.
 */
export interface SourcingTopOrder {
  orderNo: string
  actualStore: string
  actualStoreName?: string | null
  bestStore: string
  bestStoreName?: string | null
  saving: number | null
  reasons: string[]
}

/** `GET SourcingAdvisor/Summary?from=&to=&city=&channel=&deliveryType=`. */
export interface SourcingSummaryReply {
  orders: number
  ordersWithSaving: number
  /** SAR, as the door summed it. */
  totalSaving: number | null
  avgSaving: number | null
  byCity: SourcingSummaryBreakdownRow[]
  byChannel: SourcingSummaryBreakdownRow[]
  byDeliveryType: SourcingSummaryBreakdownRow[]
  top: SourcingTopOrder[]
  rateVersion: string
  placeholderRates: boolean
  /** The last day the nightly job has scored, `yyyy-MM-dd` (D19). */
  scoredThrough: string | null
}
