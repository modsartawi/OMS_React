/**
 * The LOCAL FULFILLMENT return detail — the warehouse watch on one LF return delivery (BackOffice
 * spec 3369 §Wire, read door 3376; client spec 759 F4, ticket 762).
 *
 * ⚠ **Transcribed, not authoritative, and not on the wire yet.** Every spelling below is spec 759's
 * transcription of 3369; 3376's build fixes them and the joining ticket (765) corrects this file
 * against it. Every field is optional or nullable on purpose: the client must survive a server that
 * sends less than it promised, and an absent quantity reads as *pending*, never `0`.
 */

/**
 * Where the watch stands: `open` (booked, waiting on the warehouse), `refunded` (confirmed in full
 * and refunded), `short` (confirmed less than asked), `nothingReceived` (confirmed empty),
 * `unanswered` (the warehouse never confirmed in time) or `forced` (an operator force-refunded it).
 * Typed `string` on the wire because the client must survive an outcome it has not learned.
 */
export type LfReturnOutcome = 'open' | 'refunded' | 'short' | 'nothingReceived' | 'unanswered' | 'forced'

/** One returned line as the warehouse watch sees it. */
export interface LfReturnLineModel {
  itemNumber: string
  sku: string
  /** What the operator asked the driver to collect. */
  askedQuantity: number | null
  /** What the warehouse confirmed it received; `null` until it has answered. */
  confirmedQuantity?: number | null
  /** What was refunded for this line; `null` until a refund ran. */
  refundedQuantity?: number | null
  /** What went back into sellable stock (the rest is *not restocked*). */
  returnedToStock?: number | null
  /** The return reason's name (free text, either script). */
  reasonName?: string | null
}

/** The LF return detail, by return delivery number. Dates are local wall-clock (no zone). */
export interface LfReturnDetailModel {
  outcome: string
  bookedAt?: string | null
  collectedAt?: string | null
  confirmedAt?: string | null
  /** Who forced the refund — present only on a `forced` return. */
  forcedBy?: string | null
  /** Why it was forced (free text) — present only on a `forced` return. */
  forcedReason?: string | null
  lines: LfReturnLineModel[]
}
