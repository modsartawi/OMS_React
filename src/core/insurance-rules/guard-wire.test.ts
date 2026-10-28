/** oms 618 — the guard document as SIS.Rules reads it, and the editor's model of it (608's guesses reconciled). */
import { describe, expect, it } from 'vitest'
import { guardRuleIn, guardRuleOut, guardRulesetIn, guardRulesetOut, rulesetIn, rulesetOut } from './guard-wire'
import type { GuardRule } from './model'

/** The phase-1 `quantity-cap` template's rule body, as HQ seeds it (SQL 035). */
const QUANTITY_CAP = {
  name: { en: 'Quantity cap per period', ar: 'حد الكمية خلال فترة' },
  folder: 'History',
  when: [{ check: 'history', match: 'list:glp1', windowDays: 28, measure: 'quantity', atLeast: 5, includeThisLine: true }],
  then: [{ effect: 'guard', severity: 'OVERRIDE', says: { en: '{count}', ar: '{count}' }, suggest: { maxQuantity: '{remaining}' } }],
}

describe('guard-wire', () => {
  it('a wire rule reads with its defaults and each list it names bound as a filter under the list id', () => {
    const rule = guardRuleIn(QUANTITY_CAP)
    expect(rule.filters).toEqual([{ id: 'glp1', list: 'glp1' }])
    expect(rule.onUnknown).toBe('none')
    expect(rule.id).toBe('')
    expect(rule.state).toBe('draft')
    expect(rule.when[0]).toMatchObject({ check: 'history', match: 'list:glp1' })
  })

  it('an editor rule is written without filters, every alias resolved to its list', () => {
    const rule = {
      ...guardRuleIn(QUANTITY_CAP),
      id: 'G-003',
      filters: [{ id: 'items', list: 'glp1' }],
      when: [
        { check: 'history', match: 'list:items', windowDays: 28, measure: 'quantity', atLeast: 5, includeThisLine: true },
        { check: 'group', mode: 'all', conditions: [{ check: 'line', inList: 'items' }] },
      ],
    } as GuardRule
    const out = guardRuleOut(rule)
    expect(out).not.toHaveProperty('filters')
    expect(out.when).toEqual([
      { check: 'history', match: 'list:glp1', windowDays: 28, measure: 'quantity', atLeast: 5, includeThisLine: true },
      { check: 'group', mode: 'all', conditions: [{ check: 'line', inList: 'glp1' }] },
    ])
  })

  it('a fact block is the engine block of its scope, `below` is `under`, noneOf is anyOf under not', () => {
    const rule = {
      ...guardRuleIn({}),
      when: [
        { check: 'fact', path: '$patient.age', op: 'atLeast', value: 65 },
        { check: 'fact', path: '$eligibility.benefit[66].copayPct', op: 'below', value: 20 },
        { check: 'fact', path: '$request.channel', op: 'noneOf', value: ['oms'] },
        { check: 'line', field: 'daysSupply', below: 30 },
      ],
    } as GuardRule
    expect(guardRuleOut(rule).when).toEqual([
      { check: 'patient', field: 'age', atLeast: 65 },
      { check: 'eligibility', field: 'benefit[66].copayPct', under: 20 },
      { check: 'request', field: 'channel', anyOf: ['oms'], not: true },
      { check: 'line', field: 'daysSupply', under: 30 },
    ])
  })

  it('reads the engine blocks back into the editor’s, and keeps what it cannot draw as the engine wrote it', () => {
    const rule = guardRuleIn({
      when: [
        { check: 'patient', field: 'age', atLeast: 65 },
        { check: 'line', field: 'daysSupply', under: 30 },
        { check: 'patient', field: 'age', above: 18, under: 65 },
        { check: 'eligibility', field: 'coverage.periodEnd', before: 'today+30' },
      ],
    })
    expect(rule.when).toEqual([
      { check: 'fact', path: '$patient.age', op: 'atLeast', value: 65 },
      { check: 'line', field: 'daysSupply', below: 30 },
      { check: 'patient', field: 'age', above: 18, under: 65 },
      { check: 'eligibility', field: 'coverage.periodEnd', before: 'today+30' },
    ])
    // …and round-trips byte for byte.
    expect(guardRuleOut(rule).when).toEqual([
      { check: 'patient', field: 'age', atLeast: 65 },
      { check: 'line', field: 'daysSupply', under: 30 },
      { check: 'patient', field: 'age', above: 18, under: 65 },
      { check: 'eligibility', field: 'coverage.periodEnd', before: 'today+30' },
    ])
  })

  it('a formula is text in the editor and the operator-first array on the wire', () => {
    const rule = guardRuleIn({ when: [{ check: 'formula', expr: ['>', '$patient.age', 65] }] })
    expect(rule.when[0]).toEqual({ check: 'formula', formula: 'patient.age > 65' })
    expect((guardRuleOut(rule).when as unknown[])[0]).toEqual({ check: 'formula', expr: ['>', '$patient.age', 65] })
  })

  it('a document defaults its lists’ filter parts and keeps its root fields', () => {
    const doc = guardRulesetIn({ schema: 1, kind: 'guard', revision: 3, nonIngredientList: 'nonIng', lists: [{ id: 'glp1', filters: [{ attributes: [{ field: 'ECode', anyOf: ['E1'] }] }] }], rules: [] })
    expect(doc.lists[0]).toMatchObject({ id: 'glp1', name: { en: '', ar: '' }, include: [], exclude: [], filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E1'] }] }] })
    expect(guardRulesetOut(doc)).toMatchObject({ revision: 3, nonIngredientList: 'nonIng' })
  })

  it('a category / coverage document rides the same block codec', () => {
    const doc = rulesetIn<{ rules: { when: unknown[] }[] }>({ kind: 'coverage', rules: [{ id: 'C-1', when: [{ check: 'patient', field: 'age', atLeast: 60 }], then: [] }] })
    expect(doc.rules[0].when[0]).toEqual({ check: 'fact', path: '$patient.age', op: 'atLeast', value: 60 })
    expect(rulesetOut(doc)).toEqual({ kind: 'coverage', rules: [{ id: 'C-1', when: [{ check: 'patient', field: 'age', atLeast: 60 }], then: [] }] })
  })
})
