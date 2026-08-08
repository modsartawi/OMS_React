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

/**
 * `GET CollectionWeb/Acrs` — one row of the ACRs grid (ticket 255). This is
 * `AcrInquiryModel` verbatim (`Sartawi.Retail.Data/Modules/Pos/Services/Models/Acr/AcrModel.cs`,
 * transcribed via [243's research asset](../../../.issues/assets/243-server-read-spine.RESEARCH.md)),
 * camel-cased by the serializer, with **nothing added and nothing renamed**.
 *
 * An ACR is the collector's day-bag: one collector, one business date, and the
 * receipts they linked to it. The four aggregates are the server's own sums over
 * the linked collections, which is what finance reconciles against the bank.
 *
 * 🚩 **This row carries no `currencyKey`, and that is the wire's shape rather
 * than an omission here.** `CollectionInquiryModel` has one; the ACR aggregate
 * does not. So the grid's two money columns render at the default two decimals
 * with no code in the header — the client cannot state a currency that is not on
 * the wire, and 244 §7's "the row's own decimals" has no row field to read. It is
 * logged as a server change (`.afk/HITL-255.md`), never guessed at here.
 *
 * ⚠️ `closedAt` is a non-nullable `DateTime` server-side, so a still-OPEN ACR
 * arrives as `0001-01-01` rather than as `null` — it renders blank, the same
 * sentinel `salesDate` carries on the collections row.
 *
 * ⚠️ `depositId` is `''` and `depositNumber` is `0` on an ACR that has not been
 * banked yet — that pair IS the eligibility predicate the collector's deposit
 * picker reads. `depositStatus` is `'POSTED'` or blank **by construction, never
 * `'VOID'`**: voiding a deposit clears `DepositId` on its ACRs, so a voided
 * document is unreachable from this side.
 */
export interface AcrInquiryRow {
  /** ULID, the ACR's PK and the form URL's key (spec 249 §"The ACR form"). */
  acrId: string
  /** The serial a supervisor actually holds — `AcrNumber`, minted per collector. */
  acrNumber: number
  label: string
  collectorOperatorId: string
  collectorName: string
  /** The collector-chosen business date the From/To window applies to. */
  acrDate: string
  /** `'OPEN'` or `'CLOSED'`. */
  status: string
  createdAt: string
  /** `0001-01-01` while the ACR is still OPEN. */
  closedAt: string
  linkedCollectionCount: number
  /** Σ `NetCollected` over the linked receipts — what the collector banks. */
  netCollectedTotal: number
  cardTotalSum: number
  cardTransactionCountSum: number
  /** `''` until this ACR is banked. */
  depositId: string
  /** `0` until this ACR is banked. */
  depositNumber: number
  /** `'POSTED'` or blank. Never `'VOID'` — see the note above. */
  depositStatus: string
}

/**
 * `GET CollectionWeb/Attempts` — one row of the Collection Attempts grid (ticket
 * 255). This is `CollectionAttemptInquiryModel` verbatim
 * (`Sartawi.Retail.Data/Modules/Pos/Services/Models/CollectionAttempt/`).
 *
 * One failed collection visit: **who** came, **when** by the device clock,
 * **where**, which shift/business day, and **why** nothing was collected. The
 * shift stays collectable — this is liability evidence a supervisor reviews, not
 * a collection.
 *
 * 🚩 **It carries no money at all**, which is why this is the smallest screen in
 * the suite and why it has **no document and no row action** (244 §8, spec 249
 * story 39). An attempt is immutable evidence, not a voucher.
 */
export interface CollectionAttemptRow {
  /** ULID. Opaque, and there is no document to open with it. */
  attemptId: string
  collectorStaffId: string
  /** Resolved from the Staff master; falls back to the id, so it is never blank. */
  collectorName: string
  storeCode: string
  storeName: string
  shiftId: string
  /** The day the collector came to collect. */
  businessDay: string
  /** The device-clock visit moment — what the From/To window applies to. */
  attemptTime: string
  /** `CollectionAttemptReasons`. */
  reasonCode: string
  /** Free-text detail, mandatory for `OTHER`. */
  reasonText: string
}
