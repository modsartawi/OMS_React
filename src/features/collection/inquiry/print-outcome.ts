import { apiErrorCode } from '@/core/api'

/**
 * What a print route draws (ticket 259).
 *
 * The two document routes fetch different things from different endpoints and
 * then face exactly the same question, so they ask it here rather than each
 * spelling four branches of their own. The four answers are exhaustive on
 * purpose: **there is no fifth branch that renders nothing**, because a print
 * route that renders nothing prints a blank A4 sheet, and a blank sheet prints as
 * convincingly as a real one (spec 249, story 91).
 *
 * 🚩 The distinction this module exists to hold is `miss` versus `failure`.
 * "This document no longer exists" is a claim about the DOCUMENT — that the
 * receipt was reversed, or the link went stale. Saying it because SIS.Api was
 * down, or because the session lacks the grant, sends a user to look for a
 * paper trail that is sitting right where they left it. So a miss is ONLY the
 * route's own not-found code, arriving inside the envelope; everything else is a
 * failure that shows the server's own sentence.
 */
export type PrintOutcome = 'pending' | 'ready' | 'miss' | 'failure'

/**
 * The three fields of a react-query result the decision reads, and nothing wider.
 *
 * Deliberately structural rather than `UseQueryResult<T>`: it keeps this module
 * (and its test) free of the query client, and it makes the input small enough
 * that the test can state every combination — including the ones react-query
 * would not normally produce, which are precisely the ones a future version
 * might.
 */
export interface PrintQueryState {
  isPending: boolean
  error: unknown
  /**
   * ⚠ Typed as the contract, checked as if it were not. `data` is whatever the
   * envelope's `data` held — the type is a claim about the server, and this is
   * the one place in the feature where a wrong claim has nowhere to fall. A body
   * missing `pages` reaches a `.length` and throws, and a throw on a print route
   * renders the router's error boundary: not a blank sheet, but not a sentence a
   * user can act on either.
   */
  data: { pages?: unknown[] } | null | undefined
}

/**
 * @param notFoundCode the route's OWN envelope code — `CollectionReceiptNotFound`
 *   for the receipt, `AcrNotFound` for the ACR. Passed in rather than checked
 *   against both: the receipt route must not report a stale link because the ACR
 *   family refused something.
 */
export function printOutcome(state: PrintQueryState, notFoundCode: string): PrintOutcome {
  // Error FIRST, before `isPending`. A retrying query can carry both, and the
  // error is the newer fact and the only one the reader can act on.
  if (state.error) return apiErrorCode(state.error) === notFoundCode ? 'miss' : 'failure'
  if (state.isPending) return 'pending'

  // ⚠ NOT `pages.length` as a proxy for "empty". An ACR with no linked
  // collections is ONE page carrying `rows: []` — a real document that prints,
  // totals `0.00`, summary present. What is checked here is a document with no
  // SHEETS at all, which is contractually unreachable and, if it ever arrives,
  // is the blank sheet wearing a 200.
  return Array.isArray(state.data?.pages) && state.data.pages.length > 0 ? 'ready' : 'miss'
}
