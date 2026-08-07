/**
 * Collections area models (spec 249).
 *
 * Only the access probe lives here today — the four grids' row models and the two
 * documents' print-ready contracts arrive with their own slices. The rule that
 * governs everything that joins this file later is spec 249's §0: **the client
 * cannot format**, so a money field on a document contract is a pre-formatted
 * `string` and never a `number`.
 */

/**
 * `GET CollectionWeb/Access` — the whole area's probe (spec 249 §"Getting in",
 * 244 §10). **One call, four booleans**: the menu needs all four at once to draw
 * one group, and four probes would be four round trips to answer one question.
 *
 * The four flags map 1:1 onto the four existing WPF `ControllerID` grants —
 * `CollectionInquiry`, `AcrInquiry`, `DepositInquiry`, `CollectionAttempts` —
 * reused unchanged, so a WPF user's current rights carry to the web and no new
 * permission is designed or seeded. Supervisor versus accountant is which of
 * these four finance assigned, not a different screen.
 *
 * ⚠️ **The probe only hides the menu.** The endpoint grant filter is the real
 * boundary: a hand-typed URL must be refused by the server, not merely unlinked
 * by the client. Both exist for different reasons and neither substitutes for
 * the other.
 *
 * ⚠️ **The door does not exist yet** — BackOffice 1090 owns it, and ticket 259
 * is the wave-joining event. Until then this route answers a bare 403 (issue
 * 802's default-deny inversion), which the client reads as "no group", the
 * correct posture for an unbuilt door.
 */
export interface CollectionAccessResult {
  canOpenCollections: boolean
  canOpenAcrs: boolean
  canOpenDeposits: boolean
  canOpenAttempts: boolean
}

/**
 * `GET CollectionWeb/Collections` — one row of the Cash Collections grid (ticket
 * 254). This is `CollectionInquiryModel` verbatim
 * (`Sartawi.Retail.Data/Modules/Pos/Services/Models/Collection/`, transcribed via
 * [243's research asset](../../../.issues/assets/243-server-read-spine.RESEARCH.md)),
 * camel-cased by the serializer and with **one addition**: `collectionReceiptId`,
 * the ULID spec 249 §1 puts on the projection.
 *
 * 🚩 **Unlike the two document contracts, this one carries numbers and dates.**
 * That is not a drift from 245 §0 — the "client cannot format" rule governs the
 * *documents*, whose every mark must match a WPF sheet mark-for-mark. A grid row
 * is our own surface: it sorts and filters numerically, and its money renders
 * through `@/core/money.ts` to the row's own `currencyKey` (244 §7).
 *
 * ⚠️ `collectionReceiptNo` is an `int` (`PosCollectionReceipt.SequentialNumber`),
 * minted gap-free **per store** — so it does not identify a receipt HQ-wide and is
 * NOT the document's key. `collectionReceiptId` is; ticket 257 opens the receipt
 * with it.
 *
 * ⚠️ `salesDate` is legitimately `0001-01-01` on pre-shift-day rows (the server's
 * own comment says hosts fall back to `closedAt`), so it renders blank rather than
 * as a year-1 date.
 */
export interface CollectionInquiryRow {
  /** ULID, the receipt's PK and the document URL's key (spec 249 §1). */
  collectionReceiptId: string
  /** `SequentialNumber` — per-store, not HQ-unique. */
  collectionReceiptNo: number
  storeId: string
  storeName: string
  collectorOperatorId: string
  collectorName: string
  /** The shift's closer — the pharmacist block on the receipt. */
  closerOperatorId: string
  closerName: string
  openedAt: string
  /** `null` while the shift is open. */
  closedAt: string | null
  collectedAt: string
  /** The receipt's shift-day denormal; `0001-01-01` on pre-shift-day rows. */
  salesDate: string
  systemCash: number
  countedCash: number
  /** `countedCash − systemCash`, derived server-side. */
  variance: number
  varianceReasonCode: string
  varianceReasonText: string
  openingFloat: number
  countedCashNet: number
  retainedFloat: number
  netCollected: number
  cardTotal: number
  cardTransactionCount: number
  zReportIds: string
  /** `Plants.CurrencyKey` by store code, `SAR` when no plant row. */
  currencyKey: string
}
