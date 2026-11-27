/**
 * Ticket 996 (spec 995 D3) — progress is UNITS: one slot per unit of the completed offer, and
 * the primary action names exactly how many to add.
 */
import { describe, expect, it } from 'vitest'
import type { OfferDefinition } from '@/core/models/callcenter'
import { offerAdd, offerStrip } from './offer-strip'

const buy3get1: OfferDefinition = {
  buyQty: 3,
  buyUom: 'EA',
  getQty: 1,
  getSameItem: true,
  discountType: 'percent',
  discountValue: 100,
}

describe('stripIsUnitsPlusFree', () => {
  it('have 1, need 3, get 1 → [in, add, add, FREE]', () => {
    expect(offerStrip({ have: 0, need: 1, unitsHave: 1, unitsNeed: 3 }, buy3get1)?.slots).toEqual([
      'in',
      'add',
      'add',
      'free',
    ])
  })

  it('counts what is in the basket against the whole offer: 1 of 4', () => {
    const strip = offerStrip({ have: 0, need: 1, unitsHave: 1, unitsNeed: 3 }, buy3get1)
    expect([strip?.have, strip?.total]).toEqual([1, 4])
  })

  it('no get side → the buy units alone; have beyond need never overfills', () => {
    const percent = { ...buy3get1, getQty: 0 }
    expect(offerStrip({ have: 0, need: 1, unitsHave: 5, unitsNeed: 2 }, percent)?.slots).toEqual(['in', 'in'])
  })

  it('no unitsHave (a v1.13 server, a value threshold) → no strip', () => {
    expect(offerStrip({ have: 0, need: 1 }, buy3get1)).toBeNull()
    expect(offerStrip({ have: 0, need: 1, unitsHave: null, unitsNeed: 3 }, buy3get1)).toBeNull()
  })
})

describe('addNamesTheMissingQuantity', () => {
  it('buy 3 get the 4th free with 1 in → add 3, 1 of them free', () => {
    expect(offerAdd({ have: 0, need: 1, unitsHave: 1, unitsNeed: 3 }, buy3get1)).toEqual({ qty: 3, free: 1 })
  })

  it('a free unit of ANOTHER item is not part of this add', () => {
    expect(offerAdd({ have: 0, need: 1, unitsHave: 1, unitsNeed: 3 }, { ...buy3get1, getSameItem: false })).toEqual({
      qty: 2,
      free: 0,
    })
  })

  it('buy side met → only the free one is left to add', () => {
    expect(offerAdd({ have: 1, need: 1, unitsHave: 3, unitsNeed: 3 }, buy3get1)).toEqual({ qty: 1, free: 1 })
  })

  it('no units → no add', () => {
    expect(offerAdd({ have: 0, need: 1 }, buy3get1)).toBeNull()
  })
})
