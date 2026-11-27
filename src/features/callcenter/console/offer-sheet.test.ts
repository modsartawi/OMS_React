/**
 * Ticket 997 (spec 995 D5, D6) — the offer sheet's what-if read and the figures it may show.
 *
 * 🚩 RTL is not installed (spec 083), so the "component" proofs are taken here at the pure seam the
 * sheet's `useQuery` reads (its key and `enabled`) and the figure model it draws, and again in
 * `tools/callcenter-offer-sheet-drive.mjs` by counting the real requests.
 */
import { describe, expect, it } from 'vitest'
import type { FiredPromotion, OfferDefinition, OfferWhatIf } from '@/core/models/callcenter'
import type { GuidancePhrase } from './guidance-view'
import {
  addRows,
  definitionFigure,
  firedTotal,
  howItWorks,
  offerEnds,
  sheetApplied,
  sheetSay,
  sheetFigures,
  whatIfQuery,
  whoGetsIt,
} from './offer-sheet'

const buy3get1: OfferDefinition = {
  buyQty: 3,
  buyUom: 'EA',
  getQty: 1,
  getSameItem: true,
  discountType: 'percent',
  discountValue: 100,
}

// The server's own answer on the owner's case (BackOffice 4459, CONTRACT.md §3.9): `saving` is NEGATIVE.
const WHAT_IF: OfferWhatIf = {
  contractVersion: '1.14',
  offerId: 'OMS000004571',
  adds: [{ itemNumber: '509366', qty: 3, uom: 'EA' }],
  fires: true,
  saving: -98,
  payableBefore: 98,
  payableAfter: 294,
  unitAfter: 73.5,
}

describe('whatIfIsReadOnlyOnOpen', () => {
  it('a closed card makes no call', () => {
    expect(whatIfQuery({ transactionId: 'T1', offerId: 'OMS000004571', version: 7, open: false }).enabled).toBe(false)
  })
  it('the open sheet reads it', () => {
    expect(whatIfQuery({ transactionId: 'T1', offerId: 'OMS000004571', version: 7, open: true }).enabled).toBe(true)
  })
  it('an offer with a blank id (859) is never asked about, open or not', () => {
    expect(whatIfQuery({ transactionId: 'T1', offerId: '', version: 7, open: true }).enabled).toBe(false)
  })
})

describe('basketChangeMakesTheWhatIfStale', () => {
  it('the key is the transaction, the offer and the basket version', () => {
    expect(whatIfQuery({ transactionId: 'T1', offerId: 'OMS000004571', version: 7, open: true }).queryKey).toEqual([
      'callcenter',
      'offerWhatIf',
      'T1',
      'OMS000004571',
      7,
    ])
  })
  it('a version bump is a new key (one re-read); the same version is the same key (no re-read)', () => {
    const at = (version: number) =>
      JSON.stringify(whatIfQuery({ transactionId: 'T1', offerId: 'OMS000004571', version, open: true }).queryKey)
    expect(at(8)).not.toBe(at(7))
    expect(at(7)).toBe(at(7))
  })
})

describe('failedWhatIfShowsTheDefinitionNotAFigure', () => {
  it('while it loads: the definition, no figure', () => {
    expect(sheetFigures({ status: 'pending' }, buy3get1)).toEqual({
      kind: 'pending',
      definition: { key: 'callcenter:offer.sheet.definition.percent', params: { value: 100, count: 1 } },
    })
  })
  it('when it fails: the definition and the failure, never a figure', () => {
    const figures = sheetFigures({ status: 'error' }, buy3get1)
    expect(figures).toEqual({
      kind: 'failed',
      definition: { key: 'callcenter:offer.sheet.definition.percent', params: { value: 100, count: 1 } },
    })
    expect(JSON.stringify(figures)).not.toMatch(/saving|payable|unitAfter|98/)
  })
  it('when it answers: the engine’s figures verbatim, the saving as its size (the wire’s is negative)', () => {
    expect(sheetFigures({ status: 'success', data: WHAT_IF }, buy3get1)).toEqual({
      kind: 'priced',
      saving: 98,
      eachAfter: 73.5,
      payableBefore: 98,
      payableAfter: 294,
      fires: true,
    })
  })
  it('no `unitAfter` (several items): no per-unit figure — the client never divides', () => {
    const figures = sheetFigures({ status: 'success', data: { ...WHAT_IF, unitAfter: null } }, buy3get1)
    expect(figures.kind === 'priced' && figures.eachAfter).toBeNull()
  })
})

