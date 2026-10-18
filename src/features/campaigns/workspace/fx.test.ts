/**
 * Tickets 507 / 522 — the guided ƒx helper inserts at the cursor; its text box reads into the
 * stored JSON expression through the codec, and a stored one it cannot print shows as JSON.
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { FORMULA_GUIDE } from '@/core/rules/formula-guide'
import { CAMPAIGNS } from '../../../../tools/campaigns-fixtures.mjs'
import { keyOf, withKeys } from './block-keys'
import { boxOf, fxFields, insertAtCursor, operatorChip, readBox, recipeFormula, recipeNeedsCurrent, recipeNeedsFilter, valuesBefore } from './fx'

let n = 0
const rule = (code: string): CampaignRule => withKeys([structuredClone(CAMPAIGNS.find((c) => c.code === code)!.campaign.rules[0])], () => `k${++n}`)[0]

describe('insertAtCursor', () => {
  it('insertAtCursor_placesChipAndKeepsCaret', () => {
    // A field at the caret, the caret after it.
    expect(insertAtCursor('back > 0', { start: 0, end: 0 }, { text: 'spend' })).toEqual({ formula: 'spend back > 0', caret: 5 })
    // Over a selection: it replaces what was selected.
    expect(insertAtCursor('round(sum(eligible) * 10 / 100, decimals, halfUp)', { start: 6, end: 19 }, { text: 'spend' })).toEqual({
      formula: 'round(spend * 10 / 100, decimals, halfUp)',
      caret: 11,
    })
    // A function's snippet puts the caret inside it.
    expect(insertAtCursor('', null, { text: 'min(, 100)', caret: 4 })).toEqual({ formula: 'min(, 100)', caret: 4 })
    expect(insertAtCursor('spend', { start: 5, end: 5 }, { text: 'min(, 100)', caret: 4 })).toEqual({ formula: 'spend min(, 100)', caret: 10 })
    // No caret yet: at the end.
    expect(insertAtCursor('back', null, operatorChip('>='))).toEqual({ formula: 'back >= ', caret: 8 })
    // An operator next to a space does not double it.
    expect(insertAtCursor('back ', { start: 5, end: 5 }, operatorChip('*'))).toEqual({ formula: 'back * ', caret: 7 })
    expect(insertAtCursor('a b', { start: 1, end: 1 }, operatorChip('+'))).toEqual({ formula: 'a + b', caret: 4 })
    // Brackets come as a pair, the caret between them.
    expect(insertAtCursor('x', { start: 1, end: 1 }, operatorChip('('))).toEqual({ formula: 'x ()', caret: 3 })
    // A word before a word gets a space after too, so two names never run together.
    expect(insertAtCursor('back', { start: 0, end: 0 }, { text: 'spend' }).formula).toBe('spend back')
    // A caret past the end (the formula changed under it) is held to the end.
    expect(insertAtCursor('ab', { start: 9, end: 12 }, { text: 'c' })).toEqual({ formula: 'ab c', caret: 4 })
  })
})

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
