/**
 * `stateAppliesOnlyForward` (162) and `theScreenNeverRewinds` (164) — the guard
 * that stands between the wire and the screen, proved at its edge.
 *
 * State in, state out. Nothing here knows how the cache calls it, and nothing
 * asserts on a React detail (spec 160's testing ruling). Every version number
 * below is set by the test, because a fixture value is never evidence of engine
 * behaviour (CONTRACT.md §11).
 *
 * 🚩 Moved here with the guard (ticket 210) and its assertions are unchanged.
 * What did change is the fixture it builds them on: in `core/` it cannot reach
 * the call-centre payload fixture — `core/` may not import a feature — and it
 * has no business doing so, because the rule under test reads two fields and
 * neither of them belongs to one feature's projection. `header.plant` below
 * stands in for exactly what it stood in for before: a field of the state that
 * the two candidates disagree about.
 */
import { describe, expect, it } from 'vitest'
import { applyState, checkContractVersion, CLIENT_CONTRACT_VERSION } from './session-state'

/** The minimum a state must be for this guard to rule on it, plus one field the
 *  guard never reads — which is how a test can tell WHICH state was applied. */
interface SessionState {
  version: number
  etag: string
  replayed?: boolean
  header?: { plant: string }
}

const EMPTY_SESSION: SessionState = { version: 0, etag: 'E0', header: { plant: '1101' } }

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

  it('🚩 applies an equal version whose etag disagrees — the store that would not appear', () => {
    // The bug this rule ends: `setStore` answers with the new plant on a version
    // the server did not advance, the guard reads *same save point, same state*,
    // and the chip keeps the store the agent just replaced until the page is
    // reloaded. Version orders states; the etag identifies one, and two
    // different etags cannot be the same state whatever the counter says.
    const current = at(12, 'E12')
    const moved: SessionState = {
      ...at(12, 'E12-MOVED'),
      header: { ...EMPTY_SESSION.header, plant: '1044' },
    }
    expect(applyState(current, moved)).toBe(moved)
  })

  it('...but never on a LOWER version, whatever the etag says', () => {
    // The ordering rule is untouched: a slow response that would rewind the
    // basket is still discarded, and a fresh etag on it proves only that the
    // server was somewhere else when it built it.
    const current = at(14, 'E14')
    expect(applyState(current, at(9, 'E9-DIFFERENT'))).toBe(current)
  })

  // 🚩 The other half of the same defect, and the one that actually bit: the
  // console asks the order what it holds (§6.1) because a verb's answer looked
  // wrong — and the guard threw the answer away for carrying the version the
  // wrong one carried. Recovery a guard can discard is not recovery.
  it('lets a READ win at an equal version — the recovery the guard used to discard', () => {
    const projected: SessionState = {
      ...at(12),
      // What `setAddress` answered: the address landed, the plant is the
      // placeholder the district rule has already replaced.
      header: { ...EMPTY_SESSION.header, plant: 'P000' },
    }
    const held: SessionState = {
      ...at(12),
      header: { ...EMPTY_SESSION.header, plant: '1044' },
    }
    expect(applyState(projected, held, 'read')).toBe(held)
    // The same pair from a VERB is the idempotent case — same save point, same
    // etag, nothing to prefer.
    expect(applyState(projected, held, 'verb')).toBe(projected)
  })

  it('...but a read still cannot rewind the basket', () => {
    // The race §2.1 is actually about: a `getState` that left before the verb
    // landed. Lower version, discarded, whoever asked for it.
    const current = at(14)
    expect(applyState(current, at(9), 'read')).toBe(current)
  })

  it('...and a server that names no etag keeps the idempotent reading', () => {
    // Every state on the wire carries one today; a server that stops (or has not
    // started) must not have its replays turned into re-renders by this rule.
    const current = { ...at(12), etag: '' }
    const replay = { ...at(12), etag: '', replayed: true }
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
