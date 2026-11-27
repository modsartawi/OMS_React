/**
 * The promotions panel's view model (spec 983 D7, ticket 987): Applied · One step away.
 *
 * Expected values are literals off the fixtures, never recomputed the way the module does.
 */
import { describe, expect, it } from 'vitest'
import type { FiredPromotion, NearMiss, SessionLine, SessionState } from '@/core/models/callcenter'
import { ATTACHED_SESSION, GET_SHORTFALL, NEAR_MISS_CLASSES } from './__fixtures__/payloads'
import { promotionsPanel } from './promotions-panel'

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
    if (typeof value === 'number') return /amount|total|sav|discount|price/i.test(key) ? [value] : []
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
    const served = state.firedPromotions.map((fired) => fired.amount)
    const shown = moneyOf(promotionsPanel(state))
    expect(shown.length).toBe(served.length)
    for (const amount of shown) expect(served.some((s) => Object.is(s, amount))).toBe(true)
  })
})
