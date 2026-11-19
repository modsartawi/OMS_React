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

/**
 * Spec 4040 / ticket 921: the missed card labels the bonus buy's HEADER minimum with its basis,
 * read from the engine result's `minValueInclVat` (BackOffice 4041). A prerequisite's own
 * minimum is always excl. VAT, so it carries no basis at all.
 */
describe('promoView().missed minimum', () => {
  const potential = (over: Record<string, unknown>) =>
    promoView({
      items: [],
      appliedBonusBuys: [],
      potentialBonusBuys: [
        {
          bbyNumber: 'B1',
          promoNumber: 'P1',
          offerId: 'O1',
          description: 'Spend 100 get 10% off',
          minValue: 100,
          maxValue: 0,
          prerequisites: [
            {
              prereqNumber: '1',
              materialNumber: null,
              matGrouping: 'G1',
              requiredQty: 0,
              foundQty: 0,
              minValue: 40,
              foundValue: 12.5,
              isMet: false,
            },
          ],
          discount: { discountType: '%', value: 10, conditionType: 'ZB12' },
          skipReason: null,
          ...over,
        },
      ],
    } as never).missed[0]

  it('labels a marked header minimum incl. VAT', () => {
    expect(potential({ minValueInclVat: true }).minimum).toEqual({ value: 100, inclVat: true })
  })

  it('leaves an unmarked or pre-4041 header minimum unlabelled', () => {
    expect(potential({ minValueInclVat: false }).minimum).toEqual({ value: 100, inclVat: false })
    expect(potential({}).minimum).toEqual({ value: 100, inclVat: false })
  })

  it('has no minimum line without a header minimum', () => {
    expect(potential({ minValue: 0, minValueInclVat: true }).minimum).toBeNull()
  })

  it('never labels the prerequisite minimum, even on a marked bonus buy', () => {
    const prereq = potential({ minValueInclVat: true }).prereq
    expect(prereq?.minValue).toBe(40)
    expect(prereq).not.toHaveProperty('inclVat')
    expect(prereq).not.toHaveProperty('minValueInclVat')
  })
})
