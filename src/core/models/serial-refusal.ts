/**
 * The serial refusal report's wire shapes (ticket 573, BackOffice ticket 3065, spec 3049) — mirrored field for field,
 * camelCase, from BackOffice `Sartawi.Retail.Data\Modules\Pick\Reports\SerialRefusalReportModels.cs`. A shape change
 * goes there first, then here.
 *
 * A **serial refusal** is head office's record of one till serial check it answered SOLD (the pack was already sold)
 * or HELD (a picking document holds it), as given at that moment.
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are
 * formatted through `@/core/util/date-format`.
 *
 * 🚩 Every count is the door's: the screen never recomputes one. A blank `staff` / `staffId` is a till that sent no
 * staff id (many people, not one) — read as "unknown", never as a person.
 */

export type SerialRefusalStatus = 'SOLD' | 'HELD'

/** The report's refusals (`SerialRefusalReportErrorCodes`). */
export const SERIAL_REFUSAL_REFUSALS = {
  rangeTooLong: 'PICK-00301',
  rangeReversed: 'PICK-00302',
  unknownStatus: 'PICK-00303',
} as const

/** The query every read takes: whole local days (`yyyy-MM-dd`, both inclusive), the asking stores, the answer. */
export interface SerialRefusalQuery {
  from?: string
  to?: string
  /** Comma-separated asking store codes; blank = every store. */
  stores?: string
  /** `SOLD` / `HELD`; blank = both. */
  status?: string
}

/** The list's narrowing on top of the query, each blank = any. `noStaff` keeps the refusals with no staff id. */
export interface SerialRefusalRowsQuery extends SerialRefusalQuery {
  staff?: string
  noStaff?: boolean
  gtin?: string
  serial?: string
  item?: string
  heldStore?: string
}

export interface SerialRefusalAccess {
  screenAllowed: boolean
}

export interface SerialRefusalTotals {
  refusals: number
  sold: number
  held: number
  /** Sold, and the asking store is the store that sold it. */
  sameStore: number
  /** Sold at another store. */
  crossStore: number
  /** Sold, but the ledger named no sale. */
  unknownSale: number
  unknownStaff: number
  stores: number
  staff: number
  serials: number
}

export interface SerialRefusalDayRow {
  day: string
  store: string
  refusals: number
  sold: number
  held: number
}

export interface SerialRefusalStoreRow {
  store: string
  name: string
  refusals: number
  sold: number
  held: number
  crossStore: number
  staff: number
  unknownStaff: number
}

export interface SerialRefusalStaffRow {
  /** `""` = the till sent no staff id. */
  staff: string
  refusals: number
  sold: number
  held: number
  serials: number
  stores: string[]
  lastRefusedAt: string
}

export interface SerialRefusalArticleRow {
  itemNumber: string
  refusals: number
  serials: number
  stores: number
}

/** The latest basket that asked: store, till and receipt number (blank from an older till). */
export interface SerialRefusalBasket {
  store: string
  till: string
  trxNumber: string
}

export interface SerialRefusalSerialRow {
  gtin: string
  serial: string
  itemNumber: string
  refusals: number
  stores: number
  baskets: number
  firstRefusedAt: string
  lastRefusedAt: string
  last: SerialRefusalBasket
}

export interface SerialRefusalHeldByRow {
  heldStore: string
  refusals: number
  documents: number
  askingStores: number
}

/** The same staff member refused the same serial more than once. */
export interface SerialRefusalOffenderRow {
  staff: string
  gtin: string
  serial: string
  itemNumber: string
  times: number
  stores: number
  baskets: number
  firstRefusedAt: string
  lastRefusedAt: string
  last: SerialRefusalBasket
}

export interface SerialRefusalReport {
  asOf: string
  from: string
  to: string
  totals: SerialRefusalTotals
  days: SerialRefusalDayRow[]
  stores: SerialRefusalStoreRow[]
  staff: SerialRefusalStaffRow[]
  articles: SerialRefusalArticleRow[]
  serials: SerialRefusalSerialRow[]
  heldBy: SerialRefusalHeldByRow[]
  offenders: SerialRefusalOffenderRow[]
}

/** One refusal, as recorded. */
export interface SerialRefusalRow {
  id: string
  refusedAt: string
  storeCode: string
  staffId: string
  tillCode: string
  tillVersion: string
  trxNumber: string
  gtin: string
  serial: string
  itemNumber: string
  status: string
  soldStoreCode: string
  soldMachineCode: string
  soldTrxNumber: string
  heldDocumentNo: string
  heldStoreCode: string
}

export interface SerialRefusalRows {
  asOf: string
  from: string
  to: string
  /** More refusals matched than the 2000 sent. */
  truncated: boolean
  rows: SerialRefusalRow[]
}
