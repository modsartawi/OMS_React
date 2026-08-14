/**
 * The estate headline (ticket 270, spec 267 D2) — **and what ticket 274 had to take
 * out of it.**
 *
 * 270's rule was *per currency, two magnitudes, never a net*, asserted three ways
 * over two readings of one fold. 274 found the fleet row carries no `currencyKey`
 * (`.afk/FINDINGS-274.md` §B6) and the estate is KSA **and** Bahrain, which leaves no
 * honest cross-branch money total at all: folding the two adds dinars to riyals and
 * is wrong in both, splitting them needs the missing field, and defaulting the lot to
 * SAR is the silent rounding D10 exists to forbid.
 *
 * 🔑 **So the headline states counts, and this file's job is to hold it to that.**
 * The strongest test below is the one asserting no money is on it: it is what stops
 * a well-meaning tidy-up putting a `shortageTotal` back on a screen that cannot say
 * what currency it is in.
 *
 * (`ledgerFigures`, the same fold read over the cross-estate ledger's footer, went
 * with the ledger door that does not exist — §B1.)
 */
import { describe, expect, it } from 'vitest'
import type { SettlementFleetRow } from '@/core/models/settlement'
import { SETTLEMENT_FLEET } from './fleet-fixture'
import { estateFigures } from './figures'

const branch = (
  o: Partial<SettlementFleetRow> & Pick<SettlementFleetRow, 'storeId'>,
): SettlementFleetRow => ({
  storeName: `${o.storeId} Pharmacy`,
  openCount: 0,
  shortageTotal: 0,
  surplusTotal: 0,
  signedPosition: 0,
  movedSinceCutoff: 0,
  hasOrphan: false,
  hasUncollectedReceipt: false,
  ...o,
})

describe('the estate headline is a REPORT FIGURE', () => {
  it('🚩 states COUNTS and no money — the assertion §B6 turns on', () => {
    // ⚠️ The one to read before "improving" this. A total needs a currency; the wire
    // sends none; two currencies are live. Counts are true whatever the money is in,
    // which is the only thing that stays sayable.
    const figures = estateFigures(SETTLEMENT_FLEET)
    expect(Object.keys(figures).sort()).toEqual(['branchCount', 'openCount'])
  })

  it('counts only branches that actually hold an open entry', () => {
    // Roughly two thirds of the estate is square. A branch that owes nothing is the
    // ordinary case and is not a figure about anything.
    const figures = estateFigures([
      branch({ storeId: '0001', openCount: 2 }),
      branch({ storeId: '0002', openCount: 0 }),
      branch({ storeId: '0003', openCount: 1 }),
    ])
    expect(figures.branchCount).toBe(2)
    expect(figures.openCount).toBe(3)
  })

  it('🚩 sums a fleet row’s own open COUNT — the row is an aggregate, not an entry', () => {
    // One row stands for a whole branch, so it contributes its branch's count. A fold
    // that counted rows would report 1394 branches as 1394 open entries.
    const figures = estateFigures([branch({ storeId: '0001', openCount: 7 })])
    expect(figures.branchCount).toBe(1)
    expect(figures.openCount).toBe(7)
  })

  it('agrees with the estate fixture', () => {
    const figures = estateFigures(SETTLEMENT_FLEET)
    const holding = SETTLEMENT_FLEET.filter((r) => r.openCount > 0)
    expect(figures.branchCount).toBe(holding.length)
    expect(figures.openCount).toBe(holding.reduce((sum, r) => sum + r.openCount, 0))
    // The estate is big, and the headline's whole job is to say so at a glance.
    expect(figures.branchCount).toBeGreaterThan(0)
  })

  it('tolerates a door that answered nothing', () => {
    // No ErrorBoundary in this app: a null envelope must render an empty headline
    // rather than throw inside render.
    expect(estateFigures(null)).toEqual({ branchCount: 0, openCount: 0 })
    expect(estateFigures(undefined)).toEqual({ branchCount: 0, openCount: 0 })
    expect(estateFigures([])).toEqual({ branchCount: 0, openCount: 0 })
  })
})
