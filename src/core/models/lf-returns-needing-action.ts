// Wire shape for "LF returns needing action" (BackOffice spec 3369 §Wire, read door 3376; client spec
// 759 F6, ticket 764). ⚠ Transcribed, not authoritative: 3376's build fixes the spellings, and the
// joining ticket (765) corrects this file against them. Grant: `LocalFulfillmentReturn,03`.
//
// In `core/` beside the LF return detail (`./lf-return`, ticket 762), whose outcome vocabulary it
// shares: the deliveries and document features may never import each other.
import type { LfReturnOutcome } from './lf-return'

/** One row of the needing-action read: newest first, as the server sorts it. */
export interface LfReturnNeedingActionRow {
  /** The return delivery — the row opens ITS Document Details. */
  returnDeliveryNo: string
  /** The forward LF delivery the return was raised from. */
  forwardDeliveryNo: string
  /**
   * `unanswered`, `nothingReceived` or `short` on this read. Typed `string` too, because the client
   * must survive an outcome it has not learned: such a row is simply not listed.
   */
  outcome: LfReturnOutcome | string
  /** When the pickup was booked, local wall-clock (no offset). */
  bookedAt: string | null
}
