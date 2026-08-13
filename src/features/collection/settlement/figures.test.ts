/**
 * The two report figures (ticket 270, spec 267 D2).
 *
 * 🚩 One rule under test, stated three ways: **per currency, two magnitudes, never a
 * net.** The estate is KSA *and* Bahrain, so one number across currencies is wrong in
 * both; and a net across branches would state a settlement no server-side path
 * allows — which is the reading 269's account headline already says out loud it does
 * not support.
 *
 * They were the same algorithm written twice until `/standards-review` said so, so
 * the suite runs the same expectations over both readings of the one fold.
 */
import { describe, expect, it } from 'vitest'
import type { SettlementFleetRow, SettlementLedgerRow } from '@/core/models/settlement'
import { SETTLEMENT_FLEET } from './fleet-fixture'
import { estateFigures, ledgerFigures } from './figures'

const branch = (
  o: Partial<SettlementFleetRow> & Pick<SettlementFleetRow, 'storeId'>,
): SettlementFleetRow => ({
  storeName: `${o.storeId} Pharmacy`,
  city: 'Riyadh',
  assignment: 'unassigned',
  currencyKey: 'SAR',
  openCount: 0,
  shortageTotal: 0,
  surplusTotal: 0,
  signedPosition: 0,
  movedSinceCutoff: 0,
  hasOrphan: false,
  hasUncollectedReceipt: false,
  ageingCount: 0,
  ...o,
})

const entry = (
  o: Partial<SettlementLedgerRow> & Pick<SettlementLedgerRow, 'settlementEntryId'>,
): SettlementLedgerRow => ({
  entryNumber: 1,
  storeId: '0142',
  entryKind: 'SHORTAGE',
  amount: 500,
  remainingAmount: 500,
  reason: '',
  status: 'OPEN',
  batchId: '',
  postedByStaffId: '',
  postedByName: '',
  postedAt: '2026-08-01T00:00:00',
  closedByStaffId: '',
  closedAt: '',
  closedReason: '',
  storeName: 'Al-Rawdah',
  currencyKey: 'SAR',
  ...o,
})

describe('the estate headline is a REPORT FIGURE', () => {
  it('reports per currency and never nets the two magnitudes', () => {
    const figures = estateFigures(SETTLEMENT_FLEET)

    // 🚩 KSA and Bahrain are both live, so one number across the estate would be
    // wrong in both currencies at once.
    expect(figures.map((f) => f.currencyKey)).toContain('SAR')
    expect(figures.map((f) => f.currencyKey)).toContain('BHD')
    for (const f of figures) {
      expect(f).toHaveProperty('shortageTotal')
      expect(f).toHaveProperty('surplusTotal')
      expect(f).not.toHaveProperty('signedPosition')
    }
  })

  it('counts only branches that actually hold an open entry', () => {
    expect(
      estateFigures([
        branch({ storeId: '0001', openCount: 0, shortageTotal: 0 }),
        branch({ storeId: '0002', openCount: 2, shortageTotal: 100.5 }),
      ]),
    ).toEqual([
      { currencyKey: 'SAR', branchCount: 1, openCount: 2, shortageTotal: 100.5, surplusTotal: 0 },
    ])
  })

  it('🚩 sums a fleet row’s own open COUNT — the row is an aggregate, not an entry', () => {
    const [figure] = estateFigures([
      branch({ storeId: '0001', openCount: 3, shortageTotal: 10 }),
      branch({ storeId: '0002', openCount: 4, surplusTotal: 5 }),
    ])
    expect(figure.branchCount).toBe(2)
    expect(figure.openCount).toBe(7)
  })
})

describe('the ledger’s footer is the same figure, over entries', () => {
  const rows = [
    entry({ settlementEntryId: 'A', entryKind: 'SHORTAGE', remainingAmount: 500 }),
    entry({ settlementEntryId: 'B', entryKind: 'SURPLUS', remainingAmount: 120 }),
    // 🚩 CANCELLED, and it STILL carries its full remaining on the wire — 269's
    // finding. It must not reach a total.
    entry({
      settlementEntryId: 'C',
      storeId: '0688',
      currencyKey: 'BHD',
      entryKind: 'SURPLUS',
      status: 'CANCELLED',
      remainingAmount: 180,
    }),
  ]

  it('🚩 reports per currency — a dinar is never added to a riyal', () => {
    expect(ledgerFigures(rows).map((f) => f.currencyKey)).toEqual(['BHD', 'SAR'])
  })

  it('🚩 keeps the two magnitudes apart — nothing here nets them', () => {
    const sar = ledgerFigures(rows).find((f) => f.currencyKey === 'SAR')!
    expect(sar).toEqual({
      currencyKey: 'SAR',
      rowCount: 2,
      openCount: 2,
      shortageTotal: 500,
      surplusTotal: 120,
    })
    expect(sar).not.toHaveProperty('signedPosition')
  })

  it('counts a closed entry as a ROW but never as money', () => {
    const bhd = ledgerFigures(rows).find((f) => f.currencyKey === 'BHD')!
    expect(bhd).toMatchObject({ rowCount: 1, openCount: 0, surplusTotal: 0 })
  })

  it('rounds to the scale money is HELD at, so a level branch reads as level', () => {
    const thirds = ledgerFigures([
      entry({ settlementEntryId: 'A', remainingAmount: 0.1 }),
      entry({ settlementEntryId: 'B', remainingAmount: 0.2 }),
    ])
    expect(thirds[0].shortageTotal).toBe(0.3)
  })

  it('tolerates a door that answered nothing', () => {
    expect(ledgerFigures(null)).toEqual([])
    expect(estateFigures(null)).toEqual([])
  })
})
