/**
 * The worklist's triage, and 🔑 **the estate-wide carve-out** — the two unit tests
 * ticket 270's Proof names, and the pair spec 267 D2 calls *"the first thing to
 * break if someone tidies the scope handling"*.
 *
 * The rule under test, in one sentence: **wrong money and cash waiting ignore the
 * scope entirely; only the ageing count honours it.** 1255 of the estate's 1394
 * branches are assigned to nobody, so a naive *mine* over the two enumerated lanes
 * would take 90% of the estate's wrong money off every screen in the company.
 *
 * The second rule: **wrong money is enumerated in full, ageing is collapsed to a
 * count** — because the prototype proved the alternative by failing. An untriaged
 * list went from 3 cards to ~140 at estate scale, of which 131 were merely ageing,
 * and the four that were actually *wrong* sank into them.
 */
import { describe, expect, it } from 'vitest'
import type {
  SettlementFleetRow,
  SettlementWorklistResult,
} from '@/core/models/settlement'
import {
  AGEING_IN_SCOPE,
  AGEING_THRESHOLD_DAYS,
  AGEING_TOTAL,
  ESTATE_MINE,
  ESTATE_TOTAL,
  ESTATE_UNASSIGNED,
  SETTLEMENT_FLEET,
  SETTLEMENT_WORKLIST,
} from './fleet-fixture'
import { resolveScope } from './scope'
import { buildWorklist } from './worklist'

