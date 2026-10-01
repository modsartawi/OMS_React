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
  afterRaise,
  cardFor,
  changeRequestBody,
  entryNow,
  changeRequestFailure,
  offerFor,
  raisedRequest,
  type ChangeRequestSession,
} from './change-request'
import {
  APPLIED_SAMPLE,
  BELOW_SPENT_SAMPLE,
  REQUESTER,
  UNSTAMPED,
  historyOf,
  raisedAnswerFor,
  waitingRequestOn,
} from './change-request-fixture'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'

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
    expect(changeRequestBody(entry, draft())).toEqual({ kind: 'held', amount: null, description: null, reason: null, unchanged: true })
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
