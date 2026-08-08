import { describe, expect, it } from 'vitest'
import type { DepositInquiryLine } from '@/core/models/collection'
import { lineHasDrift } from './deposit-drift'

// Ticket 256's drift Proof. This is the screen's whole reason to exist, so it is
// asserted on the DATA rather than left to the eye: a claimed-ACR line whose
// figure no longer matches what was banked is flagged, and one that matches is
// not.

/** A line that balances: what was banked is what the ACR still holds. */
function clean(overrides: Partial<DepositInquiryLine> = {}): DepositInquiryLine {
  return {
    acrId: '01J0ACR0000000000000000001',
    acrNumber: 41,
    netCollectedAtDeposit: 143910.75,
    netCollectedNow: 143910.75,
    drift: 0,
    hasDrift: false,
    ...overrides,
  }
}

/** A line that moved after banking: a late collection landed on the ACR. */
function drifted(overrides: Partial<DepositInquiryLine> = {}): DepositInquiryLine {
  return clean({ netCollectedNow: 144310.75, drift: 400, hasDrift: true, ...overrides })
}

describe('lineHasDrift', () => {
  it('flags a claimed ACR whose figure no longer matches what was banked', () => {
    expect(lineHasDrift(drifted())).toBe(true)
  })

  it('does NOT flag one that still matches', () => {
    expect(lineHasDrift(clean())).toBe(false)
  })

  it('flags a line that SHRANK as well as one that grew — a gap is a gap', () => {
    expect(lineHasDrift(drifted({ netCollectedNow: 143510.75, drift: -400 }))).toBe(true)
  })

  // 🚩 The ruling this module exists to hold. `drift`/`hasDrift` are computed
  // server-side in `decimal`; subtracting the two amounts here would run in
  // IEEE-754 doubles, where 1234.30 − 1234.10 is 0.19999999999995 — a red flag on
  // a deposit that balances to the halala. The server decides; this only asks.
  it('reads the server’s own answer rather than subtracting the two amounts', () => {
    const floatTrap = clean({ netCollectedAtDeposit: 1234.1, netCollectedNow: 1234.3, drift: 0.2 })
    expect(floatTrap.netCollectedNow - floatTrap.netCollectedAtDeposit).not.toBe(0.2)
    // …and the flag still follows `hasDrift`, not that subtraction.
    expect(lineHasDrift({ ...floatTrap, hasDrift: false })).toBe(false)
    expect(lineHasDrift({ ...floatTrap, hasDrift: true })).toBe(true)
  })

  it('treats a malformed or missing line as NOT drifted, never as truthy', () => {
    expect(lineHasDrift(undefined)).toBe(false)
    expect(lineHasDrift(null)).toBe(false)
    expect(lineHasDrift({ ...clean(), hasDrift: 'true' as unknown as boolean })).toBe(false)
  })

  // A deposit's whole line set, asked one line at a time — which is how the
  // detail region asks it, drawing each row. The mixed case is the one that
  // matters: a flagged line beside a clean one, not a deposit that is wholly
  // one or the other.
  it('separates the moved lines from the matching ones inside one deposit', () => {
    const lines = [drifted({ acrNumber: 41 }), clean({ acrNumber: 42 }), drifted({ acrNumber: 43 })]
    expect(lines.filter(lineHasDrift).map((l) => l.acrNumber)).toEqual([41, 43])
  })

  // The exchanged-foreign-currency follow-up banks real cash against no ACR at
  // all. It has nothing that COULD drift, so nothing is flagged.
  it('flags nothing on a deposit that claims no ACR at all', () => {
    expect([].filter(lineHasDrift)).toEqual([])
  })
})
