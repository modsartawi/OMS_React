import { describe, expect, it } from 'vitest'
import type { RuleDraft, RuleEvaluateReply, RuleSimulation, RuleTraceEntry } from '@/core/models/rule-campaign'
import type { RuleUnitEffect } from '@/core/models/rule-session'
import { couponCodes, draftTarget, gapPlace, needsDraft, parsePoints, refusalLines, saleMoney, shapeSimulation, simAt, simRequest, sumUnits, type SimForm } from './sim-result'

describe('needsDraft_whenNothingIsPublished', () => {
  it('nothing published and no draft named: a run must name one; a draft named, a live version, or the order still loading: not', () => {
    expect(needsDraft(null, 0)).toBe(true)
    expect(needsDraft('X', 0)).toBe(false)
    expect(needsDraft(null, 1)).toBe(false)
    expect(needsDraft(null, undefined)).toBe(false)
  })
})

describe('gapPlace_readsHqsPath', () => {
  it('a condition path is its rule and condition, counted from 1; another shape is null', () => {
    expect(gapPlace('campaigns[0].rules[0].when[0]')).toEqual({ rule: 1, condition: 1 })
    expect(gapPlace('campaigns[2].rules[3].when[1]')).toEqual({ rule: 4, condition: 2 })
    expect(gapPlace('campaigns[0].rules[0].then[0]')).toBeNull()
    expect(gapPlace(null)).toBeNull()
  })
})

const LABEL = { en: '10% off Beauty', ar: 'خصم 10% على التجميل' }
const unit = (line: number, u: number, amount: number, o: Partial<RuleUnitEffect> = {}): RuleUnitEffect => ({
  campaign: 'BEAUTY10',
  rule: 'r1',
  effect: 'discountItems',
  line,
  unit: u,
  amount,
  label: LABEL,
  freeGoods: false,
  ...o,
})
const trace = (campaign: string, status: string, code: string | null = null): RuleTraceEntry => ({
  campaign,
  group: null,
  status,
  code,
  money: 0,
  reason: code ? { en: code, ar: code } : null,
})

const reply = (o: Partial<RuleEvaluateReply> = {}): RuleEvaluateReply => ({
  rulesetVersion: 41,
  currency: 'SAR',
  decimals: 2,
  effects: [],
  points: [],
  nearMisses: [],
  refusals: [],
  trace: [],
  prompts: [],
  messages: [],
  offers: [],
  member: null,
  wallet: null,
  createdCoupons: [],
  ...o,
})

// BackOffice's own Simulate test (RuleBuilderTests.Simulate_Draft_MatchesEvaluateOnPublished): 10%
// off each Beauty unit — line 1 one unit of 45.99, line 2 two units of 61.03 (the residual on the
// highest-net unit), line 3 an Rx line nothing reaches.
const effects = [unit(1, 0, 4.6), unit(2, 0, 3.05), unit(2, 1, 3.05)]
const sim = (o: Partial<RuleSimulation> = {}, r: Partial<RuleEvaluateReply> = {}): RuleSimulation => ({
  basedOnVersion: 41,
  campaign: 'T2738-SIM',
  at: '2026-10-16T18:30:00',
  lines: [
    { lineNumber: 2, article: 'BEA-2', quantity: 2, net: 61.03, discount: 6.1, netAfter: 54.93, effects: effects.slice(1) },
    { lineNumber: 1, article: 'BEA-1', quantity: 1, net: 45.99, discount: 4.6, netAfter: 41.39, effects: effects.slice(0, 1) },
    { lineNumber: 3, article: 'RX-1', quantity: 1, net: 20, discount: 0, netAfter: 20, effects: [] },
  ],
  reply: reply({ effects, ...r }),
  ...o,
})

