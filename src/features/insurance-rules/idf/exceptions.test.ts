/**
 * Ticket 624 — the IDF exception form: a reason on every change, a key always, and a master only (and always) for
 * "master" handling.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_EXCEPTION_FORM, exceptionBody, exceptionFormProblems, formFromException, type IdfException } from './exceptions'

const filled = { ...EMPTY_EXCEPTION_FORM, keyKind: 'documentType' as const, key: 'SABIC', handling: 'skip' as const, reason: 'Company contract' }

describe('exception form requires a reason, and a master only for master handling', () => {
  it('a filled skip row has no problems', () => {
    expect(exceptionFormProblems(filled)).toEqual({})
  })
  it('a blank (or spaces-only) reason and key are refused', () => {
    expect(exceptionFormProblems({ ...filled, reason: '   ', key: '' })).toEqual({ reason: 'reasonRequired', key: 'keyRequired' })
  })
  it('master handling without a master is refused', () => {
    expect(exceptionFormProblems({ ...filled, handling: 'master', masterId: '' })).toEqual({ masterId: 'masterRequired' })
    expect(exceptionFormProblems({ ...filled, handling: 'master', masterId: 'M-OPS' })).toEqual({})
  })
  it('reminder and skip ignore a left-over master', () => {
    expect(exceptionFormProblems({ ...filled, handling: 'reminder', masterId: 'M-OPS' })).toEqual({})
  })
  it('the body trims, and sends the master only for master handling', () => {
    expect(exceptionBody({ ...filled, key: ' SABIC ', reason: ' Company contract ', handling: 'reminder', masterId: 'M-OPS' })).toEqual({
      keyKind: 'documentType',
      key: 'SABIC',
      handling: 'reminder',
      masterId: null,
      reason: 'Company contract',
    })
    expect(exceptionBody({ ...filled, handling: 'master', masterId: 'M-OPS' }).masterId).toBe('M-OPS')
  })
  it('editing a row starts from its values with a blank reason (each change asks for its own)', () => {
    const row: IdfException = { exceptionId: 'X-1', keyKind: 'nphiesClaimType', key: 'GOSI', handling: 'master', masterId: 'M-OPS', reason: 'old', by: 'a', at: '2026-10-01T10:00:00' }
    expect(formFromException(row)).toEqual({ keyKind: 'nphiesClaimType', key: 'GOSI', handling: 'master', masterId: 'M-OPS', reason: '' })
    expect(formFromException({ ...row, handling: 'skip', masterId: null }).masterId).toBe('')
  })
})
