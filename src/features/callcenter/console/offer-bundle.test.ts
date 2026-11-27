import { describe, expect, it } from 'vitest'
import type { OfferDefinition } from '@/core/models/callcenter'
import { bundleNext, offerBundle } from './offer-bundle'
import { offerHeadline } from './offer-headline'
import { howItWorks } from './offer-sheet'

// BackOffice 4462: OMS000004508 on the 2026-11-28 walk — 50% off 106429 AND 50% off 103436, no buy side,
// with only 106429 on the order.
const fiftyOffBoth = (over: Partial<OfferDefinition> = {}): OfferDefinition => ({
  buyQty: null,
  buyUom: null,
  getQty: 1,
  getSameItem: false,
  discountType: 'percent',
  discountValue: 50,
  getAll: true,
  getItems: [
    { itemNumber: '106429', description: 'STONALI NATURAL 6.3 GM 30 SACHET', qty: 1, uom: 'EA', discountType: 'percent', discountValue: 50, have: 1 },
    { itemNumber: '103436', description: 'OTHER ITEM', qty: 1, uom: 'EA', discountType: 'percent', discountValue: 50, have: 0 },
  ],
  ...over,
})

describe('offerBundle', () => {
  it('names each item and says which one is missing', () => {
    const bundle = offerBundle(fiftyOffBoth())
    expect(bundle?.value).toBe(50)
    expect(bundle?.items.map((i) => [i.itemNumber, i.held, i.missing])).toEqual([
      ['106429', true, 0],
      ['103436', false, 1],
    ])
    expect(bundleNext(bundle)?.itemNumber).toBe('103436')
  })

  it('is not a bundle when any one item is enough (OR), or with a buy side', () => {
    expect(offerBundle(fiftyOffBoth({ getAll: false }))).toBeNull()
    expect(offerBundle(fiftyOffBoth({ buyQty: 3 }))).toBeNull()
  })

  it('is not a bundle on a v1.14 server that sends no get items', () => {
    expect(offerBundle({ ...fiftyOffBoth(), getItems: undefined, getAll: undefined })).toBeNull()
  })

  it('has no shared value when the arms differ', () => {
    const definition = fiftyOffBoth()
    definition.getItems![1] = { ...definition.getItems![1], discountValue: 30 }
    expect(offerBundle(definition)?.value).toBeNull()
  })
})

describe('a bundle in words', () => {
  it('headlines the shared discount on items bought together', () => {
    expect(offerHeadline(fiftyOffBoth(), '50% OFF')).toEqual({
      kind: 'phrase',
      phrase: { key: 'callcenter:offer.headline.bundlePercent', params: { value: 50, count: 2 } },
    })
  })

  it('says how it works with the item list, not the first arm alone', () => {
    const how = howItWorks(fiftyOffBoth(), { have: 0, need: 0, unitsHave: null, unitsNeed: null })
    expect(how.get).toEqual({ key: 'callcenter:offer.sheet.how.bundlePercent', params: { value: 50, count: 2 } })
    expect(how.buy).toBeNull()
    expect(how.bundle?.map((i) => i.itemNumber)).toEqual(['106429', '103436'])
    expect(how.progress).toEqual({ have: 1, total: 2 })
  })
})