describe('shapeSimulation', () => {
  it('simResult_sumsUnitsPerLine', () => {
    const shaped = shapeSimulation(sim())
    expect(shaped.lines.map((l) => [l.lineNumber, l.grouped.map((g) => [g.campaign, g.effect, g.units, g.amount])])).toEqual([
      [1, [['BEAUTY10', 'discountItems', 1, 4.6]]],
      [2, [['BEAUTY10', 'discountItems', 2, 6.1]]],
      [3, []],
    ])
    expect(shaped.lines[1].grouped[0].label).toEqual(LABEL)
    expect(shaped.totals).toEqual({ net: 127.02, discount: 10.7, netAfter: 116.32 })
    expect(shaped.stray).toEqual([])
  })

  it('keeps each campaign, rule and effect apart on a line, and counts its free units', () => {
    const line = [
      unit(1, 0, 15, { campaign: 'GIFT', effect: 'freeProduct', freeGoods: true, label: null }),
      unit(1, 0, 1.5),
      unit(1, 1, 1.5),
      unit(1, 1, 2, { rule: 'r2' }),
    ]
    expect(sumUnits(line, 2).map((g) => [g.campaign, g.rule, g.effect, g.units, g.freeUnits, g.amount])).toEqual([
      ['GIFT', 'r1', 'freeProduct', 1, 1, 15],
      ['BEAUTY10', 'r1', 'discountItems', 2, 0, 3],
      ['BEAUTY10', 'r2', 'discountItems', 1, 0, 2],
    ])
  })

  it('sums at the currency\'s decimals, never with float noise', () => {
    const thirds = [unit(1, 0, 0.1), unit(1, 1, 0.2)]
    expect(sumUnits(thirds, 2)[0].amount).toBe(0.3)
    expect(sumUnits([unit(1, 0, 0.618), unit(1, 1, 0.382)], 3)[0].amount).toBe(1)
  })

  it('an effect on a line HQ did not answer is kept apart, not dropped', () => {
    const shaped = shapeSimulation(sim({}, { effects: [...effects, unit(9, 0, 1)] }))
    expect(shaped.stray.map((g) => [g.line, g.amount])).toEqual([[9, 1]])
  })

  it('trace order is HQ\'s evaluation order, and the campaigns are counted by status', () => {
    const t = [trace('PCUT', 'applied'), trace('SUN', 'notTriggered', 'notMet'), trace('BDAY', 'skipped', 'window'), trace('PTS', 'lost', 'lostToGroup'), trace('X', 'applied')]
    const shaped = shapeSimulation(sim({}, { trace: t }))
    expect(shaped.counts).toEqual({ applied: 2, notTriggered: 1, lost: 1, skipped: 1 })
    // The page draws `reply.trace` as it came: shaping never reorders it.
    expect(sim({}, { trace: t }).reply.trace.map((x) => x.campaign)).toEqual(['PCUT', 'SUN', 'BDAY', 'PTS', 'X'])
  })

  it('a status this client lacks is not counted, and missing lists read as empty', () => {
    const odd = shapeSimulation(sim({}, { trace: [trace('A', 'paused'), trace('B', 'constructor'), trace('C', 'toString')] }))
    expect(odd.counts).toEqual({ applied: 0, notTriggered: 0, lost: 0, skipped: 0 })
    const bare = shapeSimulation({ ...sim(), lines: undefined, reply: { ...reply(), effects: undefined, trace: undefined } } as unknown as RuleSimulation)
    expect(bare.lines).toEqual([])
    expect(bare.totals).toEqual({ net: 0, discount: 0, netAfter: 0 })
  })

  it('near-miss gaps carry their path and the condition\'s own words (a real-shaped reply)', () => {
    const r = sim({}, {
      nearMisses: [
        {
          campaign: 'T2738-SIM',
          rule: 'r-five',
          text: { en: 'Two more Beauty items for SAR 15 off', ar: 'صنفان آخران' },
          gaps: [
            { check: 'minCount', path: 'campaign.rules[1].when[0]', amount: 2, unit: 'items', currency: null, text: { en: 'add 2 items', ar: 'أضف صنفين' }, says: { en: 'five Beauty items', ar: 'خمسة أصناف' } },
          ],
        },
      ],
    })
    const gap = r.reply.nearMisses[0].gaps[0]
    expect([gap.path, gap.says?.en, gap.text?.en]).toEqual(['campaign.rules[1].when[0]', 'five Beauty items', 'add 2 items'])
  })
})

