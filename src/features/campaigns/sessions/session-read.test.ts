import { describe, expect, it } from 'vitest'
import type { RuleCartLine, RuleSessionLookup, RuleUnitEffect } from '@/core/models/rule-session'
import { cartRows, sessionCampaigns, sessionTotals } from './session-read'

const line = (lineNumber: number, article: string, quantity: number, netBeforePromotion: number): RuleCartLine => ({
  lineNumber,
  article,
  quantity,
  unit: 'EA',
  baseUnitQuantity: quantity,
  gross: netBeforePromotion,
  netBeforePromotion,
  vatRate: 15,
  category: 'A001',
  fee: false,
  attributes: null,
})
const fx = (campaign: string, line: number, unit: number, amount: number, o: Partial<RuleUnitEffect> = {}): RuleUnitEffect => ({
  campaign,
  rule: 'r1',
  effect: 'discountItems',
  line,
  unit,
  amount,
  label: null,
  freeGoods: false,
  ...o,
})

const lookup = (o: Partial<RuleSessionLookup>): RuleSessionLookup => ({
  session: {
    sessionId: 'R101-0042',
    storeCode: 'R101',
    channel: 'POS',
    state: 'closed',
    rulesetVersion: 7,
    cartVersion: 3,
    currency: 'SAR',
    decimals: 2,
    couponCode: null,
    openedAt: '2026-10-16T10:00:05',
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    returnedAt: null,
    updatedAt: '2026-10-16T10:03:20',
  },
  calls: [],
  cart: {
    storeCode: 'R101',
    country: 'SA',
    channel: 'POS',
    currency: 'SAR',
    decimals: 2,
    lines: [line(2, 'SER-VC', 1, 89), line(1, 'SUN-50', 2, 110)],
    coupons: [],
    flags: [],
    requestedPoints: 0,
    pointValue: 0,
    burnNotAuthorized: false,
  },
  effects: [],
  points: [],
  returned: [],
  holds: [],
  movements: [],
  budgetEvents: [],
  refusals: [],
  coupon: null,
  createdCoupons: [],
  pointsActivities: [],
  ...o,
})

const label = { en: 'Weekend 20%', ar: 'خصم نهاية الأسبوع 20%' }

describe('cartRows', () => {
  it('lists the cart lines by line number, each with its discount and net after promotions', () => {
    const rows = cartRows(lookup({ effects: [fx('WKND20', 1, 0, 11, { label }), fx('WKND20', 1, 1, 11, { label })] }))
    expect(rows.map((r) => [r.line, r.article, r.discount, r.netAfter])).toEqual([
      [1, 'SUN-50', 22, 88],
      [2, 'SER-VC', 0, 89],
    ])
  })

  it('sums a line\'s per-unit effects by campaign, rule and effect, keeping the label and counting free units', () => {
    const rows = cartRows(
      lookup({
        effects: [
          fx('WKND20', 1, 0, 11, { label }),
          fx('SUN-3FOR2', 1, 1, 55, { effect: 'freeUnits', freeGoods: true }),
          fx('WKND20', 1, 1, 0.1, { label }),
        ],
      }),
    )
    expect(rows[0].effects).toEqual([
      { campaign: 'WKND20', rule: 'r1', effect: 'discountItems', amount: 11.1, label, freeUnits: 0 },
      { campaign: 'SUN-3FOR2', rule: 'r1', effect: 'freeUnits', amount: 55, label: null, freeUnits: 1 },
    ])
  })

  it('lists every unit of a counted line (0-based on the wire), its discount, campaigns and whether it came back', () => {
    const rows = cartRows(lookup({ effects: [fx('WKND20', 1, 0, 11), fx('WKND20', 1, 1, 11)], returned: [{ line: 1, unit: 1 }] }))
    expect(rows[0].units).toEqual([
      { unit: 0, discount: 11, campaigns: ['WKND20'], returned: false },
      { unit: 1, discount: 11, campaigns: ['WKND20'], returned: true },
    ])
    expect(rows[1].units).toEqual([{ unit: 0, discount: 0, campaigns: [], returned: false }])
  })

  it('reads a weighed line (a fractional quantity) as one unit', () => {
    const rows = cartRows(lookup({ cart: { ...lookup({}).cart!, lines: [line(1, 'NUTS', 0.75, 30)] } }))
    expect(rows[0].units.map((u) => u.unit)).toEqual([0])
  })

  it('rounds to the session\'s decimals (BHD has three)', () => {
    const l = lookup({ effects: [fx('X', 1, 0, 0.1), fx('X', 1, 1, 0.2)] })
    l.session.decimals = 3
    l.cart!.lines = [line(1, 'A', 2, 14.444)]
    expect(cartRows(l)[0].netAfter).toBe(14.144)
  })

  it('has no rows without a cart', () => {
    expect(cartRows(lookup({ cart: null }))).toEqual([])
  })
})

