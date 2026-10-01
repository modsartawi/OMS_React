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

import type { SettlementChangeRequest } from '@/core/models/settlement'
import { projectAccount } from './account-projection'
import { auditColumn, changedTag, type AuditFact } from './audit'
import { REQUESTER, SUPERVISOR, UNSTAMPED, decidedRequest, waitingRequestOn } from './change-request-fixture'
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

/**
 * **Every change request joins the column** (ticket 350, spec 342 W11) — one fact per
 * step of each request, read from History and merged BY TIME with the entry's own facts.
 *
 * 0142/151 is the stage: posted 2026-08-11T09:02, a till took 200 at 2026-08-12T22:41.
 * Its requests are placed around those two so the merge, not the input order, decides
 * where each lands.
 */
describe('🔑 change requests in the column (350)', () => {
  const row = rowOf('0142', 151)
  const ask = (id: string, requestedAt: string, more: Parameters<typeof waitingRequestOn>[1] = {}) =>
    waitingRequestOn(row, { changeRequestId: id, requestedAt, ...more })

  const applied = decidedRequest(ask('R-APP', '2026-08-11T10:00:00', { newAmount: 300, requestReason: 'typed 320' }), {
    status: 'APPLIED',
    decidedAt: '2026-08-11T12:00:00',
  })
  const rejected = decidedRequest(ask('R-REJ', '2026-08-12T09:00:00', { newDescription: 'مرتجع' }), {
    status: 'REJECTED',
    decidedAt: '2026-08-12T15:00:00',
    decisionReason: 'no evidence attached',
  })
  const withdrawn = decidedRequest(ask('R-WDR', '2026-08-13T08:00:00', { newAmount: 250 }), {
    status: 'WITHDRAWN',
    decidedAt: '2026-08-13T08:30:00',
    decidedByStaffId: REQUESTER.staffId,
    decidedByName: REQUESTER.name,
  })
  const superseded = decidedRequest(ask('R-SUP', '2026-08-13T10:00:00', { requestKind: 'DELETE' }), {
    status: 'SUPERSEDED',
    decidedAt: '2026-08-14T09:00:00',
  })
  const waiting = ask('R-OPEN', '2026-08-15T11:00:00', { newAmount: 280, requestReason: 'recount' })
  // History lists newest first — the merge must not depend on it.
  const requests = [waiting, superseded, withdrawn, rejected, applied]

  it('each status yields its facts, interleaved by time with the posting and the till', () => {
    expect(auditColumn(row, requests).map((f) => `${f.at} ${f.kind}`)).toEqual([
      '2026-08-11T09:02:00 posted',
      '2026-08-11T10:00:00 requested',
      '2026-08-11T12:00:00 request-applied',
      '2026-08-12T09:00:00 requested',
      '2026-08-12T15:00:00 request-rejected',
      '2026-08-12T22:41:00 consumed',
      '2026-08-13T08:00:00 requested',
      '2026-08-13T08:30:00 request-withdrawn',
      '2026-08-13T10:00:00 requested',
      '2026-08-14T09:00:00 request-superseded',
      '2026-08-15T11:00:00 requested',
    ])
  })

  it('the order is the same whatever order History listed them in', () => {
    expect(auditColumn(row, [...requests].reverse())).toEqual(auditColumn(row, requests))
  })

  it('names the ACTOR under the name recorded then — the asker on a raise, the decider on a decision', () => {
    const column = auditColumn(row, requests)
    const of = (id: string, kind: AuditFact['kind']) => column.find((f) => f.id.includes(id) && f.kind === kind)
    expect(of('R-APP', 'requested')?.where).toEqual({ kind: 'person', name: REQUESTER.name })
    expect(of('R-APP', 'request-applied')?.where).toEqual({ kind: 'person', name: SUPERVISOR.name })
    expect(of('R-REJ', 'request-rejected')?.where).toEqual({ kind: 'person', name: SUPERVISOR.name })
    expect(of('R-WDR', 'request-withdrawn')?.where).toEqual({ kind: 'person', name: REQUESTER.name })
    expect(of('R-SUP', 'request-superseded')?.where).toEqual({ kind: 'person', name: SUPERVISOR.name })
  })

  it('…and falls back to the staff id only when the server recorded no name', () => {
    const nameless = { ...rejected, decidedByName: '' }
    expect(auditColumn(row, [nameless]).find((f) => f.kind === 'request-rejected')?.where).toEqual({
      kind: 'staff',
      staffId: SUPERVISOR.staffId,
    })
  })

  it('a raise carries the request’s Reason, a rejection its own — server text, verbatim', () => {
    const column = auditColumn(row, requests)
    expect(column.find((f) => f.id.includes('R-APP') && f.kind === 'requested')?.note).toBe('typed 320')
    expect(column.find((f) => f.kind === 'request-rejected')?.note).toBe('no evidence attached')
    expect(column.find((f) => f.id.includes('R-OPEN'))?.note).toBe('recount')
  })

  it('a raise and an application say what moved, old → new; the other decisions say only what was decided', () => {
    const column = auditColumn(row, requests)
    expect(column.find((f) => f.id.includes('R-APP') && f.kind === 'requested')?.request?.changes).toEqual([
      { field: 'amount', from: 320, to: 300 },
    ])
    expect(column.find((f) => f.kind === 'request-applied')?.request?.changes).toEqual([
      { field: 'amount', from: 320, to: 300 },
    ])
    expect(column.find((f) => f.kind === 'request-rejected')?.request?.changes).toEqual([])
    expect(column.find((f) => f.kind === 'request-superseded')?.request?.kind).toBe('DELETE')
  })

  it('🚩 a request fact states no figure of its own and no remainder — those are the till’s and the posting’s', () => {
    for (const f of auditColumn(row, requests).filter((f) => f.request)) {
      expect(f.amount).toBeNull()
      expect(f.remainingAfter).toBeNull()
      expect(f.document).toBeNull()
    }
  })

  it('🔑 a supervisor’s own request (decidedAt == requestedAt) is ONE applied fact, not a raise and an approval', () => {
    const own = decidedRequest(
      ask('R-OWN', '2026-08-12T23:00:00', {
        newAmount: 300,
        requestedByStaffId: SUPERVISOR.staffId,
        requestedByName: SUPERVISOR.name,
        requestReason: 'my own correction',
      }),
      { status: 'APPLIED', decidedAt: '2026-08-12T23:00:00' },
    )
    const facts = auditColumn(row, [own]).filter((f) => f.request)
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({
      kind: 'request-applied',
      at: '2026-08-12T23:00:00',
      where: { kind: 'person', name: SUPERVISOR.name },
      note: 'my own correction',
      request: { kind: 'CHANGE', own: true, changes: [{ field: 'amount', from: 320, to: 300 }] },
    })
    // …while an approval by someone else is not "own".
    expect(auditColumn(row, [applied]).find((f) => f.kind === 'request-applied')?.request?.own).toBe(false)
  })

  it('…but the same stamp by TWO people is a raise and an approval — "own" is both halves of 2194’s record', () => {
    const quick = decidedRequest(ask('R-FAST', '2026-08-12T23:00:00'), {
      status: 'APPLIED',
      decidedAt: '2026-08-12T23:00:00',
    })
    // …and the raise reads BEFORE its own approval in the same second.
    expect(auditColumn(row, [quick]).filter((f) => f.request).map((f) => f.kind)).toEqual([
      'requested',
      'request-applied',
    ])
    expect(auditColumn(row, [quick]).find((f) => f.kind === 'requested')?.where).toEqual({
      kind: 'person',
      name: REQUESTER.name,
    })
  })

  it('🔑 the POSTING states what it was posted at — the earliest applied change’s old figures, not today’s', () => {
    // Posted at 350 with another Description; changed to 320 (today's), then reworded.
    const first = {
      ...decidedRequest(ask('R-1', '2026-08-11T10:00:00'), { status: 'APPLIED', decidedAt: '2026-08-11T12:00:00' }),
      oldAmount: 350,
      newAmount: 320,
      oldDescription: 'as posted',
      newDescription: 'as posted',
    }
    const second = {
      ...decidedRequest(ask('R-2', '2026-08-13T10:00:00'), { status: 'APPLIED', decidedAt: '2026-08-13T11:00:00' }),
      oldAmount: 320,
      newAmount: 320,
      oldDescription: 'as posted',
      newDescription: row.reason,
    }
    const posted = auditColumn(row, [second, first]).find((f) => f.kind === 'posted')
    expect(posted?.amount).toBe(350)
    expect(posted?.note).toBe('as posted')
  })

  it('…while a request never applied leaves the posting at the entry’s own figures', () => {
    const posted = auditColumn(row, [rejected, withdrawn, superseded, waiting]).find((f) => f.kind === 'posted')
    expect(posted?.amount).toBe(row.amount)
    expect(posted?.note).toBe(row.reason)
  })

  it('🚩 an approved DELETE reads BEFORE the cancel it caused, never as a second cancel', () => {
    const cancelled = rowOf('0688', 147)
    const del = decidedRequest(
      waitingRequestOn(cancelled, { changeRequestId: 'R-DEL', requestKind: 'DELETE', requestedAt: '2026-08-09T10:00:00' }),
      { status: 'APPLIED', decidedAt: cancelled.closedAt },
    )
    const column = auditColumn(cancelled, [del])
    expect(column.slice(-2).map((f) => f.kind)).toEqual(['request-applied', 'cancelled'])
    expect(column.filter((f) => f.kind === 'cancelled')).toHaveLength(1)
    expect(column.find((f) => f.kind === 'request-applied')?.request).toMatchObject({ kind: 'DELETE', changes: [] })
  })

  it('⚠️ an unstamped time gets no row rather than a row at the top of time', () => {
    const unstampedAsk = ask('R-X', UNSTAMPED)
    const undecided = { ...applied, changeRequestId: 'R-Y', decidedAt: UNSTAMPED }
    const facts = auditColumn(row, [unstampedAsk, undecided]).filter((f) => f.request)
    expect(facts.map((f) => `${f.id} ${f.kind}`)).toEqual(['request:R-Y:asked requested'])
  })

  it('🚩 a decision stamped in the same second as its raise still sorts after it', () => {
    const same = decidedRequest(ask('R-Q', '2026-08-13T08:00:00'), {
      status: 'REJECTED',
      decidedAt: '2026-08-13T08:00:00',
      decisionReason: 'no',
    })
    expect(auditColumn(row, [same]).filter((f) => f.request).map((f) => f.kind)).toEqual([
      'requested',
      'request-rejected',
    ])
  })

  it('a request about ANOTHER entry is not drawn under this one', () => {
    const elsewhere = { ...waiting, settlementEntryId: 'not-151' }
    expect(auditColumn(row, [elsewhere]).some((f) => f.request)).toBe(false)
  })

  it('no History (a 404, still loading) leaves the column exactly as it was', () => {
    expect(auditColumn(row, undefined)).toEqual(auditColumn(row))
    expect(auditColumn(row, null)).toEqual(auditColumn(row))
    expect(auditColumn(row, [])).toEqual(auditColumn(row))
  })

  it('the entry’s own facts carry no request', () => {
    for (const f of auditColumn(row)) expect(f.request).toBeNull()
  })
})

