/**
 * Ticket 624 — the IDF exception form: a reason on every change, a key always, and a master only (and always) for
 * "master" handling.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_EXCEPTION_FORM, exceptionBody, exceptionFormProblems, formFromException, reasonProblem, type IdfException } from './exceptions'

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
      allStores: false,
      reason: 'Company contract',
    })
    expect(exceptionBody({ ...filled, handling: 'master', masterId: 'M-OPS' }).masterId).toBe('M-OPS')
  })
  it('editing a row starts from its values with a blank reason (each change asks for its own)', () => {
    const row: IdfException = { exceptionId: 'X-1', keyKind: 'nphiesClaimType', key: '3', handling: 'master', masterId: 'M-OPS', reason: 'old', by: 'a', at: '2026-10-01T10:00:00' }
    expect(formFromException(row)).toEqual({ keyKind: 'nphiesClaimType', key: '3', handling: 'master', masterId: 'M-OPS', allStores: false, reason: '' })
    expect(formFromException({ ...row, allStores: true }).allStores).toBe(true)
    expect(formFromException({ ...row, handling: 'skip', masterId: null }).masterId).toBe('')
  })
})

describe('3166: allStores, a whole-number Nphies claim type, a reason of at most 400', () => {
  it('allStores defaults to false (pilot stores only) and is sent as set', () => {
    expect(EMPTY_EXCEPTION_FORM.allStores).toBe(false)
    expect(exceptionBody(filled).allStores).toBe(false)
    expect(exceptionBody({ ...filled, allStores: true }).allStores).toBe(true)
  })
  it('a Nphies claim type key must be a whole number; other key kinds take any text', () => {
    expect(exceptionFormProblems({ ...filled, keyKind: 'nphiesClaimType', key: 'GOSI' })).toEqual({ key: 'keyWholeNumber' })
    expect(exceptionFormProblems({ ...filled, keyKind: 'nphiesClaimType', key: ' 3 ' })).toEqual({})
    expect(exceptionFormProblems({ ...filled, keyKind: 'subDocumentType', key: 'SABIC staff' })).toEqual({})
  })
  it('a reason over 400 characters is refused before sending', () => {
    expect(reasonProblem('x'.repeat(400))).toBeNull()
    expect(reasonProblem('x'.repeat(401))).toBe('reasonTooLong')
  })
})
