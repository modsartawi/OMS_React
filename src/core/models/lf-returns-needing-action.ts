// Wire shape for "LF returns needing action" (BackOffice spec 3369 §Wire, read door 3376; client spec
// 759 F6, ticket 764). ⚠ Transcribed, not authoritative: 3376's build fixes the spellings, and the
// joining ticket (765) corrects this file against them. Grant: `LocalFulfillmentReturn,03`.
//
// In `core/` because the outcome vocabulary is the LF return's own: Document Details' LF return panel
// (762) reads the same outcomes, and the two features may never import each other.

/**
 * A local fulfillment return's watch outcome (3369 D9). Typed `string` on the row because the client
 * must survive an outcome it has not learned: an unknown one is simply not listed as needing action.
 */
export type LfReturnOutcome = 'open' | 'refunded' | 'short' | 'nothingReceived' | 'unanswered' | 'forced'

/** One row of the needing-action read: newest first, as the server sorts it. */
export interface LfReturnNeedingActionRow {
  /** The return delivery — the row opens ITS Document Details. */
  returnDeliveryNo: string
  /** The forward LF delivery the return was raised from. */
  forwardDeliveryNo: string
  /** `unanswered`, `nothingReceived` or `short` on this read; anything else is not listed. */
  outcome: LfReturnOutcome | string
  /** When the pickup was booked, local wall-clock (no offset). */
  bookedAt: string | null
}
