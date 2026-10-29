/**
 * Ticket 667 (reconciled to the BackOffice 3201 door contract, 2026-10-29) — the Check panel's
 * reading of a Check answer `{ canSend, itemCount, duplicateCount, refusals[], warnings[], parts[] }`:
 * a refusal blocks Send, the `priceNotBelow` warning never does; issues are grouped per row
 * (material) and per header field (`rowNo` null). A refused Send (DHS-00018 / 00019) carries only
 * a message, so the page re-runs Check for the detail.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import en from '@/locales/en/hungerstation-promotions.json'
import ar from '@/locales/ar/hungerstation-promotions.json'
import type { HungerStationPromotionCheck, HungerStationPromotionCheckIssue } from '@/core/models/hungerstation'
import { HUNGERSTATION_PROMOTION_CHECK_CODES } from '@/core/models/hungerstation'
import { checkCellText, checkRefused, checkSummary, problemWords } from './check-summary'

const clean: HungerStationPromotionCheck = { promotionId: 'p', canSend: true, itemCount: 3, duplicateCount: 0, refusals: [], warnings: [], parts: [] }
const issue = (over: Partial<HungerStationPromotionCheckIssue>): HungerStationPromotionCheckIssue => ({
  code: 'materialNotListed',
  field: 'materialNumber',
  rowNo: 1,
  materialNumber: '101001',
  storeCodes: [],
  message: 'server words / كلمات',
  ...over,
})
const header = (field: string, code: string, over: Partial<HungerStationPromotionCheckIssue> = {}) => issue({ field, code, rowNo: null, materialNumber: null, ...over })
const warning = (materialNumber: string, storeCodes: string[]) => issue({ code: 'priceNotBelow', field: 'value', materialNumber, storeCodes })

describe('checkSummary', () => {
  it('a clean answer: nothing refuses, Send is open', () => {
    const s = checkSummary(clean)
    expect([s.refusals, s.warnings, s.blocksSend, s.rows.size, s.header.size, s.itemCount]).toEqual([0, 0, false, 0, 0, 3])
  })

  it('a price warning never blocks Send, and names its stores', () => {
    const s = checkSummary({ ...clean, warnings: [warning('101003', ['2001', '1001'])] })
    expect([s.blocksSend, s.warnings, s.refusedRows]).toEqual([false, 1, 0])
    expect(s.rows.get('101003')).toEqual({ refusals: [], warningStores: ['2001', '1001'] })
  })

  it('a row refusal blocks Send, grouped on its material', () => {
    const s = checkSummary({
      ...clean,
      canSend: false,
      refusals: [
        issue({ materialNumber: '101002', code: 'materialNotListed' }),
        issue({ materialNumber: '101001', code: 'percentOutOfRange', field: 'value' }),
        issue({ materialNumber: '101001', code: 'valueTooManyDecimals', field: 'value' }),
      ],
      warnings: [warning('101001', ['1001'])],
    })
    expect([s.blocksSend, s.refusals, s.refusedRows, s.warnings]).toEqual([true, 3, 2, 1])
    expect(s.rows.get('101001')?.refusals.map((p) => p.code)).toEqual(['percentOutOfRange', 'valueTooManyDecimals'])
    expect(s.rows.get('101002')?.warningStores).toEqual([])
  })

  it('a material warned twice keeps each store once', () => {
    const s = checkSummary({ ...clean, warnings: [warning('7', ['1001']), warning('7', ['1001', '1002'])] })
    expect(s.rows.get('7')?.warningStores).toEqual(['1001', '1002'])
  })

  it('header refusals (rowNo null) are grouped per field, in the order named, and block Send', () => {
    const s = checkSummary({ ...clean, canSend: false, refusals: [header('endAt', 'endPast'), header('displayNameAr', 'displayNameArMissing'), header('endAt', 'endMissing')] })
    expect([s.blocksSend, s.refusals, s.refusedRows]).toEqual([true, 3, 0])
    expect([...s.header.keys()]).toEqual(['endAt', 'displayNameAr'])
    expect(s.header.get('endAt')?.map((p) => p.code)).toEqual(['endPast', 'endMissing'])
  })

  it('the server saying it cannot send blocks Send even with no refusal listed; a listed refusal blocks it whatever canSend says', () => {
    expect(checkSummary({ ...clean, canSend: false }).blocksSend).toBe(true)
    expect(checkSummary({ ...clean, refusals: [header('stores', 'noStores')] }).blocksSend).toBe(true)
  })

  it('668: carries the part preview in the server’s order', () => {
    const parts = [
      { partNo: 1, combination: 'B2G1|PERCENTAGE|50', buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 50, skuCount: 600, name: 'Eid · B2G1 50%' },
      { partNo: 2, combination: 'B1G1|PERCENTAGE|100', buyQuantity: 1, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 100, skuCount: 300, name: 'Eid · B1G1 100%' },
    ]
    expect(checkSummary({ ...clean, parts, itemCount: 900 }).parts.map((p) => [p.name, p.skuCount])).toEqual([
      ['Eid · B2G1 50%', 600],
      ['Eid · B1G1 100%', 300],
    ])
  })
})

const refusal = (code: string) => new ApiError('business', 'The promotion cannot be sent: row 2: …', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'x' }])

describe('checkRefused — a Send or edit refused by its checks', () => {
  it('DHS-00018 and DHS-00019 are; anything else is not', () => {
    expect(checkRefused(refusal('DHS-00018'))).toBe(true)
    expect(checkRefused(refusal('DHS-00019'))).toBe(true)
    expect(checkRefused(refusal('DHS-00017'))).toBe(false)
    expect(checkRefused(new Error('x'))).toBe(false)
  })
})

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'hungerstation-promotions': en }, ar: { 'hungerstation-promotions': ar } },
  ns: ['hungerstation-promotions'],
  defaultNS: 'hungerstation-promotions',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const tOf = (lng: 'en' | 'ar') => instance.getFixedT(lng, 'hungerstation-promotions') as never

describe('problemWords', () => {
  it.each(['en', 'ar'] as const)('every refusal code of the contract has its own words (%s)', (lng) => {
    for (const code of HUNGERSTATION_PROMOTION_CHECK_CODES) {
      const words = problemWords(tOf(lng), issue({ code, message: 'SERVER' }))
      expect([code, words === 'SERVER' || words.startsWith('check.codes')]).toEqual([code, false])
    }
  })

  it('a code it does not know reads in the server’s words', () => {
    expect(problemWords(tOf('en'), issue({ code: 'somethingNew', message: 'row 2: new / جديد' }))).toBe('row 2: new / جديد')
  })

  it('storeNotOnboarded names the stores, isolated whole', () => {
    expect(problemWords(tOf('en'), header('stores', 'storeNotOnboarded', { storeCodes: ['1001', '1002'] }))).toBe(
      'These stores are no longer onboarded stores of the chain: ⁨1001, 1002⁩.',
    )
  })
})

describe('checkCellText — the preview grid’s Check cell (bidi rule: no isolate in a grid value)', () => {
  it('a refusal whose words interpolate a figure carries no FSI / PDI', () => {
    const text = checkCellText(tOf('en'), { refusals: [issue({ code: 'tooManySkus' })], warningStores: [] })
    expect(text).toContain('20,000')
    expect(text).not.toMatch(/[⁦-⁩]/)
  })

  it('refusals in words, else the price warning counted, else blank', () => {
    expect(checkCellText(tOf('en'), { refusals: [issue({ code: 'materialNotListed' })], warningStores: ['1001'] })).toBe('The material is not on the HungerStation material list.')
    expect(checkCellText(tOf('en'), { refusals: [], warningStores: ['1001', '2001'] })).toBe('HungerStation will refuse it at 2 stores')
    expect(checkCellText(tOf('en'), null)).toBe('')
  })
})
