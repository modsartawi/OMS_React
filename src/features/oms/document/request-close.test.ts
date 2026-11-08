/**
 * Ticket 855 (BackOffice spec 3461, door 3462) — the Request cancellation dialog picks from the server's
 * cancellation reasons, shows each in the user's language, and posts the code with the English name.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/document.json'
import ar from '@/locales/ar/document.json'
import { hasLocaleKey } from '@/core/test/locale'
import type { CancellationReasonModel } from '@/core/models/sd-document'
import { buildUpdateHeader } from './actions'
import {
  cancellationReasonName,
  requestCloseCommit,
  requestCloseRefusalKeyOf,
  requestCloseUpdate,
} from './request-close'

const MISTAKE: CancellationReasonModel = { code: 'CMIS', nameEn: 'Order placed by mistake', nameAr: 'تم إنشاء الطلب بالخطأ' }
const NO_ARABIC: CancellationReasonModel = { code: 'CDUP', nameEn: 'Duplicate order', nameAr: '' }

describe('the request carries the code and the English name', () => {
  it('even when the Arabic name was shown', () => {
    const { note, extras } = requestCloseUpdate(MISTAKE)
    expect(buildUpdateHeader('8000000253', 'DRCL', note, extras)).toEqual({
      documentNo: '8000000253',
      actionType: 'DRCL',
      note: 'Order placed by mistake',
      reasonCode: 'CMIS',
    })
  })

  it('a request built without a reason carries no code (every other action stays as it was)', () => {
    expect(buildUpdateHeader('8000000253', 'DADN', 'hello')).toEqual({
      documentNo: '8000000253',
      actionType: 'DADN',
      note: 'hello',
    })
  })
})

describe('names follow the UI language', () => {
  it('Arabic under ar, English under en', () => {
    expect(cancellationReasonName(MISTAKE, 'ar')).toBe('تم إنشاء الطلب بالخطأ')
    expect(cancellationReasonName(MISTAKE, 'ar-SA')).toBe('تم إنشاء الطلب بالخطأ')
    expect(cancellationReasonName(MISTAKE, 'en')).toBe('Order placed by mistake')
  })

  it('a reason with no Arabic name shows its English one under ar', () => {
    expect(cancellationReasonName(NO_ARABIC, 'ar')).toBe('Duplicate order')
  })
})

describe('a failed load disables commit and says why', () => {
  it('a failed load cannot commit and names the load failure', () => {
    expect(requestCloseCommit({ status: 'error', reasons: undefined, pickedCode: '' })).toEqual({
      canCommit: false,
      picked: null,
      loadFailed: true,
    })
  })

  it('while loading, nothing can be committed', () => {
    expect(requestCloseCommit({ status: 'pending', reasons: undefined, pickedCode: 'CMIS' }).canCommit).toBe(false)
  })

  it('a loaded list commits only a reason it holds', () => {
    const loaded = { status: 'success' as const, reasons: [NO_ARABIC, MISTAKE] }
    expect(requestCloseCommit({ ...loaded, pickedCode: '' })).toEqual({ canCommit: false, picked: null, loadFailed: false })
    expect(requestCloseCommit({ ...loaded, pickedCode: 'GONE' }).canCommit).toBe(false)
    expect(requestCloseCommit({ ...loaded, pickedCode: 'CMIS' })).toEqual({ canCommit: true, picked: MISTAKE, loadFailed: false })
  })

  it('the load failure sentence ships in both languages', () => {
    for (const locale of [en, ar]) expect(hasLocaleKey(locale, 'requestClose.loadFailed')).toBe(true)
  })
})

describe('a reason retired while the dialog was open is refused by code', () => {
  it('SDD-02235 has its own words in both languages; any other code shows the server sentence', () => {
    const key = requestCloseRefusalKeyOf('SDD-02235')
    expect(key).toBe('requestClose.refused.unknownReason')
    for (const locale of [en, ar]) expect(hasLocaleKey(locale, key!)).toBe(true)
    expect(requestCloseRefusalKeyOf('SDD-99999')).toBeNull()
    expect(requestCloseRefusalKeyOf(null)).toBeNull()
  })
})
