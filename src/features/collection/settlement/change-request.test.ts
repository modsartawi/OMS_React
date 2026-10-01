/**
 * **The change-request offer and the change body** — spec 342 W3 / W4, ticket 343's
 * Proof.
 *
 * 🔑 The suite walks W3's whole table — status × kind × spent × waiting × grant —
 * because later tickets (345–349) RENDER these cells rather than adding predicates
 * beside them. Every assertion is on the whole union value, so a cell that quietly
 * grew a second act fails here rather than on screen.
 */
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/core/api'
import type { SettlementEntryKind, SettlementEntryStatus } from '@/core/models/settlement'
import {
  afterDecide,
  afterRaise,
  afterWithdraw,
  asksBusinessDay,
  cardFor,
  changeDraftFor,
  changeRequestBody,
  decideFirst,
  deleteRequestBody,
  entryNow,
  changeRequestFailure,
  offerFor,
  paneRead,
  raisedRequest,
  raiseOutcome,
  reduceToSpent,
  rejectBody,
  removeSaidBy,
  type ChangeDraft,
  type ChangeRequestSession,
} from './change-request'
import { changeRefusal } from './change-refusal'
import {
  APPLIED_SAMPLE,
  BELOW_SPENT_SAMPLE,
  DELETE_SPENT_SAMPLE,
  NOT_REQUESTER_SAMPLE,
  REQUESTER,
  THEFT_DAY_COLLECTED_SAMPLE,
  UNSTAMPED,
  approvedAnswerFor,
  historyOf,
  raisedAnswerFor,
  rejectedAnswerFor,
  waitingRequestOn,
  withdrawnAnswerFor,
} from './change-request-fixture'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'
import { APPROVED_THEFT_ID, THEFT_ENTRIES } from './theft-fixture'

const ACCOUNTANT: ChangeRequestSession = { canOpenSettlement: true, canSuperviseSettlement: false, userId: 'u-accountant' }
const SUPERVISOR: ChangeRequestSession = { canOpenSettlement: true, canSuperviseSettlement: true, userId: 'u-supervisor' }
const NEITHER: ChangeRequestSession = { canOpenSettlement: false, canSuperviseSettlement: false, userId: 'u-reader' }

const entryOf = (code: string, entryNumber: number) => {
  const found = SETTLEMENT_ACCOUNTS[code].entries.find((e) => e.entryNumber === entryNumber)
  if (!found) throw new Error(`fixture ${code} has no entry ${entryNumber}`)
  return found
}

const anEntry = (o: { status: SettlementEntryStatus; entryKind?: SettlementEntryKind; amount?: number; remainingAmount?: number }) => ({
  entryKind: o.entryKind ?? ('SHORTAGE' as SettlementEntryKind),
  status: o.status,
  amount: o.amount ?? 500,
  remainingAmount: o.remainingAmount ?? o.amount ?? 500,
})

const KINDS: SettlementEntryKind[] = ['SHORTAGE', 'SURPLUS', 'THEFT']
const LIVE: SettlementEntryStatus[] = ['PENDING_APPROVAL', 'OPEN', 'CONSUMED']

describe('offerFor — a finished entry offers nothing, and says why per status (D2)', () => {
  const cases: [SettlementEntryStatus, string][] = [
    ['CANCELLED', 'cancelled'],
    ['CLOSED_OUT', 'written-off'],
    ['REJECTED', 'rejected'],
  ]
  for (const [status, because] of cases)
    for (const kind of KINDS)
      for (const session of [ACCOUNTANT, SUPERVISOR])
        it(`${status} ${kind}, ${session.canSuperviseSettlement ? 'supervisor' : 'accountant'} → finished: ${because}`, () => {
          expect(offerFor(anEntry({ status, entryKind: kind }), { openRequest: null, spentAmount: 0 }, session)).toEqual({
            kind: 'finished',
            because,
          })
        })

  it('🚩 finished wins over a request the server left open — no act is offered on a finished entry', () => {
    const entry = entryOf('0688', 147) // CANCELLED
    const request = waitingRequestOn(entry)
    expect(offerFor(entry, { openRequest: request, spentAmount: 0 }, SUPERVISOR)).toEqual({ kind: 'finished', because: 'cancelled' })
  })
})

describe('offerFor — no request waiting: the accountant asks, the supervisor acts now (W3 rows 3–4)', () => {
  for (const status of LIVE)
    for (const kind of KINDS) {
      it(`${status} ${kind}, nothing spent → accountant: Request a change · Request delete`, () => {
        expect(offerFor(anEntry({ status, entryKind: kind }), { openRequest: null, spentAmount: 0 }, ACCOUNTANT)).toEqual({
          kind: 'ask',
          mode: 'request',
          floor: 0,
          remove: { kind: 'delete' },
        })
      })
      it(`${status} ${kind}, nothing spent → supervisor: Change now · Delete now`, () => {
        expect(offerFor(anEntry({ status, entryKind: kind }), { openRequest: null, spentAmount: 0 }, SUPERVISOR)).toEqual({
          kind: 'ask',
          mode: 'now',
          floor: 0,
          remove: { kind: 'delete' },
        })
      })
      it(`${status} ${kind}, 120 spent of 500 → accountant: Request a change, delete replaced by "reduce to 120"`, () => {
        expect(
          offerFor(anEntry({ status, entryKind: kind, remainingAmount: 380 }), { openRequest: null, spentAmount: 120 }, ACCOUNTANT),
        ).toEqual({ kind: 'ask', mode: 'request', floor: 120, remove: { kind: 'reduce', to: 120 } })
      })
      it(`${status} ${kind}, 120 spent of 500 → supervisor: Change now, the same replacement`, () => {
        expect(
          offerFor(anEntry({ status, entryKind: kind, remainingAmount: 380 }), { openRequest: null, spentAmount: 120 }, SUPERVISOR),
        ).toEqual({ kind: 'ask', mode: 'now', floor: 120, remove: { kind: 'reduce', to: 120 } })
      })
    }

  it('🔑 a BHD entry spent by 0.001 is SPENT — no delete, reduce to 0.001', () => {
    const entry = entryOf('0688', 152) // 95.25 BHD, untouched on the account
    const offer = offerFor({ ...entry, remainingAmount: 95.249 }, { openRequest: null, spentAmount: 0.001 }, ACCOUNTANT)
    expect(offer).toEqual({ kind: 'ask', mode: 'request', floor: 0.001, remove: { kind: 'reduce', to: 0.001 } })
  })

  it('…while a float tail below the holding scale is not spending — 0.0004 reads as untouched', () => {
    const offer = offerFor(anEntry({ status: 'OPEN' }), { openRequest: null, spentAmount: 0.0004 }, ACCOUNTANT)
    expect(offer).toEqual({ kind: 'ask', mode: 'request', floor: 0, remove: { kind: 'delete' } })
  })

  it('🔑 spent is the SERVER\'s spentAmount, never amount − remaining computed here', () => {
    // 0142/151 is 320 with 120 left on the account; the server says it has spent 200.
    const entry = entryOf('0142', 151)
    expect(offerFor(entry, { openRequest: null, spentAmount: 200 }, ACCOUNTANT)).toEqual({
      kind: 'ask',
      mode: 'request',
      floor: 200,
      remove: { kind: 'reduce', to: 200 },
    })
    // …and if the server says nothing is spent, nothing is — whatever the row's arithmetic.
    expect(offerFor(entry, { openRequest: null, spentAmount: 0 }, ACCOUNTANT)).toMatchObject({ remove: { kind: 'delete' } })
  })

  it('a wholly spent (CONSUMED) entry has no figure to reduce to — "reduce" would change nothing', () => {
    const entry = entryOf('0207', 149) // CONSUMED surplus, 260 of 260 spent
    expect(offerFor(entry, { openRequest: null, spentAmount: 260 }, ACCOUNTANT)).toEqual({
      kind: 'ask',
      mode: 'request',
      floor: 260,
      remove: { kind: 'spent-whole', spent: 260 },
    })
  })

  it('a session holding neither grant is offered no act', () => {
    expect(offerFor(anEntry({ status: 'OPEN' }), { openRequest: null, spentAmount: 0 }, NEITHER)).toEqual({ kind: 'read-only' })
  })

  it('🚩 supervision without the settlement grant cannot raise — Raise is behind the settlement grant', () => {
    const session = { ...SUPERVISOR, canOpenSettlement: false }
    expect(offerFor(anEntry({ status: 'OPEN' }), { openRequest: null, spentAmount: 0 }, session)).toEqual({ kind: 'read-only' })
  })
})

