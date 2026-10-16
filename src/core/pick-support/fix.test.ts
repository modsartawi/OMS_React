/** The fix dialog's pure rules (ticket 497, brief 2691 "The fix dialog"). */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { PickSupportFixResult } from '@/core/models/pick-support'
import { stuckDiagnosis } from './__fixtures__/brief'
import { FIX_REASON_MAX, FIX_REFERENCE_MAX, canConfirmFix, fixBody, fixOutcome } from './fix'

const refusal = (code: string, message: string) =>
  new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

const success = (over: Partial<PickSupportFixResult> = {}): PickSupportFixResult => ({
  shape: 'DONOR_AT_OLD_ORDER_STORE',
  tellTheStoreEn: 'Store 1139: void the open invoice of delivery 8006777365.',
  tellTheStoreAr: 'الفرع 1139: ألغِ الفاتورة المفتوحة للتوصيل 8006777365.',
  diagnosis: { ...stuckDiagnosis(), verdict: 'HEALTHY', shapes: [] },
  ...over,
})

describe('canConfirmFix', () => {
  it('keeps Confirm off while either field is blank or whitespace only', () => {
    expect(canConfirmFix('', '')).toBe(false)
    expect(canConfirmFix('Store 1139 cannot invoice after the move', '')).toBe(false)
    expect(canConfirmFix('', 'CMP-2026-10-0412')).toBe(false)
    expect(canConfirmFix('   \n\t', 'CMP-2026-10-0412')).toBe(false)
    expect(canConfirmFix('Store 1139 cannot invoice after the move', '   ')).toBe(false)
  })

  it('turns Confirm on once both carry text', () => {
    expect(canConfirmFix('Store 1139 cannot invoice after the move', 'CMP-2026-10-0412')).toBe(true)
    expect(canConfirmFix('  الفرع لا يستطيع إصدار الفاتورة ', ' CMP-1 ')).toBe(true)
  })

  it('holds the brief widths: 512 for the reason, 40 for the reference', () => {
    expect(FIX_REASON_MAX).toBe(512)
    expect(FIX_REFERENCE_MAX).toBe(40)
  })
})

describe('fixBody', () => {
  it('carries exactly shape, reason and complaintRef, trimmed (no actor: the session is the actor)', () => {
    const body = fixBody('DONOR_AT_OLD_ORDER_STORE', '  Store 1139 cannot invoice after the move \n', ' CMP-2026-10-0412 ')
    expect(body).toEqual({ shape: 'DONOR_AT_OLD_ORDER_STORE', reason: 'Store 1139 cannot invoice after the move', complaintRef: 'CMP-2026-10-0412' })
    expect(Object.keys(body).sort()).toEqual(['complaintRef', 'reason', 'shape'])
  })
})

describe('fixOutcome', () => {
  it('a success with a diagnosis replaces the panel with it, and asks no re-read', () => {
    const result = success()
    expect(fixOutcome({ result }, 'x')).toEqual({
      kind: 'fixed',
      tellTheStoreEn: result.tellTheStoreEn,
      tellTheStoreAr: result.tellTheStoreAr,
      diagnosis: result.diagnosis,
      reread: false,
    })
  })

  it('a success with diagnosis: null is STILL a success — it asks for a re-read, never a retry', () => {
    const outcome = fixOutcome({ result: success({ diagnosis: null }) }, 'x')
    expect(outcome.kind).toBe('fixed')
    expect(outcome).toMatchObject({ diagnosis: null, reread: true, tellTheStoreEn: success().tellTheStoreEn })
  })

  it('a 200 with no data at all is still the fix standing: a re-read, not a failure', () => {
    expect(fixOutcome({ result: null }, 'x')).toEqual({ kind: 'fixed', tellTheStoreEn: '', tellTheStoreAr: '', diagnosis: null, reread: true })
  })

  it('PICK-00224 is a refusal that offers Refresh diagnosis and no second press', () => {
    const message = 'Delivery 8006777365 is not in shape DONOR_AT_OLD_ORDER_STORE — nothing was changed; refresh its diagnosis'
    expect(fixOutcome({ error: refusal('PICK-00224', message) }, 'x')).toEqual({
      kind: 'refused',
      code: 'PICK-00224',
      message,
      offerRefresh: true,
      canResend: false,
    })
  })

  it('PICK-00225 offers no refresh: the agent fills the fields and confirms again', () => {
    expect(fixOutcome({ error: refusal('PICK-00225', 'A reason and a complaint reference are required — nothing was changed') }, 'x')).toEqual({
      kind: 'refused',
      code: 'PICK-00225',
      message: 'A reason and a complaint reference are required — nothing was changed',
      offerRefresh: false,
      canResend: true,
    })
  })

  it('PICK-00003 and PICK-00002 show their code and message, with no refresh', () => {
    expect(fixOutcome({ error: refusal('PICK-00003', 'Shape X is not a stuck shape') }, 'x')).toMatchObject({ code: 'PICK-00003', offerRefresh: false })
    expect(fixOutcome({ error: refusal('PICK-00002', 'Delivery 8006777300 not found') }, 'x')).toMatchObject({ code: 'PICK-00002', offerRefresh: false })
  })

  it('a bodiless 403 reads denied, and pressing again cannot help', () => {
    expect(fixOutcome({ error: new ApiError('unknown', 'Unexpected 403', 403) }, 'x')).toEqual({ kind: 'denied' })
  })

  it('a failure with no code shows the fallback-backed message', () => {
    expect(fixOutcome({ error: new Error('boom') }, 'The fix could not be sent.')).toEqual({
      kind: 'refused',
      code: null,
      message: 'The fix could not be sent.',
      offerRefresh: false,
      canResend: true,
    })
  })
})
