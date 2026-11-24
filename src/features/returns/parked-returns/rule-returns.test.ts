/**
 * BackOffice ticket 4226 (spec 4212, stories 31-33) — a parked rule return's words. The server sends the mirrored state
 * (`PARKED` / `UNPARKED` / `SENT`) and the un-park ids (BackOffice 4221 / 4222); the screen reads five labels off them:
 * parked, un-park requested, applied, sent and parked again.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import {
  RULE_PAGE_SIZE,
  UNPARK_REFUSAL_CODES,
  canUnpark,
  readRuleReturnsPage,
  ruleFiltersFromParams,
  ruleFiltersToParams,
  ruleListQuery,
  ruleReturnLabel,
  unparkRefusalKey,
} from './rule-returns'

const row = { state: 'PARKED', unparkRequestId: '', appliedUnparkId: '' }

describe('a parked rule return’s state label', () => {
  it('parked: the till parked it and nobody asked to un-park it', () => {
    expect(ruleReturnLabel(row).key).toBe('rule.state.parked')
  })

  it('un-park requested: HQ asked and the till has not applied that request yet', () => {
    expect(ruleReturnLabel({ ...row, unparkRequestId: 'U1' }).key).toBe('rule.state.unparkRequested')
    // A second request after the till applied the first is pending again.
    expect(ruleReturnLabel({ ...row, unparkRequestId: 'U2', appliedUnparkId: 'U1' }).key).toBe('rule.state.unparkRequested')
  })

  it('applied: the till applied the un-park and mirrored UNPARKED back', () => {
    expect(ruleReturnLabel({ state: 'UNPARKED', unparkRequestId: 'U1', appliedUnparkId: 'U1' }).key).toBe('rule.state.applied')
  })

  it('sent: the till finally sent it', () => {
    expect(ruleReturnLabel({ state: 'SENT', unparkRequestId: 'U1', appliedUnparkId: 'U1' }).key).toBe('rule.state.sent')
    expect(ruleReturnLabel({ ...row, state: 'SENT' }).key).toBe('rule.state.sent')
  })

  it('parked again: it parked once more after an applied un-park', () => {
    expect(ruleReturnLabel({ ...row, unparkRequestId: 'U1', appliedUnparkId: 'U1' }).key).toBe('rule.state.parkedAgain')
  })

  it('a state the screen does not know reads "unknown", never a raw code', () => {
    expect(ruleReturnLabel({ ...row, state: 'SOMETHING_NEW' }).key).toBe('rule.state.unknown')
    expect(ruleReturnLabel({ ...row, state: '' }).key).toBe('rule.state.unknown')
  })

  it('each label has a severity', () => {
    expect(ruleReturnLabel(row).sev).toBe('warn')
    expect(ruleReturnLabel({ ...row, unparkRequestId: 'U1' }).sev).toBe('go')
    expect(ruleReturnLabel({ state: 'SENT', unparkRequestId: '', appliedUnparkId: '' }).sev).toBe('ok')
  })
})

describe('Un-park is offered only with the settle right (ParkedReturns:06)', () => {
  const holding = (...screens: string[]) => permissionsOf({ screens })

  it('shown on a parked row with the settle right', () => {
    expect(canUnpark(row, holding('ParkedReturns:03', 'ParkedReturns:06'))).toBe(true)
    // Parked again after an applied un-park: it can be un-parked again.
    expect(canUnpark({ ...row, unparkRequestId: 'U1', appliedUnparkId: 'U1' }, holding('ParkedReturns:06'))).toBe(true)
  })

  it('hidden without the settle right — the view right alone, no answer, pending or failed', () => {
    for (const p of [
      holding('ParkedReturns:03'),
      holding(),
      permissionsOf(null),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ])
      expect(canUnpark(row, p)).toBe(false)
  })

  it('hidden while a request waits for the till, and on a row that is not parked', () => {
    const settle = holding('ParkedReturns:06')
    expect(canUnpark({ ...row, unparkRequestId: 'U1' }, settle)).toBe(false)
    expect(canUnpark({ ...row, state: 'UNPARKED' }, settle)).toBe(false)
    expect(canUnpark({ ...row, state: 'SENT' }, settle)).toBe(false)
  })
})

describe('an un-park refusal in words (BackOffice 4222)', () => {
  const refused = (code: string) =>
    new ApiError('business', `server words for ${code}`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: `server words for ${code}` }])

  it.each([
    ['PARKED_RULE_RETURN_NOT_FOUND'],
    ['PARKED_RULE_RETURN_NOT_PARKED'],
    ['PARKED_RULE_RETURN_UNPARK_PENDING'],
    ['PARKED_RULE_RETURN_NO_REQUESTER'],
  ])('%s has its own sentence', (code) => {
    expect(unparkRefusalKey(refused(code))).toBe(`rule.refusal.${code}`)
  })

  it('the four codes, and only those', () => {
    expect([...UNPARK_REFUSAL_CODES].sort()).toEqual([
      'PARKED_RULE_RETURN_NOT_FOUND',
      'PARKED_RULE_RETURN_NOT_PARKED',
      'PARKED_RULE_RETURN_NO_REQUESTER',
      'PARKED_RULE_RETURN_UNPARK_PENDING',
    ])
  })

  it('a bare 403 is "no settle right"', () => {
    expect(unparkRefusalKey(new ApiError('auth', 'Unexpected API error (HTTP 403)', 403))).toBe('rule.refusal.noSettleRight')
  })

  it('anything else is left to the server’s own message', () => {
    expect(unparkRefusalKey(refused('SOMETHING_ELSE'))).toBeNull()
    expect(unparkRefusalKey(new ApiError('server', 'boom', 500))).toBeNull()
    expect(unparkRefusalKey(new Error('network'))).toBeNull()
  })
})

describe('the list’s filters live in the address (store, include sent, page)', () => {
  it('a bare address is every store, parked only, page 1', () => {
    expect(ruleFiltersFromParams(new URLSearchParams())).toEqual({ store: '', includeSent: false, page: 1 })
    expect(ruleFiltersToParams({ store: '', includeSent: false, page: 1 }).toString()).toBe('')
  })

  it('round-trips', () => {
    const f = { store: 'P001', includeSent: true, page: 3 }
    expect(ruleFiltersFromParams(ruleFiltersToParams(f))).toEqual(f)
  })

  it('a bad page or flag reads as the default', () => {
    expect(ruleFiltersFromParams(new URLSearchParams('page=0&sent=maybe&store=%20P002%20'))).toEqual({ store: 'P002', includeSent: false, page: 1 })
  })

  it('asks the door under its own names, 50 a page', () => {
    expect(RULE_PAGE_SIZE).toBe(50)
    expect(ruleListQuery({ store: 'P001', includeSent: true, page: 2 })).toEqual({ store: 'P001', includeSent: true, page: 2, pageSize: 50 })
  })
})

describe('the list answer is read field by field (BackOffice 4221)', () => {
  it('reads every agreed field and nothing else', () => {
    const page = readRuleReturnsPage({
      total: 2,
      page: 1,
      pageSize: 50,
      extra: 'x',
      rows: [
        {
          id: '01J',
          storeCode: 'P001',
          registerId: '03',
          transactionId: 'T1',
          originalTransactionId: 'O1',
          errorCode: 'WSL_500',
          errorMessage: 'partner down',
          attemptsCount: 3,
          parkedAt: '2026-11-24T09:00:00',
          state: 'PARKED',
          lastEventAt: '2026-11-24T09:01:00',
          appliedUnparkId: '',
          unparkRequestId: 'U1',
          unparkRequestedBy: 'hq.user',
          unparkRequestedTime: '2026-11-24T10:00:00',
          secret: 'never',
        },
        'not a row',
      ],
    })
    expect(page.total).toBe(2)
    expect(page.rows).toEqual([
      {
        id: '01J',
        storeCode: 'P001',
        registerId: '03',
        transactionId: 'T1',
        originalTransactionId: 'O1',
        errorCode: 'WSL_500',
        errorMessage: 'partner down',
        attemptsCount: 3,
        parkedAt: '2026-11-24T09:00:00',
        state: 'PARKED',
        lastEventAt: '2026-11-24T09:01:00',
        appliedUnparkId: '',
        unparkRequestId: 'U1',
        unparkRequestedBy: 'hq.user',
        unparkRequestedTime: '2026-11-24T10:00:00',
      },
    ])
  })

  it('missing fields read empty; a null requested time reads as blank', () => {
    expect(readRuleReturnsPage({ rows: [{ unparkRequestedTime: null }] }).rows[0]).toMatchObject({ id: '', attemptsCount: 0, unparkRequestedTime: '' })
    expect(readRuleReturnsPage(null)).toEqual({ total: 0, rows: [] })
  })
})