describe('offerFor — a request waiting: the card, Withdraw for its requester, Approve/Reject for a supervisor', () => {
  const entry = entryOf('0142', 143)
  const request = waitingRequestOn(entry, { newAmount: 450, requestedByStaffId: 'u-accountant' })

  for (const status of LIVE)
    it(`${status}: the accountant who raised it gets the card with Withdraw`, () => {
      expect(offerFor({ ...entry, status }, { openRequest: request, spentAmount: 0 }, ACCOUNTANT)).toEqual({
        kind: 'waiting',
        request,
        withdraw: true,
        decide: false,
      })
    })

  it('another accountant gets the card and nothing to press', () => {
    const other = { ...ACCOUNTANT, userId: 'u-someone-else' }
    expect(offerFor(entry, { openRequest: request, spentAmount: 0 }, other)).toEqual({ kind: 'waiting', request, withdraw: false, decide: false })
  })

  it('a supervisor gets Approve / Reject, and no Withdraw on a request they did not raise', () => {
    expect(offerFor(entry, { openRequest: request, spentAmount: 0 }, SUPERVISOR)).toEqual({ kind: 'waiting', request, withdraw: false, decide: true })
  })

  it('…and Withdraw too, on one they raised themselves', () => {
    const theirs = { ...request, requestedByStaffId: 'u-supervisor' }
    expect(offerFor(entry, { openRequest: theirs, spentAmount: 0 }, SUPERVISOR)).toEqual({ kind: 'waiting', request: theirs, withdraw: true, decide: true })
  })

  it('🚩 a session whose user id is unknown is never the requester — not even of a request with no requester', () => {
    const blank = { ...request, requestedByStaffId: '' }
    expect(offerFor(entry, { openRequest: blank, spentAmount: 0 }, { ...ACCOUNTANT, userId: null })).toMatchObject({ withdraw: false })
    expect(offerFor(entry, { openRequest: blank, spentAmount: 0 }, { ...ACCOUNTANT, userId: '' })).toMatchObject({ withdraw: false })
  })

  it('the card is drawn even to a session with no grant — it is a fact about the entry', () => {
    expect(offerFor(entry, { openRequest: request, spentAmount: 0 }, NEITHER)).toEqual({ kind: 'waiting', request, withdraw: false, decide: false })
  })

  it('a waiting request on a SPENT entry is still the card, not the reduce offer', () => {
    expect(offerFor({ ...entry, remainingAmount: 380 }, { openRequest: request, spentAmount: 120 }, ACCOUNTANT)).toMatchObject({ kind: 'waiting' })
  })
})

describe('offerFor — Withdraw is the requester\'s, and only theirs (W6, ticket 345)', () => {
  const entry = entryOf('0142', 143)
  const byAccountant = waitingRequestOn(entry, { newAmount: 450, requestedByStaffId: 'u-accountant' })
  const bySupervisor = waitingRequestOn(entry, { newAmount: 450, requestedByStaffId: 'u-supervisor' })
  const read = (openRequest: typeof byAccountant, notRequesterOf?: string | null) => ({ openRequest, spentAmount: 0, notRequesterOf })

  it('🔑 the accountant who raised it: Withdraw; another accountant on the same request: none', () => {
    expect(offerFor(entry, read(byAccountant), ACCOUNTANT)).toMatchObject({ kind: 'waiting', withdraw: true, decide: false })
    expect(offerFor(entry, read(byAccountant), { ...ACCOUNTANT, userId: 'u-colleague' })).toMatchObject({ kind: 'waiting', withdraw: false, decide: false })
  })

  it('🔑 a supervisor who raised it: Withdraw beside Approve / Reject; on an accountant\'s: Approve / Reject only', () => {
    expect(offerFor(entry, read(bySupervisor), SUPERVISOR)).toMatchObject({ kind: 'waiting', withdraw: true, decide: true })
    expect(offerFor(entry, read(byAccountant), SUPERVISOR)).toMatchObject({ kind: 'waiting', withdraw: false, decide: true })
  })

  it('the match is exact after a trim — never re-cased (the live check of the claim is still open)', () => {
    expect(offerFor(entry, read({ ...byAccountant, requestedByStaffId: ' u-accountant ' }), ACCOUNTANT)).toMatchObject({ withdraw: true })
    expect(offerFor(entry, read({ ...byAccountant, requestedByStaffId: 'U-ACCOUNTANT' }), ACCOUNTANT)).toMatchObject({ withdraw: false })
  })

  it('the requester without the settlement grant is not offered it — Withdraw sits behind that grant (W1)', () => {
    expect(offerFor(entry, read(byAccountant), { ...NEITHER, userId: 'u-accountant' })).toMatchObject({ withdraw: false })
  })

  it('🚩 once the server answered NOT_REQUESTER on this request, Withdraw is no longer offered on it', () => {
    expect(offerFor(entry, read(byAccountant, byAccountant.changeRequestId), ACCOUNTANT)).toEqual({
      kind: 'waiting',
      request: byAccountant,
      withdraw: false,
      decide: false,
    })
  })

  it('…but a DIFFERENT request waiting later is judged afresh', () => {
    const later = { ...byAccountant, changeRequestId: 'R-later' }
    expect(offerFor(entry, read(later, byAccountant.changeRequestId), ACCOUNTANT)).toMatchObject({ withdraw: true })
  })

  it('…and the refused id does not touch a supervisor\'s Approve / Reject', () => {
    expect(offerFor(entry, read(bySupervisor, bySupervisor.changeRequestId), SUPERVISOR)).toMatchObject({ withdraw: false, decide: true })
  })
})

describe('afterWithdraw — withdrawn only when the answer says WITHDRAWN (2194)', () => {
  const entry = entryOf('0142', 143)
  const request = waitingRequestOn(entry, { changeRequestId: 'R1' })

  it('accepted, requestStatus WITHDRAWN → withdrawn', () => {
    expect(afterWithdraw(withdrawnAnswerFor(entry, request, 0))).toEqual({ kind: 'withdrawn' })
  })
  it('🚩 accepted but naming another status → unconfirmed: neither withdrawn nor a refusal the server never made', () => {
    expect(afterWithdraw({ ...withdrawnAnswerFor(entry, request, 0), requestStatus: 'OPEN' })).toEqual({ kind: 'unconfirmed' })
    expect(afterWithdraw({ ...withdrawnAnswerFor(entry, request, 0), requestStatus: '' })).toEqual({ kind: 'unconfirmed' })
  })
  it('a 200 refusal → refused with its code (2194\'s NOT_REQUESTER sample)', () => {
    expect(afterWithdraw(NOT_REQUESTER_SAMPLE)).toEqual({ kind: 'refused', code: 'NOT_REQUESTER' })
  })
  it('CHANGE_NOT_OPEN → refused with its code; the map words which end it met', () => {
    expect(afterWithdraw({ ...NOT_REQUESTER_SAMPLE, refusalReason: 'CHANGE_NOT_OPEN', requestStatus: 'SUPERSEDED' })).toEqual({ kind: 'refused', code: 'CHANGE_NOT_OPEN' })
  })
  it('no answer → refused with no code', () => {
    expect(afterWithdraw(undefined)).toEqual({ kind: 'refused', code: '' })
  })
})

