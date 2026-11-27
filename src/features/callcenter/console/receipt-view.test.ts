/**
 * The summary column's receipt (spec 983 D6, ticket 986): Original · Discount ·
 * Subtotal · VAT · Delivery fee · Total, and *Caller saves …*.
 *
 * 🚩 Every figure here is a literal the server sent — the walk basket of BackOffice
 * 4454 (NOV10 + Panadol + 2 × Vichy + 238321: 214.28 before discount, 20.73 off,
 * 193.55 net). Nothing is expected because it adds up; a receipt that summed would
 * still pass a case whose figures agreed, so the cases below deliberately DISAGREE.
 */
import { describe, expect, it } from 'vitest'
import type { SessionTotals } from '@/core/models/callcenter'
import { receipt } from './receipt-view'

const fee = { amount: 15, waived: false, waivedReason: null, thresholdGross: 300, conditionType: 'DFEE' }

/** A v1.13 `totals` (contract §2, C1). */
const v113 = (over: Partial<SessionTotals> = {}): SessionTotals => ({
  beforeDiscount: 214.28,
  discount: 20.73,
  net: 193.55,
  vat: 29.03,
  gross: 222.58,
  deliveryFee: fee,
  payable: 237.58,
  ...over,
})

describe('theReceiptPrintsTheServersFigures', () => {
  it('prints Original · Discount · Subtotal · VAT in that order, each verbatim', () => {
    const view = receipt(v113(), { delivering: true })
    expect(view.figures).toEqual([
      { id: 'original', amount: 214.28 },
      { id: 'discount', amount: 20.73 },
      { id: 'subtotal', amount: 193.55 },
      { id: 'vat', amount: 29.03 },
    ])
    expect(view.total).toBe(237.58)
  })

  it('🚩 prints what it is given even when the figures do not add up', () => {
    // 100 − 7 is not 50, and 50 + 9 + 15 is not 1: a receipt that subtracted or
    // summed would show something else here.
    const view = receipt(
      v113({ beforeDiscount: 100, discount: 7, net: 50, vat: 9, payable: 1 }),
      { delivering: true },
    )
    expect(view.figures.map((f) => f.amount)).toEqual([100, 7, 50, 9])
    expect(view.total).toBe(1)
    expect(view.saves).toBe(7)
  })

  it('🚩 a v1.12 payload (no beforeDiscount) hides Original and Discount rather than inventing them', () => {
    const { beforeDiscount: _b, discount: _d, ...v112 } = v113()
    const view = receipt(v112 as SessionTotals, { delivering: true })
    expect(view.figures).toEqual([
      { id: 'subtotal', amount: 193.55 },
      { id: 'vat', amount: 29.03 },
    ])
    expect(view.saves).toBeNull()
  })

  it('a half-sent pair (discount without beforeDiscount) is not drawn either', () => {
    const { beforeDiscount: _b, ...half } = v113()
    const view = receipt(half as SessionTotals, { delivering: true })
    expect(view.figures.map((f) => f.id)).toEqual(['subtotal', 'vat'])
    expect(view.saves).toBeNull()
  })

  it('the caller saves the server’s discount, and nothing when there is none', () => {
    expect(receipt(v113(), { delivering: true }).saves).toBe(20.73)
    const none = receipt(v113({ beforeDiscount: 193.55, discount: 0 }), { delivering: true })
    expect(none.saves).toBeNull()
    // The rows still print: the server said "nothing off", and that is a figure.
    expect(none.figures.map((f) => f.id)).toEqual(['original', 'discount', 'subtotal', 'vat'])
  })

  it('quotes a standing fee with its threshold', () => {
    expect(receipt(v113(), { delivering: true }).fee).toEqual({ kind: 'amount', amount: 15, thresholdGross: 300 })
  })

  it('draws no fee at all on a collection order (absent, not zero)', () => {
    expect(receipt(v113(), { delivering: false }).fee).toBeNull()
  })

  it('draws no fee where the projection carried no fee block (§9)', () => {
    const { deliveryFee: _f, ...bare } = v113()
    expect(receipt(bare as SessionTotals, { delivering: true }).fee).toBeNull()
  })
})

describe('aWaivedFeeIsStruckWithItsReason', () => {
  it('🚩 strikes the waived fee’s own amount and names the server’s reason', () => {
    const view = receipt(
      v113({ deliveryFee: { ...fee, waived: true, waivedReason: 'ThresholdReached' } }),
      { delivering: true },
    )
    expect(view.fee).toEqual({ kind: 'waived', struck: 15, reason: 'ThresholdReached' })
  })

  it('a campaign waiver names the campaign', () => {
    const view = receipt(
      v113({ deliveryFee: { ...fee, amount: 25, waived: true, waivedReason: 'PromotionalWindow' } }),
      { delivering: true },
    )
    expect(view.fee).toEqual({ kind: 'waived', struck: 25, reason: 'PromotionalWindow' })
  })

  it('a reason this console has no sentence for degrades to "free" with no reason (§9)', () => {
    const view = receipt(
      v113({ deliveryFee: { ...fee, waived: true, waivedReason: 'SomethingNew' as never } }),
      { delivering: true },
    )
    expect(view.fee).toEqual({ kind: 'waived', struck: 15, reason: null })
  })

  it('a waived fee of nought has nothing to strike', () => {
    const view = receipt(
      v113({ deliveryFee: { ...fee, amount: 0, waived: true, waivedReason: 'ThresholdReached' } }),
      { delivering: true },
    )
    expect(view.fee).toEqual({ kind: 'waived', struck: null, reason: 'ThresholdReached' })
  })
})
