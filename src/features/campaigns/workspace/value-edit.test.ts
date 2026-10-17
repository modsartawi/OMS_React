/**
 * Tickets 507 / 522 — a rule's named values. Schema 1 reads a value by name (`"$name"`), so a rename
 * rewrites every reading of it in the rule; a value something reads cannot be deleted; a name is the
 * checker's shape and never another value's or filter's.
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { filterNameProblem } from '@/core/rules/filters'
import { BLOCK_KEY, keyOf, withKeys } from './block-keys'
import { setBlockField } from './rule-edit'
import { addValue, deleteValue, moveValue, newValue, nextValueName, renameValue, setValueExpr, valueNameProblem, valueUses } from './value-edit'

let n = 0
const rulesOf = (code: string): CampaignRule[] => withKeys(structuredClone(CAMPAIGNS.find((c) => c.code === code)!.campaign.rules), () => `k${++n}`)

describe('named values', () => {
  it('an effect reads a value by name, and a rename follows it everywhere in the rule', () => {
    const rules = rulesOf('WLCB') // values eligible, back; the award reads "$back", a formula reads it too
    const r = rules[0]
    const back = keyOf(r.values[1])
    const next = renameValue(rules, r.id, back, 'payback')
    expect(next[0].values[1].name).toBe('payback')
    expect(JSON.stringify(next[0])).not.toContain('"$back"')
    expect(JSON.stringify(next[0])).toContain('"$payback"')
    expect(valueUses(next[0], back, CATALOGUE)).toBe(valueUses(r, back, CATALOGUE))
    expect(renameValue(next, r.id, back, 'payback')).toBe(next)
  })

  it('a rename through another value’s name never takes that value’s readers with it', () => {
    const rules = rulesOf('WLCB') // `back` reads "$eligible"
    const r = rules[0]
    const v = { ...newValue('cashback'), [BLOCK_KEY]: 'v-cash' }
    let next = addValue(rules, r.id, v)
    next = renameValue(next, r.id, 'v-cash', 'eligible') // taken: the readers of `eligible` stay its own
    expect(next[0].values[1].expr).toEqual(r.values[1].expr)
    next = renameValue(next, r.id, 'v-cash', 'cashback') // the old name is shared: nothing follows
    expect(next[0].values[1].expr).toEqual(r.values[1].expr)
    expect(next[0].values[2].name).toBe('cashback')
  })

  it('a new value, its expression set and read by an effect', () => {
    const rules = rulesOf('WLCB')
    const r = rules[0]
    const v = { ...newValue(nextValueName(r, 'value')), [BLOCK_KEY]: 'v-new' }
    expect(newValue('value1')).toEqual({ name: 'value1', expr: null })
    let next = addValue(rules, r.id, v)
    next = setValueExpr(next, r.id, 'v-new', ['*', '$eligible', 0.1])
    expect(next[0].values.at(-1)?.expr).toEqual(['*', '$eligible', 0.1])
    expect(setValueExpr(next, r.id, 'v-new', ['*', '$eligible', 0.1])).toBe(next)
    next = setBlockField(next, r.id, keyOf(next[0].then[0]), 'amount', `$${v.name}`)
    expect(valueUses(next[0], 'v-new', CATALOGUE)).toBe(1)
  })

  it('a value in use cannot be deleted; an unused one can', () => {
    const rules = rulesOf('WLCB')
    const back = keyOf(rules[0].values[1])
    expect(valueUses(rules[0], back, CATALOGUE)).toBeGreaterThan(0)
    expect(deleteValue(rules, rules[0].id, back, CATALOGUE)).toBe(rules)
    const unused = addValue(rules, rules[0].id, { ...newValue('spare'), [BLOCK_KEY]: 'v-spare' } as ReturnType<typeof newValue>)
    expect(deleteValue(unused, rules[0].id, 'v-spare', CATALOGUE)[0].values.map((v) => v.name)).toEqual(rules[0].values.map((v) => v.name))
  })

  it('a name is the checker’s shape, never empty, nor another value’s or a filter’s', () => {
    const r = rulesOf('WLCB')[0]
    const self = keyOf(r.values[0])
    expect(valueNameProblem(r, ' ', self)).toBe('empty')
    expect(valueNameProblem(r, 'Back', self)).toBe('pattern')
    expect(valueNameProblem(r, 'two words', self)).toBe('pattern')
    expect(valueNameProblem(r, 'back', self)).toBe('taken')
    expect(valueNameProblem(r, 'spend', self)).toBeNull()
    expect(nextValueName({ filters: [], values: [newValue('value1')] }, 'value')).toBe('value2')
    expect(filterNameProblem(r.filters, 'BACK', undefined, r.values)).toBe('taken')
  })

  it('moves a value up and down within the rule', () => {
    const rules = rulesOf('PRCB-AUG26')
    const rate = keyOf(rules[0].values[1])
    expect(moveValue(rules, rules[0].id, rate, -1)[0].values.map((v) => v.name)).toEqual(['rate', 'basis', 'back'])
    expect(moveValue(rules, rules[0].id, keyOf(rules[0].values[0]), -1)).toBe(rules)
  })
})
