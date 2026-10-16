/**
 * Ticket 505 — the builder's edits are pure: they copy what they touch, share the rest, and hand
 * back the SAME rules when there is nothing to change (the history then takes no step).
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleCondition } from '@/core/models/rule-campaign'
import { CAMPAIGNS } from '../../../../tools/campaigns-fixtures.mjs'
import {
  addCondition,
  addEffect,
  addRule,
  deleteBlock,
  deleteRule,
  moveBlock,
  moveRule,
  renameRule,
  setBlockField,
  setPartial,
  setWhenMode,
} from './rule-edit'

const sun = (): CampaignRule[] => structuredClone(CAMPAIGNS.find((c) => c.id === 'SUN-3FOR2')!.rules)
const cond = (id: string, extra: Record<string, unknown> = {}): RuleCondition => ({ id, type: 'minCount', says: { en: '', ar: '' }, count: 1, of: '', ...extra })
const blank = (id: string): CampaignRule => ({ id, name: '', filters: [], values: [], when: { mode: 'all', items: [] }, then: [], partial: 'refuse' })

describe('rule-edit', () => {
  it('adds, renames, moves and deletes rules', () => {
    const rules = addRule(sun(), blank('r2'))
    expect(rules.map((r) => r.id)).toEqual([sun()[0].id, 'r2'])
    expect(renameRule(rules, 'r2', 'Second')[1].name).toBe('Second')
    expect(moveRule(rules, 'r2', -1).map((r) => r.id)).toEqual(['r2', sun()[0].id])
    expect(moveRule(rules, 'r2', 1)).toBe(rules)
    expect(deleteRule(rules, 'r2')).toHaveLength(1)
    expect(deleteRule(rules, 'nope')).toBe(rules)
    expect(setWhenMode(rules, 'r2', 'any')[1].when.mode).toBe('any')
    expect(setPartial(rules, 'r2', 'scale')[1].partial).toBe('scale')
    expect(setPartial(rules, 'r2', 'refuse')).toBe(rules)
  })

  it('sets a field, leaves the original untouched, and shares the other rules', () => {
    const rules = addRule(sun(), blank('r2'))
    const id = rules[0].when.items[0].id
    const next = setBlockField(rules, rules[0].id, id, 'count', 5)
    expect(next[0].when.items[0].count).toBe(5)
    expect(rules[0].when.items[0].count).toBe(3)
    expect(next[1]).toBe(rules[1])
    expect(next[0].then).toBe(rules[0].then)
    expect(setBlockField(rules, rules[0].id, id, 'count', 3)).toBe(rules)
    const effect = rules[0].then[0].id
    expect(setBlockField(rules, rules[0].id, effect, 'free', 2)[0].then[0].free).toBe(2)
  })

  it('adds into a group, edits, moves and deletes inside it', () => {
    let rules = sun()
    const r = rules[0].id
    rules = addCondition(rules, r, null, { ...cond('g1'), type: 'group', mode: 'any', items: [] })
    rules = addCondition(rules, r, 'g1', cond('in1'))
    rules = addCondition(rules, r, 'g1', cond('in2'))
    const group = rules[0].when.items[2] as RuleCondition & { items: RuleCondition[] }
    expect(group.items.map((c) => c.id)).toEqual(['in1', 'in2'])
    rules = setBlockField(rules, r, 'in2', 'count', 4)
    expect((rules[0].when.items[2] as typeof group).items[1].count).toBe(4)
    rules = moveBlock(rules, r, 'in2', -1)
    expect((rules[0].when.items[2] as typeof group).items.map((c) => c.id)).toEqual(['in2', 'in1'])
    // A block moves only within its own list.
    expect(moveBlock(rules, r, 'in2', -1)).toBe(rules)
    rules = deleteBlock(rules, r, 'in1')
    expect((rules[0].when.items[2] as typeof group).items.map((c) => c.id)).toEqual(['in2'])
    rules = deleteBlock(rules, r, 'g1')
    expect(rules[0].when.items).toHaveLength(2)
    expect(JSON.stringify(rules)).not.toContain('"in2"')
  })

  it('adds, moves and deletes effects', () => {
    let rules = sun()
    const r = rules[0].id
    rules = addEffect(rules, r, { id: 'e2', type: 'notify', text: { en: '', ar: '' } })
    expect(rules[0].then.map((e) => e.id)).toEqual([sun()[0].then[0].id, 'e2'])
    rules = moveBlock(rules, r, 'e2', -1)
    expect(rules[0].then[0].id).toBe('e2')
    rules = deleteBlock(rules, r, 'e2')
    expect(rules[0].then).toHaveLength(1)
    expect(deleteBlock(rules, r, 'nope')).toBe(rules)
  })
})
