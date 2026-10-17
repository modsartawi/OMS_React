/**
 * Tickets 505 / 522 — the builder's edits are pure: they copy what they touch, share the rest, and
 * hand back the SAME rules when there is nothing to change (the history then takes no step). Blocks
 * carry no id in schema 1: they are found by their builder key, which the wire never sees.
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleCondition } from '@/core/models/rule-campaign'
import { CAMPAIGNS } from '../../../../tools/campaigns-fixtures.mjs'
import { BLOCK_KEY, keyOf, withKeys } from './block-keys'
import { addCondition, addEffect, addRule, deleteBlock, deleteRule, moveBlock, moveRule, renameRule, setBlockField, setBundle, setPartial } from './rule-edit'

let n = 0
const mint = () => `k${++n}`
const sun = (): CampaignRule[] => withKeys(structuredClone(CAMPAIGNS.find((c) => c.code === 'SUN-3FOR2')!.campaign.rules), mint)
const keyed = <T extends object>(x: T, k: string): T => ({ ...x, [BLOCK_KEY]: k })
const cond = (k: string, extra: Record<string, unknown> = {}): RuleCondition => keyed({ check: 'minCount', says: { en: '', ar: '' }, count: 1, ...extra }, k)
const blank = (id: string): CampaignRule => ({ id, name: '', filters: [], values: [], when: [], then: [] })
type Group = RuleCondition & { conditions: RuleCondition[] }

describe('rule-edit', () => {
  it('keys never reach the wire', () => {
    const rules = sun()
    expect(keyOf(rules[0].when[0])).not.toBe('')
    expect(JSON.stringify(rules)).toBe(JSON.stringify(CAMPAIGNS.find((c) => c.code === 'SUN-3FOR2')!.campaign.rules.map((r) => ({ ...r, filters: r.filters ?? [], values: r.values ?? [] }))))
  })

  it('adds, renames, moves and deletes rules', () => {
    const rules = addRule(sun(), blank('r2'))
    expect(rules.map((r) => r.id)).toEqual([sun()[0].id, 'r2'])
    expect(renameRule(rules, 'r2', 'Second')[1].name).toBe('Second')
    expect(moveRule(rules, 'r2', -1).map((r) => r.id)).toEqual(['r2', sun()[0].id])
    expect(moveRule(rules, 'r2', 1)).toBe(rules)
    expect(deleteRule(rules, 'r2')).toHaveLength(1)
    expect(deleteRule(rules, 'nope')).toBe(rules)
    expect(setPartial(rules, 'r2', 'scale')[1].partial).toBe('scale')
    expect(setPartial(rules, 'r2', 'refuse')).toBe(rules)
  })

  it('sets a field, leaves the original untouched, and shares the other rules', () => {
    const rules = addRule(sun(), blank('r2'))
    const k = keyOf(rules[0].when[0])
    const before = rules[0].when[0].count
    const next = setBlockField(rules, rules[0].id, k, 'count', 5)
    expect(next[0].when[0].count).toBe(5)
    expect(rules[0].when[0].count).toBe(before)
    expect(keyOf(next[0].when[0])).toBe(k)
    expect(next[1]).toBe(rules[1])
    expect(next[0].then).toBe(rules[0].then)
    expect(setBlockField(rules, rules[0].id, k, 'count', before)).toBe(rules)
    expect(setBlockField(rules, rules[0].id, keyOf(rules[0].then[0]), 'free', 2)[0].then[0].free).toBe(2)
  })

  it('adds into a group, edits, moves and deletes inside it', () => {
    let rules = sun()
    const r = rules[0].id
    const at = rules[0].when.length
    rules = addCondition(rules, r, null, keyed({ check: 'group', mode: 'any', conditions: [] }, 'g1'))
    rules = addCondition(rules, r, 'g1', cond('in1'))
    rules = addCondition(rules, r, 'g1', cond('in2'))
    const group = () => rules[0].when[at] as Group
    expect(group().conditions.map(keyOf)).toEqual(['in1', 'in2'])
    rules = setBlockField(rules, r, 'in2', 'count', 4)
    expect(group().conditions[1].count).toBe(4)
    rules = moveBlock(rules, r, 'in2', -1)
    expect(group().conditions.map(keyOf)).toEqual(['in2', 'in1'])
    expect(moveBlock(rules, r, 'in2', -1)).toBe(rules)
    rules = deleteBlock(rules, r, 'in1')
    expect(group().conditions.map(keyOf)).toEqual(['in2'])
    rules = deleteBlock(rules, r, 'g1')
    expect(rules[0].when).toHaveLength(at)
  })

  it('adds, moves and deletes effects', () => {
    let rules = sun()
    const r = rules[0].id
    rules = addEffect(rules, r, keyed({ effect: 'cashierMessage', text: { en: '', ar: '' } }, 'e2'))
    expect(rules[0].then.map((e) => e.effect)).toEqual([sun()[0].then[0].effect, 'cashierMessage'])
    rules = moveBlock(rules, r, 'e2', -1)
    expect(keyOf(rules[0].then[0])).toBe('e2')
    rules = deleteBlock(rules, r, 'e2')
    expect(rules[0].then).toHaveLength(1)
    expect(deleteBlock(rules, r, 'nope')).toBe(rules)
  })

  it('sets and clears the rule’s bundle', () => {
    const rules = sun()
    const r = rules[0].id
    const next = setBundle(rules, r, { lists: [{ filter: 'f-sun', count: 2 }], max: 2 })
    expect(next[0].bundle).toEqual({ lists: [{ filter: 'f-sun', count: 2 }], max: 2 })
    expect(setBundle(next, r, { lists: [{ filter: 'f-sun', count: 2 }], max: 2 })).toBe(next)
    expect(setBundle(next, r, null)[0]).not.toHaveProperty('bundle')
  })
})
