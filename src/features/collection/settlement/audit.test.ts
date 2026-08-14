/**
 * **The audit pane's column of time** — that posting, consumption, void and
 * correction come back as one ordered list of the same kind of fact, with the store
 * code on a consumption and the poster's name on a posting (ticket 272's Proof,
 * spec 267 D6).
 *
 * Every case is one of the fixture's six hostile branches. 0455 carries the void,
 * 0688 carries both correction states, 0331 the orphan — so the pane is asserted on
 * the histories that are actually hard to render rather than on a posting with one
 * clean close behind it.
 */
import { describe, expect, it } from 'vitest'

import { projectAccount } from './account-projection'
import { auditColumn, type AuditFact } from './audit'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'

const rowOf = (code: string, entryNumber: number) => {
  const found = projectAccount(SETTLEMENT_ACCOUNTS[code]).find((r) => r.entryNumber === entryNumber)
  if (!found) throw new Error(`fixture ${code} has no entry ${entryNumber}`)
  return found
}
const columnOf = (code: string, entryNumber: number): AuditFact[] =>
  auditColumn(rowOf(code, entryNumber))

describe('one column of time', () => {
  it('opens with the POSTING — every entry begins with somebody deciding', () => {
    const column = columnOf('0142', 151)
    expect(column[0].kind).toBe('posted')
    expect(column[0].at).toBe('2026-08-11T09:02:00')
    expect(column[0].amount).toBe(320)
  })

  it('🔑 renders posting, consumption, void and correction as the same kind of fact', () => {
    // 0455 is the void's branch, 0688/133 the write-off's. Between them the four
    // kinds this pane claims to unify are all present, and each arrives as one row
    // of one shape rather than as four differently-shaped things.
    const kinds = [
      ...columnOf('0455', 141).map((f) => f.kind),
      ...columnOf('0688', 133).map((f) => f.kind),
      ...columnOf('0688', 147).map((f) => f.kind),
    ]
    expect(new Set(kinds)).toEqual(
      new Set(['posted', 'consumed', 'restored', 'written-off', 'cancelled']),
    )
  })

  it('orders by the facts’ OWN local timestamps — 0455’s four rows under their posting', () => {
    const column = columnOf('0455', 141)
    expect(column.map((f) => f.at)).toEqual([
      '2026-08-06T12:02:00', // posted
      '2026-08-08T19:40:00', // SR-0455-0011
      '2026-08-10T20:11:00', // SR-0455-0012
      '2026-08-10T20:58:00', // …voided 47 minutes later
      '2026-08-12T18:25:00', // SR-0455-0013
    ])
    expect([...column].sort((a, b) => (a.at < b.at ? -1 : 1))).toEqual(column)
  })

  it('⚠️ passes every timestamp through VERBATIM — nothing is parsed or converted', () => {
    // The pane's one unforgivable defect would be a three-hour lie: settlement
    // stamps are local wall clock and `UaAdminAudit`'s are UTC (D6). Reading a
    // stamp back unchanged is the guarantee that nothing between here and the
    // screen has decided it knows better.
    const row = rowOf('0688', 133)
    const stamps = auditColumn(row).map((f) => f.at)
    expect(stamps).toContain(row.postedAt)
    expect(stamps).toContain(row.closedAt)
    expect(stamps).toContain(row.journal[0].consumption.consumedAt)
  })

  it('🚩 is TOTALLY ordered — two facts sharing a stamp keep a stable order', () => {
    const row = rowOf('0455', 141)
    const forward = auditColumn(row).map((f) => f.id)
    const reversed = auditColumn({ ...row, journal: [...row.journal].reverse() }).map((f) => f.id)
    expect(reversed).toEqual(forward)
  })

  it('runs forward in time, exactly as the journal does — the two panes must agree', () => {
    const row = rowOf('0455', 141)
    const consumed = auditColumn(row)
      .filter((f) => f.document)
      .map((f) => f.id)
    expect(consumed).toEqual(row.journal.map((j) => `consumption:${j.consumption.settlementConsumptionId}`))
  })
})