describe('offerFor — no usable read decides nothing', () => {
  it('no History read at all → unstated', () => {
    expect(offerFor(anEntry({ status: 'OPEN' }), null, ACCOUNTANT)).toEqual({ kind: 'unstated' })
  })
  it('a read with no spentAmount (an older or a malformed answer, `{}`) → unstated, never a floor of 0', () => {
    expect(offerFor(anEntry({ status: 'OPEN' }), {}, ACCOUNTANT)).toEqual({ kind: 'unstated' })
    expect(offerFor(anEntry({ status: 'OPEN' }), { openRequest: null, spentAmount: Number.NaN }, ACCOUNTANT)).toEqual({ kind: 'unstated' })
  })
  it('no entry → unstated', () => {
    expect(offerFor(null, { openRequest: null, spentAmount: 0 }, ACCOUNTANT)).toEqual({ kind: 'unstated' })
  })
})

describe('changeRequestBody — only what differs is sent (W4)', () => {
  const entry = { settlementEntryId: 'E-143', amount: 500, description: 'نقص في تسليم يوم 2026-05-04', spentAmount: 0 }
  const draft = (o: Partial<{ amount: string; description: string; reason: string }> = {}) => ({
    amount: '500',
    description: entry.description,
    reason: 'wrong figure typed',
    ...o,
  })

  it('nothing differs → held, unchanged, and no field problem', () => {
    expect(changeRequestBody(entry, draft())).toEqual({ kind: 'held', amount: null, description: null, businessDay: null, reason: null, unchanged: true })
  })

  it('the amount alone → newAmount, and the description goes null', () => {
    expect(changeRequestBody(entry, draft({ amount: '300' }))).toEqual({
      kind: 'ready',
      body: { settlementEntryId: 'E-143', requestKind: 'CHANGE', newAmount: 300, newDescription: null, reason: 'wrong figure typed' },
    })
  })

  it('the description alone → newDescription (trimmed), and the amount goes null', () => {
    expect(changeRequestBody(entry, draft({ description: '  عجز نقدي — مراجعة سبتمبر  ' }))).toEqual({
      kind: 'ready',
      body: { settlementEntryId: 'E-143', requestKind: 'CHANGE', newAmount: null, newDescription: 'عجز نقدي — مراجعة سبتمبر', reason: 'wrong figure typed' },
    })
  })

  it('both → both', () => {
    const out = changeRequestBody(entry, draft({ amount: '1,240.5', description: 'x' }))
    expect(out).toMatchObject({ kind: 'ready', body: { newAmount: 1240.5, newDescription: 'x' } })
  })

  it('🔑 "nothing differs" is decided at holding scale — 500.0004 is 500', () => {
    expect(changeRequestBody(entry, draft({ amount: '500.0004' }))).toMatchObject({ kind: 'held', unchanged: true })
    expect(changeRequestBody(entry, draft({ amount: '500.000' }))).toMatchObject({ kind: 'held', unchanged: true })
  })

  it('…while one fils differs, and is sent at holding scale', () => {
    expect(changeRequestBody(entry, draft({ amount: '500.0006' }))).toMatchObject({ kind: 'ready', body: { newAmount: 500.001 } })
    expect(changeRequestBody({ ...entry, amount: 95.25 }, draft({ amount: '95.249' }))).toMatchObject({ kind: 'ready', body: { newAmount: 95.249 } })
  })

  it('a description differing only in surrounding spaces does not differ', () => {
    expect(changeRequestBody(entry, draft({ description: `  ${entry.description} ` }))).toMatchObject({ kind: 'held', unchanged: true })
  })

  for (const typed of ['0', '0.000', '-5', 'abc', '', '   ', '0.0004'])
    it(`a figure that is not above zero is refused in the form — "${typed}"`, () => {
      expect(changeRequestBody(entry, draft({ amount: typed }))).toMatchObject({ kind: 'held', amount: 'invalid' })
    })

  it('🔑 below the floor is refused — spent 350, 349.999 asked', () => {
    const spent = { ...entry, spentAmount: 350 }
    expect(changeRequestBody(spent, draft({ amount: '349.999' }))).toMatchObject({ kind: 'held', amount: 'below-floor' })
  })

  it('…and the floor itself is allowed (an entry may be lowered to exactly what was spent)', () => {
    const spent = { ...entry, spentAmount: 350 }
    expect(changeRequestBody(spent, draft({ amount: '350' }))).toMatchObject({ kind: 'ready', body: { newAmount: 350 } })
  })

  it('an entry whose own Description is blank or over 200 may still have its amount changed — an untouched Description is not checked', () => {
    const blank = { ...entry, description: '' }
    expect(changeRequestBody(blank, draft({ amount: '300', description: '' }))).toMatchObject({ kind: 'ready', body: { newAmount: 300, newDescription: null } })
    const long = { ...entry, description: 'x'.repeat(201) }
    expect(changeRequestBody(long, draft({ amount: '300', description: long.description }))).toMatchObject({ kind: 'ready', body: { newAmount: 300, newDescription: null } })
    expect(changeRequestBody(blank, draft({ description: '' }))).toMatchObject({ kind: 'held', description: null, unchanged: true })
  })

  it('a blank description is refused (the server\'s SettlementReasonRequired) — it would blank the red box', () => {
    expect(changeRequestBody(entry, draft({ description: '   ' }))).toMatchObject({ kind: 'held', description: 'blank' })
  })

  it('a description over 200 is refused', () => {
    expect(changeRequestBody(entry, draft({ description: 'x'.repeat(201) }))).toMatchObject({ kind: 'held', description: 'too-long' })
  })

  it('the Reason is required and ≤ 200, and goes trimmed', () => {
    expect(changeRequestBody(entry, draft({ amount: '300', reason: '  ' }))).toMatchObject({ kind: 'held', reason: 'blank', unchanged: false })
    expect(changeRequestBody(entry, draft({ amount: '300', reason: 'y'.repeat(201) }))).toMatchObject({ kind: 'held', reason: 'too-long' })
    expect(changeRequestBody(entry, draft({ amount: '300', reason: '  why  ' }))).toMatchObject({ kind: 'ready', body: { reason: 'why' } })
  })
})

describe('afterRaise — the outcome is read from the answer, never the probe (W1)', () => {
  const entry = entryOf('0142', 143)
  it('requestStatus OPEN → waiting', () => {
    expect(afterRaise(raisedAnswerFor(entry, { changeRequestId: 'R1' }, 0))).toEqual({ kind: 'waiting' })
  })
  it('requestStatus APPLIED (2191\'s sample) → applied', () => {
    expect(afterRaise(APPLIED_SAMPLE)).toEqual({ kind: 'applied' })
  })
  it('a 200 refusal → refused with its code (2192\'s BELOW_SPENT sample)', () => {
    expect(afterRaise(BELOW_SPENT_SAMPLE)).toEqual({ kind: 'refused', code: 'BELOW_SPENT' })
  })
  it('no answer → refused with no code', () => {
    expect(afterRaise(null)).toEqual({ kind: 'refused', code: '' })
  })
})

