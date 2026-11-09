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

  it('a reason with no English name posts its Arabic name, and one with neither its code — never a blank note', () => {
    expect(requestCloseUpdate({ code: 'CARB', nameEn: '  ', nameAr: 'طلب العميل' }).note).toBe('طلب العميل')
    expect(requestCloseUpdate({ code: 'CXXX', nameEn: '', nameAr: '' }).note).toBe('CXXX')
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

describe('the dialog shows the list only once THIS open has read it', () => {
  const idle = { fetching: false, pickedCode: '' }

  it('a failed load cannot commit and says so', () => {
    expect(requestCloseCommit({ ...idle, status: 'error', reasons: undefined })).toEqual({
      view: 'failed',
      canCommit: false,
      picked: null,
    })
  })

  it('while loading, nothing can be committed', () => {
    const first = requestCloseCommit({ status: 'pending', fetching: true, reasons: undefined, pickedCode: 'CMIS' })
    expect(first).toEqual({ view: 'loading', canCommit: false, picked: null })
  })

  it('a reopen whose re-read is running shows loading, never the last open’s list, even with a pick', () => {
    const cached = { status: 'success' as const, fetching: true, reasons: [NO_ARABIC, MISTAKE], pickedCode: 'CMIS' }
    expect(requestCloseCommit(cached)).toEqual({ view: 'loading', canCommit: false, picked: null })
  })

  it('a reopen retrying a failed load shows loading, not the last failure', () => {
    expect(requestCloseCommit({ status: 'error', fetching: true, reasons: undefined, pickedCode: '' }).view).toBe('loading')
  })

  it('a loaded list commits only a reason it holds', () => {
    const loaded = { ...idle, status: 'success' as const, reasons: [NO_ARABIC, MISTAKE] }
    expect(requestCloseCommit(loaded)).toEqual({ view: 'ready', canCommit: false, picked: null })
    expect(requestCloseCommit({ ...loaded, pickedCode: 'GONE' }).canCommit).toBe(false)
    expect(requestCloseCommit({ ...loaded, pickedCode: 'CMIS' })).toEqual({ view: 'ready', canCommit: true, picked: MISTAKE })
  })

  it('a list that loaded EMPTY says there is no reason to pick, and cannot commit', () => {
    expect(requestCloseCommit({ ...idle, status: 'success', reasons: [] })).toEqual({
      view: 'empty',
      canCommit: false,
      picked: null,
    })
  })

  it('the load-failure, empty-list and grant-refused sentences ship in both languages', () => {
    const keys = [
      'requestClose.loadFailed',
      'requestClose.empty',
      'requestClose.grantRefused.title',
      'requestClose.grantRefused.detail',
    ]
    for (const locale of [en, ar]) for (const key of keys) expect(hasLocaleKey(locale, key), key).toBe(true)
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
