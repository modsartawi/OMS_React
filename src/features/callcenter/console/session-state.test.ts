/**
 * `stateAppliesOnlyForward` (162) and `theScreenNeverRewinds` (164) — the guard
 * that stands between the wire and the screen, proved at its edge.
 *
 * State in, state out. Nothing here knows how the cache calls it, and nothing
 * asserts on a React detail (spec 160's testing ruling). The fixture supplies
 * the SHAPE of a real `SessionState`; every version number below is set by the
 * test, because a fixture value is never evidence of engine behaviour
 * (CONTRACT.md §11).
 */
import { describe, expect, it } from 'vitest'
import type { SessionState } from '@/core/models/callcenter'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import { applyState, checkContractVersion, CLIENT_CONTRACT_VERSION } from './session-state'

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

  it('renders a replay identically to a fresh response', () => {
    // §4 — a retried `requestId` returns the CURRENT state with `replayed: true`.
    // The flag exists so the console can suppress a duplicate toast, and for
    // nothing else: the state it rides on is ordinary truth and is applied by
    // the ordinary rule. Asserted as a property of the payload rather than of a
    // component — the two differ in that one field and in no other.
    const fresh = at(20)
    const replay: SessionState = { ...at(20), replayed: true }
    const { replayed: _a, ...freshRest } = fresh
    const { replayed: _b, ...replayRest } = replay
    expect(replayRest).toEqual(freshRest)
    // And it moves the screen forward on exactly the same terms.
    expect(applyState(at(19), replay)).toBe(replay)
    expect(applyState(at(21), replay)).not.toBe(replay)
  })
})

describe('checkContractVersion', () => {
  it('accepts the version this client was built against', () => {
    expect(checkContractVersion(CLIENT_CONTRACT_VERSION)).toEqual({ ok: true })
  })

  it('ignores minor drift in EITHER direction', () => {
    // §9 — additive changes bump the minor and ship server-first, because
    // clients ignore unknown fields by rule. A client one minor ahead of its
    // server is the same non-event seen from the other side (this repo shipped
    // the v1.1 model against v1.0 fixtures).
    expect(checkContractVersion('1.0')).toEqual({ ok: true })
    expect(checkContractVersion('1.7')).toEqual({ ok: true })
    expect(checkContractVersion('1')).toEqual({ ok: true })
    expect(checkContractVersion('1.0.4')).toEqual({ ok: true })
  })

  it('hard-stops on a major mismatch, in either direction', () => {
    expect(checkContractVersion('2.0')).toEqual({
      ok: false,
      expected: CLIENT_CONTRACT_VERSION,
      received: '2.0',
    })
    expect(checkContractVersion('0.9')).toMatchObject({ ok: false, received: '0.9' })
  })

  it('hard-stops on a version it cannot read', () => {
    // The server NAMED a version and this client cannot say whether it speaks
    // it. That is evidence of a break, and the check exists for evidence.
    for (const bad of ['v1', 'latest', 'x.y']) {
      expect(checkContractVersion(bad)).toMatchObject({ ok: false, received: bad })
    }
  })

  it('runs against a server that sends no version at all', () => {
    // 🚩 Law 10 says every response carries one, so silence is a server defect
    // — but it is not evidence of a MAJOR change, and stopping on it would
    // brick the console against a server that has simply not added the field
    // yet (BackOffice 804 is unbuilt). That is the ship-server-first failure
    // §9 exists to design against, so absence degrades rather than refuses.
    for (const quiet of [null, undefined, '']) {
      expect(checkContractVersion(quiet)).toEqual({ ok: true })
    }
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