describe('raiseOutcome — a raise\'s redraw is read from the ANSWER, whatever the supervision flag (W1/W8, ticket 348)', () => {
  const row = entryOf('0142', 143)
  const history = historyOf(row, { spentAmount: 0 })
  const now = entryNow(row, history, null)
  const change = { settlementEntryId: row.settlementEntryId, requestKind: 'CHANGE' as const, newAmount: 300, newDescription: null, reason: 'typed 500 instead of 300' }
  const remove = { settlementEntryId: row.settlementEntryId, requestKind: 'DELETE' as const, reason: 'posted twice' }
  /** 2194: a supervisor's own change, applied in the same act — 2191's sample, about 143. */
  const applied = { ...APPLIED_SAMPLE, settlementEntryId: row.settlementEntryId }
  /** …and a supervisor's own delete: `entryStatus: "CANCELLED"`, its figures unchanged. */
  const appliedDelete = { ...raisedAnswerFor(row, { changeRequestId: 'R-DEL-NOW' }, 0), requestStatus: 'APPLIED' as const, entryStatus: 'CANCELLED' as const }
  const raised = raisedAnswerFor(row, { changeRequestId: 'R-NEW' }, 0)
  const asSession = (s: ChangeRequestSession) => ({ ...s, displayName: 'Huda' })
  const label = (s: ChangeRequestSession) => (s.canSuperviseSettlement ? 'supervision flag on' : 'supervision flag off')

  for (const session of [ACCOUNTANT, SUPERVISOR]) {
    it(`🔑 APPLIED → redraw the corrected entry with NO card (${label(session)})`, () => {
      const out = raiseOutcome(now, change, applied, asSession(session))
      expect(out.kind).toBe('applied')
      expect(out.answered).toEqual({ result: applied, request: null })
      const read = paneRead(row, history, out.answered)
      expect(read.openRequest).toBeNull()
      expect(read.now).toMatchObject({ amount: 300, remainingAmount: 300, description: applied.description, status: 'OPEN' })
      // The redraw offers the next act on the corrected entry — never a card.
      expect(offerFor(read.now, read, session).kind).toBe('ask')
    })

    it(`🔑 an APPLIED delete → the entry is drawn CANCELLED, finished, no card (${label(session)})`, () => {
      const out = raiseOutcome(now, remove, appliedDelete, asSession(session))
      expect(out.kind).toBe('applied')
      const read = paneRead(row, history, out.answered)
      expect(read.openRequest).toBeNull()
      expect(offerFor(read.now, read, session)).toEqual({ kind: 'finished', because: 'cancelled' })
    })

    it(`🔑 OPEN → the card, as for anyone — even for a supervisor's own raise (${label(session)})`, () => {
      const out = raiseOutcome(now, change, raised, asSession(session))
      expect(out.kind).toBe('waiting')
      expect(out.answered.request).toMatchObject({ changeRequestId: 'R-NEW', status: 'OPEN', oldAmount: 500, newAmount: 300, requestedByStaffId: session.userId, requestedByName: 'Huda' })
      const read = paneRead(row, history, out.answered)
      const offer = offerFor(read.now, read, session)
      expect(offer).toMatchObject({ kind: 'waiting', withdraw: true, decide: session.canSuperviseSettlement })
    })

    it(`a refusal stores nothing and says nothing about what waits — History's word stands (${label(session)})`, () => {
      // 2194: a supervisor's own refusals store nothing — `changeRequestId: ''`.
      const refused = { ...BELOW_SPENT_SAMPLE, changeRequestId: '', requestStatus: '' as const, settlementEntryId: row.settlementEntryId, entryNumber: 143 }
      const out = raiseOutcome(now, change, refused, asSession(session))
      expect(out).toEqual({ kind: 'refused', code: 'BELOW_SPENT', answered: { result: refused } })
      expect('request' in out.answered).toBe(false)
    })

    for (const code of ['BELOW_SPENT', 'DELETE_SPENT', 'ENTRY_FINAL', 'NO_CHANGE', 'CHANGE_STALE'] as const)
      it(`${code} on a raise that stores nothing: refused, and said by 344's map by its code (${label(session)})`, () => {
        const base = code === 'DELETE_SPENT' ? DELETE_SPENT_SAMPLE : BELOW_SPENT_SAMPLE
        const refused = { ...base, refusalReason: code, changeRequestId: '', requestStatus: '' as const, settlementEntryId: row.settlementEntryId, entryNumber: 143 }
        const out = raiseOutcome(now, code === 'DELETE_SPENT' ? remove : change, refused, asSession(session))
        expect(out).toMatchObject({ kind: 'refused', code })
        const said = changeRefusal('raise', refused)
        expect(said.code).toBe(code)
        expect(said.words.kind).toBe('key')
      })
  }

  it('the whole redraw is the same whichever flag is passed — the answer alone decides it', () => {
    const asUser = (canSuperviseSettlement: boolean) => ({ ...ACCOUNTANT, canSuperviseSettlement, displayName: 'Huda' })
    for (const answer of [applied, appliedDelete, raised])
      expect(raiseOutcome(now, change, answer, asUser(true))).toEqual(raiseOutcome(now, change, answer, asUser(false)))
  })

  it('🔑 a supervisor\'s raise refused CHANGE_ALREADY_OPEN: the re-read\'s accountant request is drawn, with Approve / Reject', () => {
    const theirs = waitingRequestOn(row, { changeRequestId: 'R-THEIRS', newAmount: 450 })
    const refused = { ...APPLIED_SAMPLE, accepted: false, refusalReason: 'CHANGE_ALREADY_OPEN', changeRequestId: 'R-THEIRS', requestStatus: 'OPEN' as const, settlementEntryId: row.settlementEntryId, amount: 500, remainingAmount: 500 }
    const out = raiseOutcome(now, change, refused, asSession(SUPERVISOR))
    expect(out.kind).toBe('refused')
    const reread = historyOf(row, { spentAmount: 0, openRequest: theirs })
    const read = paneRead(row, reread, out.answered)
    expect(offerFor(read.now, read, SUPERVISOR)).toMatchObject({ kind: 'waiting', request: { changeRequestId: 'R-THEIRS' }, withdraw: false, decide: true })
  })

  it('no display name: the requester is named by the user id', () => {
    const out = raiseOutcome(now, change, raised, { ...ACCOUNTANT, displayName: null })
    expect(out.answered.request).toMatchObject({ requestedByStaffId: 'u-accountant', requestedByName: 'u-accountant' })
  })
})

