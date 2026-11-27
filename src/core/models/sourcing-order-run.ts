/**
 * The sourcing advisor's old order link (ticket 974, BackOffice 4397, spec 4354 §20): what a link to an order's score
 * from the retired advisor opens now. Wire of `GET SourcingAdvisor/Results/OrderRun?orderNumber=` (`ResultsEndpoints.
 * OrderRun`, reply `ResultsOrderRunReply`, camelCase), under the advisor view grant like every results door. A blank
 * number is refused `RESULTS-400` (a 400 in the usual envelope).
 */

/** `GET SourcingAdvisor/Results/OrderRun`'s `data`. */
export interface ResultsOrderRunReply {
  /** The number the link carried: an order, or one of its deliveries. */
  asked: string
  /** The order it names; `''` when it names none. */
  orderNumber: string
  orderKnown: boolean
  /** The order's stored run to open in the simulator: its comparison run, else its newest kept run; null when none. */
  runId: string | null
  /** `COMPARISON` or `KEPT` (never a held working copy); null with no run. */
  state: string | null
  ranAt: string | null
  /** Its comparison summary row is still kept (24 months), so the results page's order card opens too. */
  hasSummary: boolean
  /** No stored run, and the order is known: the screen offers a replay (`POST SourcingAdvisor/Advise` with it). */
  offerReplay: boolean
}
