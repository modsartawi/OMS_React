/**
 * HQ's daily list of holds that should have ended (BackOffice ticket 3872, spec 3849) — wire shapes mirrored field for
 * field, camelCase, from BackOffice `Sartawi.Retail.Data\Modules\Pick\Reports\HoldDailyListModels.cs`. A shape change goes
 * there first, then here.
 *
 * The list is filled once a day (`PickHoldDailyList`, the SIS.Api worker); the screen only reads it. Each row is one held
 * unit traced to its document, line, pick index and take, so a support agent can explain why a pack is held.
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are
 * formatted through `@/core/util/date-format`.
 */

/** The six kinds of hold that should have ended (`HoldDailyListKinds`), in the door's order. */
export const HOLD_DAILY_LIST_KINDS = [
  /** A sold hold whose sale was pushed over 24 hours ago and never fed: also a sale that did not reach HQ. */
  'SOLD_OVER_24H',
  /** A donor pick's hold waiting for the transfer's goods issue: sold and never transferred, or a failed transfer. */
  'DONOR_WAITS_GI',
  /** A hold waiting for a movement for over an hour. */
  'WAITING_OVER_1H',
  /** A DRS Return PO saved over 30 days ago and not issued. */
  'RETURN_PO_OVER_30D',
  /** A delivery out for delivery for more than 3 days. */
  'OUT_OVER_3D',
  /** A delivery delivered with no sale. */
  'DELIVERED_NO_SALE',
] as const

export type HoldDailyListKind = (typeof HOLD_DAILY_LIST_KINDS)[number]

/** Why a row of a kind is listed, where the kind has more than one cause (`HoldDailyListCauses`). Blank otherwise. */
export const HOLD_DAILY_LIST_CAUSES = [
  'SOLD_NOT_TRANSFERRED',
  'TRANSFER_FAILED',
  /** A delivered delivery whose pick still holds. */
  'STANDING',
  /** A delivered delivery whose pick the expiry sweep ended `DELIVERED_UNSOLD` since the last fill. */
  'ENDED_BY_SWEEP',
  /** A waiting hold no picking document's ledger or unit names. */
  'UNTRACED',
] as const

/** The screen's query: one kind (blank = all) and the stores (comma-separated, blank = the fleet). */
export interface HoldDailyListQuery {
  kind?: string
  stores?: string
}

export interface HoldDailyListAccess {
  screenAllowed: boolean
}

/** Rows per kind and store. */
export interface HoldDailyListCount {
  kind: string
  storeCode: string
  rows: number
  heldQuantity: number
}

/** One held unit, traced to its document, unit and take. */
export interface HoldDailyListRow {
  kind: string
  cause: string
  /** The store whose book holds it (the donor store for a donor's hold). */
  storeCode: string
  documentNo: string
  sourceType: string
  sourceKey: string
  documentState: string
  lineNumber: number
  pickIndex: number
  itemNumber: string
  batch: string
  heldQuantity: number
  takeId: string
  serialNumber: string
  soldStore: string
  soldTrx: string
  requestNo: string
  orderStore: string
  donorStore: string
  /** What the hold waits for (a movement, a sale's push time, a delivery). */
  reference: string
  /** What the row's age counts from. */
  since: string
  /** When a fill first listed it; carried while the hold stands. */
  firstListedAt: string
}

/** The list as the last fill left it. */
export interface HoldDailyListReport {
  asOf: string
  /** When the list was filled; null before the first fill. */
  filledAt: string | null
  counts: HoldDailyListCount[]
  rows: HoldDailyListRow[]
}
