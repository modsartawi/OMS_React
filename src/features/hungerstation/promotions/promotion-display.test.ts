/**
 * Ticket 665 — a promotion's machine values as ONE string each (bidi rule): a discount with its
 * unit, a part's buy/get, the window. Review C3 (2026-10-29): the unit is a LOCALE template
 * (`units.*`), never glued in code, and a percentage reads through the figure formatter too.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-promotions.json'
import ar from '@/locales/ar/hungerstation-promotions.json'
import { buyGetText, discountText, windowText } from './promotion-display'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'hungerstation-promotions': en }, ar: { 'hungerstation-promotions': ar } },
  ns: ['hungerstation-promotions'],
  defaultNS: 'hungerstation-promotions',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const t = instance.getFixedT('en', 'hungerstation-promotions') as never

describe('discountText', () => {
  it('a percentage reads with %, an amount or a final price with SAR at 3 decimals', () => {
    expect(discountText(t, 'PERCENTAGE', 50)).toBe('50%')
    expect(discountText(t, 'PERCENTAGE', 12.5)).toBe('12.5%')
    expect(discountText(t, 'ABSOLUTE', 5)).toBe('5.000 SAR')
    expect(discountText(t, 'FINAL_PRICE', 9.95)).toBe('9.950 SAR')
  })

  it('the unit comes from the locale', () => {
    expect(en.units).toEqual({ PERCENTAGE: '{{value}}%', SAR: '{{value}} SAR' })
    expect(Object.keys(ar.units).sort()).toEqual(['PERCENTAGE', 'SAR'])
  })

  it('no value (a draft default left blank) is blank; an unknown subtype keeps its value bare', () => {
    expect(discountText(t, 'PERCENTAGE', null)).toBe('')
    expect(discountText(t, null, null)).toBe('')
    expect(discountText(t, 'BOGUS', 3)).toBe('3')
  })
})

describe('buyGetText', () => {
  it('a bundle part reads B<buy>G<get>; a strikethrough part (all nulls) has none', () => {
    expect(buyGetText({ buyQuantity: 2, getQuantity: 1 })).toBe('B2G1')
    expect(buyGetText({ buyQuantity: null, getQuantity: null })).toBeNull()
  })
})

describe('windowText', () => {
  it('the local start and end, formatted, as one range', () => {
    expect(windowText('2026-11-01T00:00:00', '2026-11-30T23:59:00')).toBe('2026-11-01 00:00 – 2026-11-30 23:59')
  })

  it('a draft with no window yet is blank; a missing end is a dash', () => {
    expect(windowText(null, null)).toBe('')
    expect(windowText('2026-11-01T00:00:00', null)).toBe('2026-11-01 00:00 – —')
  })
})
