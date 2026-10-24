/**
 * Ticket 548 — "Close without invoice": the write-off form's validity, the body it sends, and the
 * refusal view each failure maps to. Pure.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { writeOffBlock, writeOffBody, writeOffRefusal } from './write-off'

const business = (code: string, message: string, statusCode = 400) =>
  new ApiError('business', message, statusCode, [{ errorCode: code, errorMessage: message, internalErrorCode: '' }])

describe('writeOffBlock', () => {
  it('no reason chosen blocks', () => {
    expect(writeOffBlock({ reason: '', note: 'anything' })).toBe('reasonRequired')
  })
  it('OTHER without a note blocks', () => {
    expect(writeOffBlock({ reason: 'OTHER', note: '' })).toBe('noteRequired')
  })
  it('OTHER with only white space blocks', () => {
    expect(writeOffBlock({ reason: 'OTHER', note: '   \n ' })).toBe('noteRequired')
  })
  it('OTHER with a note is ready', () => {
    expect(writeOffBlock({ reason: 'OTHER', note: 'الدافع رفض' })).toBeNull()
  })
  it.each(['PAYER_REFUSED', 'SALE_LOST', 'GOODS_NEVER_LEFT'])('%s needs no note', (reason) => {
    expect(writeOffBlock({ reason, note: '' })).toBeNull()
  })
})

describe('writeOffBody', () => {
  it('sends { reason, note } trimmed', () => {
    expect(writeOffBody({ reason: 'SALE_LOST', note: '  sold at the counter  ' })).toEqual({
      reason: 'SALE_LOST',
      note: 'sold at the counter',
    })
  })
  it('keeps an Arabic note unchanged', () => {
    expect(writeOffBody({ reason: 'OTHER', note: ' المريض لم يحضر ' })).toEqual({ reason: 'OTHER', note: 'المريض لم يحضر' })
  })
  it('an empty note is sent as an empty string', () => {
    expect(writeOffBody({ reason: 'PAYER_REFUSED', note: '' })).toEqual({ reason: 'PAYER_REFUSED', note: '' })
  })
})

describe('writeOffRefusal', () => {
  it('a bare 403 is "not granted"', () => {
    expect(writeOffRefusal(new ApiError('business', '', 403))).toEqual({ kind: 'notGranted' })
  })
  it.each([
    ['PSES-00009', 'notEndable'],
    ['PSES-00220', 'badReason'],
    ['PSES-00221', 'noteRequired'],
    ['PSES-00222', 'noActor'],
  ])('%s maps to its refusal with the envelope message and code', (code, label) => {
    expect(writeOffRefusal(business(code, 'The server said no.'))).toEqual({
      kind: 'refused',
      code,
      labelKey: `writeOff.refusal.${label}`,
      message: 'The server said no.',
    })
  })
  it('an unknown code keeps its message and code, with no label', () => {
    expect(writeOffRefusal(business('PSES-00001', 'No prescription session PS-9.', 404))).toEqual({
      kind: 'refused',
      code: 'PSES-00001',
      labelKey: null,
      message: 'No prescription session PS-9.',
    })
  })
  it('a failure with no envelope is "failed"', () => {
    expect(writeOffRefusal(new ApiError('network', 'offline', 0))).toEqual({ kind: 'failed' })
    expect(writeOffRefusal(new Error('bug'))).toEqual({ kind: 'failed' })
  })
})
