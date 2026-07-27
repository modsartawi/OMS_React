import { describe, expect, it } from 'vitest'

import { PAYLOADS } from './__fixtures__/payloads'
import { promoView } from './promo-view'

/**
 * `theMissedCardPromisesNoTotal` — ticket 161, spec 160 US38.
 *
 * A missed promotion says what the offer GIVES, never what it would save. A real
 * savings total requires firing the promotion (spec 574 US26); the wire carries no
 * such field and none may be computed client-side.
 *
 * The assertion is deliberately about the SHAPE, not the render: the bug was not
 * that someone formatted a number badly, it was that the view model published a
 * field called `wouldSave` holding a percentage. A future caller can only
 * re-introduce a savings total by reading a field, so the view model exposes none.
 */
describe('promoView().missed', () => {
  it('publishes a discount definition where the fabricated total used to be', () => {
    // `01-near-miss-owner-supplied` is the capture the bug was found in: the
    // promotion `70% 2nd PCS`, whose wire discount is `{ '%', 35 }`. That 35 went
    // through `formatMoney` beside a currency word and read `35.00 SAR`.
    const { missed } = promoView(PAYLOADS['near-miss-owner-supplied'])
    expect(missed).toHaveLength(1)
    expect(missed[0].kind).toBe('percent')
    expect(missed[0].definition).toEqual({
      key: 'common:discount.percent',
      params: { value: '35' },
    })
  })

  it('carries the set-price capture’s definition too, with no currency of its own', () => {
    // `03-applied-and-potential-owner-supplied`: `2 PC for 29.95 SR`, wire value
    // 26.04 ex-VAT. The server's own `SR` rides the description, untouched — the
    // rule is that no figure the CLIENT composes is formatted as money.
    const { missed } = promoView(PAYLOADS['applied-and-potential'])
    expect(missed).toHaveLength(1)
    expect(missed[0].definition).toEqual({ key: 'common:discount.setPrice', params: { value: '26.04' } })
    expect(missed[0].description).toBe('2 PC for 29.95 SR')
  })

  it('exposes no savings figure at all, on any capture', () => {
    // The guard that outlives this slice: not "wouldSave is gone" but "there is no
    // field a caller could mistake for a total". Anything numeric on a missed entry
    // belongs to the prerequisite meter, which is found-vs-required, not money.
    for (const result of Object.values(PAYLOADS)) {
      for (const m of promoView(result).missed) {
        expect(m).not.toHaveProperty('wouldSave')
        const stray = Object.entries(m).filter(([, v]) => typeof v === 'number')
        expect(stray).toEqual([])
      }
    }
  })

  it('leaves the definition null when the discount code did not classify', () => {
    // Honest absence, the same way `kind` is null — the card falls back to the
    // server's description rather than inventing a phrase.
    const view = promoView({
      items: [],
      appliedBonusBuys: [],
      potentialBonusBuys: [
        {
          bbyNumber: 'B1',
          promoNumber: 'P1',
          offerId: 'O1',
          description: 'Something the taxonomy has never seen',
          prerequisites: [],
          discount: { discountType: 'Z', value: 9, conditionType: 'ZZZZ' },
          skipReason: null,
        },
      ],
    } as never)
    expect(view.missed[0].kind).toBeNull()
    expect(view.missed[0].definition).toBeNull()
  })
})