describe('decideFirst — a supervisor blocked by a waiting request is told to decide THAT one first (ticket 348)', () => {
  const row = entryOf('0142', 143)
  const theirs = waitingRequestOn(row, { changeRequestId: 'R-THEIRS' })
  const blocked = (changeRequestId: string) =>
    changeRefusal('raise', { refusalReason: 'CHANGE_ALREADY_OPEN', changeRequestId, settlementEntryId: row.settlementEntryId })
  const card = (o: Partial<{ request: typeof theirs; withdraw: boolean; decide: boolean }> = {}) =>
    ({ kind: 'waiting', request: theirs, withdraw: false, decide: true, ...o }) as const

  it('🔑 the named request\'s card, with Approve / Reject → said', () => {
    expect(decideFirst(blocked('R-THEIRS'), card())).toBe(true)
  })
  it('a DIFFERENT request waiting by the re-read → not said: it is not the one that blocked', () => {
    expect(decideFirst(blocked('R-THEIRS'), card({ request: { ...theirs, changeRequestId: 'R-LATER' } }))).toBe(false)
  })
  it('2194\'s race (no id named) → said of whatever waits now', () => {
    expect(decideFirst(blocked(''), card())).toBe(true)
  })
  it('an accountant (no decide) → not said: they cannot decide it', () => {
    expect(decideFirst(blocked('R-THEIRS'), card({ decide: false }))).toBe(false)
  })
  it('the session\'s own request (withdraw) → not said: that one is withdrawn, not decided first', () => {
    expect(decideFirst(blocked('R-THEIRS'), card({ withdraw: true }))).toBe(false)
  })
  it('any other refusal, no refusal, or no card → not said', () => {
    expect(decideFirst(changeRefusal('raise', { refusalReason: 'CHANGE_STALE' }), card())).toBe(false)
    expect(decideFirst(changeRefusal('approve', { refusalReason: 'ENTRY_NOT_OPEN', settlementEntryId: row.settlementEntryId }), card())).toBe(false)
    expect(decideFirst(null, card())).toBe(false)
    expect(decideFirst(blocked('R-THEIRS'), { kind: 'ask', mode: 'now', floor: 0, remove: { kind: 'delete' } })).toBe(false)
  })
})

describe('entryNow — the answer, then the History read, then the row (W8)', () => {
  const row = entryOf('0142', 143)

  it('the row alone — no spent figure is invented', () => {
    expect(entryNow(row, null, null)).toMatchObject({ amount: 500, status: 'OPEN', description: row.reason, spentAmount: null })
  })

  it('the History read\'s figures beat the row\'s, and carry the spent figure', () => {
    const history = { ...historyOf(row, { spentAmount: 0 }), amount: 450, remainingAmount: 450 }
    expect(entryNow(row, history, null)).toMatchObject({ amount: 450, remainingAmount: 450, spentAmount: 0, description: row.reason })
  })

  it('a History read of no such entry (entryStatus \'\') leaves the row\'s figures', () => {
    const history = { ...historyOf(row, { spentAmount: 0 }), entryStatus: '' as const, amount: 0, remainingAmount: 0 }
    expect(entryNow(row, history, null)).toMatchObject({ amount: 500, spentAmount: 0 })
  })

  it('🔑 the act answer beats both — the pane redraws from it before the re-read lands', () => {
    const history = historyOf(row, { spentAmount: 0 })
    const answer = { ...APPLIED_SAMPLE, settlementEntryId: row.settlementEntryId }
    expect(entryNow(row, history, answer)).toMatchObject({ amount: 300, remainingAmount: 300, spentAmount: 0, description: 'عجز نقدي — مراجعة سبتمبر', status: 'OPEN' })
  })

  it('…but never an answer about another entry', () => {
    expect(entryNow(row, null, APPLIED_SAMPLE)).toMatchObject({ amount: 500, spentAmount: null })
  })
})

describe('cardFor — old → new, only what differs (W6)', () => {
  const entry = entryOf('0142', 143)

  it('an amount change names only the amount', () => {
    const card = cardFor(waitingRequestOn(entry, { newAmount: 450 }))
    expect(card.changes).toEqual([{ field: 'amount', from: 500, to: 450 }])
    expect(card).toMatchObject({ kind: 'CHANGE', by: REQUESTER.name, at: '2026-09-30T10:42:00' })
  })

  it('a description change names only the description', () => {
    const card = cardFor(waitingRequestOn(entry, { newDescription: 'عجز نقدي — مراجعة سبتمبر' }))
    expect(card.changes).toEqual([{ field: 'description', from: entry.reason, to: 'عجز نقدي — مراجعة سبتمبر' }])
  })

  it('amounts equal at holding scale are not a change', () => {
    expect(cardFor(waitingRequestOn(entry, { newAmount: 500.0004 })).changes).toEqual([])
  })

  it('a day move names the day', () => {
    const theft = { ...entry, businessDay: '2025-08-11T00:00:00' }
    const card = cardFor(waitingRequestOn(theft, { newBusinessDay: '2025-08-12T00:00:00' }))
    expect(card.changes).toEqual([{ field: 'businessDay', from: '2025-08-11T00:00:00', to: '2025-08-12T00:00:00' }])
  })

  it('an unstamped time is no time', () => {
    expect(cardFor(waitingRequestOn(entry, { requestedAt: UNSTAMPED })).at).toBeNull()
    expect(cardFor(waitingRequestOn(entry, { requestedAt: '' })).at).toBeNull()
  })
})

describe('raisedRequest — the card drawn from the answer before History is re-read', () => {
  const entry = entryOf('0142', 143)
  const now = entryNow(entry, historyOf(entry, { spentAmount: 0 }), null)
  const body = { settlementEntryId: entry.settlementEntryId, requestKind: 'CHANGE' as const, newAmount: 450, newDescription: null, reason: 'typo' }

  it('old is the entry as it was sent, new is what was asked, the id is the answer\'s', () => {
    const answer = raisedAnswerFor(entry, { changeRequestId: 'R-NEW' }, 0)
    const request = raisedRequest(now, body, answer, { staffId: 'u-accountant', name: 'Huda' })
    expect(request).toMatchObject({
      changeRequestId: 'R-NEW',
      status: 'OPEN',
      requestKind: 'CHANGE',
      oldAmount: 500,
      newAmount: 450,
      oldDescription: entry.reason,
      newDescription: entry.reason,
      requestedByStaffId: 'u-accountant',
      requestedByName: 'Huda',
      requestReason: 'typo',
    })
    // 🚩 No clock here: the time is the server's, and it arrives with the re-read.
    expect(cardFor(request).at).toBeNull()
    expect(cardFor(request).changes).toEqual([{ field: 'amount', from: 500, to: 450 }])
  })
})

describe('changeRequestFailure — a 404 means SIS.Api has not shipped the wave', () => {
  it('404 → not-shipped', () => {
    expect(changeRequestFailure(new ApiError('business', 'Not Found', 404))).toBe('not-shipped')
    expect(changeRequestFailure(new ApiError('unknown', 'Not Found', 404))).toBe('not-shipped')
  })
  it('a bare 403 → forbidden (approval.ts\'s supervisionFailure)', () => {
    expect(changeRequestFailure(new ApiError('unknown', '', 403))).toBe('forbidden')
  })
  it('anything else → other', () => {
    expect(changeRequestFailure(new ApiError('server', 'boom', 500))).toBe('other')
    expect(changeRequestFailure(new Error('x'))).toBe('other')
  })
})

describe('afterDecide — what an approve or a reject came back with, read from the answer (ticket 346)', () => {
  const entry = entryOf('0142', 151)
  const request = waitingRequestOn(entry, { changeRequestId: 'R-151', newAmount: 300 })

  it('🔑 an approve is decided only when the answer says APPLIED (2191\'s sample)', () => {
    expect(afterDecide('approve', APPLIED_SAMPLE)).toEqual({ kind: 'decided' })
  })
  it('a reject is decided only when the answer says REJECTED', () => {
    expect(afterDecide('reject', rejectedAnswerFor(entry, request, 200))).toEqual({ kind: 'decided' })
  })
  it('🚩 accepted but naming another status → unconfirmed, never a decision the server did not state', () => {
    expect(afterDecide('approve', rejectedAnswerFor(entry, request, 200))).toEqual({ kind: 'unconfirmed' })
    expect(afterDecide('reject', APPLIED_SAMPLE)).toEqual({ kind: 'unconfirmed' })
    expect(afterDecide('approve', raisedAnswerFor(entry, request, 200))).toEqual({ kind: 'unconfirmed' })
  })
  it('a 200 refusal → refused with its code (2192\'s BELOW_SPENT sample, the request still OPEN)', () => {
    expect(afterDecide('approve', BELOW_SPENT_SAMPLE)).toEqual({ kind: 'refused', code: 'BELOW_SPENT' })
  })
  it('no answer → refused with no code', () => {
    expect(afterDecide('reject', null)).toEqual({ kind: 'refused', code: '' })
  })
})

