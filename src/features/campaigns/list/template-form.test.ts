import { describe, expect, it } from 'vitest'
import type { RuleCampaignTemplate } from '@/core/models/rule-campaign'
import { fillTemplate, templateFormFor, templateProblems, templateValues } from './template-form'

/** The prototype's "Spend X, get Y% off a category", in the provisional template shape. */
const SPEND: RuleCampaignTemplate = {
  id: 'T-SPEND-PCT',
  name: { en: 'Spend X, get Y% off a category', ar: 'أنفق واحصل على خصم' },
  description: 'A basket threshold and a percent off one category.',
  enabled: true,
  placeholders: [
    { key: 'minSpend', label: 'Minimum basket (SAR)', kind: 'number', min: 50, max: 1000, default: 200 },
    { key: 'pct', label: 'Percent off', kind: 'number', min: 5, max: 30, default: 10 },
    { key: 'cats', label: 'Category', kind: 'pick', lookup: 'categories', default: ['A002'] },
  ],
  draft: {
    name: { en: 'Spend SAR {{minSpend}}, get {{pct}}% off', ar: 'أنفق {{minSpend}} ريال واحصل على خصم {{pct}}%' },
    features: [],
    rules: [
      {
        id: 'r1',
        name: '{{pct}}% off the category',
        filters: [{ id: 'f1', name: 'target', categories: { placeholder: 'cats' } as unknown as string[], exclude: { categories: ['A006'] } }],
        values: [],
        when: [{ check: 'minSubtotal', amount: { placeholder: 'minSpend' }, says: { en: 'A basket of SAR {{minSpend}}', ar: 'سلة بقيمة {{minSpend}} ريال' } }],
        then: [{ effect: 'discountItems', filter: 'f1', kind: 'percent', value: { placeholder: 'pct' }, label: { en: '{{pct}}% off', ar: 'خصم {{pct}}%' } }],
      },
    ],
  },
}

describe('templateForm', () => {
  it('starts each placeholder at its default', () => {
    expect(templateFormFor(SPEND)).toEqual({ minSpend: '200', pct: '10', cats: ['A002'] })
  })

  it('refuses an empty, a non-number and an out-of-bounds value, and an empty pick', () => {
    expect(templateProblems(SPEND, templateFormFor(SPEND))).toEqual([])
    expect(templateProblems(SPEND, { minSpend: ' ', pct: 'ten', cats: [] })).toEqual([
      { key: 'minSpend', problem: 'required' },
      { key: 'pct', problem: 'notNumber' },
      { key: 'cats', problem: 'required' },
    ])
    expect(templateProblems(SPEND, { minSpend: '49.5', pct: '31', cats: ['A002'] })).toEqual([
      { key: 'minSpend', problem: 'belowMin' },
      { key: 'pct', problem: 'aboveMax' },
    ])
    expect(templateProblems(SPEND, { minSpend: '0x1E', pct: '1e1', cats: ['A002'] })).toEqual([
      { key: 'minSpend', problem: 'notNumber' },
      { key: 'pct', problem: 'notNumber' },
    ])
    // The bounds are inclusive.
    expect(templateProblems(SPEND, { minSpend: '50', pct: '30', cats: ['A002'] })).toEqual([])
  })

  it('a choice must be one of its options', () => {
    const tier: RuleCampaignTemplate = {
      ...SPEND,
      placeholders: [{ key: 'tier', label: 'Tier', kind: 'choice', options: [{ code: 'G', name: 'Gold' }], default: 'G' }],
    }
    expect(templateProblems(tier, { tier: 'G' })).toEqual([])
    expect(templateProblems(tier, { tier: 'X' })).toEqual([{ key: 'tier', problem: 'required' }])
  })

  it('types the values: a number as a number, a pick as its codes', () => {
    expect(templateValues(SPEND, { minSpend: ' 250 ', pct: '15', cats: ['A002', 'A003'] })).toEqual({ minSpend: 250, pct: 15, cats: ['A002', 'A003'] })
  })
})

describe('fillTemplate', () => {
  it('fillTemplate_replacesEveryPlaceholder_andLeavesNoneUnset', () => {
    const out = fillTemplate(SPEND.draft, { minSpend: 250, pct: 15, cats: ['A002', 'A003'] })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const d = out.draft
    expect(d.name).toEqual({ en: 'Spend SAR 250, get 15% off', ar: 'أنفق 250 ريال واحصل على خصم 15%' })
    const rule = d.rules[0]
    expect(rule.name).toBe('15% off the category')
    expect(rule.filters[0].categories).toEqual(['A002', 'A003'])
    expect(rule.when[0]).toMatchObject({ amount: 250, says: { en: 'A basket of SAR 250', ar: 'سلة بقيمة 250 ريال' } })
    expect(rule.then[0]).toMatchObject({ value: 15, label: { en: '15% off', ar: 'خصم 15%' } })
    // Nothing of a mark is left anywhere.
    expect(JSON.stringify(d)).not.toMatch(/placeholder|\{\{/)
    // Everything else is as the template wrote it.
    expect(rule.filters[0].exclude).toEqual({ categories: ['A006'] })
    expect(rule.then[0].filter).toBe('f1')
  })

  it('refuses, naming each key with no value once, rather than leave a mark in', () => {
    expect(fillTemplate(SPEND.draft, { pct: 15 })).toEqual({ ok: false, unset: ['minSpend', 'cats'] })
  })

  it('never changes the template it fills', () => {
    const before = JSON.stringify(SPEND.draft)
    const out = fillTemplate(SPEND.draft, { minSpend: 250, pct: 15, cats: ['A002'] })
    expect(JSON.stringify(SPEND.draft)).toBe(before)
    if (out.ok) out.draft.rules[0].filters[0].categories?.push('A005')
    expect(JSON.stringify(SPEND.draft)).toBe(before)
  })

  it('a text inside an expression takes the value as text, and is otherwise left as written', () => {
    const draft = { ...SPEND.draft, rules: [{ ...SPEND.draft.rules[0], values: [{ name: 'pts', expr: ['*', '$basis', '{{mult}}'] }] }] }
    const out = fillTemplate(draft, { minSpend: 1, pct: 1, cats: [], mult: 2.5 })
    expect(out.ok && out.draft.rules[0].values[0].expr).toEqual(['*', '$basis', '2.5'])
  })
})
