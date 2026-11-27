/**
 * The promotions panel's view model (spec 983 D7, ticket 987): Applied · One step away.
 *
 * Expected values are literals off the fixtures, never recomputed the way the module does.
 */
import { describe, expect, it } from 'vitest'
import type { FiredPromotion, NearMiss, OfferDefinition, SessionLine, SessionState } from '@/core/models/callcenter'
import { ATTACHED_SESSION, GET_SHORTFALL, NEAR_MISS_CLASSES } from './__fixtures__/payloads'
import { promotionsPanel, rememberDefinitions } from './promotions-panel'

const line = (lineId: string): SessionLine => ({ ...ATTACHED_SESSION.lines[0], lineId })

/** The NOV10 walk's shape: four lines, the coupon on 1, 3 and 4, medicine (L20) skipped. */
const walk = (over: Partial<SessionState> = {}): SessionState => ({
  ...ATTACHED_SESSION,
  lines: [line('L10'), line('L20'), line('L30'), line('L40')],
  firedPromotions: [{ offerId: '', description: '10% Coupon', amount: -20.73, lineIds: ['L40', 'L10', 'L30'] }],
  nearMisses: [],
  ...over,
})

describe('appliedCardsNameTheirLinesByNumber', () => {
  it('names each fired promotion’s lines by their basket number, in number order', () => {
    const [card] = promotionsPanel(walk()).applied
    expect(card.lines).toEqual([1, 3, 4])
    expect(card.description).toBe('10% Coupon')
  })

  it('🚩 drops a lineId the basket does not hold rather than showing it as 0', () => {
    const fired: FiredPromotion = { offerId: 'BBY-1', description: 'x', amount: -1, lineIds: ['L30', 'GONE', 'L10'] }
    const [card] = promotionsPanel(walk({ firedPromotions: [fired] })).applied
    expect(card.lines).toEqual([1, 3])
  })

  it('renumbers after a void: the same lineId reads its new position', () => {
    const fired: FiredPromotion = { offerId: 'BBY-1', description: 'x', amount: -1, lineIds: ['L30'] }
    const voided = walk({ lines: [line('L10'), line('L30')], firedPromotions: [fired] })
    expect(promotionsPanel(voided).applied[0].lines).toEqual([2])
  })

  it('a coupon’s promotion says which lines it is NOT on; an automatic one never does', () => {
    const coupon = walk({
      header: { ...ATTACHED_SESSION.header, coupons: [{ code: 'NOV10', description: '10% Coupon', amount: -20.73 }] },
    })
    const [card] = promotionsPanel(coupon).applied
    expect(card.coupon).toBe('NOV10')
    expect(card.notOn).toEqual([2])

    // No coupon names it ⇒ it is an automatic promotion, and "not on line 2" would be noise.
    const [auto] = promotionsPanel(walk()).applied
    expect(auto.coupon).toBeNull()
    expect(auto.notOn).toEqual([])
  })

  it('a coupon with no description is never matched to a promotion', () => {
    const coupon = walk({
      header: { ...ATTACHED_SESSION.header, coupons: [{ code: 'NOV10', description: null, amount: -20.73 }] },
    })
    expect(promotionsPanel(coupon).applied[0].coupon).toBeNull()
  })

  it('two fired promotions sharing a blank offerId are still two cards (859)', () => {
    const two = walk({
      firedPromotions: [
        { offerId: '', description: 'a', amount: -1, lineIds: ['L10'] },
        { offerId: '', description: 'b', amount: -2, lineIds: ['L20'] },
      ],
    })
    const ids = promotionsPanel(two).applied.map((card) => card.cardId)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('appliedCardIsCardD', () => {
  /** The owner's case after Add 3: 509366 × 4 at 98.00, the engine's −98.00, the line paying 294.00. */
  const owner = (over: Partial<SessionState> = {}) =>
    walk({
      lines: [{ ...line('L10'), qty: 4, unitPrice: { net: 85.22, gross: 98 }, lineTotal: { net: 255.65, gross: 294 } }],
      firedPromotions: [{ offerId: 'OMS000004571', description: '3+1', amount: -98, lineIds: ['L10'] }],
      ...over,
    })
  const buy3get1: OfferDefinition = { buyQty: 3, buyUom: 'EA', getQty: 1, getSameItem: true, discountType: 'percent', discountValue: 100 }

  it('names the one line it landed on with its quantity and the line’s own server figures', () => {
    const [card] = promotionsPanel(owner()).applied
    expect(card.landed).toEqual({ line: 1, qty: 4, unitGross: 98, lineGross: 294 })
  })

  it('more than one line → no single line to do the arithmetic on', () => {
    const fired: FiredPromotion = { offerId: 'X', description: 'x', amount: -1, lineIds: ['L10', 'L30'] }
    expect(promotionsPanel(walk({ firedPromotions: [fired] })).applied[0].landed).toBeNull()
  })

  it('warns that removing one takes the free one away when the offer it was had a get side', () => {
    const remembered = new Map([['OMS000004571', buy3get1]])
    expect(promotionsPanel(owner(), { remembered }).applied[0].keepAll).toBe(true)
    expect(promotionsPanel(owner()).applied[0].keepAll).toBe(false)
    const percent = new Map([['OMS000004571', { ...buy3get1, getQty: 0 }]])
    expect(promotionsPanel(owner(), { remembered: percent }).applied[0].keepAll).toBe(false)
  })

  it('remembers each near-miss definition by offerId across states, and never by a blank id', () => {
    const miss = { ...NEAR_MISS_CLASSES[0], offerId: 'OMS000004571', definition: buy3get1 }
    const first = rememberDefinitions(new Map(), [miss, { ...miss, offerId: '' }])
    expect([...first.keys()]).toEqual(['OMS000004571'])
    // The next state: the offer fired, so it is no longer a near-miss — the memory keeps it.
    expect(rememberDefinitions(first, []).get('OMS000004571')).toEqual(buy3get1)
  })
})

describe('oneStepAwayCarriesThePitch', () => {
  const WALK = new Date(2026, 10, 27, 15, 30)
  const owner: NearMiss = {
    ...NEAR_MISS_CLASSES[0],
    offerId: 'OMS000004571',
    description: '3+1',
    progress: { have: 0, need: 1, unitsHave: 1, unitsNeed: 3 },
    prereq: { kind: 'material', materialNumber: '509366' },
    definition: { buyQty: 3, buyUom: 'EA', getQty: 1, getSameItem: true, discountType: 'percent', discountValue: 100 },
    endsOn: '2026-12-03',
    audience: { channelOnly: true, tiers: ['P', 'G', 'S'], callerQualifies: true },
  }

  it('the owner’s case: headline, 1 of 4, add 3 of 509366, phone + tier + ends', () => {
    const panel = promotionsPanel(walk({ nearMisses: [owner] }), { now: WALK })
    const pitch = panel.pitch.get('OMS000004571')
    expect(pitch?.headline).toEqual({
      kind: 'phrase',
      phrase: { key: 'callcenter:offer.headline.nthFree', params: { buy: 3, count: 4, ordinal: true } },
    })
    expect(pitch?.strip).toEqual({ slots: ['in', 'add', 'add', 'free'], have: 1, total: 4 })
    expect(pitch?.add).toEqual({ qty: 3, free: 1, itemNumber: '509366', itemName: null })
    expect(pitch?.badges.map((badge) => badge.kind)).toEqual(['phoneOnly', 'tier', 'ends'])
    expect(pitch?.say.map((phrase) => phrase.key)).toEqual([
      'callcenter:offer.say.addFree',
      'callcenter:offer.say.phoneOnly',
      'callcenter:offer.say.ends',
    ])
  })

  it('the add names its own item as the basket holds it, never the offer', () => {
    const basket = [line('L10'), { ...line('L20'), itemNumber: '509366', description: 'OWNER CASE ITEM 509366' }]
    const pitch = promotionsPanel(walk({ lines: basket, nearMisses: [owner] }), { now: WALK }).pitch.get('OMS000004571')
    expect(pitch?.add).toEqual({ qty: 3, free: 1, itemNumber: '509366', itemName: 'OWNER CASE ITEM 509366' })
  })

  it('a grouping prerequisite has no one item to add: the card opens the items instead', () => {
    const grouping = { ...owner, prereq: { kind: 'grouping', groupingId: 'G1', eligibleCount: 12 } }
    expect(promotionsPanel(walk({ nearMisses: [grouping] }), { now: WALK }).pitch.get('OMS000004571')?.add).toBeNull()
  })

  it('a v1.13 near-miss degrades: description headline, no strip, no add', () => {
    const old: NearMiss = { ...NEAR_MISS_CLASSES[0], offerId: 'OLD', description: '3+1' }
    const pitch = promotionsPanel(walk({ nearMisses: [old] }), { now: WALK }).pitch.get('OLD')
    expect(pitch?.headline).toEqual({ kind: 'description', text: '3+1' })
    expect(pitch?.strip).toBeNull()
    expect(pitch?.add).toBeNull()
  })
})

describe('nearMissesKeepTheirShortfallOrder', () => {
  it('🚩 a shortfall the server lists after an actionable offer is drawn first (412 W8)', () => {
    const [actionable, counted, skipped] = NEAR_MISS_CLASSES
    const state = walk({ nearMisses: [actionable, counted, GET_SHORTFALL, skipped] })
    const away = promotionsPanel(state).oneStepAway
    expect(away.map((card) => card.offerId)).toEqual([GET_SHORTFALL.offerId, actionable.offerId])
  })

  it('a ready (counted) or skipped offer is not one step away', () => {
    const [, counted, skipped] = NEAR_MISS_CLASSES
    expect(promotionsPanel(walk({ nearMisses: [counted, skipped] })).oneStepAway).toEqual([])
  })

  it('each card carries a sentence to recommend it, built from server facts only', () => {
    const [actionable] = NEAR_MISS_CLASSES
    const shortfall = GET_SHORTFALL
    const panel = promotionsPanel(walk({ nearMisses: [actionable, shortfall] }))
    const byId = new Map(panel.oneStepAway.map((card) => [card.offerId, panel.say.get(card.cardId)]))
    expect(byId.get(actionable.offerId)).toEqual({
      key: 'callcenter:promotions.say.add',
      params: { count: 1, offer: actionable.description },
    })
    expect(byId.get(shortfall.offerId)?.key).toBe('callcenter:promotions.say.reward')
  })
})

describe('noFigureIsComputedHere', () => {
  /** Every money-shaped value the panel carries, wherever it is nested. */
  const moneyOf = (value: unknown, key = ''): number[] => {
    if (typeof value === 'number') return /amount|total|sav|discount|price|gross/i.test(key) ? [value] : []
    if (Array.isArray(value)) return value.flatMap((item) => moneyOf(item, key))
    if (value instanceof Map) return [...value.values()].flatMap((item) => moneyOf(item, key))
    if (value && typeof value === 'object')
      return Object.entries(value).flatMap(([k, v]) => moneyOf(v, k))
    return []
  }

  const fixtures: SessionState[] = [
    ATTACHED_SESSION,
    walk(),
    walk({
      header: { ...ATTACHED_SESSION.header, coupons: [{ code: 'NOV10', description: '10% Coupon', amount: -20.73 }] },
      nearMisses: [...NEAR_MISS_CLASSES, GET_SHORTFALL] as NearMiss[],
    }),
    walk({
      firedPromotions: [
        { offerId: 'A', description: 'a', amount: -1.11, lineIds: ['L10'] },
        { offerId: 'B', description: 'b', amount: -2.22, lineIds: ['L10', 'L20'] },
        { offerId: 'C', description: 'c', amount: 0, lineIds: [] },
      ],
    }),
  ]

  it.each(fixtures.map((state, i) => [i, state] as const))('fixture %i: every amount is a server field, verbatim', (_, state) => {
    // Card D (996) carries its line's own unitPrice.gross and lineTotal.gross, verbatim.
    const served = [
      ...state.firedPromotions.map((fired) => fired.amount),
      ...state.lines.flatMap((line) => [line.unitPrice.gross, line.lineTotal.gross]),
    ]
    const shown = moneyOf(promotionsPanel(state))
        for (const amount of shown) expect(served.some((s) => Object.is(s, amount))).toBe(true)
  })
})
