/**
 * Ticket 507 — the guided ƒx helper inserts at the cursor and shows HQ's check: the error under the
 * bad word, or the result on the sample basket. The client never parses the formula (ADR 0089).
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleFormulaCheck } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { checkRequest, fxFields, insertAtCursor, operatorChip, readFormulaCheck, recipeFormula, recipeNeedsCurrent, recipeNeedsFilter } from './fx'

const rule = (code: string): CampaignRule => structuredClone(CAMPAIGNS.find((c) => c.code === code)!.rules[0])
const check = (o: Partial<RuleFormulaCheck>): RuleFormulaCheck => ({ ok: false, type: null, errors: [], warnings: [], result: null, ...o })

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

describe('readFormulaCheck', () => {
  it('formulaCheck_mapsHqErrorSpanToTheUnderline', () => {
    const bad = readFormulaCheck(
      'bakc > 0',
      check({ errors: [{ code: 'UNKNOWN_NAME', message: '"bakc" is not a field.', start: 0, end: 4 }, { code: 'X', message: 'second', start: null, end: null }] }),
    )
    expect(bad).toEqual({ state: 'bad', message: '"bakc" is not a field.', underline: { before: '', bad: 'bakc', after: ' > 0' }, more: ['second'] })

    // A span inside the formula.
    expect(readFormulaCheck('sum(eligble) * 2', check({ errors: [{ code: 'U', message: 'm', start: 4, end: 11 }] }))).toMatchObject({
      underline: { before: 'sum(', bad: 'eligble', after: ') * 2' },
    })
    // An empty span marks one character; at the end, a space stands for what is missing.
    expect(readFormulaCheck('a >', check({ errors: [{ code: 'U', message: 'm', start: 1, end: 1 }] }))).toMatchObject({ underline: { before: 'a', bad: ' ', after: '>' } })
    expect(readFormulaCheck('a >', check({ errors: [{ code: 'U', message: 'm', start: 3, end: 3 }] }))).toMatchObject({ underline: { before: 'a >', bad: ' ', after: '' } })
    // A span past the end is held to the formula.
    expect(readFormulaCheck('ab', check({ errors: [{ code: 'U', message: 'm', start: 1, end: 40 }] }))).toMatchObject({ underline: { before: 'a', bad: 'b', after: '' } })
    // No span: the message, nothing underlined.
    expect(readFormulaCheck('ab', check({ errors: [{ code: 'U', message: 'm', start: null, end: null }] }))).toMatchObject({ state: 'bad', underline: null })

    // A good formula: its type, its result on the sample basket and HQ's warnings.
    expect(readFormulaCheck('spend', check({ ok: true, type: 'money', result: 12.5, warnings: [{ code: 'W', message: 'careful', start: null, end: null }] }))).toEqual({
      state: 'ok',
      type: 'money',
      result: 12.5,
      warnings: ['careful'],
    })
  })
})

describe('the helper’s lists', () => {
  it('Fields lists the rule’s filters, the values above this one, then HQ’s fields', () => {
    const r = rule('PRCB-AUG26') // values basis, rate, back
    const back = r.values[2].id
    const own = fxFields(CATALOGUE.formula, r, back).filter((f) => f.group === 'rule')
    expect(own.map((f) => [f.kind, f.insert, f.type])).toEqual([
      ['filter', 'earning', 'items'],
      ['value', 'basis', 'number'],
      ['value', 'rate', 'number'],
    ])
    // The formula condition reads every value.
    expect(fxFields(CATALOGUE.formula, r, null).filter((f) => f.kind === 'value').map((f) => f.insert)).toEqual(['basis', 'rate', 'back'])
    // HQ's fields follow, in its groups.
    expect(fxFields(CATALOGUE.formula, r, null).some((f) => f.kind === 'field' && f.insert === 'session.total')).toBe(true)
  })

  it('a recipe names the picked filter, and says when it needs one', () => {
    const pct = CATALOGUE.formula.recipes.find((x) => x.key === 'percentOfSpend')!
    expect(recipeNeedsFilter(pct)).toBe(true)
    expect(recipeFormula(pct, 'eligible')).toBe('round(sum(eligible) * 10 / 100, decimals, halfUp)')
    expect(recipeNeedsFilter(CATALOGUE.formula.recipes.find((x) => x.key === 'topTiers')!)).toBe(false)
    // A cap wraps what the box already has.
    const cap = CATALOGUE.formula.recipes.find((x) => x.key === 'capped')!
    expect(recipeNeedsCurrent(cap)).toBe(true)
    expect(recipeFormula(cap, 'eligible', ' spend * 0.1 ')).toBe('min(spend * 0.1, 100)')
  })

  it('the check sends the draft rule’s filters and only the values above the one being written', () => {
    const r = rule('PRCB-AUG26')
    const req = checkRequest('PRCB-AUG26', r, r.values[1].id, 'number', ' band(basis, 200:0.10) ')
    expect(req).toEqual({ campaignId: 'PRCB-AUG26', expect: 'number', formula: ' band(basis, 200:0.10) ', filters: r.filters, values: [r.values[0]] })
    expect(checkRequest('X', r, null, 'bool', 'back > 0').values).toEqual(r.values)
  })
})
