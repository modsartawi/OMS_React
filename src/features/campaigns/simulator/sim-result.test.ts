import { describe, expect, it } from 'vitest'
import type { RuleSimEffect, RuleSimResult, RuleSimTrace } from '@/core/models/rule-campaign'
import { shapeSimResult, simAt, simRequest } from './sim-result'

const fx = (code: string, kind: RuleSimEffect['kind'], line: number | null, o: Partial<RuleSimEffect> = {}): RuleSimEffect => ({
  campaignId: code,
  code,
  kind,
  line,
  amount: null,
  quantity: null,
  points: null,
  label: null,
  coupon: null,
  ...o,
})

const tr = (code: string, outcome: RuleSimTrace['outcome']): RuleSimTrace => ({
  campaignId: code,
  code,
  name: { en: code, ar: code },
  outcome,
  reason: null,
  group: null,
  lostTo: null,
  rules: [],
})

const result = (o: Partial<RuleSimResult> = {}): RuleSimResult => ({
  currency: 'SAR',
  engine: 'Rule',
  lines: [
    { line: 2, sku: 'SER-VC', name: 'Serum', qty: 1, gross: 89, discount: 13.35, net: 75.65 },
    { line: 1, sku: 'SUN-50', name: 'Sunblock', qty: 2, gross: 110, discount: 16.5, net: 93.5 },
  ],
  totals: { gross: 199, discount: 29.85, net: 169.15 },
  effects: [],
  trace: [],
  nearMisses: [],
  ...o,
})

describe('shapeSimResult', () => {
  it('simResult_groupsEffectsPerLine_andSessionLevel', () => {
    const effects = [
      fx('GP-BEAUTY15', 'discount', 1, { amount: 16.5 }),
      fx('BASE-EARN', 'points', null, { points: 262 }),
      fx('GP-BEAUTY15', 'discount', 2, { amount: 13.35 }),
      fx('GIFT-POUCH', 'message', null, { label: { en: 'Scan a pouch', ar: 'امسح' } }),
      fx('SUN-3FOR2', 'freeUnit', 1, { quantity: 1, amount: 42 }),
      fx('NEXT-VISIT', 'createCoupon', null, { coupon: 'NEXT-VISIT' }),
    ]
    const shaped = shapeSimResult(result({ effects }))
    expect(shaped.lines.map((l) => [l.line, l.effects.map((e) => `${e.code}:${e.kind}`)])).toEqual([
      [1, ['GP-BEAUTY15:discount', 'SUN-3FOR2:freeUnit']],
      [2, ['GP-BEAUTY15:discount']],
    ])
    expect(shaped.session.map((e) => `${e.code}:${e.kind}`)).toEqual(['BASE-EARN:points', 'GIFT-POUCH:message', 'NEXT-VISIT:createCoupon'])
  })

  it('an effect on a line HQ did not answer is kept at the session level, not dropped', () => {
    const shaped = shapeSimResult(result({ effects: [fx('X', 'discount', 9, { amount: 1 })] }))
    expect(shaped.session.map((e) => e.code)).toEqual(['X'])
    expect(shaped.lines.every((l) => l.effects.length === 0)).toBe(true)
  })

  it('counts the campaigns by outcome, every outcome present', () => {
    const shaped = shapeSimResult(result({ trace: [tr('A', 'applied'), tr('B', 'notMet'), tr('C', 'applied'), tr('D', 'lost')] }))
    expect(shaped.outcomes).toEqual({ applied: 2, notMet: 1, skipped: 0, budget: 0, lost: 1 })
  })

  it('reads a missing list as empty', () => {
    const shaped = shapeSimResult({ ...result(), effects: undefined, trace: undefined, nearMisses: undefined } as unknown as RuleSimResult)
    expect(shaped.session).toEqual([])
    expect(shaped.outcomes.applied).toBe(0)
  })
})

describe('the request', () => {
  it('the moment is the local day and time, with seconds and no Z', () => {
    expect(simAt('2026-10-16', '18:30')).toBe('2026-10-16T18:30:00')
    expect(simAt('2026-10-16', '')).toBeNull()
    expect(simAt('', '18:30')).toBeNull()
    expect(simAt('16/10/2026', '18:30')).toBeNull()
  })

  it('is built from the form, or null while something it needs is missing', () => {
    const form = {
      basket: [{ sku: 'SUN-50', name: 'Sunblock', qty: 2 }],
      store: 'R101',
      memberId: '  M-100231 ',
      channel: 'POS',
      date: '2026-10-16',
      time: '18:30',
      includeDrafts: false,
      draftId: 'BDAY-BEAUTY',
    }
    expect(simRequest(form)).toEqual({
      basket: [{ sku: 'SUN-50', qty: 2 }],
      store: 'R101',
      memberId: 'M-100231',
      channel: 'POS',
      at: '2026-10-16T18:30:00',
      includeDrafts: false,
      draftId: 'BDAY-BEAUTY',
    })
    expect(simRequest({ ...form, memberId: ' ' })?.memberId).toBeNull()
    expect(simRequest({ ...form, includeDrafts: true })?.includeDrafts).toBe(false)
    expect(simRequest({ ...form, includeDrafts: true, draftId: null })?.includeDrafts).toBe(true)
    expect(simRequest({ ...form, basket: [] })).toBeNull()
    expect(simRequest({ ...form, store: '' })).toBeNull()
    expect(simRequest({ ...form, channel: '' })).toBeNull()
    expect(simRequest({ ...form, time: '' })).toBeNull()
  })
})
