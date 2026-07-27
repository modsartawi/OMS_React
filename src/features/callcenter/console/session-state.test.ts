/**
 * `stateAppliesOnlyForward` — ticket 162's pure proof.
 *
 * The guard is asserted at its edge: state in, state out. Nothing here knows how
 * the cache calls it, and nothing asserts on a React detail (spec 160's testing
 * ruling). The fixture supplies the SHAPE of a real `SessionState`; every
 * version number below is set by the test, because a fixture value is never
 * evidence of engine behaviour (CONTRACT.md §11).
 */
import { describe, expect, it } from 'vitest'
import type { SessionState } from '@/core/models/callcenter'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import { applyState } from './session-state'

/** The fixture at a chosen version — the only field this guard reads. */
function at(version: number, etag = `E${version}`): SessionState {
  return { ...EMPTY_SESSION, version, etag }
}

describe('applyState', () => {
  it('accepts anything when nothing is rendered yet', () => {
    const first = at(1)
    expect(applyState(null, first)).toBe(first)
    expect(applyState(undefined, first)).toBe(first)
  })

  it('applies a higher version', () => {
    const next = at(13)
    expect(applyState(at(12), next)).toBe(next)
  })

  it('is idempotent on an equal version — the replay case', () => {
    const current = at(12)
    // §4: a retried requestId returns the CURRENT state with `replayed: true`.
    // It must render identically, and cost no re-render.
    const replay: SessionState = { ...at(12), replayed: true }
    expect(applyState(current, replay)).toBe(current)
  })

  it('discards a lower version — the slow response that would rewind the basket', () => {
    const current = at(14)
    expect(applyState(current, at(9))).toBe(current)
  })

  it('never mutates either input', () => {
    const current = at(5)
    const incoming = at(6)
    applyState(current, incoming)
    expect(current.version).toBe(5)
    expect(incoming.version).toBe(6)
  })
})

describe('the open fixture', () => {
  // Shape only: an empty order is what slice 0 renders, and every field the
  // shell reads must exist on it. Values are illustrative and asserted nowhere.
  it('is a whole SessionState the console can render', () => {
    expect(EMPTY_SESSION.transactionId).toBeTruthy()
    expect(typeof EMPTY_SESSION.version).toBe('number')
    expect(EMPTY_SESSION.status).toBe('open')
    expect(EMPTY_SESSION.lines).toEqual([])
    expect(EMPTY_SESSION.totals.deliveryFee).toBeDefined()
    expect(EMPTY_SESSION.capabilities.submitBlockers.length).toBeGreaterThan(0)
    expect(EMPTY_SESSION.capabilities.canSubmit).toBe(false)
  })

  it('carries no client-computable savings figure anywhere', () => {
    // `wouldSave` does not exist and will not be added (§2.1). Asserted on the
    // wire shape so a server that grew one fails a client test loudly.
    expect(JSON.stringify(EMPTY_SESSION)).not.toContain('wouldSave')
  })
})
