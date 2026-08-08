import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { ACR_NOT_FOUND, RECEIPT_NOT_FOUND } from './api'
import { printOutcome } from './print-outcome'

/**
 * Ticket 259's pure Proof: WHICH of the four things a print route draws.
 *
 * The reason this is a module and not four `if`s inside two components is that
 * both print routes have to make the same decision and get it wrong in the same
 * two directions if they get it wrong at all — and neither direction is visible
 * in a typecheck:
 *
 * - ⚠ **An empty document is a SUCCESS, not a miss.** An ACR with no linked
 *   collections is a 200 with one page and `rows: []`. Reading that as a refusal
 *   turns an idle ACR into an error screen.
 * - ⚠ **A failure is not a miss.** "This document no longer exists" is a claim
 *   about the DOCUMENT. Saying it when the server was merely down, or the session
 *   lacks the grant, tells a user to stop looking for a receipt that is sitting
 *   right there.
 *
 * And underneath both: **never `null`**. Every branch names something to draw,
 * because a print route that renders nothing prints a blank A4 sheet, and a blank
 * sheet prints as convincingly as a real one.
 */

/** react-query's shape, narrowed to the three fields the decision reads. */
const state = (over: Partial<Parameters<typeof printOutcome>[0]> = {}) => ({
  isPending: false,
  error: null,
  data: undefined,
  ...over,
})

const refusal = (code: string) =>
  new ApiError('business', 'no such thing', 404, [
    { errorCode: code, internalErrorCode: '', errorMessage: 'no such thing' },
  ])

const doc = (pageCount: number) => ({ pages: Array.from({ length: pageCount }, () => ({})) })

describe('printOutcome', () => {
  it('is pending while the document is on its way — not blank, and not a miss', () => {
    expect(printOutcome(state({ isPending: true }), RECEIPT_NOT_FOUND)).toBe('pending')
  })

  it('is ready once a document with pages arrives', () => {
    expect(printOutcome(state({ data: doc(1) }), RECEIPT_NOT_FOUND)).toBe('ready')
  })

  it('is ready for a MULTI-PAGE document — the page count is never a condition', () => {
    expect(printOutcome(state({ data: doc(3) }), ACR_NOT_FOUND)).toBe('ready')
  })

  it('is a miss when the envelope carries the route’s own not-found code', () => {
    expect(printOutcome(state({ error: refusal(RECEIPT_NOT_FOUND) }), RECEIPT_NOT_FOUND)).toBe(
      'miss',
    )
    expect(printOutcome(state({ error: refusal(ACR_NOT_FOUND) }), ACR_NOT_FOUND)).toBe('miss')
  })

  it('is a FAILURE, not a miss, when a business refusal carries some OTHER code', () => {
    // The receipt route must not report a stale link because the ACR family
    // refused something. Each route owns exactly one code.
    expect(printOutcome(state({ error: refusal(ACR_NOT_FOUND) }), RECEIPT_NOT_FOUND)).toBe(
      'failure',
    )
  })

  it('is a FAILURE for an uncoded refusal — a 403 from a missing cookie marker', () => {
    // 802's default-deny answers a browser with a bare 403 and no envelope code.
    // That is "the door refused you", never "the receipt is gone".
    expect(
      printOutcome(state({ error: new ApiError('unknown', 'forbidden', 403) }), RECEIPT_NOT_FOUND),
    ).toBe('failure')
  })

  it('is a FAILURE when the server crashed', () => {
    expect(
      printOutcome(state({ error: new ApiError('server', 'boom', 500) }), ACR_NOT_FOUND),
    ).toBe('failure')
  })

  it('is a FAILURE when the network never answered', () => {
    expect(
      printOutcome(state({ error: new ApiError('network', 'offline', 0) }), ACR_NOT_FOUND),
    ).toBe('failure')
  })

  it('is a FAILURE when the thrown thing is not an ApiError at all — a client bug', () => {
    // `apiErrorCode` returns null for these, and null must never fall into the
    // miss branch by accident: a `TypeError` in a renderer is not a stale link.
    expect(printOutcome(state({ error: new TypeError('undefined is not a function') }), ACR_NOT_FOUND)).toBe(
      'failure',
    )
  })

  it('reports the error even while the query still calls itself pending', () => {
    // Order matters: a retrying query can carry both. The error is the newer fact
    // and the one the reader can act on.
    expect(
      printOutcome(state({ isPending: true, error: refusal(ACR_NOT_FOUND) }), ACR_NOT_FOUND),
    ).toBe('miss')
  })

  it('is a miss for a settled query that somehow produced no document', () => {
    // Contractually unreachable — a 200 always carries a document. It is here
    // because the alternative to naming it is rendering nothing, and rendering
    // nothing on a print route IS the blank sheet.
    expect(printOutcome(state({ data: undefined }), RECEIPT_NOT_FOUND)).toBe('miss')
    expect(printOutcome(state({ data: null }), RECEIPT_NOT_FOUND)).toBe('miss')
  })

  it('is a miss for a document with ZERO pages — the same lie told more quietly', () => {
    expect(printOutcome(state({ data: doc(0) }), RECEIPT_NOT_FOUND)).toBe('miss')
  })

  it('is a miss for a MALFORMED body, rather than throwing on the way to `.length`', () => {
    // Found by the screens drive, whose stub answers every unmatched route with an
    // empty envelope: `{}` typechecks as the contract and reaches `pages.length`.
    // A throw here renders the router's error boundary — not a blank sheet, but
    // not a sentence a user can act on either, and the type system cannot help
    // because the type is a claim ABOUT THE SERVER.
    expect(printOutcome(state({ data: {} }), RECEIPT_NOT_FOUND)).toBe('miss')
    expect(printOutcome(state({ data: { pages: null } as never }), ACR_NOT_FOUND)).toBe('miss')
    expect(printOutcome(state({ data: 'nonsense' as never }), ACR_NOT_FOUND)).toBe('miss')
  })

  it('is NOT a miss for a document whose one page is empty — 0 rows is a real ACR', () => {
    // The distinction the whole module exists for: `pages: []` is nothing to
    // print, `pages: [{ rows: [] }]` is an idle ACR that prints its one sheet.
    expect(printOutcome(state({ data: { pages: [{ rows: [] }] } }), ACR_NOT_FOUND)).toBe('ready')
  })
})