describe('whatIfRefusalsAreReadByCode', () => {
  const definition = { key: 'callcenter:offer.sheet.definition.percent', params: { value: 100, count: 1 } }
  it('🚩 ITEM_NOT_FOUND: the offer is no longer a near-miss — stale, not "couldn’t price"', () => {
    expect(sheetFigures({ status: 'error', code: 'ITEM_NOT_FOUND' }, buy3get1)).toEqual({ kind: 'stale', definition })
  })
  it('NO_PRICE_AT_PLANT (an unreadable record too) and ITEM_NOT_SELLABLE: couldn’t price, the card stays', () => {
    expect(sheetFigures({ status: 'error', code: 'NO_PRICE_AT_PLANT' }, buy3get1)).toEqual({ kind: 'failed', definition })
    expect(sheetFigures({ status: 'error', code: 'ITEM_NOT_SELLABLE' }, buy3get1)).toEqual({ kind: 'failed', definition })
  })
})

describe('definitionFigure', () => {
  it('percent off the get side: 100% off 1', () => {
    expect(definitionFigure(buy3get1)).toEqual({
      key: 'callcenter:offer.sheet.definition.percent',
      params: { value: 100, count: 1 },
    })
  })
  it('percent with no get side: off the buy side', () => {
    expect(definitionFigure({ ...buy3get1, getQty: 0, buyQty: 2, discountValue: 20 })).toEqual({
      key: 'callcenter:offer.sheet.definition.percent',
      params: { value: 20, count: 2 },
    })
  })
  it('an amount and a set price', () => {
    expect(definitionFigure({ ...buy3get1, getQty: null, discountType: 'amount', discountValue: 10 })).toEqual({
      key: 'callcenter:offer.sheet.definition.amount',
      params: { value: 10 },
    })
    expect(definitionFigure({ ...buy3get1, getQty: null, discountType: 'price', discountValue: 29.95 })).toEqual({
      key: 'callcenter:offer.sheet.definition.price',
      params: { value: 29.95 },
    })
  })
  it('no definition, or an unknown type: nothing', () => {
    expect(definitionFigure(null)).toBeNull()
    expect(definitionFigure({ ...buy3get1, discountType: 'ZB03' })).toBeNull()
  })
})

describe('howItWorks', () => {
  it('buy 3 of the item, get 1 more of it free, and units for the bar', () => {
    expect(howItWorks(buy3get1, { have: 0, need: 1, unitsHave: 1, unitsNeed: 3 })).toEqual({
      buy: { key: 'callcenter:offer.sheet.how.buy', params: { count: 3, uom: 'EA' } },
      get: { key: 'callcenter:offer.sheet.how.getSameFree', params: { count: 1 } },
      progress: { have: 1, total: 4 },
    })
  })
  it('a get side at a percent, on another item', () => {
    expect(howItWorks({ ...buy3get1, getSameItem: false, discountValue: 50 }, { have: 0, need: 1 }).get).toEqual({
      key: 'callcenter:offer.sheet.how.getOtherPercent',
      params: { count: 1, value: 50 },
    })
  })
  it('no get side: the discount is on what is bought; no units, no bar', () => {
    expect(howItWorks({ ...buy3get1, getQty: 0, discountValue: 20 }, { have: 0, need: 1 })).toEqual({
      buy: { key: 'callcenter:offer.sheet.how.buy', params: { count: 3, uom: 'EA' } },
      get: { key: 'callcenter:offer.sheet.how.buyPercent', params: { value: 20 } },
      progress: null,
    })
  })
  it('no definition: nothing to say in words', () => {
    expect(howItWorks(null, { have: 0, need: 1 })).toEqual({ buy: null, get: null, progress: null })
  })
})

describe('whoGetsIt', () => {
  it('the tiers, whether the caller qualifies, and phone orders', () => {
    expect(whoGetsIt({ channelOnly: true, tiers: ['P', 'G', 'S'], callerQualifies: true })).toEqual({
      tiers: ['P', 'G', 'S'],
      qualifies: true,
      phoneOnly: true,
    })
  })
  it('no tiers: every caller; no audience: nothing known', () => {
    expect(whoGetsIt({ channelOnly: false, tiers: [], callerQualifies: true })).toEqual({
      tiers: [],
      qualifies: true,
      phoneOnly: false,
    })
    expect(whoGetsIt(null)).toBeNull()
  })
})

