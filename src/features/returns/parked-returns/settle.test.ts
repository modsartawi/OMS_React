/**
 * BackOffice ticket 4225 (spec 4212 stories 14-22) — the settle actions' pure half: the Pay-in-cash dialog's validation
 * (both a reason and the partner's dashboard evidence, within the server's 500 / 1000), which buttons a grain offers
 * (none without the settle right), and a refusal's words per error code (BackOffice 4219's contract).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { ParkedReturnDetail, ParkedReturnGrain } from '@/core/models/parked-returns'
import { CASH_EVIDENCE_MAX, CASH_REASON_MAX, SETTLE_REFUSAL_CODES, canResolveRowless, cashCommit, clampTo, grainActions, rowlessCommit, rowlessSeed, settleRefusalKey } from './settle'

describe('the Pay-in-cash dialog — both a reason and the evidence, within the widths', () => {
  const ok = { reason: 'Partner refund failed twice', evidence: 'Dashboard: refund 7781 declined', pending: false }

  it('a reason and evidence may be sent, trimmed', () => {
    expect(cashCommit(ok)).toEqual({
      canCommit: true,
      reasonMissing: false,
      evidenceMissing: false,
      reasonTooLong: false,
      evidenceTooLong: false,
      body: { outcome: 'PAY_IN_CASH', reason: 'Partner refund failed twice', partnerEvidence: 'Dashboard: refund 7781 declined' },
    })
    expect(cashCommit({ ...ok, reason: '  why  ' }).body?.reason).toBe('why')
  })

  it('an empty or blank reason blocks the submit', () => {
    for (const reason of ['', '   ', '\n\t']) {
      const c = cashCommit({ ...ok, reason })
      expect([reason, c.canCommit, c.reasonMissing, c.body]).toEqual([reason, false, true, null])
    }
  })

  it('empty or blank evidence blocks the submit', () => {
    for (const evidence of ['', '   ']) {
      const c = cashCommit({ ...ok, evidence })
      expect([evidence, c.canCommit, c.evidenceMissing, c.body]).toEqual([evidence, false, true, null])
    }
  })

  it('the widths are the server columns: 500 and 1000', () => {
    expect(CASH_REASON_MAX).toBe(500)
    expect(CASH_EVIDENCE_MAX).toBe(1000)
  })

  it('a reason up to 500 and evidence up to 1000 go; one more character blocks', () => {
    expect(cashCommit({ ...ok, reason: 'r'.repeat(500), evidence: 'e'.repeat(1000) }).canCommit).toBe(true)
    expect(cashCommit({ ...ok, reason: 'r'.repeat(501) })).toMatchObject({ canCommit: false, reasonTooLong: true, body: null })
    expect(cashCommit({ ...ok, evidence: 'e'.repeat(1001) })).toMatchObject({ canCommit: false, evidenceTooLong: true, body: null })
  })

  it('the width counts the trimmed text, so padding never refuses a fitting answer', () => {
    expect(cashCommit({ ...ok, reason: `  ${'r'.repeat(500)}  ` }).canCommit).toBe(true)
  })

  it('never twice at once', () => {
    expect(cashCommit({ ...ok, pending: true }).canCommit).toBe(false)
  })

  it('the clamp cuts typed or pasted text at the width and leaves shorter text alone', () => {
    expect(clampTo('x'.repeat(1200), CASH_EVIDENCE_MAX)).toHaveLength(1000)
    expect(clampTo('x'.repeat(600), CASH_REASON_MAX)).toHaveLength(500)
    expect(clampTo('short', CASH_REASON_MAX)).toBe('short')
    expect(clampTo('', CASH_REASON_MAX)).toBe('')
  })
})

const grain = (over: Partial<ParkedReturnGrain> = {}): ParkedReturnGrain => ({
  refundId: '01JF0000000000000000000001',
  partner: 'TABBY',
  tenderType: 'TABY',
  grainKey: 'TRX',
  originalReference: 'ord-1',
  partnerRefundReference: '',
  amount: 115,
  status: 'FAILED',
  hasStatusApi: true,
  addedTime: '2026-11-20T10:00:00',
  parkDeadline: '2026-11-23T10:00:00',
  escalated: false,
  awaitingHq: true,
  settledBy: '',
  settledTime: '',
  cashRuled: false,
  cashReason: '',
  partnerEvidence: '',
  ...over,
})

describe('which settle buttons a grain offers', () => {
  const open = 'NEEDS_HQ'

  it('without the settle right, no button on any grain, whatever its status', () => {
    for (const status of ['PENDING', 'SUBMITTED', 'FAILED', 'REFUNDED'])
      expect([status, grainActions(grain({ status }), { canSettle: false, returnState: open })]).toEqual([status, []])
  })

  it('an in-flight grain offers Refunded, Void after check and Pay in cash', () => {
    for (const status of ['PENDING', 'SUBMITTED'])
      expect(grainActions(grain({ status, awaitingHq: false }), { canSettle: true, returnState: open })).toEqual([
        'REFUNDED',
        'VOID_AFTER_CHECK',
        'PAY_IN_CASH',
      ])
  })

  it('a failed grain nobody settled offers Refunded, Void after check and Pay in cash (spec 4212 review fix)', () => {
    // The till never finalizes an unchecked FAILED (D7), so HQ may still find the money moved and settle it Refunded.
    expect(grainActions(grain({ status: 'FAILED' }), { canSettle: true, returnState: open })).toEqual([
      'REFUNDED',
      'VOID_AFTER_CHECK',
      'PAY_IN_CASH',
    ])
  })

  it('Void after check is hidden beside a grain of the same return that is refunded or ruled cash (spec 4212 review fix)', () => {
    // Refunded or Cash beside a Void can never finish at the till; the server refuses it as PARKED_RETURN_VOID_BESIDE_REFUNDED.
    const self = grain({ refundId: 'A', status: 'FAILED' })
    const refunded = grain({ refundId: 'B', status: 'REFUNDED', awaitingHq: false })
    const cash = grain({ refundId: 'C', status: 'FAILED', awaitingHq: false, settledBy: 'hq.user', cashRuled: true })
    const inFlight = grain({ refundId: 'D', status: 'SUBMITTED', awaitingHq: false })
    for (const sibling of [refunded, cash])
      expect(grainActions(self, { canSettle: true, returnState: open, grains: [self, sibling] })).toEqual(['REFUNDED', 'PAY_IN_CASH'])
    expect(grainActions(self, { canSettle: true, returnState: open, grains: [self, inFlight] })).toEqual([
      'REFUNDED',
      'VOID_AFTER_CHECK',
      'PAY_IN_CASH',
    ])
  })

  it('a grain a person already settled, a refunded grain or an unknown status offers nothing', () => {
    const settled = grain({ status: 'FAILED', settledBy: 'hq.user', settledTime: '2026-11-24T09:00:00', cashRuled: true })
    expect(grainActions(settled, { canSettle: true, returnState: 'WAITING_FOR_STORE' })).toEqual([])
    expect(grainActions(grain({ status: 'REFUNDED' }), { canSettle: true, returnState: open })).toEqual([])
    expect(grainActions(grain({ status: 'LOST' }), { canSettle: true, returnState: open })).toEqual([])
  })

  it('a return finished at the till offers nothing', () => {
    expect(grainActions(grain({ status: 'SUBMITTED' }), { canSettle: true, returnState: 'FINISHED' })).toEqual([])
  })
})

const detail = (over: Partial<ParkedReturnDetail> = {}): ParkedReturnDetail => ({
    transactionId: 'P077-01-000123',
    state: 'NEEDS_HQ',
    needsHqReasons: ['ROWLESS'],
    storeDetailsReceived: true,
    resumeResolution: '',
    canFinalize: false,
    header: {
      storeCode: 'P077',
      registerId: '01',
      operatorId: '5501',
      customerId: '',
      loyaltyId: '',
      loyaltyMobile: '',
      parkedAt: '2026-11-22T18:00:00',
      mirrorStatus: 'PARKED',
      originalTransactionId: 'P077-01-000100',
      originalReceiptNumber: 'R-100',
      currency: 'SAR',
      grandTotal: 115,
      parkReason: 'AMBIGUOUS_ANSWER',
    },
    lines: [],
    tenders: [],
    grains: [],
    ...over,
  })

describe('Resolve row-less', () => {
  it('a mirrored park with no ledger row offers it, with the settle right only', () => {
    expect(canResolveRowless(detail(), true)).toBe(true)
    expect(canResolveRowless(detail(), false)).toBe(false)
  })

  it('a park with a ledger row, a finished return or no store details does not', () => {
    expect(canResolveRowless(detail({ grains: [grain()] }), true)).toBe(false)
    expect(canResolveRowless(detail({ state: 'FINISHED' }), true)).toBe(false)
    expect(canResolveRowless(detail({ header: null, storeDetailsReceived: false }), true)).toBe(false)
  })
})

describe('a refusal in plain words, per error code', () => {
  const refused = (code: string, status = 400) =>
    new ApiError('business', `server words for ${code}`, status, [{ errorCode: code, internalErrorCode: '', errorMessage: `server words for ${code}` }])

  it('every code of the settle and row-less doors has its own sentence', () => {
    expect([...SETTLE_REFUSAL_CODES].sort()).toEqual(
      [
        'PARKED_RETURN_NO_SETTLER',
        'PARKED_RETURN_INVALID_OUTCOME',
        'PARKED_RETURN_REASON_REQUIRED',
        'PARKED_RETURN_EVIDENCE_REQUIRED',
        'PARKED_RETURN_NOT_FOUND',
        'PARKED_RETURN_ALREADY_SETTLED',
        'PARKED_RETURN_FINISHED_AT_TILL',
        'PARKED_RETURN_NOT_SETTLEABLE',
        'PARKED_RETURN_SETTLED_CONCURRENTLY',
        'PARKED_RETURN_INVALID_STATUS',
        'PARKED_RETURN_NOT_ROWLESS',
        'PARKED_RETURN_VOID_BESIDE_REFUNDED',
      ].sort(),
    )
    for (const code of SETTLE_REFUSAL_CODES) expect(settleRefusalKey(refused(code))).toBe(`refusal.${code}`)
  })

  it('the lost race, the already-settled row and the finished return each read differently', () => {
    const keys = ['PARKED_RETURN_SETTLED_CONCURRENTLY', 'PARKED_RETURN_ALREADY_SETTLED', 'PARKED_RETURN_FINISHED_AT_TILL'].map((c) =>
      settleRefusalKey(refused(c)),
    )
    expect(new Set(keys).size).toBe(3)
  })

  it('a bare 403 (the settle right was taken away) says so', () => {
    expect(settleRefusalKey(new ApiError('auth', 'Unexpected API error (HTTP 403)', 403))).toBe('refusal.noSettleRight')
  })

  it('an unknown code, a server fault or a non-API error has no sentence: the caller shows the server message', () => {
    expect(settleRefusalKey(refused('SOMETHING_NEW'))).toBeNull()
    expect(settleRefusalKey(new ApiError('server', 'boom', 500))).toBeNull()
    expect(settleRefusalKey(new Error('bug'))).toBeNull()
    expect(settleRefusalKey(null)).toBeNull()
  })
})

describe('the row-less resolve form', () => {
  const tender = { tenderNumber: 2, tenderType: 'TABY', amount: 115.5, isRefund: true, isParked: true, refundReference: 'RF-9', settlementState: '' }

  it('starts from the store, the cashier and the one parked refund tender', () => {
    expect(rowlessSeed(detail({ tenders: [{ ...tender, tenderNumber: 1, tenderType: 'CASH', amount: 10, isParked: false }, tender] }))).toEqual({
      status: '',
      partner: '',
      tenderType: 'TABY',
      originalReference: '',
      amount: '115.5',
      storeCode: 'P077',
      operatorId: '5501',
    })
  })

  it('leaves the tender blank when no tender, or more than one, parked', () => {
    expect(rowlessSeed(detail()).tenderType).toBe('')
    expect(rowlessSeed(detail({ tenders: [tender, { ...tender, tenderNumber: 3 }] }))).toMatchObject({ tenderType: '', amount: '' })
  })

  const form = { ...rowlessSeed(detail({ tenders: [tender] })), status: 'FAILED', partner: ' TABBY ', originalReference: ' ord-7 ' }

  it('sends the trimmed fields and the amount as a number', () => {
    expect(rowlessCommit(form, false)).toEqual({
      canCommit: true,
      body: {
        status: 'FAILED',
        partner: 'TABBY',
        tenderType: 'TABY',
        originalReference: 'ord-7',
        storeCode: 'P077',
        operatorId: '5501',
        amount: 115.5,
      },
    })
    expect(rowlessCommit({ ...form, status: 'REFUNDED' }, false).canCommit).toBe(true)
  })

  it('needs an outcome, a partner, a tender and an amount above zero', () => {
    for (const bad of [{ status: '' }, { status: 'VOID' }, { partner: '  ' }, { tenderType: '' }, { amount: '' }, { amount: '0' }, { amount: '-5' }, { amount: 'abc' }])
      expect([bad, rowlessCommit({ ...form, ...bad }, false)]).toEqual([bad, { canCommit: false, body: null }])
  })

  it('never twice at once', () => {
    expect(rowlessCommit(form, true).canCommit).toBe(false)
  })
})