const branch = (o: Partial<SettlementFleetRow> & Pick<SettlementFleetRow, 'storeId'>): SettlementFleetRow => ({
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

/** One unassigned branch carrying all three kinds of work at once — the single
 *  fixture the carve-out can be read off, because the three lanes disagree about
 *  it and only about it. */
const UNOWNED = branch({
  storeId: '0331',
  assignment: 'unassigned',
  openCount: 6,
  ageingCount: 4,
  hasOrphan: true,
  hasUncollectedReceipt: true,
})
const OWNED = branch({ storeId: '0142', assignment: 'mine', openCount: 3, ageingCount: 2 })

const WORK: SettlementWorklistResult = {
  orphans: [
    {
      settlementConsumptionId: 'C1',
      settlementEntryId: 'E1',
      entryNumber: 137,
      storeId: '0331',
      storeName: '0331 Pharmacy',
      currencyKey: 'SAR',
      amount: 150,
      ageDays: 4,
      consumedAt: '2026-08-12T22:58:00',
    },
  ],
  uncollected: [
    {
      documentId: 'SR1',
      documentNumber: 'SR-0331-0002',
      storeId: '0331',
      storeName: '0331 Pharmacy',
      currencyKey: 'SAR',
      amount: 600,
      ageDays: 3,
      preparedAt: '2026-08-10T18:00:00',
    },
  ],
  ageingThresholdDays: 30,
}

const scopeOver = (scope: 'mine' | 'unassigned' | 'all') =>
  resolveScope(scope, [UNOWNED, OWNED])

describe('🔑 the estate-wide carve-out', () => {
  it('shows an UNASSIGNED branch’s wrong money and waiting cash under scope = mine', () => {
    const lanes = buildWorklist(WORK, [UNOWNED, OWNED], scopeOver('mine'))

    expect(lanes.wrongMoney.map((r) => r.storeId)).toEqual(['0331'])
    expect(lanes.cashWaiting.map((r) => r.storeId)).toEqual(['0331'])
  })

  it('…while that same branch’s ageing entries do NOT count under scope = mine', () => {
    const mine = buildWorklist(WORK, [UNOWNED, OWNED], scopeOver('mine'))
    // OWNED's two, and not one of UNOWNED's four.
    expect(mine.ageing.count).toBe(2)
    expect(mine.ageing.branchCount).toBe(1)

    const all = buildWorklist(WORK, [UNOWNED, OWNED], scopeOver('all'))
    expect(all.ageing.count).toBe(6)
    expect(all.ageing.branchCount).toBe(2)
  })

  it('🚩 the two enumerated lanes are byte-identical across ALL THREE scopes', () => {
    const [mine, unassigned, all] = (['mine', 'unassigned', 'all'] as const).map((s) =>
      buildWorklist(WORK, [UNOWNED, OWNED], scopeOver(s)),
    )
    for (const lanes of [unassigned, all]) {
      expect(lanes.wrongMoney).toEqual(mine.wrongMoney)
      expect(lanes.cashWaiting).toEqual(mine.cashWaiting)
    }
    // …and the ageing count is the one thing that moved.
    expect([mine.ageing.count, unassigned.ageing.count, all.ageing.count]).toEqual([2, 4, 6])
  })

  it('🚩 keeps the lanes whole for a session with NO staff row — which reads as unfiltered', () => {
    // Nothing is assigned to this session, so *mine* degrades to the estate (a
    // normal state, per D2). The enumerated lanes were never scoped in the first
    // place, so the only figure that moves is the count.
    const noStaffRow = resolveScope('mine', [UNOWNED, branch({ storeId: '0512', assignment: 'other', openCount: 1, ageingCount: 1 })])
    const lanes = buildWorklist(WORK, [UNOWNED, branch({ storeId: '0512', assignment: 'other', openCount: 1, ageingCount: 1 })], noStaffRow)

    expect(noStaffRow.unfiltered).toBe(true)
    expect(lanes.wrongMoney).toHaveLength(1)
    expect(lanes.ageing.count).toBe(5)
  })
})

describe('triage — what each lane costs to read', () => {
  it('🔑 enumerates wrong money in full and collapses ageing to a COUNT', () => {
    const lanes = buildWorklist(SETTLEMENT_WORKLIST, SETTLEMENT_FLEET, scopeOver('all'))

    // Every orphan is a row, because each one is money and each one is repairable.
    expect(lanes.wrongMoney).toHaveLength(SETTLEMENT_WORKLIST.orphans.length)
    // 🔑 …and the ageing lane has NO rows to render, at any fixture size: the type
    // carries a count and never an array, so a card-per-entry is not a thing a
    // component could do wrong. 140 entries, one lane, three numbers.
    expect(lanes.ageing.count).toBe(AGEING_TOTAL)
    expect(Object.keys(lanes.ageing).sort()).toEqual(['branchCount', 'count', 'thresholdDays'])
  })

  it('reports the ageing lane at the estate’s real numbers, in and out of scope', () => {
    const mine = buildWorklist(SETTLEMENT_WORKLIST, SETTLEMENT_FLEET, resolveScope('mine', SETTLEMENT_FLEET))
    const all = buildWorklist(SETTLEMENT_WORKLIST, SETTLEMENT_FLEET, resolveScope('all', SETTLEMENT_FLEET))

    expect(mine.ageing.count).toBe(AGEING_IN_SCOPE)
    expect(all.ageing.count).toBe(AGEING_TOTAL)
    expect(all.ageing.thresholdDays).toBe(AGEING_THRESHOLD_DAYS)
  })

  it('orders both enumerated lanes OLDEST FIRST, and totally', () => {
    const lanes = buildWorklist(SETTLEMENT_WORKLIST, SETTLEMENT_FLEET, scopeOver('all'))
    const ages = lanes.wrongMoney.map((r) => r.ageDays)
    expect([...ages].sort((a, b) => b - a)).toEqual(ages)

    // Stable under a reversed input — two rows can genuinely share a day count.
    const reversed = buildWorklist(
      { ...SETTLEMENT_WORKLIST, orphans: [...SETTLEMENT_WORKLIST.orphans].reverse() },
      SETTLEMENT_FLEET,
      scopeOver('all'),
    )
    expect(reversed.wrongMoney.map((r) => r.settlementConsumptionId)).toEqual(
      lanes.wrongMoney.map((r) => r.settlementConsumptionId),
    )
  })

  it('says when there is nothing to do, rather than rendering three empty lanes', () => {
    const lanes = buildWorklist(
      { orphans: [], uncollected: [], ageingThresholdDays: 30 },
      [branch({ storeId: '0512', assignment: 'mine', openCount: 1 })],
      scopeOver('mine'),
    )
    expect(lanes.isEmpty).toBe(true)
  })

  it('tolerates a door that answered nothing at all — the contract is 274’s to settle', () => {
    const lanes = buildWorklist(null, null, scopeOver('mine'))
    expect(lanes).toMatchObject({ wrongMoney: [], cashWaiting: [], isEmpty: true })
    expect(lanes.ageing.count).toBe(0)
  })
})

describe('the fixture is the estate, at its real size', () => {
  it('🚩 carries 1394 branches of which 1255 are assigned to NOBODY', () => {
    expect(SETTLEMENT_FLEET).toHaveLength(ESTATE_TOTAL)
    expect(SETTLEMENT_FLEET.filter((r) => r.assignment === 'unassigned')).toHaveLength(
      ESTATE_UNASSIGNED,
    )
    expect(SETTLEMENT_FLEET.filter((r) => r.assignment === 'mine')).toHaveLength(ESTATE_MINE)
  })

  it('🔑 puts wrong money on branches nobody owns — the case the carve-out exists for', () => {
    const byId = new Map(SETTLEMENT_FLEET.map((r) => [r.storeId, r]))
    const unowned = SETTLEMENT_WORKLIST.orphans.filter(
      (o) => byId.get(o.storeId)?.assignment !== 'mine',
    )
    expect(unowned.length).toBeGreaterThan(0)
    // …including the orphan the ACCOUNT screen renders in words (269's rule 1).
    expect(SETTLEMENT_WORKLIST.orphans.some((o) => o.storeId === '0331')).toBe(true)
    expect(byId.get('0331')?.assignment).toBe('unassigned')
  })

  it('keeps a branch’s aggregate row and its own account in agreement', () => {
    const row = SETTLEMENT_FLEET.find((r) => r.storeId === '0142')!
    // 0142 holds 575.50 of open shortage against 120.00 of open surplus — the same
    // two magnitudes 269's headline renders, because the row is computed from the
    // account rather than retyped beside it.
    expect(row.shortageTotal).toBe(575.5)
    expect(row.surplusTotal).toBe(120)
    expect(row.signedPosition).toBe(455.5)
  })
})