/**
 * **The "Changed" tag — the till's rule (BackOffice 2197), read off History** (ticket 350,
 * spec 342 W11): the date is the latest APPLIED change's `decidedAt`; the earlier amount
 * is the `oldAmount` of the latest applied change that MOVED the amount.
 */
describe('🔑 changedTag (350)', () => {
  const row = rowOf('0142', 143)
  const tagOf = (requests: SettlementChangeRequest[] | null | undefined) =>
    changedTag(requests, row.settlementEntryId)
  const change = (
    id: string,
    oldAmount: number,
    newAmount: number,
    decidedAt: string,
    more: Partial<SettlementChangeRequest> = {},
  ): SettlementChangeRequest => ({
    ...decidedRequest(waitingRequestOn(row, { changeRequestId: id }), { status: 'APPLIED', decidedAt }),
    oldAmount,
    newAmount,
    ...more,
  })

  it('500 → 450 → 420 shows the earlier amount 450, at the second change’s date', () => {
    const first = change('R-1', 500, 450, '2026-09-01T10:00:00')
    const second = change('R-2', 450, 420, '2026-09-05T14:30:00')
    expect(tagOf([second, first])).toEqual({ at: '2026-09-05T14:30:00', earlierAmount: 450 })
    expect(tagOf([first, second])).toEqual({ at: '2026-09-05T14:30:00', earlierAmount: 450 })
  })

  it('🔑 an amount change then a description-only change keeps the amount’s earlier figure and the LATER date', () => {
    const amount = change('R-1', 350, 300, '2026-09-01T10:00:00')
    const words = change('R-2', 300, 300, '2026-09-03T09:00:00', { newDescription: 'نقص في تسليم — مصحح' })
    expect(tagOf([words, amount])).toEqual({ at: '2026-09-03T09:00:00', earlierAmount: 350 })
  })

  it('no applied change ⇒ no tag — waiting, rejected, withdrawn and superseded tag nothing', () => {
    expect(tagOf([])).toBeNull()
    expect(tagOf(null)).toBeNull()
    expect(tagOf(undefined)).toBeNull()
    expect(
      tagOf([
        waitingRequestOn(row, { newAmount: 450 }),
        { ...change('R-2', 500, 450, '2026-09-01T10:00:00'), status: 'REJECTED' },
        { ...change('R-3', 500, 450, '2026-09-02T10:00:00'), status: 'WITHDRAWN' },
        { ...change('R-4', 500, 450, '2026-09-03T10:00:00'), status: 'SUPERSEDED' },
      ]),
    ).toBeNull()
  })

  it('🚩 an applied DELETE is not a "Changed" tag — the entry is cancelled', () => {
    expect(tagOf([change('R-D', 500, 500, '2026-09-04T10:00:00', { requestKind: 'DELETE' })])).toBeNull()
    // …and it does not move the date of an earlier change either.
    const amount = change('R-1', 500, 450, '2026-09-01T10:00:00')
    const del = change('R-D', 450, 450, '2026-09-04T10:00:00', { requestKind: 'DELETE' })
    expect(tagOf([del, amount])).toEqual({ at: '2026-09-01T10:00:00', earlierAmount: 500 })
  })

  it('a change that never moved the amount is tagged with no earlier amount — the till’s "amount not changed"', () => {
    expect(
      tagOf([change('R-1', 500, 500, '2026-09-01T10:00:00', { newDescription: 'another description' })]),
    ).toEqual({ at: '2026-09-01T10:00:00', earlierAmount: null })
  })

  it('⚠️ "moved" is read at holding scale — a figure the same to the fils did not move', () => {
    expect(tagOf([change('R-1', 450, 450.0004, '2026-09-01T10:00:00')])).toEqual({
      at: '2026-09-01T10:00:00',
      earlierAmount: null,
    })
    expect(tagOf([change('R-1', 450, 449.999, '2026-09-01T10:00:00')])?.earlierAmount).toBe(450)
  })

  it('⚠️ an applied change with no decision stamp tags nothing rather than claiming the year 1', () => {
    expect(tagOf([change('R-1', 500, 450, UNSTAMPED)])).toBeNull()
  })

  it('🚩 a request about ANOTHER entry tags nothing — the same filter as the column', () => {
    const elsewhere = { ...change('R-1', 500, 450, '2026-09-01T10:00:00'), settlementEntryId: 'not-143' }
    expect(tagOf([elsewhere])).toBeNull()
  })

  it('a supervisor’s own change counts like any applied one', () => {
    const own = change('R-OWN', 500, 480, '2026-09-02T08:00:00', { requestedAt: '2026-09-02T08:00:00' })
    expect(tagOf([own])).toEqual({ at: '2026-09-02T08:00:00', earlierAmount: 500 })
  })
})
