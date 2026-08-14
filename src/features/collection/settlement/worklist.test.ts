/**
 * The worklist's triage, and 🔑 **the estate-wide carve-out** (ticket 270, spec 267
 * D2) — rewritten by ticket 274 around the lane that has a door.
 *
 * The rule 270 stated, and what became of each half:
 *
 * > **Wrong money and cash waiting ignore the scope entirely; only the ageing count
 * > honours it.**
 *
 * - **Wrong money** — still true, and now true *twice*: `Settlement/Orphans` takes
 *   no scope parameter at all, and the fleet door OR's the same carve-out into every
 *   scoped predicate server-side. A door with no scope to pass cannot be narrowed by
 *   accident.
 * - **Cash waiting** — no door enumerates it (§B2). The lane is gone.
 * - **Ageing** — spec 1173 rules entry staleness *fog* and sets no threshold (§B3).
 *   The lane is gone.
 *
 * ⚠️ **What this file can no longer assert, and why that is not a loss of coverage:**
 * the scope tests below used to prove the client did not narrow the lanes. The client
 * no longer *can* — `buildWorklist` is not handed a scope, and there is no parameter
 * to pass one through. The rule is enforced by shape, which is what 270 wanted:
 * *"narrowing it would have to be a deliberate change to the contract, which is a
 * thing a reviewer sees."*
 *
 * 🚩 **The last describe block is 274's own lesson.** Five tickets were built against
 * fields no server sent, because the fixture had them. So the fixture is now asserted
 * to carry **exactly** BackOffice spec 1173 D13's row — no more.
 */
import { describe, expect, it } from 'vitest'
import type { SettlementOrphanRow } from '@/core/models/settlement'
import {
  ESTATE_TOTAL,
  ESTATE_UNASSIGNED,
  SETTLEMENT_FLEET,
  SETTLEMENT_ORPHANS,
} from './fleet-fixture'
import { buildWorklist } from './worklist'

const orphan = (
  o: Partial<SettlementOrphanRow> & Pick<SettlementOrphanRow, 'settlementConsumptionId'>,
): SettlementOrphanRow => ({
  settlementEntryId: 'E1',
  storeId: '0331',
  amount: 150,
  consumedAt: '2026-08-12T22:58:00',
  consumptionKind: 'CONSUME',
  documentType: 'SPECIAL_RECEIPT',
  documentId: '',
  documentNumber: '',
  ...o,
})

describe('🔑 the estate-wide carve-out, enforced by shape', () => {
  it('🚩 takes no scope — there is no parameter a tidy-up could narrow it through', () => {
    // The whole rule, as a type-level fact rather than a behaviour: `buildWorklist`
    // has arity 1 and it is the orphan array. 270 passed a fleet and a
    // `ScopeResolution` alongside; both are gone, and with them every way to filter.
    expect(buildWorklist).toHaveLength(1)
  })

  it('returns the door’s answer whole, including branches nobody is assigned to', () => {
    // 1255 of 1394 branches are on nobody's *mine*. Under a naive scope their money
    // would be on nobody's screen — which is the failure the carve-out exists for.
    const rows = [orphan({ settlementConsumptionId: 'C1', storeId: '0331' })]
    expect(buildWorklist(rows).wrongMoney).toHaveLength(1)
    expect(buildWorklist(rows).wrongMoney[0].storeId).toBe('0331')
  })
})

