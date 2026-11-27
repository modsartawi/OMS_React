/**
 * Ticket 996 (spec 995 D2) — the pitch card's headline, from the definition and never from the
 * author's label. Expected values are the spec's own sentences.
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import type { OfferDefinition } from '@/core/models/callcenter'
import { offerHeadline } from './offer-headline'

const en = i18n.getFixedT('en')
const ar = i18n.getFixedT('ar')
const said = (definition: OfferDefinition | null, description = '3+1', t = en) => {
  const headline = offerHeadline(definition, description)
  return headline.kind === 'phrase' ? t(headline.phrase.key, headline.phrase.params) : headline.text
}

const def = (over: Partial<OfferDefinition>): OfferDefinition => ({
  buyQty: 3,
  buyUom: 'EA',
  getQty: 1,
  getSameItem: true,
  discountType: 'percent',
  discountValue: 100,
  ...over,
})

describe('buy3Get1FreeReadsAsTheFourthFree', () => {
  it('{3, 1, sameItem, percent 100} → "Buy 3, get the 4th free"', () => {
    expect(said(def({}))).toBe('Buy 3, get the 4th free')
  })

  it('the ordinal follows the figure: buy 1 → the 2nd, buy 2 → the 3rd, buy 20 → the 21st', () => {
    expect(said(def({ buyQty: 1 }))).toBe('Buy 1, get the 2nd free')
    expect(said(def({ buyQty: 2 }))).toBe('Buy 2, get the 3rd free')
    expect(said(def({ buyQty: 20 }))).toBe('Buy 20, get the 21st free')
  })

  it('two free of the same item, or one of another item, are said as a count', () => {
    expect(said(def({ getQty: 2 }))).toBe('Buy 3, get 2 more free')
    expect(said(def({ getSameItem: false }))).toBe('Buy 3, get 1 free')
  })

  it('a get side at part price says its percentage', () => {
    expect(said(def({ discountValue: 50 }))).toBe('Buy 3, get the 4th at 50% off')
  })

  it('Arabic is its own sentence, not the English word order', () => {
    const text = said(def({}), '3+1', ar)
    expect(text).toMatch(/اشترِ/)
    expect(text).not.toMatch(/Buy/)
  })
})

describe('percentOffWithNoGetSide', () => {
  it('{2, 0, percent 20} → "Buy 2, 20% off"', () => {
    expect(said(def({ buyQty: 2, getQty: 0, getSameItem: null, discountValue: 20 }))).toBe('Buy 2, 20% off')
  })

  it('an amount off and a set price keep their figure as the definition states it', () => {
    expect(said(def({ buyQty: 2, getQty: 0, discountType: 'amount', discountValue: 10 }))).toBe('Buy 2, 10 off')
    expect(said(def({ buyQty: 2, getQty: null, discountType: 'price', discountValue: 29.95 }))).toBe('Buy 2 for 29.95')
  })

  it('a value threshold (no buyQty) says the discount alone', () => {
    expect(said(def({ buyQty: null, getQty: 0, discountValue: 15 }))).toBe('15% off')
  })
})

describe('noDefinitionFallsBackToDescription', () => {
  it('no definition → the author’s description, verbatim', () => {
    expect(offerHeadline(null, '3+1')).toEqual({ kind: 'description', text: '3+1' })
    expect(offerHeadline(undefined, '3+1')).toEqual({ kind: 'description', text: '3+1' })
  })

  it('an unknown discount type, or no value, is an unknown shape → the description', () => {
    expect(offerHeadline(def({ discountType: 'ZB03' }), '3+1')).toEqual({ kind: 'description', text: '3+1' })
    expect(offerHeadline(def({ discountValue: null }), '3+1')).toEqual({ kind: 'description', text: '3+1' })
  })

  it('a get side with an amount or a price is not a shape the console can say → the description', () => {
    expect(offerHeadline(def({ discountType: 'amount', discountValue: 5 }), '3+1').kind).toBe('description')
  })
})
