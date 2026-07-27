/**
 * Ticket 163's pure seam: reading `OpenResult`, and naming what an abandon
 * throws away.
 *
 * Both functions exist because the console's whole 163 behaviour hangs off a
 * branch that the *type* cannot enforce — `OpenResult` carries a discriminant
 * AND two independently-nullable payloads, so `outcome: 'opened'` with a null
 * `state` type-checks. Left unread, that pair strands the agent on "Opening…"
 * forever. These tests are the reason it cannot.
 */
import { describe, expect, it } from 'vitest'
import type { ExistingOrder, OpenResult, SessionState } from '@/core/models/callcenter'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import { abandonTargetOfExisting, abandonTargetOfSession, openedAtLabel, readOpenResult } from './open-outcome'

const EXISTING: ExistingOrder = {
  transactionId: '01JC8Q4KYZ3M7N2P5R8T1V6W9X',
  customerName: 'Mohammed Al-Otaibi',
  lineCount: 4,
  openedAt: '2026-07-27T08:41:00Z',
  plant: '1101',
}

describe('readOpenResult', () => {
  it('reads the opened outcome as the state it carries', () => {
    const result: OpenResult = { outcome: 'opened', state: EMPTY_SESSION, existing: null }
    expect(readOpenResult(result)).toEqual({ kind: 'opened', state: EMPTY_SESSION })
  })

  it('reads refusedExisting as a CHOICE, carrying the order to choose about', () => {
    const result: OpenResult = { outcome: 'refusedExisting', state: null, existing: EXISTING }
    expect(readOpenResult(result)).toEqual({ kind: 'existing', existing: EXISTING })
  })

  it('is pending while the result has not arrived', () => {
    expect(readOpenResult(undefined)).toEqual({ kind: 'pending' })
  })

  // The two malformed pairs. A server that says `opened` and sends no state has
  // broken the contract, and the honest client answer is a named fault the agent
  // can leave — not an eternal spinner and not a crash on `state.header`.
  it('calls an opened outcome with no state malformed, not opened', () => {
    const result: OpenResult = { outcome: 'opened', state: null, existing: null }
    expect(readOpenResult(result)).toEqual({ kind: 'malformed' })
  })

  it('calls a refusedExisting with no existing order malformed, not a choice', () => {
    const result: OpenResult = { outcome: 'refusedExisting', state: null, existing: null }
    expect(readOpenResult(result)).toEqual({ kind: 'malformed' })
  })

  it('treats an unknown outcome as malformed rather than guessing at it', () => {
    // §9 ignores unknown FIELDS; an unknown value in the one field the whole
    // screen branches on is a different thing and must not fall through to a
    // console rendered from nothing.
    const result = { outcome: 'somethingNew', state: null, existing: null } as unknown as OpenResult
    expect(readOpenResult(result)).toEqual({ kind: 'malformed' })
  })
})

describe('abandonTarget', () => {
  it('names the previous caller and line count from the existing order', () => {
    expect(abandonTargetOfExisting(EXISTING)).toEqual({
      transactionId: EXISTING.transactionId,
      customerName: 'Mohammed Al-Otaibi',
      lineCount: 4,
    })
  })

  it('names them from a live session — the SAME act, so the same confirmation', () => {
    // 🚩 The line count comes off `lines.length` and NOT off any total: this is
    // a count of what is about to be thrown away, not money (law 1 — the console
    // never computes an amount, and never needs to here).
    const live: SessionState = {
      ...EMPTY_SESSION,
      transactionId: '01JC9AAAAAAAAAAAAAAAAAAAAA',
      lines: [EMPTY_SESSION.lines[0], EMPTY_SESSION.lines[0]].filter(Boolean),
    }
    expect(abandonTargetOfSession(live)).toEqual({
      transactionId: '01JC9AAAAAAAAAAAAAAAAAAAAA',
      customerName: null,
      lineCount: live.lines.length,
    })
  })

  it('carries the attached caller when there is one', () => {
    const live: SessionState = {
      ...EMPTY_SESSION,
      header: {
        ...EMPTY_SESSION.header,
        customer: { customerId: 'C1', name: 'Sara Al-Ghamdi', mobile: '0500000000', loyaltyAttached: false },
      },
    }
    expect(abandonTargetOfSession(live).customerName).toBe('Sara Al-Ghamdi')
  })
})

describe('openedAtLabel', () => {
  // Built from LOCAL parts, not from a `Z` instant: "same day" is a local-time
  // question (the estate is single-timezone, `date-format.ts`'s no-utc rule),
  // and a UTC literal plus an offset would put the boundary in a different place
  // on every machine that ran the suite.
  const opened = new Date(2026, 6, 27, 8, 41, 0)

  it('shows the clock alone when the order was opened today', () => {
    const now = new Date(2026, 6, 27, 17, 5, 0)
    expect(openedAtLabel(opened.toISOString(), now)).toBe('08:41')
  })

  it('carries the DATE once the order is from another day', () => {
    // The forgotten-tab case: `08:41` on an order opened yesterday reads as
    // minutes ago, and the agent resumes a basket they think is warm.
    const now = new Date(2026, 6, 28, 8, 40, 0)
    expect(openedAtLabel(opened.toISOString(), now)).toBe('2026-07-27 08:41')
  })

  it('is the DATE even a few minutes over midnight — the boundary is the day', () => {
    const now = new Date(2026, 6, 28, 0, 3, 0)
    expect(openedAtLabel(opened.toISOString(), now)).toBe('2026-07-27 08:41')
  })

  it('renders an unusable timestamp as blank rather than as Invalid Date', () => {
    expect(openedAtLabel('', new Date())).toBe('')
    expect(openedAtLabel('not-a-date', new Date())).toBe('')
  })
})
