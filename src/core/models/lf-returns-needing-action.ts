// Wire shape for "LF returns needing action" (BackOffice spec 3369 §Wire, read door 3376
// `GET LocalFulfillmentReturnWeb/NeedingAction`; client spec 759 F6, ticket 764, reconciled against
// the built door by ticket 765). Grant: `LocalFulfillmentReturn,03`.
//
// In `core/` beside the LF return detail (`./lf-return`, ticket 762), whose outcome vocabulary it
// shares: the deliveries and document features may never import each other.

/** One row of the needing-action read: newest booking first, as the server sorts it. */
export interface LfReturnNeedingActionRow {
  /** The return delivery — the row opens ITS Document Details. */
  returnDeliveryNo: string
  /** The forward LF delivery the return was raised from. */
  forwardDeliveryNo: string
  /**
   * `unanswered`, `nothing-received` or `short` on the wire. Typed `string`, because the client must
   * survive an outcome it has not learned: read it through `normaliseLfReturnOutcome`, and a row it
   * reads as `unknown` is simply not listed.
   */
  outcome: string
  /** When the pickup was booked, local wall-clock (no offset); `null` when never stamped. */
  bookedAt: string | null
  /** When the watch closed on this outcome. Sent by 3376; not drawn yet. */
  closedAt?: string | null
  /** The server's sentence for why it needs an operator (English, server text). Not drawn yet. */
  reason?: string | null
  /** Local calendar days since booking, by the server's clock. Not drawn yet (the queue counts its own). */
  ageDays?: number
}
