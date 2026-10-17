import { describe, expect, it } from 'vitest'
import { CANCEL_REASON_MAX, cancelBody, cancelFailure, mayHaveLanded, pressRequestId, reasonProblem } from './cancel'

const minter = () => {
  let n = 0
  return () => `id-${++n}`
}

describe('cancel_newRequestIdPerPress', () => {
  it('mints a new request id for every press', () => {
    const mint = minter()
    const first = pressRequestId(null, mint)
    // HQ answered the first press (a refusal): the next press is a new action, with a new id.
    const second = pressRequestId({ requestId: first, failure: 'business', statusCode: 409 }, mint)
    expect(first).toBe('id-1')
    expect(second).toBe('id-2')
  })

  it('…except a press that retries one HQ never answered: the same id, so a cancel that did land comes back `repeated`', () => {
    const mint = minter()
    expect(pressRequestId({ requestId: 'id-9', failure: 'network', statusCode: 0 }, mint)).toBe('id-9')
    expect(pressRequestId({ requestId: 'id-9', failure: 'server', statusCode: 502 }, mint)).toBe('id-9')
    // A 2xx whose body did not read: it may have landed too.
    expect(pressRequestId({ requestId: 'id-9', failure: 'unknown', statusCode: 200 }, mint)).toBe('id-9')
    expect(mint()).toBe('id-1')
  })

  it('…and a bare 403 (the grant filter, before anything is written) is answered: the next press is new', () => {
    expect(pressRequestId({ requestId: 'id-9', failure: 'unknown', statusCode: 403 }, minter())).toBe('id-1')
  })

  it('mints real, distinct ids by default', () => {
    const a = pressRequestId(null)
    const b = pressRequestId(null)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})

describe('mayHaveLanded', () => {
  it('is false only when HQ answered (a refusal in the envelope) or the press never left (no failure)', () => {
    expect(mayHaveLanded({ failure: null, statusCode: 0 })).toBe(false)
    expect(mayHaveLanded({ failure: 'business', statusCode: 409 })).toBe(false)
    expect(mayHaveLanded({ failure: 'unknown', statusCode: 403 })).toBe(false)
    expect(mayHaveLanded({ failure: 'network', statusCode: 0 })).toBe(true)
    expect(mayHaveLanded({ failure: 'server', statusCode: 500 })).toBe(true)
    expect(mayHaveLanded({ failure: 'unknown', statusCode: 200 })).toBe(true)
  })
})

describe('reasonProblem', () => {
  it('requires a reason, blank counting as none', () => {
    expect(reasonProblem('')).toBe('required')
    expect(reasonProblem('   ')).toBe('required')
    expect(reasonProblem('Customer walked out before paying')).toBeNull()
  })

  it('takes at most 500 characters, counted after trimming', () => {
    expect(CANCEL_REASON_MAX).toBe(500)
    expect(reasonProblem('x'.repeat(500))).toBeNull()
    expect(reasonProblem(`  ${'x'.repeat(500)}  `)).toBeNull()
    expect(reasonProblem('x'.repeat(501))).toBe('tooLong')
  })
})

describe('cancelBody', () => {
  it('is the door\'s body, the sale id and the reason trimmed', () => {
    expect(cancelBody(' R101-0042 ', 'id-1', '  Till crashed mid-sale ')).toEqual({ sessionId: 'R101-0042', requestId: 'id-1', reason: 'Till crashed mid-sale' })
  })
})

describe('cancelFailure', () => {
  it('names each of the cancel\'s refusal codes', () => {
    for (const code of ['RULES_SESSION_CANCELLED', 'RULES_SESSION_CLOSED', 'RULES_SESSION_OPEN', 'RULES_REQUEST_ID_REUSED', 'RULES_REASON_REQUIRED', 'RULES_SESSION_NOT_FOUND']) {
      expect(cancelFailure(code, false)).toBe(code)
    }
  })

  it('reads a bare 403 (no body, no code) as a missing grant', () => {
    expect(cancelFailure(null, true)).toBe('denied')
  })

  it('has nothing to add to any other failure', () => {
    expect(cancelFailure('RULES_SOMETHING_NEW', false)).toBeNull()
    expect(cancelFailure(null, false)).toBeNull()
  })
})
