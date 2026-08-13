/**
 * **The posting form's two guards** (ticket 271, spec 267 D4) — the branch resolved
 * to *exactly one* match, and the branch's standing open position of the same kind.
 *
 * Both are the silent-regression kind: a resolution that quietly picked the
 * best-ranked of twelve matches would post the right amount onto the wrong branch,
 * and a standing position that netted the two kinds would stop warning about the
 * duplicate the monthly audit actually produces.
 */
import { describe, expect, it } from 'vitest'
import type { SettlementEntry, SettlementFleetRow } from '@/core/models/settlement'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'
import { SETTLEMENT_FLEET } from './fleet-fixture'
import { parseAmount, resolveBranch, standingPosition } from './posting'

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

const ROWS: SettlementFleetRow[] = [
  branch({ storeId: '0142', storeName: 'صيدلية الروضة / Al-Rawdah Pharmacy', city: 'Riyadh' }),
  branch({ storeId: '0331', storeName: 'صيدلية النخيل / Al-Nakheel Pharmacy', city: 'Jeddah' }),
  branch({ storeId: '0688', storeName: 'صيدلية المحرق / Al-Muharraq Pharmacy', city: 'Muharraq', currencyKey: 'BHD' }),
]

describe('resolveBranch — exactly one match, or nothing is posted', () => {
  it('resolves an exact branch code', () => {
    const r = resolveBranch(ROWS, '0142')
    expect(r.kind).toBe('one')
    expect(r.kind === 'one' && r.row.storeId).toBe('0142')
  })

  it('resolves a name in either script, and a city', () => {
    expect(resolveBranch(ROWS, 'Al-Nakheel')).toMatchObject({ kind: 'one' })
    expect(resolveBranch(ROWS, 'النخيل')).toMatchObject({ kind: 'one' })
    expect(resolveBranch(ROWS, 'Muharraq')).toMatchObject({ kind: 'one' })
  })

  it('🔑 refuses to guess when a query matches more than one branch', () => {
    // Every fixture branch is a "Pharmacy". A form that broke this tie by ranking
    // would post the right amount onto the wrong branch — silently, and plausibly.
    const r = resolveBranch(ROWS, 'Pharmacy')
    expect(r.kind).toBe('many')
    expect(r.kind === 'many' && r.total).toBe(3)
    expect(r.kind === 'many' && r.matches.length).toBe(3)
  })

  it('🔑 …but an exact code collapses the ambiguity — that is an address, not a search', () => {
    const withCollision = [...ROWS, branch({ storeId: '01420', storeName: '01420 Pharmacy' })]
    const r = resolveBranch(withCollision, '0142')
    expect(r.kind).toBe('one')
    expect(r.kind === 'one' && r.row.storeId).toBe('0142')
  })

  it('says nothing matched, and says nothing was typed — they are different states', () => {
    expect(resolveBranch(ROWS, 'zzzz')).toEqual({ kind: 'none' })
    expect(resolveBranch(ROWS, '   ')).toEqual({ kind: 'empty' })
    expect(resolveBranch(null, '0142')).toEqual({ kind: 'none' })
  })

  it('🚩 is never scoped — an unassigned branch is as postable as an assigned one', () => {
    // 1255 of the estate's 1394 branches are assigned to nobody. A posting box that
    // inherited the door's scope ranking could not reach most of the estate.
    const unassigned = SETTLEMENT_FLEET.find((r) => r.assignment === 'unassigned')!
    expect(resolveBranch(SETTLEMENT_FLEET, unassigned.storeId)).toMatchObject({
      kind: 'one',
      row: { storeId: unassigned.storeId },
    })
  })

  it('resolves every branch in the estate by its own code', () => {
    for (const row of SETTLEMENT_FLEET.slice(0, 50)) {
      expect(resolveBranch(SETTLEMENT_FLEET, row.storeId)).toMatchObject({
        kind: 'one',
        row: { storeId: row.storeId },
      })
    }
  })
})

describe('parseAmount', () => {
  it('takes a figure as an accountant transcribes it', () => {
    expect(parseAmount('500')).toBe(500)
    expect(parseAmount('50,000.57')).toBe(50_000.57)
    expect(parseAmount(' 95.250 ')).toBe(95.25)
    expect(parseAmount('.5')).toBe(0.5)
  })

  it('🚩 refuses zero, a negative and anything that is not a number', () => {
    // `amount` is a positive magnitude on this contract; `entryKind` carries the
    // direction. A `-500` typed into a shortage is a refusal, not a surplus.
    for (const bad of ['0', '0.00', '-500', '', '   ', 'five hundred', '5o0', '1.2.3', null]) {
      expect(parseAmount(bad)).toBeNull()
    }
  })
})

describe('standingPosition — the duplicate only this screen can catch', () => {
  const entries = SETTLEMENT_ACCOUNTS['0142'].entries

  it('🔑 names each open entry of the SAME kind, with its remaining', () => {
    // 0142 carries two open shortages (143 · 500.00 and 128 · 75.50) and one open
    // surplus. A monthly audit reposting a shortage here is permitted by design, so
    // this warning is the only thing standing between it and a doubled shortage.
    const shortage = standingPosition(entries, 'SHORTAGE')
    expect(shortage.entries.map((e) => e.entryNumber)).toEqual([128, 143])
    expect(shortage.total).toBe(575.5)
  })

  it('🚩 never nets the two kinds — a branch legitimately holds one of each', () => {
    const surplus = standingPosition(entries, 'SURPLUS')
    expect(surplus.entries.map((e) => e.entryNumber)).toEqual([151])
    expect(surplus.total).toBe(120)
  })

  it('counts only OPEN entries — cancelled, consumed and written-off are history', () => {
    // 0688 holds a CLOSED_OUT shortage (133), a CANCELLED surplus (147) and one open
    // shortage (152). The cancelled entry still carries 180.000 on the wire.
    const bhd = SETTLEMENT_ACCOUNTS['0688'].entries
    expect(standingPosition(bhd, 'SHORTAGE').entries.map((e) => e.entryNumber)).toEqual([152])
    expect(standingPosition(bhd, 'SHORTAGE').total).toBe(95.25)
    expect(standingPosition(bhd, 'SURPLUS')).toEqual({ entries: [], total: 0 })
  })

  it('is empty for a branch carrying nothing, and for no account at all', () => {
    expect(standingPosition(SETTLEMENT_ACCOUNTS['0512'].entries, 'SHORTAGE').entries).toEqual([])
    expect(standingPosition(null, 'SHORTAGE')).toEqual({ entries: [], total: 0 })
    expect(standingPosition(undefined, 'SURPLUS')).toEqual({ entries: [], total: 0 })
  })

  it('🚩 sums at the scale money is HELD at — a level branch reads as level', () => {
    const thirds: SettlementEntry[] = [0.1, 0.2, 0.3].map((amount, i) => ({
      ...SETTLEMENT_ACCOUNTS['0142'].entries[0],
      settlementEntryId: `x${i}`,
      entryNumber: 900 + i,
      amount,
      remainingAmount: amount,
      postedAt: `2026-08-0${i + 1}T00:00:00`,
    }))
    expect(standingPosition(thirds, 'SHORTAGE').total).toBe(0.6)
  })
})
