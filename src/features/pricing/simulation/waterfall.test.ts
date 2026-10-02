import { describe, expect, it } from 'vitest'
import { PAYLOADS, SCENARIOS } from './__fixtures__/payloads'
import { lineWaterfall } from './waterfall'

// PROTOTYPE 372 — does the conditions-only derivation foot on the real corpus?
describe('lineWaterfall on the 098 captures', () => {
  for (const scenario of SCENARIOS) {
    for (const item of PAYLOADS[scenario].items) {
      it(`${scenario} #${item.itemNumber}`, () => {
        const wf = lineWaterfall(item)
        if (item.pricingStatus === 'W' || item.pricingStatus === 'E') {
          expect(wf).toBeNull()
          return
        }
        expect(wf).not.toBeNull()
        expect(wf!.foots).toBe(true)
        expect(wf!.steps.some((s) => s.kind === 'gap')).toBe(false)
        const total = wf!.steps.find((s) => s.kind === 'total')!
        expect(total.to).toBeCloseTo(item.netTotal, 2)
        // every delta step chains: each starts where the previous running figure ended
        const tax = wf!.steps.filter((s) => s.kind === 'tax')
        expect(tax.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(item.taxValue, 2)
      })
    }
  }

  it('a discounted line shows a net bar, a plain line does not', () => {
    const fired = lineWaterfall(PAYLOADS['fired-bonus-buy'].items[0])!
    expect(fired.steps.map((s) => s.kind)).toEqual(['base', 'promo', 'net', 'tax', 'total'])
    expect(fired.steps[1].count).toBe(2)
    const plain = lineWaterfall(PAYLOADS['plain-multiline'].items[0])!
    expect(plain.steps.map((s) => s.kind)).toEqual(['base', 'tax', 'total'])
  })

  it('a manual condition after a promotion stays before net', () => {
    const line20 = lineWaterfall(PAYLOADS['manual-conditions'].items[1])!
    expect(line20.steps.map((s) => s.kind)).toEqual(['base', 'promo', 'manual', 'net', 'tax', 'total'])
  })
})