describe('paneRead — the act answer redraws the pane before the re-read lands (W8, ticket 346)', () => {
  const entry = entryOf('0142', 151)
  const request = waitingRequestOn(entry, { changeRequestId: 'R-151', newAmount: 300 })
  const history = historyOf(entry, { spentAmount: 200, openRequest: request })

  it('with no answer, History\'s figures and its waiting request stand', () => {
    const read = paneRead(entry, history, null)
    expect(read.openRequest).toBe(request)
    expect(read.now).toMatchObject({ amount: 320, remainingAmount: 120, spentAmount: 200, status: 'OPEN' })
    expect(offerFor(read.now, read, SUPERVISOR)).toEqual({ kind: 'waiting', request, withdraw: false, decide: true })
  })

  it('🔑 an accepted approve REPLACES the figures, and the card goes — the answer says nothing waits', () => {
    const result = approvedAnswerFor(entry, request, 200, { amount: 300, remainingAmount: 100 })
    const read = paneRead(entry, history, { result, request: null })
    expect(read.openRequest).toBeNull()
    expect(read.now).toMatchObject({ amount: 300, remainingAmount: 100, spentAmount: 200, status: 'OPEN' })
    expect(offerFor(read.now, read, SUPERVISOR)).toEqual({ kind: 'ask', mode: 'now', floor: 200, remove: { kind: 'reduce', to: 200 } })
  })

  it('an OPEN entry lowered to exactly its spent figure becomes CONSUMED — the answer\'s status, not one derived here', () => {
    const result = approvedAnswerFor(entry, request, 200, { amount: 200, remainingAmount: 0, entryStatus: 'CONSUMED' })
    expect(paneRead(entry, history, { result, request: null }).now).toMatchObject({ status: 'CONSUMED', amount: 200, remainingAmount: 0 })
  })

  it('🚩 a pending entry stays PENDING_APPROVAL — approving a change never approves the entry (2192)', () => {
    const pending = { ...entry, status: 'PENDING_APPROVAL' as const, amount: 600, remainingAmount: 600 }
    const result = approvedAnswerFor(pending, request, 0, { amount: 550, remainingAmount: 550 })
    const read = paneRead(pending, historyOf(pending, { spentAmount: 0, openRequest: request }), { result, request: null })
    expect(read.now).toMatchObject({ status: 'PENDING_APPROVAL', amount: 550 })
  })

  it('an approved delete answers CANCELLED (2193) — the pane says the entry is finished at once', () => {
    const result = approvedAnswerFor(entry, request, 0, { entryStatus: 'CANCELLED' })
    const read = paneRead(entry, history, { result, request: null })
    expect(offerFor(read.now, read, SUPERVISOR)).toEqual({ kind: 'finished', because: 'cancelled' })
  })

  it('🔑 a refused approve keeps the request OPEN on the card, with its refusal and TODAY\'s spent figure', () => {
    const result = { ...BELOW_SPENT_SAMPLE, settlementEntryId: entry.settlementEntryId, entryNumber: 151, amount: 320, remainingAmount: 0, spentAmount: 320 }
    // A refusal says nothing about what waits: `request` is left unset, so History's word stands.
    const read = paneRead(entry, history, { result })
    expect(read.openRequest).toBe(request)
    expect(read.now).toMatchObject({ spentAmount: 320, remainingAmount: 0 })
    expect(offerFor(read.now, read, SUPERVISOR)).toEqual({ kind: 'waiting', request, withdraw: false, decide: true })
    expect(changeRefusal('approve', result)).toMatchObject({ code: 'BELOW_SPENT', spent: 320, step: { kind: 'reject' } })
  })

  it('a rejected request goes, and the entry\'s figures are the answer\'s — unchanged', () => {
    const read = paneRead(entry, history, { result: rejectedAnswerFor(entry, request, 200), request: null })
    expect(read.openRequest).toBeNull()
    expect(read.now).toMatchObject({ amount: 320, remainingAmount: 120, spentAmount: 200 })
  })

  it('…but never an answer about another entry — neither its figures nor what it says waits', () => {
    const read = paneRead(entry, history, { result: APPLIED_SAMPLE, request: null })
    expect(read.openRequest).toBe(request)
    expect(read.now).toMatchObject({ amount: 320, spentAmount: 200 })
  })
})

describe('rejectBody — rejecting needs a Reason (W6, ticket 346)', () => {
  const request = waitingRequestOn(entryOf('0142', 151), { changeRequestId: 'R-151' })

  it('a blank Reason, or one of spaces, is held', () => {
    expect(rejectBody(request, '')).toEqual({ kind: 'held', problem: 'blank' })
    expect(rejectBody(request, '   ')).toEqual({ kind: 'held', problem: 'blank' })
  })
  it('a Reason over 200 is held', () => {
    expect(rejectBody(request, 'x'.repeat(201))).toEqual({ kind: 'held', problem: 'too-long' })
  })
  it('🔑 the body is { changeRequestId, reason }, the Reason trimmed — nothing about the entry', () => {
    expect(rejectBody(request, '  spent past it already  ')).toEqual({
      kind: 'ready',
      body: { changeRequestId: 'R-151', reason: 'spent past it already' },
    })
  })
})

describe('deleteRequestBody — a delete asks for a Reason only, and sends no figure (W5, ticket 347)', () => {
  const entry = { settlementEntryId: 'E-143' }

  it('🔑 requestKind DELETE and the Reason trimmed — and no figure field at all, not even null', () => {
    const check = deleteRequestBody(entry, '  posted against the wrong branch  ')
    expect(check).toEqual({
      kind: 'ready',
      body: { settlementEntryId: 'E-143', requestKind: 'DELETE', reason: 'posted against the wrong branch' },
    })
    // 2193 400s SettlementDeleteTakesNoFigures on a named figure, even "" — so none is named.
    if (check.kind !== 'ready') throw new Error('expected ready')
    expect(Object.keys(check.body).sort()).toEqual(['reason', 'requestKind', 'settlementEntryId'])
  })
  it('a blank Reason, or one of spaces, is held', () => {
    expect(deleteRequestBody(entry, '')).toEqual({ kind: 'held', problem: 'blank' })
    expect(deleteRequestBody(entry, '   ')).toEqual({ kind: 'held', problem: 'blank' })
  })
  it('a Reason over 200 is held', () => {
    expect(deleteRequestBody(entry, 'x'.repeat(201))).toEqual({ kind: 'held', problem: 'too-long' })
  })
})