describe('offerEnds', () => {
  const now = new Date(2026, 10, 27, 15, 0)
  it('days left and the day, however far away', () => {
    expect(offerEnds('2026-12-03', now)).toEqual({ date: '2026-12-03', days: 6 })
    expect(offerEnds('2027-03-01', now)).toEqual({ date: '2027-03-01', days: 94 })
  })
  it('past, or not a date: nothing', () => {
    expect(offerEnds('2026-11-20', now)).toBeNull()
    expect(offerEnds('soon', now)).toBeNull()
    expect(offerEnds(null, now)).toBeNull()
  })
})

describe('sheetSay', () => {
  const pitch: GuidancePhrase[] = [
    { key: 'callcenter:offer.say.addFree', params: { count: 3, free: 1 } },
    { key: 'callcenter:offer.say.phoneOnly', params: {} },
  ]
  it('the pitch, then the membership clause, then the engine’s saving once priced', () => {
    expect(
      sheetSay({
        pitch,
        who: { tiers: ['S'], qualifies: true, phoneOnly: true },
        priced: { saving: '98.00', after: '294.00' },
      }),
    ).toEqual([
      ...pitch,
      { key: 'callcenter:offer.say.qualifies', params: {} },
      { key: 'callcenter:offer.say.wouldSave', params: { amount: '98.00', after: '294.00', currency: true } },
    ])
  })
  it('🚩 no saving clause until the what-if answers, and no membership clause where it does not apply', () => {
    expect(sheetSay({ pitch, who: { tiers: ['S'], qualifies: false, phoneOnly: true }, priced: null })).toEqual(pitch)
    expect(sheetSay({ pitch, who: null, priced: null })).toEqual(pitch)
  })
})

describe('eachAddRowIsItsOwnItem', () => {
  const basket = [
    { itemNumber: '509366', description: 'OWNER CASE ITEM 509366' },
    { itemNumber: '100200', description: 'OTHER ITEM 100200' },
  ]

  it('names each row from its own item, and draws the prerequisite’s stock on its row only', () => {
    const adds = [
      { itemNumber: '509366', qty: 3, uom: 'EA' },
      { itemNumber: '100200', qty: 1, uom: null },
      { itemNumber: '777777', qty: 1 },
    ]
    expect(addRows(adds, basket, '509366')).toEqual([
      { itemNumber: '509366', qty: 3, uom: 'EA', name: 'OWNER CASE ITEM 509366', stock: true },
      { itemNumber: '100200', qty: 1, uom: null, name: 'OTHER ITEM 100200', stock: false },
      // Not on the basket: no name to say, so the row is its number.
      { itemNumber: '777777', qty: 1, uom: null, name: null, stock: false },
    ])
  })

  it('with no material prerequisite no row draws its stock', () => {
    expect(addRows([{ itemNumber: '509366', qty: 3, uom: 'EA' }], basket, '')).toEqual([
      { itemNumber: '509366', qty: 3, uom: 'EA', name: 'OWNER CASE ITEM 509366', stock: false },
    ])
  })
})

describe('appliedOnlyWhenTheOfferFiredAgain', () => {
  const fired = (amount: number, offerId = 'OMS000004571'): FiredPromotion => ({ offerId, description: '3+1', amount, lineIds: ['L10'] })

  it('totals what the offer gave when the sheet opened (nothing ⇒ 0, a blank id ⇒ 0)', () => {
    expect(firedTotal([], 'OMS000004571')).toBe(0)
    expect(firedTotal([fired(-98), fired(-5, 'OTHER')], 'OMS000004571')).toBe(98)
    expect(firedTotal([fired(-98, '')], '')).toBe(0)
  })

  it('first fire: Applied with the engine’s amount', () => {
    expect(sheetApplied(0, [fired(-98)], 'OMS000004571')).toBe(-98)
  })

  it('🚩 an offer that had already fired once and fires a second round: Applied', () => {
    expect(sheetApplied(98, [fired(-196)], 'OMS000004571')).toBe(-196)
  })

  it('🚩 an offer that had already fired, its second round only moved out of reach: not Applied', () => {
    expect(sheetApplied(98, [fired(-98)], 'OMS000004571')).toBeNull()
    expect(sheetApplied(98, [], 'OMS000004571')).toBeNull()
  })

  it('a blank id is never Applied: nothing addresses it', () => {
    expect(sheetApplied(0, [fired(-98, '')], '')).toBeNull()
  })
})
