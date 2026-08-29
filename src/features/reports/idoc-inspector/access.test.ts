import { describe, expect, it } from 'vitest'
import {
  canOpenIDocInspector,
  IDOC_INSPECTOR_ACCESS_KEY,
  idocInspectorAccessQuery,
} from './api'

/**
 * Ticket 296's three named proofs, on the seam that decides all three.
 *
 * The nav leaf and the screen's own `ScreenGate` are thin: each reads ONE
 * predicate over ONE shared query. So `canOpenIDocInspector` plus the options
 * that travel with the key *is* the access spine, and it is a pure module — the
 * spec's client-test ruling (vitest on pure modules only, no component tests,
 * mirroring retail-invoice) lands the assertions exactly here. The rendering of
 * the shut door was driven in the app; see the ticket's Proof.
 */

describe('theScreenIsHiddenFromTheNavWithoutTheGrant', () => {
  it('is hidden when the server says the grant is not held', () => {
    // The leaf renders on `visible(data)`, so a false predicate IS a hidden leaf.
    expect(canOpenIDocInspector({ screenAllowed: false })).toBe(false)
  })

  it('is shown only on an explicit grant', () => {
    expect(canOpenIDocInspector({ screenAllowed: true })).toBe(true)
  })

  it('🚩 stays hidden while the probe is pending or has thrown', () => {
    // The shell hands the predicate `undefined` before the probe resolves and on
    // an error. Fail-closed means both are a no — and no flash-then-hide.
    expect(canOpenIDocInspector(undefined)).toBe(false)
    expect(canOpenIDocInspector(null)).toBe(false)
  })

  it('🔑 reads its own grant, never the invoices one', () => {
    // Same area, same namespace, same nav group — different permission. One key
    // answering for both would hand a consultant the inspector because they can
    // print receipts. Spelled out rather than compared against the invoices
    // constant: a feature may not import a feature, test or not.
    expect(IDOC_INSPECTOR_ACCESS_KEY).toEqual(['reports', 'idoc-inspector', 'access'])
  })
})

describe('theScreenGuardsItselfWhenReachedDirectly', () => {
  it('guards on the very same predicate the nav leaf hides on', () => {
    // Not "an equivalent check" — the Page passes this very function to
    // `ScreenGate`, so a hand-typed URL can never be let in by a second reading
    // of the grant that drifted.
    expect(canOpenIDocInspector({ screenAllowed: false })).toBe(false)
    expect(canOpenIDocInspector({ screenAllowed: true })).toBe(true)
  })

  it('shares ONE cache key with the nav probe — one network call, never two', () => {
    expect(idocInspectorAccessQuery().queryKey).toBe(IDOC_INSPECTOR_ACCESS_KEY)
  })

  it('refuses a malformed answer rather than reading it as truthy', () => {
    // `=== true` and nothing looser: a shape nobody agreed to is a denial.
    expect(canOpenIDocInspector({} as never)).toBe(false)
    expect(canOpenIDocInspector({ screenAllowed: 'true' } as never)).toBe(false)
    expect(canOpenIDocInspector({ screenAllowed: 1 } as never)).toBe(false)
  })
})

describe('aDeniedProbeRendersAShutDoorNotAnError', () => {
  it('🔑 treats a denial as an ANSWER — no retry', () => {
    // The whole point of the endpoint answering `{ screenAllowed: false }` with a
    // 200. `retry: false` is what stops the client turning a shut door into
    // "try again in a moment", forever. It travels with the key rather than
    // being spelled at each call site, because react-query merges the options of
    // concurrent observers and a consumer that dropped it would retry under a
    // gate whose whole ruling is to fail closed on the first no.
    expect(idocInspectorAccessQuery().retry).toBe(false)
  })

  it('does not re-ask inside a page life — a grant does not change under you', () => {
    expect(idocInspectorAccessQuery().staleTime).toBe(Infinity)
  })

  it('🚩 a denial is not an error state at all — it is `screenAllowed: false`', () => {
    // Nothing throws, nothing is caught: the predicate simply says no, and the
    // gate draws the denied sentence rather than the unreachable one.
    expect(canOpenIDocInspector({ screenAllowed: false })).toBe(false)
  })

  it('hands every reader the same options object shape', () => {
    const a = idocInspectorAccessQuery()
    const b = idocInspectorAccessQuery()
    expect(Object.keys(a)).toEqual(['queryKey', 'queryFn', 'staleTime', 'retry'])
    expect(b.retry).toBe(a.retry)
    expect(b.staleTime).toBe(a.staleTime)
  })
})