describe('reduceToSpent — "Reduce it to X" fills the change form with the spent figure (W5, ticket 347)', () => {
  const entry = { settlementEntryId: 'E-151', amount: 500, description: 'فائض نقدي — مراجعة سبتمبر', businessDay: UNSTAMPED }

  it('🔑 from the History read: offerFor\'s reduce cell → the draft whose newAmount is the spent figure', () => {
    const offer = offerFor(anEntry({ status: 'OPEN', amount: 500, remainingAmount: 380 }), { openRequest: null, spentAmount: 120 }, ACCOUNTANT)
    if (offer.kind !== 'ask' || offer.remove.kind !== 'reduce') throw new Error(`expected the reduce cell, got ${JSON.stringify(offer)}`)
    const draft = reduceToSpent(entry, offer.remove)
    expect(draft).toEqual({ amount: '120', description: entry.description, reason: '', businessDay: '' })
    expect(changeRequestBody({ ...entry, spentAmount: 120 }, { ...draft, reason: 'only 120 was ever owed' })).toEqual({
      kind: 'ready',
      body: { settlementEntryId: 'E-151', requestKind: 'CHANGE', newAmount: 120, newDescription: null, reason: 'only 120 was ever owed' },
    })
  })

  it('🔑 from a DELETE_SPENT answer: 344\'s reduce step, X the ANSWER\'s spentAmount (2193\'s sample)', () => {
    const refusal = changeRefusal('raise', DELETE_SPENT_SAMPLE)
    if (refusal.step.kind !== 'reduce') throw new Error(`expected the reduce step, got ${JSON.stringify(refusal.step)}`)
    const draft = reduceToSpent({ description: DELETE_SPENT_SAMPLE.description, businessDay: DELETE_SPENT_SAMPLE.businessDay }, refusal.step)
    expect(draft.amount).toBe('120')
    const check = changeRequestBody(
      { settlementEntryId: DELETE_SPENT_SAMPLE.settlementEntryId, amount: 500, description: DELETE_SPENT_SAMPLE.description, spentAmount: 120 },
      { ...draft, reason: 'x' },
    )
    expect(check.kind === 'ready' && check.body.newAmount).toBe(120)
  })

  it('🔑 a BHD entry spent by 0.001: the draft asks for 0.001, exactly the floor, and is ready', () => {
    const offer = offerFor(anEntry({ status: 'OPEN', amount: 50, remainingAmount: 49.999 }), { openRequest: null, spentAmount: 0.001 }, ACCOUNTANT)
    if (offer.kind !== 'ask' || offer.remove.kind !== 'reduce') throw new Error('expected the reduce cell')
    const draft = reduceToSpent({ description: 'd', businessDay: UNSTAMPED }, offer.remove, 'posted twice')
    expect(draft).toEqual({ amount: '0.001', description: 'd', reason: 'posted twice', businessDay: '' })
    const check = changeRequestBody({ settlementEntryId: 'E', amount: 50, description: 'd', spentAmount: 0.001 }, draft)
    expect(check).toEqual({
      kind: 'ready',
      body: { settlementEntryId: 'E', requestKind: 'CHANGE', newAmount: 0.001, newDescription: null, reason: 'posted twice' },
    })
  })

  it('the figure is written at holding scale — a float tail never reaches the box', () => {
    expect(reduceToSpent({ description: '', businessDay: UNSTAMPED }, { kind: 'reduce', to: 120.10000000000001 }).amount).toBe('120.1')
  })

  it('a Reason typed for the refused delete is carried into the change form, to be edited there', () => {
    expect(reduceToSpent({ description: 'd', businessDay: UNSTAMPED }, { kind: 'reduce', to: 120 }, 'entry posted in error').reason).toBe('entry posted in error')
  })
})

describe('a delete through the pane\'s pure steps (ticket 347)', () => {
  const entry = entryOf('0142', 143)
  const request = waitingRequestOn(entry, { changeRequestId: 'R-DEL', requestKind: 'DELETE' })

  it('the card for a waiting delete names the kind and no figure — a delete lands none (2193)', () => {
    expect(cardFor(request)).toMatchObject({ kind: 'DELETE', changes: [] })
  })

  it('the card drawn from an accepted delete\'s answer is a DELETE, its new figures the old ones', () => {
    const now = entryNow(entry, historyOf(entry, { spentAmount: 0 }), null)
    const check = deleteRequestBody(now, 'posted twice')
    if (check.kind !== 'ready') throw new Error('expected ready')
    const drawn = raisedRequest(now, check.body, raisedAnswerFor(entry, { changeRequestId: 'R-DEL' }, 0), { staffId: 'u', name: 'u' })
    expect(drawn).toMatchObject({ requestKind: 'DELETE', newAmount: drawn.oldAmount, newDescription: drawn.oldDescription })
    expect(cardFor(drawn).changes).toEqual([])
  })

  it('🔑 an approved delete redraws the entry as CANCELLED from the answer — finished, nothing offered', () => {
    const history = historyOf(entry, { spentAmount: 0, openRequest: request })
    const answer = approvedAnswerFor(entry, request, 0, { entryStatus: 'CANCELLED' })
    expect(afterDecide('approve', answer)).toEqual({ kind: 'decided' })
    const read = paneRead(entry, history, { result: answer, request: null })
    expect(read.now).toMatchObject({ status: 'CANCELLED', amount: entry.amount, spentAmount: 0 })
    expect(offerFor(read.now, read, SUPERVISOR)).toEqual({ kind: 'finished', because: 'cancelled' })
  })
})

describe('removeSaidBy — the spent sentence is said once, never twice nor stale (ticket 347)', () => {
  const deleteSpent = changeRefusal('raise', DELETE_SPENT_SAMPLE)

  it('🔑 a DELETE_SPENT refusal naming the same spent figure already says the cell\'s sentence', () => {
    expect(removeSaidBy({ kind: 'reduce', to: 120 }, deleteSpent)).toBe(true)
  })
  it('…and for a wholly spent entry too (its step is none, its sentence the same)', () => {
    const whole = changeRefusal('raise', { ...DELETE_SPENT_SAMPLE, spentAmount: 500 })
    expect(whole.step).toEqual({ kind: 'none' })
    expect(removeSaidBy({ kind: 'spent-whole', spent: 500 }, whole)).toBe(true)
  })
  it('🔑 a re-read stating a different spent figure is newer — the cell says its own, with its own X', () => {
    expect(removeSaidBy({ kind: 'reduce', to: 150 }, deleteSpent)).toBe(false)
  })
  it('equal at holding scale is the same figure', () => {
    expect(removeSaidBy({ kind: 'reduce', to: 120.0004 }, deleteSpent)).toBe(true)
  })
  it('🚩 any other refusal says something else — the cell keeps its sentence', () => {
    expect(removeSaidBy({ kind: 'reduce', to: 350 }, changeRefusal('raise', BELOW_SPENT_SAMPLE))).toBe(false)
    expect(removeSaidBy({ kind: 'reduce', to: 120 }, changeRefusal('raise', { ...DELETE_SPENT_SAMPLE, refusalReason: 'NO_CHANGE' }))).toBe(false)
  })
  it('a DELETE_SPENT with no figure, or no refusal at all, says nothing of X', () => {
    expect(removeSaidBy({ kind: 'reduce', to: 120 }, changeRefusal('raise', { ...DELETE_SPENT_SAMPLE, spentAmount: Number.NaN }))).toBe(false)
    expect(removeSaidBy({ kind: 'reduce', to: 120 }, null)).toBe(false)
  })
})

