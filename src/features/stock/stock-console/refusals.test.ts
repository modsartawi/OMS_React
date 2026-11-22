import { describe, expect, it } from 'vitest'
import { ApiError, type ApiErrorKind } from '@/core/api'
import { REFUSAL_CODES, refusalOf } from './refusals'

const coded = (errorCode: string, message = 'server says so', status = 400) =>
  new ApiError('business', message, status, [{ errorCode, internalErrorCode: '', errorMessage: message }])
const bare = (kind: ApiErrorKind, status: number, message = 'Unexpected API error') =>
  new ApiError(kind, message, status, [])

describe('each refusal says its own sentence', () => {
  it.each([
    ['ConsoleBusy', 'refusal.ConsoleBusy'],
    ['ConsoleTimeout', 'refusal.ConsoleTimeout'],
    ['NarrowTheName', 'refusal.NarrowTheName'],
    ['BatchTooShort', 'refusal.BatchTooShort'],
    ['PrefixNeedsItem', 'refusal.PrefixNeedsItem'],
    ['NothingToFind', 'refusal.NothingToFind'],
    ['WindowTooLong', 'refusal.WindowTooLong'],
    ['SapNotConfigured', 'refusal.SapNotConfigured'],
    ['NoStore', 'refusal.NoStore'],
    ['NoRow', 'refusal.NoRow'],
  ])('%s → %s, with no server sentence beside it', (code, key) => {
    expect(refusalOf(coded(code))).toEqual({ code, key, reason: null })
  })

  it('SAP not reached says so, with SAP’s reason beside it', () => {
    expect(refusalOf(coded('SapUnreachable', 'RFC timeout'))).toEqual({
      code: 'SapUnreachable',
      key: 'refusal.SapUnreachable',
      reason: 'RFC timeout',
    })
  })

  it('Stock Visibility not reached, or over its time limit, is the one "not reached" sentence', () => {
    expect(refusalOf(coded('StockVisibilityUnreachable')).key).toBe('refusal.unreachable')
    expect(refusalOf(coded('StockVisibilityTimeout')).key).toBe('refusal.unreachable')
  })

  it('an outage with no code — the network, or a server crash — is "not reached" too', () => {
    expect(refusalOf(bare('network', 0))).toEqual({ code: null, key: 'refusal.unreachable', reason: null })
    expect(refusalOf(bare('server', 500))).toEqual({ code: null, key: 'refusal.unreachable', reason: null })
  })

  it('a bare 403 says the grant is gone', () => {
    expect(refusalOf(bare('business', 403))).toEqual({ code: null, key: 'refusal.denied', reason: null })
  })

  it('a code this table does not know shows the server’s own sentence under the generic one', () => {
    expect(refusalOf(coded('SomethingNew', 'A new rule refused it.'))).toEqual({
      code: 'SomethingNew',
      key: 'refusal.failed',
      reason: 'A new rule refused it.',
    })
  })

  it('anything that is not an API error is the generic sentence alone', () => {
    expect(refusalOf(new Error('bug'))).toEqual({ code: null, key: 'refusal.failed', reason: null })
  })

  it('every code the table names has a key of its own or a family’s', () => {
    expect(REFUSAL_CODES.length).toBeGreaterThan(0)
    for (const code of REFUSAL_CODES) expect(refusalOf(coded(code)).key).not.toBe('refusal.failed')
  })
})
