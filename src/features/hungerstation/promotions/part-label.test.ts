/**
 * Ticket 668 — a HungerStation promotion part's combination in words, English and Arabic: the part
 * preview from Check and the bundle's preview grid say it this way.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-promotions.json'
import ar from '@/locales/ar/hungerstation-promotions.json'
import { stripIsolates } from '@/core/util/bidi'
import { parseCombination, partLabel, type PartCombination } from './part-label'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'hungerstation-promotions': en }, ar: { 'hungerstation-promotions': ar } },
  ns: ['hungerstation-promotions'],
  defaultNS: 'hungerstation-promotions',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const say = (lng: 'en' | 'ar', c: PartCombination) =>
  partLabel(instance.getFixedT(lng, 'hungerstation-promotions') as never, c)

const combo = (buyQuantity: number, getQuantity: number, subtype: PartCombination['subtype'], value: number | null) => ({
  buyQuantity,
  getQuantity,
  subtype,
  value,
})

describe('partLabel', () => {
  it('PERCENTAGE: "Buy 2 get 1 at 50% off"', () => {
    expect(stripIsolates(say('en', combo(2, 1, 'PERCENTAGE', 50)))).toBe('Buy 2 get 1 at 50% off')
    expect(stripIsolates(say('ar', combo(2, 1, 'PERCENTAGE', 50)))).toBe('اشترِ 2 واحصل على 1 بخصم 50%')
  })

  it('buy-one-get-one-free (PERCENTAGE 100): "Buy 1 get 1 free"', () => {
    expect(stripIsolates(say('en', combo(1, 1, 'PERCENTAGE', 100)))).toBe('Buy 1 get 1 free')
    expect(stripIsolates(say('ar', combo(1, 1, 'PERCENTAGE', 100)))).toBe('اشترِ 1 واحصل على 1 مجانًا')
  })

  it('ABSOLUTE: an amount off, in SAR', () => {
    expect(stripIsolates(say('en', combo(3, 1, 'ABSOLUTE', 5)))).toBe('Buy 3 get 1 at 5.000 SAR off')
    expect(stripIsolates(say('ar', combo(3, 1, 'ABSOLUTE', 5)))).toBe('اشترِ 3 واحصل على 1 بخصم 5.000 SAR')
  })

  it('FINAL_PRICE: "Buy 2 get 1 for 9.950 SAR"', () => {
    expect(stripIsolates(say('en', combo(2, 1, 'FINAL_PRICE', 9.95)))).toBe('Buy 2 get 1 for 9.950 SAR')
    expect(stripIsolates(say('ar', combo(2, 1, 'FINAL_PRICE', 9.95)))).toBe('اشترِ 2 واحصل على 1 بسعر 9.950 SAR')
  })

  it('each machine value is isolated whole (the sentence may be RTL)', () => {
    expect(say('ar', combo(2, 1, 'PERCENTAGE', 50))).toBe('اشترِ ⁨2⁩ واحصل على ⁨1⁩ بخصم ⁨50%⁩')
  })

  it('no discount yet: buy and get only; a strikethrough part: all items', () => {
    expect(stripIsolates(say('en', combo(2, 1, 'PERCENTAGE', null)))).toBe('Buy 2 get 1')
    expect(say('en', { buyQuantity: null, getQuantity: null, subtype: null, value: null })).toBe('All items')
    expect(say('ar', { buyQuantity: null, getQuantity: null, subtype: 'PERCENTAGE', value: 20 })).toBe(ar.detail.allItems)
  })
})

// The detail's part carries its combination as ONE string (contract 3213): "ALL", or
// "B<buy>G<get>|<subtype>|<value>".
describe('parseCombination', () => {
  it('a strikethrough part is all items', () => {
    expect(parseCombination('ALL')).toEqual({ buyQuantity: null, getQuantity: null, subtype: null, value: null })
  })

  it('a bundle part reads its buy, get, subtype and value', () => {
    expect(parseCombination('B2G1|PERCENTAGE|50')).toEqual({ buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE', value: 50 })
    expect(parseCombination('B3G1|FINAL_PRICE|12.5')).toEqual({ buyQuantity: 3, getQuantity: 1, subtype: 'FINAL_PRICE', value: 12.5 })
  })

  it('what it cannot read is null (the part name still shows)', () => {
    expect(parseCombination('B2G1|HALF|x')).toEqual({ buyQuantity: 2, getQuantity: 1, subtype: null, value: null })
    expect(parseCombination('weird')).toEqual({ buyQuantity: null, getQuantity: null, subtype: null, value: null })
  })
})