describe('🔑 “from where”', () => {
  it('renders the STORE CODE for a consumption — which branch spent this', () => {
    const spent = columnOf('0455', 141).filter((f) => f.kind === 'consumed')
    expect(spent).not.toHaveLength(0)
    for (const fact of spent) expect(fact.where).toEqual({ kind: 'store', storeId: '0455' })
  })

  it('renders the POSTER’S NAME for a posting — denormalised, never resolved on read', () => {
    expect(columnOf('0142', 128).find((f) => f.kind === 'posted')?.where).toEqual({
      kind: 'person',
      name: 'سعد الدوسري / Saad Al-Dosari',
    })
  })

  it('🚩 renders a correction’s staff ID and no name — the wire carries no closer name', () => {
    expect(columnOf('0688', 147).find((f) => f.kind === 'cancelled')?.where).toEqual({
      kind: 'staff',
      staffId: '30124',
    })
  })

  it('⚠️ carries no address, no IP and no PostedFrom — none is owed', () => {
    for (const fact of columnOf('0455', 141)) {
      expect(Object.keys(fact.where)).toHaveLength(2)
      expect(JSON.stringify(fact)).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/)
    }
  })
})

describe('the corrections themselves', () => {
  it('a CANCELLED entry’s column ends with the cancellation and its reason', () => {
    const column = columnOf('0688', 147)
    const last = column[column.length - 1]
    expect(last.kind).toBe('cancelled')
    expect(last.at).toBe('2026-08-09T13:51:00')
    expect(last.note).toBe('قيد على الفرع الخطأ — أُعيد على 0455')
  })

  it('🔑 a write-off appears AFTER the consumption it left standing, not instead of it', () => {
    // The property 272's whole correction argument rests on: a write-off touches no
    // consumption, so the till's own row is still there, still saying it left
    // 400.000 standing, with the write-off after it in time.
    expect(columnOf('0688', 133).map((f) => f.kind)).toEqual(['posted', 'consumed', 'written-off'])
    expect(columnOf('0688', 133)[1].remainingAfter).toBe(400)
  })

  it('🚩 the write-off states WHAT WAS FORGIVEN — 269’s figure, not a second derivation', () => {
    // *How much was forgiven* is the number a reader opens this pane for, and it is
    // `writtenOff` — the journal's own last `remainingAfter`, read back off the
    // server by `projectAccount`. Deriving it again here (`amount − remaining`)
    // would be the one subtraction this feature forbids, in the one module nobody
    // would think to check for it.
    const row = rowOf('0688', 133)
    expect(columnOf('0688', 133).find((f) => f.kind === 'written-off')?.amount).toBe(row.writtenOff)
    expect(row.writtenOff).toBe(400)
  })

  it('🚩 …while a CANCELLED entry states no figure at all — a cancel forgives nothing', () => {
    expect(columnOf('0688', 147).find((f) => f.kind === 'cancelled')?.amount).toBeNull()
  })

  it('⚠️ a CONSUMED entry gets NO synthetic closing row — the last consumption is it', () => {
    // 0207/149 was consumed to zero across two closes. A "closed" fact beside the
    // second one would be the same event told twice with two different times.
    expect(columnOf('0207', 149).map((f) => f.kind)).toEqual(['posted', 'consumed', 'consumed'])
  })

  it('⚠️ a closed entry with no stamp gets no row rather than a row at the top of time', () => {
    const row = rowOf('0688', 147)
    const column = auditColumn({ ...row, closedAt: '' })
    expect(column.map((f) => f.kind)).toEqual(['posted'])
  })
})

describe('what a consumption row carries', () => {
  it('names an undocumented consumption through the journal’s OWN description', () => {
    // Reused rather than re-derived: two panes on one screen disagreeing about what
    // a blank document number means is exactly the drift `describeDocument` exists
    // to prevent (269 rule 1).
    const orphan = columnOf('0331', 137).find((f) => f.kind === 'consumed')
    expect(orphan?.document).toEqual({ kind: 'orphan' })
  })

  it('🔑 a REVERSE reads as RESTORED, and its remainder RISES', () => {
    const restored = columnOf('0455', 141).filter((f) => f.kind === 'restored')
    expect(restored).toHaveLength(1)
    expect(restored[0].amount).toBe(200)
    // 400 → 600: the tell a spend can never show (269 rule 2).
    expect(restored[0].remainingAfter).toBe(600)
  })

  it('🚩 states a remainder only where the SERVER wrote one', () => {
    for (const fact of columnOf('0688', 133))
      expect(fact.remainingAfter === null).toBe(fact.kind !== 'consumed' && fact.kind !== 'restored')
  })

  it('is null-tolerant — D8 is 274’s to confirm, and this app has no ErrorBoundary', () => {
    expect(auditColumn(null)).toEqual([])
    expect(auditColumn(undefined)).toEqual([])
    expect(auditColumn({ ...rowOf('0512', 119), journal: [] }).map((f) => f.kind)).toEqual(['posted'])
  })
})