describe('changeRequestBody — a theft\'s business day (W4, ticket 349; BackOffice 2195)', () => {
  // 339's approved theft 1413: 450.75, day 2026-09-20, never spent (2195: the floor never bites).
  const row = THEFT_ENTRIES.find((e) => e.settlementEntryId === APPROVED_THEFT_ID)!
  const theft = { ...entryNow(row, historyOf(row, { spentAmount: 0 }), null), spentAmount: 0 }
  const draft = (o: Partial<ChangeDraft> = {}): ChangeDraft => ({ ...changeDraftFor(theft), reason: 'reported against the wrong day', ...o })

  it('only a theft asks for a day', () => {
    expect(asksBusinessDay('THEFT')).toBe(true)
    expect(asksBusinessDay('SHORTAGE')).toBe(false)
    expect(asksBusinessDay('SURPLUS')).toBe(false)
  })

  it('🔑 the form opens with the theft\'s day as a bare date — a shortage\'s year-1 day is an empty box', () => {
    expect(changeDraftFor(theft)).toEqual({ amount: '450.75', description: row.reason, reason: '', businessDay: '2026-09-20' })
    const shortage = entryNow(entryOf('0142', 143), null, null)
    expect(changeDraftFor(shortage).businessDay).toBe('')
  })

  it('🔑 a day-move sends the bare date, and nothing else differs', () => {
    expect(changeRequestBody(theft, draft({ businessDay: '2026-09-21' }))).toEqual({
      kind: 'ready',
      body: {
        settlementEntryId: APPROVED_THEFT_ID,
        requestKind: 'CHANGE',
        newAmount: null,
        newDescription: null,
        newBusinessDay: '2026-09-21',
        reason: 'reported against the wrong day',
      },
    })
  })

  it('🔑 naming only the day it already has is nothing-differs (2195\'s NO_CHANGE counts the day)', () => {
    expect(changeRequestBody(theft, draft())).toEqual({ kind: 'held', amount: null, description: null, businessDay: null, reason: null, unchanged: true })
    expect(changeRequestBody(theft, draft({ businessDay: ' 2026-09-20 ' }))).toMatchObject({ kind: 'held', unchanged: true })
  })

  it('an amount change on a theft sends newBusinessDay null — the day is left as it is', () => {
    const check = changeRequestBody(theft, draft({ amount: '400' }))
    expect(check).toEqual({
      kind: 'ready',
      body: { settlementEntryId: APPROVED_THEFT_ID, requestKind: 'CHANGE', newAmount: 400, newDescription: null, newBusinessDay: null, reason: 'reported against the wrong day' },
    })
  })

  it('amount, Description and day together — any non-empty set may be named', () => {
    expect(changeRequestBody(theft, draft({ amount: '400', description: 'سرقة من الدرج', businessDay: '2026-09-19' }))).toMatchObject({
      kind: 'ready',
      body: { newAmount: 400, newDescription: 'سرقة من الدرج', newBusinessDay: '2026-09-19' },
    })
  })

  it('a draft that never drew the day box leaves the day as it is', () => {
    const { businessDay: _, ...noBox } = draft({ amount: '400' })
    expect(changeRequestBody(theft, noBox)).toMatchObject({ kind: 'ready', body: { newAmount: 400, newBusinessDay: null } })
    expect(changeRequestBody(theft, { ...noBox, amount: '450.75' })).toMatchObject({ kind: 'held', unchanged: true })
  })

  it('an emptied day box is held — a theft is never sent without its day', () => {
    expect(changeRequestBody(theft, draft({ amount: '400', businessDay: '' }))).toMatchObject({ kind: 'held', businessDay: 'blank', unchanged: false })
  })

  it('a day that is not a calendar date is held', () => {
    expect(changeRequestBody(theft, draft({ businessDay: '2026-02-30' }))).toMatchObject({ kind: 'held', businessDay: 'unreadable' })
    expect(changeRequestBody(theft, draft({ businessDay: '20/09/2026' }))).toMatchObject({ kind: 'held', businessDay: 'unreadable' })
  })

  it('🚩 the closed-day and collected-day rules are the server\'s — any readable day is sent', () => {
    // A future day, which can be neither closed nor collected: the 400 / the refusal say so.
    expect(changeRequestBody(theft, draft({ businessDay: '2099-01-01' }))).toMatchObject({ kind: 'ready', body: { newBusinessDay: '2099-01-01' } })
  })

  it('🚩 a shortage never sends newBusinessDay — not even null, whatever is in the box', () => {
    const shortage = { ...entryNow(entryOf('0142', 143), null, null), spentAmount: 0 }
    const check = changeRequestBody(shortage, { ...changeDraftFor(shortage), amount: '300', reason: 'typo', businessDay: '2026-09-21' })
    expect(check).toEqual({
      kind: 'ready',
      body: { settlementEntryId: shortage.settlementEntryId, requestKind: 'CHANGE', newAmount: 300, newDescription: null, reason: 'typo' },
    })
    if (check.kind !== 'ready') throw new Error('expected ready')
    expect('newBusinessDay' in check.body).toBe(false)
    // …and a day in its box is not a difference on a shortage.
    expect(changeRequestBody(shortage, { ...changeDraftFor(shortage), reason: 'typo', businessDay: '2026-09-21' })).toMatchObject({ kind: 'held', businessDay: null, unchanged: true })
  })

  it('the card drawn from the raise answer names old → new day, both at midnight as History writes them', () => {
    const check = changeRequestBody(theft, draft({ businessDay: '2026-09-21' }))
    if (check.kind !== 'ready') throw new Error('expected ready')
    const request = raisedRequest(theft, check.body, raisedAnswerFor(row, { changeRequestId: 'R-DAY' }, 0), { staffId: 'u', name: 'u' })
    expect(request).toMatchObject({ oldBusinessDay: '2026-09-20T00:00:00', newBusinessDay: '2026-09-21T00:00:00' })
    expect(cardFor(request).changes).toEqual([{ field: 'businessDay', from: '2026-09-20T00:00:00', to: '2026-09-21T00:00:00' }])
  })

  it('🔑 an approved day-move redraws from the answer\'s businessDay — and the form reopens on the new day', () => {
    const request = waitingRequestOn(row, { changeRequestId: 'R-DAY', newBusinessDay: '2026-09-21T00:00:00' })
    const history = historyOf(row, { spentAmount: 0, openRequest: request })
    const result = approvedAnswerFor(row, request, 0, { businessDay: '2026-09-21T00:00:00' })
    const read = paneRead(row, history, { result, request: null })
    expect(read.now).toMatchObject({ businessDay: '2026-09-21T00:00:00', amount: 450.75, status: 'OPEN' })
    expect(changeDraftFor(read.now).businessDay).toBe('2026-09-21')
  })

  it('"Reduce it to X" keeps a theft\'s day in its box — the form never opens with it emptied', () => {
    const draft = reduceToSpent(theft, { kind: 'reduce', to: 400 }, 'counted again')
    expect(draft).toEqual({ amount: '400', description: row.reason, reason: 'counted again', businessDay: '2026-09-20' })
    expect(changeRequestBody(theft, draft)).toMatchObject({ kind: 'ready', body: { newAmount: 400, newBusinessDay: null } })
  })

  it('THEFT_DAY_COLLECTED (2195\'s sample): said by its code; a raise keeps the form, an approve is rejected', () => {
    expect(changeRefusal('raise', THEFT_DAY_COLLECTED_SAMPLE)).toMatchObject({ code: 'THEFT_DAY_COLLECTED', words: { kind: 'key', key: 'THEFT_DAY_COLLECTED' }, step: { kind: 'stay' } })
    expect(changeRefusal('approve', THEFT_DAY_COLLECTED_SAMPLE)).toMatchObject({ step: { kind: 'reject' } })
    // The sample's own day, drawn as received.
    expect(entryNow({ ...row, settlementEntryId: THEFT_DAY_COLLECTED_SAMPLE.settlementEntryId }, null, THEFT_DAY_COLLECTED_SAMPLE).businessDay).toBe('2025-08-11T00:00:00')
  })
})
