import { describe, expect, it } from 'vitest'

import { PAYLOADS, SCENARIOS } from './__fixtures__/payloads'
import { promoView } from './promo-view'
import { promoLineList } from './promo-lines'

/**
 * The promotion card's printed line list (ticket 117, spec 110 Tier 1).
 *
 * Driven by the eleven captured `Pricing/Simulate` responses rather than synthetic
 * blocks — the map's standing evidence rule, and the reason this rule exists at all:
 * the captures found a bonus buy that discounts TWO lines with one summed discount,
 * and reports them in wire order rather than line order.
 */
describe('promoLineList', () => {
  it('prints the two lines one bonus buy touched, sorted and de-duplicated', () => {
    // `05-pricing-elements` is the capture the rule was written for: one applied bonus
    // buy over a two-line basket, whose `affectedItemNumbers` arrive as [20, 10].
    const { blocks } = promoView(PAYLOADS['pricing-elements'])
    expect(blocks).toHaveLength(1)
    expect(promoLineList(blocks[0])).toEqual([10, 20])
  })

  it('sorts ascending — the wire order is not line order', () => {
    const wire = PAYLOADS['pricing-elements'].appliedBonusBuys[0].affectedItemNumbers
    // The guard on the assertion above: if the wire ever arrives sorted, that test
    // would pass without the rule doing anything.
    expect(wire).toEqual([20, 10])
  })

  it('de-duplicates a line named twice', () => {
    // A line sitting on both sides of an application (a self-discounted prerequisite)
    // reaches `touchedItems` once already; this pins the projection itself, so the
    // rule survives a caller that hands it a repeated ref.
    expect(promoLineList({ touchedItems: refs([20, 10, 20, 10, 30]) })).toEqual([10, 20, 30])
  })

  it('is empty for a promotion that resolved no basket line', () => {
    expect(promoLineList({ touchedItems: [] })).toEqual([])
  })

  it('never invents, drops or re-numbers a line across the whole corpus', () => {
    for (const scenario of SCENARIOS) {
      for (const block of promoView(PAYLOADS[scenario]).blocks) {
        const printed = promoLineList(block)
        const touched = block.touchedItems.map((i) => i.itemNumber)
        expect(new Set(printed)).toEqual(new Set(touched))
        expect(printed).toEqual([...printed].sort((a, b) => a - b))
      }
    }
  })

  it('names only lines that are in the basket', () => {
    // `touchedItems` is resolved against the result items, so a promotion referencing
    // a line the basket does not carry cannot print a number the table has no row for.
    for (const scenario of SCENARIOS) {
      const result = PAYLOADS[scenario]
      const basket = new Set(result.items.map((i) => i.itemNumber))
      for (const block of promoView(result).blocks) {
        for (const n of promoLineList(block)) expect(basket.has(n)).toBe(true)
      }
    }
  })
})

/** The minimum `touchedItems` shape the projection reads — only `itemNumber` matters. */
function refs(itemNumbers: number[]) {
  return itemNumbers.map((itemNumber) => ({
    itemNumber,
    materialNumber: '',
    materialDescription: '',
    quantity: 0,
    unitOfMeasure: '',
    grossValue: 0,
    netValue: 0,
  }))
}
