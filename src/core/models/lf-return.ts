/**
 * The LOCAL FULFILLMENT return detail — the warehouse watch on one LF return delivery (BackOffice
 * spec 3369 §Wire, read door 3376 `GET LocalFulfillmentReturnWeb/Detail/{returnDeliveryNo}`; client
 * spec 759 F4, ticket 762, reconciled against the built door by ticket 765).
 *
 * Every field is optional or nullable on purpose: the client must survive a server that sends less
 * than it promised, and an absent quantity reads as *pending*, never `0`.
 */

/**
 * Where the watch stands: `open` (booked, waiting on the warehouse), `refunded` (confirmed in full
 * and refunded), `short` (confirmed less than asked), `nothingReceived` (confirmed empty),
 * `unanswered` (the warehouse never confirmed in time) or `forced` (an operator force-refunded it).
 *
 * These are the CLIENT's codes (they key the locale). The wire spells *nothing received*
 * `nothing-received`; read every outcome through `normaliseLfReturnOutcome`
 * (`@/core/oms/lf-return-outcome`), never by comparing the raw code.
 */
export const LF_RETURN_OUTCOMES = ['open', 'refunded', 'short', 'nothingReceived', 'unanswered', 'forced'] as const
export type LfReturnOutcome = (typeof LF_RETURN_OUTCOMES)[number]

/** One returned line as the warehouse watch sees it. */
export interface LfReturnLineModel {
  lineNumber?: number
  itemNumber: string
  sku: string
  /** What the operator asked the driver to collect. */
  quantityAsked: number | null
  /** What the warehouse confirmed it received — the server sends `0` until it has answered. */
  quantityConfirmed?: number | null
  /** What was refunded for this line — `0` until a refund ran. */
  quantityRefunded?: number | null
  /** Whether the line went back into sellable stock (`false` is *not restocked*). */
  returnedToStock?: boolean | null
  /** The return reason's name (free text, either script). */
  reasonName?: string | null
}

/** The LF return detail, by return delivery number. Dates are local wall-clock (no zone), `null` unstamped. */
export interface LfReturnDetailModel {
  returnDeliveryNo?: string
  forwardDeliveryNo?: string
  returnOrderNo?: string
  outcome: string
  bookedAt?: string | null
  collectedAt?: string | null
  confirmedAt?: string | null
  /** Who forced the refund — blank unless the outcome is `forced`. */
  forcedBy?: string | null
  /** Why it was forced (free text) — blank unless the outcome is `forced`. */
  forcedReason?: string | null
  lines: LfReturnLineModel[]
}

/**
 * The FORCE REFUND verb's body (BackOffice 3369 D13, door 3375 `POST LocalFulfillmentReturnWeb/ForceRefund`;
 * client spec 759 F5, ticket 763). Received quantities, a reason and an idempotency key — **never
 * money**: the server computes the refund with the automatic path's own amounts.
 */
export interface ForceLfReturnRefundRequest {
  returnDeliveryNo: string
  /** One per line: what actually arrived, `0 ≤ received ≤ asked`. */
  lines: { itemNumber: string; receivedQuantity: number }[]
  reason: string
  /** Client-minted; a retry of an unanswered press carries the same one, so it forces once. */
  requestId: string
}