describe('the request', () => {
  const form: SimForm = {
    basket: [
      { sku: 'BEA-1', name: 'Serum', category: 'A002', qty: 1, price: 45.99 },
      { sku: 'BEA-2', name: 'Cream', category: 'A002', qty: 2, price: 30.51 },
    ],
    file: null,
    store: 'S101',
    country: 'SA',
    channel: 'POS',
    memberId: '  3027146 ',
    earning: true,
    firstPurchase: false,
    coupons: 'HAYAK10, WKND-4F7K2Q HAYAK10',
    points: '',
    flags: ['pointsOffer'],
    date: '2026-10-16',
    time: '18:30',
    draft: 'BDAY-BEAUTY',
  }

  it('the moment is the local day and time, with no Z', () => {
    expect(simAt('2026-10-16', '18:30')).toBe('2026-10-16T18:30')
    expect(simAt('2026-10-16', '')).toBeNull()
    expect(simAt('16/10/2026', '18:30')).toBeNull()
  })

  it('is the evaluate request plus the draft, the basket as cart lines', () => {
    expect(simRequest(form)).toEqual({
      storeCode: 'S101',
      country: 'SA',
      channel: 'POS',
      currency: 'SAR',
      decimals: 2,
      lines: [
        { lineNumber: 1, article: 'BEA-1', quantity: 1, unit: 'EA', baseUnitQuantity: 1, gross: 45.99, netBeforePromotion: 45.99, vatRate: 0, category: 'A002', fee: false, attributes: {} },
        { lineNumber: 2, article: 'BEA-2', quantity: 2, unit: 'EA', baseUnitQuantity: 2, gross: 61.02, netBeforePromotion: 61.02, vatRate: 0, category: 'A002', fee: false, attributes: {} },
      ],
      profile: { loyaltyId: '3027146', tier: '', earning: true, firstPurchase: false, points: 0, audiences: [] },
      coupons: ['HAYAK10', 'WKND-4F7K2Q'],
      flags: ['pointsOffer'],
      requestedPoints: 0,
      draft: 'BDAY-BEAUTY',
      at: '2026-10-16T18:30',
    })
  })

  it('a file goes as csv with no lines; no draft sends neither campaign nor draft', () => {
    const r = simRequest({ ...form, file: 'article,quantity,net\nBEA-1,1,45.99', draft: null })
    expect(r?.lines).toEqual([])
    expect(r?.csv).toBe('article,quantity,net\nBEA-1,1,45.99')
    expect(r && 'draft' in r).toBe(false)
    expect(r && 'campaign' in r).toBe(false)
    expect(simRequest(form) && 'csv' in simRequest(form)!).toBe(false)
  })

  it('a Bahraini sale is in BHD at three decimals', () => {
    const r = simRequest({ ...form, country: 'BH', basket: [{ sku: 'A', name: 'a', category: 'A002', qty: 3, price: 1.005 }] })
    expect([r?.currency, r?.decimals, r?.lines[0].netBeforePromotion]).toEqual(['BHD', 3, 3.015])
  })

  it('is null while something it needs is missing', () => {
    expect(simRequest({ ...form, basket: [] })).toBeNull()
    expect(simRequest({ ...form, basket: [{ ...form.basket[0], price: null }] })).toBeNull()
    expect(simRequest({ ...form, store: '' })).toBeNull()
    expect(simRequest({ ...form, country: 'XX' })).toBeNull()
    expect(simRequest({ ...form, channel: '' })).toBeNull()
    expect(simRequest({ ...form, time: '' })).toBeNull()
    expect(simRequest({ ...form, points: '1.5' })).toBeNull()
    expect(simRequest({ ...form, basket: [], file: 'x' })).not.toBeNull()
  })

  it('the currency is the country\'s, at its decimals', () => {
    expect([saleMoney('SA'), saleMoney('BH'), saleMoney('XX')]).toEqual([{ currency: 'SAR', decimals: 2 }, { currency: 'BHD', decimals: 3 }, null])
  })

  it('reads coupons and points', () => {
    expect(couponCodes(' A,B  A\nC ')).toEqual(['A', 'B', 'C'])
    expect(couponCodes('')).toEqual([])
    expect([parsePoints(''), parsePoints(' 300 '), parsePoints('-1'), parsePoints('x')]).toEqual([0, 300, null, null])
  })

  it('a dashboard draft is sent only while the campaign has one', () => {
    const loaded = (source: 'draft' | 'published') => ({ code: 'BDAY-BEAUTY', source }) as RuleDraft
    expect(draftTarget(null, undefined)).toEqual({ ready: true, draft: null })
    expect(draftTarget('BDAY-BEAUTY', undefined)).toEqual({ ready: false, draft: null })
    expect(draftTarget('BDAY-BEAUTY', loaded('draft'))).toEqual({ ready: true, draft: 'BDAY-BEAUTY' })
    expect(draftTarget('PCUT-SA01', loaded('published'))).toEqual({ ready: true, draft: null })
  })
})

describe('refusalLines', () => {
  it('reads the checker\'s block lines and a file\'s lines', () => {
    expect(
      refusalLines([
        'rule 1 → effect 1 → value: a percent is more than 0 and at most 100 (campaign.rules[0].then[0].value)',
        "line 3: quantity is a number, not 'x'",
        'no colon here',
      ]),
    ).toEqual([
      { where: 'rule 1 → effect 1 → value', message: 'a percent is more than 0 and at most 100', path: 'campaign.rules[0].then[0].value' },
      { where: 'line 3', message: "quantity is a number, not 'x'", path: null },
      { where: null, message: 'no colon here', path: null },
    ])
  })

  it('an issue with no place or no path, as HQ writes it, keeps the rest', () => {
    expect(refusalLines(['campaign: the campaign has no rule ()', ': a percent is at most 100 (campaign.rules[0].then[0].value)'])).toEqual([
      { where: 'campaign', message: 'the campaign has no rule', path: null },
      { where: null, message: 'a percent is at most 100', path: 'campaign.rules[0].then[0].value' },
    ])
  })
})
