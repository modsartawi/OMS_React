/**
 * Spec 995 reconcile (BackOffice 4459) — an offer's Add for an item ALREADY on the order is a
 * `changeQty` of that line, because the console refuses a repeat `addItem` (`ITEM_ALREADY_ON_ORDER`,
 * any unit) and the what-if priced exactly that: the line growing.
 */
import { describe, expect, it } from 'vitest'
import { guidanceAddPlan } from './guidance-add-plan'

const line = (lineId: string, itemNumber: string, qty: number, uom = 'EA') => ({ lineId, itemNumber, qty, uom })

describe('anAddForAnItemOnTheOrderGrowsItsLine', () => {
  it('🚩 the owner’s case: 509366 × 1 in the basket, Add 3 ⇒ changeQty of that line to 4', () => {
    expect(guidanceAddPlan({ itemNumber: '509366', qty: 3, uom: 'EA' }, [line('L10', '509366', 1)])).toEqual({
      kind: 'grow',
      lineId: 'L10',
      qty: 4,
    })
  })

  it('an item not on the order is an addItem, carrying the offer’s unit', () => {
    expect(guidanceAddPlan({ itemNumber: '100200', qty: 1, uom: 'EA' }, [line('L10', '509366', 1)])).toEqual({
      kind: 'add',
      itemNumber: '100200',
      qty: 1,
      uom: 'EA',
    })
  })

  it('no unit named (a record with none): an addItem in the engine’s default unit', () => {
    expect(guidanceAddPlan({ itemNumber: '100200', qty: 2 }, [])).toEqual({ kind: 'add', itemNumber: '100200', qty: 2, uom: null })
  })

  it('no unit named still grows the line already on the order', () => {
    expect(guidanceAddPlan({ itemNumber: '509366', qty: 2, uom: null }, [line('L10', '509366', 1, 'BOX')])).toEqual({
      kind: 'grow',
      lineId: 'L10',
      qty: 3,
    })
  })

  it('the unit is compared without case', () => {
    expect(guidanceAddPlan({ itemNumber: '509366', qty: 3, uom: 'ea' }, [line('L10', '509366', 1, 'EA')])).toEqual({
      kind: 'grow',
      lineId: 'L10',
      qty: 4,
    })
  })

  it('🚩 the line is in another unit (3 EA beside a BOX): nothing the console can send honestly', () => {
    // The server's what-if prices a new EA line here, but a real addItem of an article already on
    // the order is refused (ITEM_ALREADY_ON_ORDER, any unit), and 3 BOX is not 3 EA.
    expect(guidanceAddPlan({ itemNumber: '509366', qty: 3, uom: 'EA' }, [line('L10', '509366', 1, 'BOX')])).toEqual({
      kind: 'otherUnit',
      lineId: 'L10',
      lineUom: 'BOX',
    })
  })
})
