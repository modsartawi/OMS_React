/**
 * Ticket 898 (BackOffice spec 3208, Nphies contract 1.2 §1.1 rows 19–21) — the pure rules of the
 * Undispense page. Prior art: `../approval-release/release-rules.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { NphiesUndispenseRequest } from '@/core/models/nphies'
import {
  LIST_REFUSAL_CODES,
  RETRY_REFUSAL_CODES,
  UNDISPENSE_REFUSAL_CODES,
  UNDISPENSE_STATES,
  buildUndispenseListParams,
  canConfirmUndispense,
  criteriaFromUrl,
  defaultUndispenseCriteria,
  isRetryable,
  listRefusalKey,
  originKey,
  retryRefusalKey,
  undispenseBody,
  undispenseRefusalKey,
  queuedOutcome,
} from './undispense-rules'

const ROW = (over: Partial<NphiesUndispenseRequest> = {}): NphiesUndispenseRequest => ({
  id: '01JCZ0000000000000000000AA',
  authId: 'AUTH-1',
  storeCode: '1001',
  returnTransactionId: 'TRX-9',
  origin: 'return',
  requestedBy: '4711',
  requestedByName: '',
  note: '',
  state: 'failed',
  attempts: 3,
  lastError: 'timeout',
  addedTime: '2026-11-13T09:00:00',
  processedTime: '2026-11-13T09:05:00',
  lastAttemptTime: '2026-11-13T09:05:00',
  retriedBy: null,
  retriedTime: null,
  ...over,
})

const refusal = (status: number, code: string | null) =>
  new ApiError('business', 'the server sentence', status, code === null ? [] : [{ errorCode: code, errorMessage: 'x' } as never])

describe('the list opens on pending and failed, and its filters become the query', () => {
  it('the default is pending + failed, nothing else narrowed', () => {
    expect(defaultUndispenseCriteria()).toEqual({ states: ['pending', 'failed'], store: '', from: '', to: '', authId: '' })
  })

  it('the default sends state=pending,failed and nothing else', () => {
    expect(buildUndispenseListParams(defaultUndispenseCriteria())).toEqual({ state: 'pending,failed' })
  })

  it('every filter reaches the query under the door’s own names, trimmed', () => {
    expect(
      buildUndispenseListParams({ states: ['done'], store: ' 1001 ', from: '2026-11-01', to: '2026-11-13', authId: ' AUTH-1 ' }),
    ).toEqual({ state: 'done', store: '1001', from: '2026-11-01', to: '2026-11-13', authId: 'AUTH-1' })
  })

  it('no state chosen is every state — the parameter is left off, never sent empty', () => {
    expect(buildUndispenseListParams({ ...defaultUndispenseCriteria(), states: [] })).toEqual({})
  })

  it('states go in one fixed order whatever order they were ticked in', () => {
    expect(buildUndispenseListParams({ ...defaultUndispenseCriteria(), states: ['done', 'pending'] }).state).toBe('pending,done')
  })

  it('all three states are offered', () => {
    expect(UNDISPENSE_STATES).toEqual(['pending', 'failed', 'done'])
  })

  it('🚩 a link with ?authId= opens on that authorization, in every state (the 751 link)', () => {
    expect(criteriaFromUrl(' AUTH-7 ')).toEqual({ ...defaultUndispenseCriteria(), states: [], authId: 'AUTH-7' })
  })

  it('no link id is the default list', () => {
    expect(criteriaFromUrl('')).toEqual(defaultUndispenseCriteria())
    expect(criteriaFromUrl(null)).toEqual(defaultUndispenseCriteria())
  })
})

describe('Retry shows only with the grant, on a failed row', () => {
  it.each([
    [true, 'failed', true],
    [true, 'pending', false],
    [true, 'done', false],
    [false, 'failed', false],
    [undefined, 'failed', false],
  ] as const)('grant=%s on a %s row → %s', (grant, state, shown) => {
    expect(isRetryable(grant, ROW({ state }))).toBe(shown)
  })
})

describe('the manual undispense', () => {
  it.each(['', ' ', '\n\t '])('a blank note (%j) cannot confirm', (note) => {
    expect(canConfirmUndispense(note, false)).toBe(false)
  })

  it('a typed note confirms, in either script', () => {
    expect(canConfirmUndispense('the patient returned it', false)).toBe(true)
    expect(canConfirmUndispense('أعاد المريض الدواء', false)).toBe(true)
  })

  it('nothing confirms while one is in flight', () => {
    expect(canConfirmUndispense('a note', true)).toBe(false)
  })

  it('🚩 the body is { note } alone — who and origin are the session’s', () => {
    expect(undispenseBody('  returned in full \n')).toEqual({ note: 'returned in full' })
  })

  it.each([
    ['AUTH_NOT_FOUND', 404, 'refusals.authNotFound'],
    ['INVOICE_NOT_FOUND', 404, 'refusals.invoiceNotFound'],
    ['INVOICE_NOT_FULLY_RETURNED', 409, 'refusals.notFullyReturned'],
    ['NOTE_REQUIRED', 400, 'refusals.noteRequired'],
  ] as const)('%s → %s', (code, status, key) => {
    expect(undispenseRefusalKey(refusal(status, code))).toBe(key)
  })

  it('every undispense code the contract names has a message', () => {
    for (const code of UNDISPENSE_REFUSAL_CODES)
      expect([code, undispenseRefusalKey(refusal(409, code))]).not.toEqual([code, null])
  })

  it('a bare 403 is the missing undispense grant', () => {
    expect(undispenseRefusalKey(refusal(403, null))).toBe('refusals.noGrant')
  })

  it('an unknown code is not guessed at', () => {
    expect(undispenseRefusalKey(refusal(409, 'SOMETHING_ELSE'))).toBeNull()
    expect(undispenseRefusalKey(new Error('boom'))).toBeNull()
  })

  it.each([
    [{ created: true, request: ROW({ state: 'pending' }) }, 'queued'],
    [{ created: false, request: ROW({ state: 'pending' }) }, 'alreadyPending'],
    [{ created: false, request: ROW({ state: 'failed' }) }, 'alreadyFailed'],
    [{ created: false, request: ROW({ state: 'done' }) }, 'alreadyDone'],
    [{ created: false, request: null }, 'alreadyPending'],
  ] as const)('the answer %j reads as %s', (answer, outcome) => {
    expect(queuedOutcome(answer)).toBe(outcome)
  })
})

describe('Retry and the list refuse in this page’s words', () => {
  it.each([
    ['UNDISPENSE_NOT_FOUND', 404, 'refusals.retryNotFound'],
    ['UNDISPENSE_NOT_FAILED', 409, 'refusals.retryNotFailed'],
  ] as const)('%s → %s', (code, status, key) => {
    expect(retryRefusalKey(refusal(status, code))).toBe(key)
  })

  it('every retry code has a message, and a bare 403 is the grant', () => {
    for (const code of RETRY_REFUSAL_CODES) expect(retryRefusalKey(refusal(409, code))).not.toBeNull()
    expect(retryRefusalKey(refusal(403, null))).toBe('refusals.noGrant')
  })

  it('a list refused for its state filter says so', () => {
    for (const code of LIST_REFUSAL_CODES) expect(listRefusalKey(refusal(400, code))).toBe('refusals.stateInvalid')
    expect(listRefusalKey(refusal(500, null))).toBeNull()
  })
})

describe('origin', () => {
  it.each([
    ['return', 'origin.return'],
    ['support', 'origin.support'],
    ['callcenter', 'origin.callcenter'],
    ['CallCenter', 'origin.callcenter'],
    ['till-x', null],
  ] as const)('%s → %s', (origin, key) => {
    expect(originKey(origin)).toBe(key)
  })
})
