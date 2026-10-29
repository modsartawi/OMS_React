/**
 * Ticket 665 — a promotion's machine values as ONE string each (bidi rule): a discount with its
 * unit, a part's buy/get, the window. Expected values are written out by hand.
 */
import { describe, expect, it } from 'vitest'
import { buyGetText, discountText, windowText } from './promotion-display'

describe('discountText', () => {
  it('a percentage reads with %, an amount or a final price with SAR at 3 decimals', () => {
    expect(discountText('PERCENTAGE', 50)).toBe('50%')
    expect(discountText('PERCENTAGE', 12.5)).toBe('12.5%')
    expect(discountText('ABSOLUTE', 5)).toBe('5.000 SAR')
    expect(discountText('FINAL_PRICE', 9.95)).toBe('9.950 SAR')
  })

  it('no value (a draft default left blank) is blank; an unknown subtype keeps its value bare', () => {
    expect(discountText('PERCENTAGE', null)).toBe('')
    expect(discountText(null, null)).toBe('')
    expect(discountText('BOGUS', 3)).toBe('3')
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
})
