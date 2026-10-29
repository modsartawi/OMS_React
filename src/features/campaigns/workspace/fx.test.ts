/**
 * Tickets 507 / 522 — the guided ƒx helper (its insert at the cursor is core's since oms 657: `@/core/rules/fx-helper/insert.test.ts`); its text box reads into the
 * stored JSON expression through the codec, and a stored one it cannot print shows as JSON.
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { FORMULA_GUIDE } from '@/core/rules/formula-guide'
import { CAMPAIGNS } from '../../../../tools/campaigns-fixtures.mjs'
import { keyOf, withKeys } from './block-keys'
import { boxOf, fxFields, readBox, recipeFormula, recipeNeedsCurrent, recipeNeedsFilter, valuesBefore } from './fx'

let n = 0
const rule = (code: string): CampaignRule => withKeys([structuredClone(CAMPAIGNS.find((c) => c.code === code)!.campaign.rules[0])], () => `k${++n}`)[0]

describe('the box', () => {
  it('shows a stored expression as text and reads text back into it', () => {
    const r = rule('WLCB') // values eligible, back
    expect(boxOf(r.values[1].expr, r)).toEqual({ text: 'round(eligible * 0.1, 0, halfUp)', json: false })
    expect(readBox('round(eligible * 0.1, 0, halfUp)', false, r)).toEqual({ ok: true, expr: r.values[1].expr })
    expect(boxOf(null, r)).toEqual({ text: '', json: false })
    expect(readBox('  ', false, r)).toEqual({ ok: true, expr: null })
  })

  it('a text that does not read keeps what is wrong and where', () => {
    const r = rule('WLCB')
    const read = readBox('round(eligible * , 0, halfUp)', false, r)
    expect(read.ok).toBe(false)
    if (!read.ok) {
      expect(read.problem?.code).toBe('unexpected')
      expect(read.underline?.bad).not.toBe('')
    }
  })

  it('an expression the codec cannot print is shown and edited as JSON', () => {
    const r = rule('WLCB')
    const odd = ['merge', { a: 1 }]
    expect(boxOf(odd as never, r)).toEqual({ text: JSON.stringify(odd), json: true })
    expect(readBox('["merge",{"a":2}]', true, r)).toEqual({ ok: true, expr: ['merge', { a: 2 }] })
    expect(readBox('["merge",', true, r)).toEqual({ ok: false, problem: null, underline: null })
  })
})

describe('the helper’s lists', () => {
  it('Fields lists the rule’s filters, the values above this one, then the language’s fields', () => {
    const r = rule('PRCB-AUG26') // values basis, rate, back
    const back = keyOf(r.values[2])
    const own = fxFields(FORMULA_GUIDE, r, back).filter((f) => f.group === 'rule')
    expect(own.map((f) => [f.kind, f.insert, f.type])).toEqual([
      ['filter', `items('${r.filters[0].name}')`, 'items'],
      ['value', 'basis', 'number'],
      ['value', 'rate', 'number'],
    ])
    // The formula condition reads every value.
    expect(fxFields(FORMULA_GUIDE, r, null).filter((f) => f.kind === 'value').map((f) => f.insert)).toEqual(['basis', 'rate', 'back'])
    // HQ's fields follow, in its groups.
    expect(fxFields(FORMULA_GUIDE, r, null).some((f) => f.kind === 'field' && f.insert === 'session.total')).toBe(true)
  })

  it('a recipe names the picked filter, and says when it needs one', () => {
    const pct = FORMULA_GUIDE.recipes.find((x) => x.key === 'percentOfSpend')!
    expect(recipeNeedsFilter(pct)).toBe(true)
    expect(recipeFormula(pct, 'Eligible')).toBe("round(sum(items('Eligible'), item.net) * 0.1, 0, halfUp)")
    expect(recipeNeedsFilter(FORMULA_GUIDE.recipes.find((x) => x.key === 'topTiers')!)).toBe(false)
    // A cap wraps what the box already has.
    const cap = FORMULA_GUIDE.recipes.find((x) => x.key === 'capped')!
    expect(recipeNeedsCurrent(cap)).toBe(true)
    expect(recipeFormula(cap, 'eligible', ' spend * 0.1 ')).toBe('min(spend * 0.1, 100)')
  })

  it('a value reads only the values above it; the formula condition reads them all', () => {
    const r = rule('PRCB-AUG26')
    expect(valuesBefore(r, keyOf(r.values[1]))).toEqual([r.values[0]])
    expect(valuesBefore(r, null)).toEqual(r.values)
  })
})