describe('sessionTotals', () => {
  it('is the cart before promotions, every effect, and the net', () => {
    expect(sessionTotals(lookup({ effects: [fx('WKND20', 1, 0, 11), fx('WKND20', 1, 1, 11)] }))).toEqual({ before: 199, discount: 22, net: 177 })
  })

  it('is null without a cart: nothing is made up', () => {
    expect(sessionTotals(lookup({ cart: null }))).toBeNull()
  })
})

describe('sessionCampaigns', () => {
  it('gathers each campaign\'s effects, points, holds, created codes and refusals, in first-seen order', () => {
    const { campaigns, sale } = sessionCampaigns(
      lookup({
        effects: [fx('WKND20', 1, 0, 11), fx('WKND20', 1, 1, 11), fx('SUN-3FOR2', 2, 0, 89, { effect: 'freeUnits', freeGoods: true })],
        points: [
          { campaign: 'BASE-EARN', rule: 'r1', effect: 'awardPoints', amount: 100, desired: 100, tierAmount: 0, unit: 'PTS', activity: 'earn', activates: null, expires: null, tender: false, value: 0 },
          { campaign: 'BASE-EARN', rule: 'r2', effect: 'awardPoints', amount: 20, desired: 20, tierAmount: 0, unit: 'PTS', activity: 'earn', activates: null, expires: null, tender: false, value: 0 },
        ],
        holds: [{ counterId: 'c1', campaign: 'WKND20', budget: 'money-cap', scopeKey: '', periodKey: '2026-10', declared: 1000, amount: 22, released: false }],
        createdCoupons: [{ campaign: 'NEXT-VISIT', rule: 'r1', template: 'T1', validDays: 30, validFrom: null, validTo: null, label: null, code: 'NV-7KQ2', state: 'created' }],
        refusals: [
          { code: 'RULES_COUPON_SECOND', campaign: 'PTS-50OFF', rule: 'r1', budget: null, reason: { en: 'Only one coupon per sale.', ar: 'قسيمة واحدة فقط لكل عملية بيع.' } },
          { code: 'RULES_BURN_NOT_AUTHORIZED', campaign: null, rule: null, budget: null, reason: null },
        ],
      }),
    )
    expect(campaigns.map((c) => c.campaign)).toEqual(['WKND20', 'SUN-3FOR2', 'BASE-EARN', 'NEXT-VISIT', 'PTS-50OFF'])
    const [wknd, sun, earn, next, pts] = campaigns
    expect([wknd.discount, wknd.freeUnits, wknd.holds.length]).toEqual([22, 0, 1])
    expect(campaigns.map((c) => c.applied)).toEqual([true, true, true, true, false])
    expect([sun.discount, sun.freeUnits]).toEqual([89, 1])
    expect(earn.points).toEqual([{ effect: 'awardPoints', unit: 'PTS', amount: 120 }])
    expect(next.createdCoupons.map((c) => c.code)).toEqual(['NV-7KQ2'])
    expect(pts.refusals.map((r) => r.code)).toEqual(['RULES_COUPON_SECOND'])
    expect(sale.map((r) => r.code)).toEqual(['RULES_BURN_NOT_AUTHORIZED'])
  })

  it('has nothing to say about a session no campaign touched', () => {
    expect(sessionCampaigns(lookup({}))).toEqual({ campaigns: [], sale: [] })
  })
})
