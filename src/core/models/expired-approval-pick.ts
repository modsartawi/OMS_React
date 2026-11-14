/**
 * The weekly report of approval picks that expired without a sale (BackOffice ticket 3874, spec 3849) — wire shapes
 * mirrored field for field, camelCase, from BackOffice
 * `Sartawi.Retail.Data\Modules\Pick\Reports\ExpiredApprovalPickReportModels.cs`. A shape change goes there first, then here.
 *
 * An **expired approval pick** is a picking document of an insurance approval (`NPHS`, `WSFT`, `WP`, `WASL`) ended by an
 * `EXPIRED` void with no sale. The weekly fill sorts each into one of two groups (`ExpiredApprovalPickOutcomes`).
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are
 * formatted through `@/core/util/date-format`. The week runs Sunday to Saturday, local.
 *
 * 🚩 The per-pharmacist counts are the door's. A blank `pharmacist` is a pick nobody's name could be read off.
 */

/** The report's two groups. */
export const EXPIRED_APPROVAL_PICK_OUTCOMES = {
  /** Sold from the approvals screen, the delivery picked on the approval never billed. */
  soldNotBilled: 'SOLD_NOT_BILLED',
  /** No sale and no bill. */
  neverSold: 'NEVER_SOLD',
} as const

export type ExpiredApprovalPickOutcome =
  (typeof EXPIRED_APPROVAL_PICK_OUTCOMES)[keyof typeof EXPIRED_APPROVAL_PICK_OUTCOMES]

/** The report's query: any day of the week (`yyyy-MM-dd`; absent = the newest week filled) and the stores. */
export interface ExpiredApprovalPickQuery {
  week?: string
  /** Comma-separated store codes; blank = every store. */
  stores?: string
}

export interface ExpiredApprovalPickAccess {
  screenAllowed: boolean
}

/** One expired approval pick of the week. */
export interface ExpiredApprovalPickRow {
  documentNo: string
  /** The approval's source: `NPHS`, `WSFT`, `WP` or `WASL`. */
  sourceType: string
  /** The approval key (an Nphies reference or a Wasfaty approval id). */
  sourceKey: string
  storeCode: string
  pharmacist: string
  outcome: string
  /** The delivery picked on the approval, blank when none. */
  deliveryNo: string
  units: number
  pickedAt: string
  expiredAt: string
}

/** One store and pharmacist of the week. */
export interface ExpiredApprovalPickPharmacist {
  storeCode: string
  pharmacist: string
  soldNotBilled: number
  neverSold: number
  units: number
}

/** One week of the report. */
export interface ExpiredApprovalPickReport {
  asOf: string
  /** The week's Sunday. */
  weekStart: string
  /** The week's Saturday (inclusive). */
  weekEnd: string
  /** When the week was last filled; null when no fill wrote a row for it. */
  filledAt: string | null
  pharmacists: ExpiredApprovalPickPharmacist[]
  rows: ExpiredApprovalPickRow[]
}
