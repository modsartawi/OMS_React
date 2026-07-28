/**
 * What a basket line says it costs, why it costs that, and where the receipt's
 * figures come from (ticket 170).
 *
 * 🚩 The one property every case here exists to hold: **no figure on this screen
 * is arrived at by adding others together**. The line total is the engine's, the
 * receipt's four rows are `totals`', and a fixture whose lines deliberately do
 * NOT add up to its totals is what proves it — a console that summed would quote
 * the caller a different number from the till.
 *
 * 🚩 The fixture is read for SHAPE only (CONTRACT.md §11) — every value a case
 * turns on is set by the test.
 */
import { describe, expect, it } from 'vitest'
import type { FiredPromotion, SessionLine, SessionTotals } from '@/core/models/callcenter'
import { ATTACHED_SESSION } from './__fixtures__/payloads'
import { basketLineView, basketLineViews, receiptView } from './basket-view'

/** A priced engine line, with only what a case is about varied. */
const line = (over: Partial<SessionLine> = {}): SessionLine => ({
  lineId: 'L1',
  itemNumber: '100001',
  description: 'Panadol Extra 24 Tab',
  description2: 'بنادول اكسترا ٢٤ قرص',
  qty: 2,
  uom: 'EA',
  uomOptions: ['EA'],
  unitPrice: { net: 12, gross: 13.8 },
  lineTotal: { net: 24, gross: 27.6 },
  conditions: [
    { type: 'ZVKP', description: 'Store price', value: 12, isStatistical: false },
    { type: 'MWST', description: 'VAT 15%', value: 3.6, isStatistical: false },
  ],
  promotions: [],
  atpAtScan: { quantity: 5, frozenAt: '2026-07-27T09:15:41Z', known: true },
  belowAtpAtScan: false,
  warnings: [],
  ...over,
})

const totals = (over: Partial<SessionTotals> = {}): SessionTotals => ({
  net: 45.6,
  vat: 6.84,
  gross: 52.44,
  deliveryFee: { amount: 15, waived: false, thresholdGross: 200, conditionType: 'DFEE' },
  payable: 67.44,
  ...over,
})