describe('triage — what the lane costs to read', () => {
  it('enumerates wrong money in FULL, because every row is money and each is rare', () => {
    // Never a count: `Settlement/Repair` is keyed by a `settlementConsumptionId`, so
    // a lane that could only say "0331 has one somewhere" would send the accountant
    // hunting through an account for the row.
    const lanes = buildWorklist(SETTLEMENT_ORPHANS)
    expect(lanes.wrongMoney).toHaveLength(SETTLEMENT_ORPHANS.length)
    expect(lanes.wrongMoney.every((r) => !!r.settlementConsumptionId)).toBe(true)
  })

  it('orders the lane OLDEST FIRST, and totally', () => {
    // ⚠️ On `consumedAt`, not on a day count — the door sends no `ageDays` (§B2), and
    // the timestamp is the same server clock at better resolution. The tie-break on
    // id makes the order total, so a re-render cannot reshuffle rows under a cursor
    // while somebody is deciding which to repair.
    const rows = [
      orphan({ settlementConsumptionId: 'C-new', consumedAt: '2026-08-12T10:00:00' }),
      orphan({ settlementConsumptionId: 'C-b', consumedAt: '2026-07-01T10:00:00' }),
      orphan({ settlementConsumptionId: 'C-a', consumedAt: '2026-07-01T10:00:00' }),
    ]
    expect(buildWorklist(rows).wrongMoney.map((r) => r.settlementConsumptionId)).toEqual([
      'C-a',
      'C-b',
      'C-new',
    ])
  })

  it('does not mutate the array it was handed', () => {
    // It sorts, and a sort in place would reorder a TanStack Query cache entry.
    const rows = [
      orphan({ settlementConsumptionId: 'C2', consumedAt: '2026-08-12T10:00:00' }),
      orphan({ settlementConsumptionId: 'C1', consumedAt: '2026-07-01T10:00:00' }),
    ]
    buildWorklist(rows)
    expect(rows.map((r) => r.settlementConsumptionId)).toEqual(['C2', 'C1'])
  })

  it('says when there is nothing to do, rather than rendering an empty lane', () => {
    expect(buildWorklist([]).isEmpty).toBe(true)
    expect(buildWorklist([orphan({ settlementConsumptionId: 'C1' })]).isEmpty).toBe(false)
  })

  it('tolerates a door that answered nothing at all', () => {
    // There is no ErrorBoundary in this app, so a door answering `data: null` must
    // produce an empty lane rather than a throw inside render.
    expect(buildWorklist(null).wrongMoney).toEqual([])
    expect(buildWorklist(undefined).isEmpty).toBe(true)
  })
})

describe('the fixture is the estate, at its real size', () => {
  it('🚩 carries 1394 branches', () => {
    expect(SETTLEMENT_FLEET).toHaveLength(ESTATE_TOTAL)
    expect(ESTATE_UNASSIGNED).toBe(1255)
  })

  it('🔑 puts wrong money on branches nobody owns — the case the carve-out exists for', () => {
    // Two of the four orphans sit at unassigned branches by construction. The
    // assertion here is the one that survives 274: the lane reaches them at all.
    expect(SETTLEMENT_ORPHANS.length).toBeGreaterThan(1)
    const branches = new Set(SETTLEMENT_ORPHANS.map((o) => o.storeId))
    expect(branches.size).toBe(SETTLEMENT_ORPHANS.length)
    expect(branches.has('0331')).toBe(true)
  })
})

/**
 * 🔑 **274's own lesson, as a test.**
 *
 * Tickets 269–273 were built against `city`, `assignment`, `ageingCount`,
 * `currencyKey`, an `entryNumber` on an orphan and a whole cross-estate ledger — none
 * of which any server sent. It stayed invisible for five tickets because the FIXTURE
 * had them, so every screen and every test agreed with each other and with nothing
 * else.
 *
 * These assert the fixture is not richer than the wire. They fail loudly the next
 * time someone adds a convenient field to a fixture instead of to a contract.
 */
describe('🚩 the fixture may not be richer than the wire', () => {
  const D13_FLEET_FIELDS = [
    'storeId',
    'storeName',
    'openCount',
    'shortageTotal',
    'surplusTotal',
    'signedPosition',
    'movedSinceCutoff',
    'hasOrphan',
    'hasUncollectedReceipt',
  ]

  it('emits exactly BackOffice spec 1173 D13’s fleet row, and no more', () => {
    expect(Object.keys(SETTLEMENT_FLEET[0]).sort()).toEqual([...D13_FLEET_FIELDS].sort())
  })

  it('emits orphans as the CONSUMPTION rows Settlement/Orphans answers', () => {
    // The four fields 270 wanted are the four the door's projection deliberately
    // omits — adding any would turn a seek on IX_SettlementConsumption_Orphan into a
    // lookup per row.
    const row = SETTLEMENT_ORPHANS[0] as Record<string, unknown>
    for (const absent of ['entryNumber', 'storeName', 'currencyKey', 'ageDays'])
      expect(row[absent]).toBeUndefined()
    expect(row.settlementConsumptionId).toBeTruthy()
    expect(row.documentId).toBe('')
  })
})
