/**
 * Ticket 507 — a rule's named values: an effect reads one by id, so a rename keeps it; a value in
 * use cannot be deleted; a name is never empty nor another value's or filter's.
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { filterNameProblem } from '@/core/rules/filters'
import { setBlockField } from './rule-edit'
import { addValue, deleteValue, moveValue, newValue, nextValueName, pinValueRefs, updateValue, valueNameProblem, valueUses } from './value-edit'

const rulesOf = (code: string): CampaignRule[] => structuredClone(CAMPAIGNS.find((c) => c.code === code)!.rules)

describe('named values', () => {
  it('an effect reads a named value by id, so a rename keeps it', () => {
    const rules = rulesOf('WLCB')
    const r = rules[0]
    const v = newValue('v-new', nextValueName(r, 'value'))
    expect(v).toEqual({ id: 'v-new', name: 'value1', formula: '' })
    let next = addValue(rules, r.id, v)
    next = updateValue(next, r.id, 'v-new', { formula: 'round(sum(eligible) * 10 / 100, decimals, halfUp)' })
    next = setBlockField(next, r.id, r.then[0].id, 'value', 'v-new')
    expect(valueUses(next[0], 'v-new', CATALOGUE)).toBe(1)
    next = updateValue(next, r.id, 'v-new', { name: 'cashback' })
    expect(next[0].values.at(-1)).toEqual({ id: 'v-new', name: 'cashback', formula: 'round(sum(eligible) * 10 / 100, decimals, halfUp)' })
    expect(next[0].then[0].value).toBe('v-new')
    // Nothing changed: the same rules, so the history takes no step.
    expect(updateValue(next, r.id, 'v-new', { name: 'cashback' })).toBe(next)
  })

  it('a rename pins a reference by the old name to the id, so the effect keeps reading the value', () => {
    const rules = rulesOf('WLCB')
    const back = rules[0].values[1]
    expect(rules[0].then[0].value).toBe('back') // the sample's older wire: by name
    const next = updateValue(pinValueRefs(rules, rules[0].id, back.id, CATALOGUE), rules[0].id, back.id, { name: 'payback' })
    expect(next[0].then[0].value).toBe(back.id)
    expect(valueUses(next[0], back.id, CATALOGUE)).toBe(1)
    // Already by id: nothing to pin, the same rules.
    expect(pinValueRefs(next, rules[0].id, back.id, CATALOGUE)).toBe(next)
  })

  it('a value in use cannot be deleted; an unused one can', () => {
    const rules = rulesOf('WLCB')
    const [spend, back] = rules[0].values
    // The sample's award reads `back` by name: that is a use too.
    expect(valueUses(rules[0], back.id, CATALOGUE)).toBe(1)
    expect(deleteValue(rules, rules[0].id, back.id, CATALOGUE)).toBe(rules)
    expect(deleteValue(rules, rules[0].id, spend.id, CATALOGUE)[0].values.map((v) => v.name)).toEqual(['back'])
  })

  it('a name is never empty, nor another value’s or a filter’s', () => {
    const r = rulesOf('WLCB')[0]
    expect(valueNameProblem(r, ' ', r.values[0].id)).toBe('empty')
    expect(valueNameProblem(r, 'BACK', r.values[0].id)).toBe('taken')
    expect(valueNameProblem(r, 'eligible')).toBe('taken')
    expect(valueNameProblem(r, 'spend', r.values[0].id)).toBeNull()
    expect(nextValueName({ filters: [], values: [newValue('a', 'value1')] }, 'value')).toBe('value2')
    // …and a filter may not take a value's name either.
    expect(filterNameProblem(r.filters, 'Spend', undefined, r.values)).toBe('taken')
  })

  it('moves a value up and down within the rule', () => {
    const rules = rulesOf('PRCB-AUG26')
    const [, rate] = rules[0].values
    expect(moveValue(rules, rules[0].id, rate.id, -1)[0].values.map((v) => v.name)).toEqual(['rate', 'basis', 'back'])
    expect(moveValue(rules, rules[0].id, rules[0].values[0].id, -1)).toBe(rules)
  })
})