describe('aLineShowsWhatItCostsAndWhyWithoutSumming', () => {
  it('🚩 takes the line total from the projection, never from its conditions', () => {
    // The conditions here add up to 999; the engine says 27.60. The engine wins,
    // and nothing in the module is in a position to disagree.
    const view = basketLineView(
      line({
        conditions: [
          { type: 'ZVKP', description: 'Store price', value: 500, isStatistical: false },
          { type: 'MWST', description: 'VAT 15%', value: 499, isStatistical: false },
        ],
      }),
      [],
    )
    expect(view.total).toBe(27.6)
  })

  it('🚩 keeps VAT a condition of its own, in the server’s own order', () => {
    // VAT *is* a separate 15% condition (§2.1) — the reason the search row's
    // estimate reads ~13% under the line beside it. Folding it into the price
    // would erase the one fact that explains the gap.
    const view = basketLineView(line(), [])
    expect(view.conditions.map((c) => c.type)).toEqual(['ZVKP', 'MWST'])
    expect(view.conditions.map((c) => c.value)).toEqual([12, 3.6])
  })

  it('marks a statistical condition rather than pricing with it', () => {
    // `isStatistical` is informational — it did not move the money. A row that
    // read like the others would be a figure the agent could quote.
    const view = basketLineView(
      line({
        conditions: [
          { type: 'ZVKP', description: 'Store price', value: 12, isStatistical: false },
          { type: 'ZSTA', description: 'Reference margin', value: 4, isStatistical: true },
        ],
      }),
      [],
    )
    expect(view.conditions.map((c) => c.isStatistical)).toEqual([false, true])
  })

  it('carries the line’s own fired promotions', () => {
    const promo = { offerId: 'BBY-4471', description: '70% 2nd PCS', amount: -8.4 }
    const view = basketLineView(line({ promotions: [promo] }), [])
    expect(view.promotions).toEqual([{ ...promo, sharedLines: 0 }])
  })

  it('picks up an order-level promotion that names this line', () => {
    // A promotion can fire across lines and be projected at the order rather than
    // on each line. A line it names is a line it fired on.
    const fired: FiredPromotion = {
      offerId: 'BBY-5510',
      description: 'Buy 2 get 1 free',
      amount: -19.5,
      lineIds: ['L1', 'L2'],
    }
    const view = basketLineView(line(), [fired])
    expect(view.promotions).toEqual([
      { offerId: 'BBY-5510', description: 'Buy 2 get 1 free', amount: -19.5, sharedLines: 1 },
    ])
  })

  it('🚩 never says the same promotion twice, and says when it is shared', () => {
    // The same offer on both projections is one promotion. And a promotion whose
    // value spans two lines must not read as this line's alone — the amount is
    // the OFFER's, not this line's share of it.
    const shared: FiredPromotion = {
      offerId: 'BBY-4471',
      description: '70% 2nd PCS',
      amount: -8.4,
      lineIds: ['L1', 'L2'],
    }
    const view = basketLineView(line({ promotions: [{ offerId: 'BBY-4471', description: '70% 2nd PCS', amount: -8.4 }] }), [shared])
    expect(view.promotions).toHaveLength(1)
    expect(view.promotions[0].sharedLines).toBe(1)
  })

  it('ignores a promotion that fired on some other line', () => {
    const elsewhere: FiredPromotion = { offerId: 'X', description: 'Elsewhere', amount: -1, lineIds: ['L9'] }
    expect(basketLineView(line(), [elsewhere]).promotions).toEqual([])
  })

  it('offers a unit of measure only where there is another one to pick', () => {
    // The same rule as the store chip (167): a control with nowhere to go is not
    // a control. The options are the SERVER's list — nothing here invents one.
    expect(basketLineView(line({ uom: 'EA', uomOptions: ['EA'] }), []).uomOptions).toEqual([])
    expect(basketLineView(line({ uom: 'EA', uomOptions: [] }), []).uomOptions).toEqual([])
    expect(basketLineView(line({ uom: 'EA', uomOptions: ['EA', 'BOX'] }), []).uomOptions).toEqual(['EA', 'BOX'])
  })

  it('🚩 offers a single option that is NOT the line’s own unit', () => {
    // Counting the list would refuse this one silently — one entry, and it is a
    // genuine correction. The line's own unit joins it so the control can show
    // what the line currently holds.
    expect(basketLineView(line({ uom: 'EA', uomOptions: ['BOX'] }), []).uomOptions).toEqual(['EA', 'BOX'])
  })

  it('reads availability as FROZEN at add, never as a live figure', () => {
    expect(basketLineView(line({ atpAtScan: { quantity: 5, frozenAt: null, known: true } }), []).availability.kind).toBe('count')
    expect(basketLineView(line({ atpAtScan: { quantity: 0, frozenAt: null, known: false } }), []).availability.kind).toBe('unknown')
  })

  it('reads the contract’s own two-line basket', () => {
    // Shape, not values: the fixture is provisional (§11).
    const views = basketLineViews(ATTACHED_SESSION)
    expect(views).toHaveLength(ATTACHED_SESSION.lines.length)
    expect(views[0].total).toBe(ATTACHED_SESSION.lines[0].lineTotal.gross)
    expect(views[0].conditions).toHaveLength(ATTACHED_SESSION.lines[0].conditions.length)
  })
})

describe('theReceiptIsEngineTruth', () => {
  it('🚩 reads every figure off totals, even when the lines disagree', () => {
    // The lines here sum to nothing like the totals. That is the whole point: the
    // console has no opinion about what the basket adds up to, so a projection
    // whose lines and totals disagree still quotes the caller the till's number.
    const view = receiptView(totals({ net: 1, vat: 2, payable: 3 }))
    expect(view.net).toBe(1)
    expect(view.vat).toBe(2)
    expect(view.payable).toBe(3)
  })

  it('quotes the delivery fee as it stands, live', () => {
    const view = receiptView(totals())
    expect(view.delivery).toEqual({ waived: false, waivedReason: null, amount: 15, thresholdGross: 200 })
  })

  it('🚩 reads a waiver as an outcome, not as a nought', () => {
    // `waived` is what the server DID — never a control the agent operates (map
    // note 4's correction). A waived fee drawn as `0.00` would read as a figure
    // someone chose.
    const view = receiptView(totals({ deliveryFee: { amount: 15, waived: true, thresholdGross: 200, conditionType: 'DFEE' } }))
    expect(view.delivery?.waived).toBe(true)
  })

  it('drops a threshold the server did not send rather than implying one', () => {
    const view = receiptView(
      totals({ deliveryFee: { amount: 15, waived: false, thresholdGross: 0, conditionType: 'DFEE' } }),
    )
    expect(view.delivery?.thresholdGross).toBeNull()
  })

  it('survives a projection with no fee block at all', () => {
    // §9 — a field the server did not send is not a crash, and not a zero either.
    const view = receiptView({ net: 1, vat: 2, gross: 3, payable: 3 } as SessionTotals)
    expect(view.delivery).toBeNull()
    expect(view.payable).toBe(3)
  })

  it('reads the contract’s own totals', () => {
    const view = receiptView(ATTACHED_SESSION.totals)
    expect(view.payable).toBe(ATTACHED_SESSION.totals.payable)
    expect(view.delivery?.amount).toBe(ATTACHED_SESSION.totals.deliveryFee.amount)
  })
})
