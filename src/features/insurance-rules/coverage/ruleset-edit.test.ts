/** Ticket 617 — category and coverage rulesets: order is the rule (first match wins); the effect's own tests moved to core/insurance-rules/editors (676). */
import { describe, expect, it } from 'vitest'
import type { CategoryRuleset } from '@/core/insurance-rules/coverage-model'
import { addRule, editRuleIn, moveRule, newRule, nextRuleId } from './ruleset-edit'

const cat = (...ids: string[]): CategoryRuleset => ({
  schema: 1,
  kind: 'category',
  revision: 3,
  rules: ids.map((id) => ({ id, name: { en: id, ar: id }, state: 'live', when: [], then: [{ effect: 'setCategory', group: 'G1' }] })),
})

describe('category and coverage rulesets', () => {
  it('moveRule_changesWhichRuleMatchesFirst — up, down, and no step past either end', () => {
    const doc = cat('K-002', 'K-003', 'K-001')
    expect(moveRule(doc, 'K-001', -2).rules.map((r) => r.id)).toEqual(['K-001', 'K-002', 'K-003'])
    expect(moveRule(doc, 'K-002', 1).rules.map((r) => r.id)).toEqual(['K-003', 'K-002', 'K-001'])
    expect(moveRule(doc, 'K-002', -1)).toBe(doc)
    expect(moveRule(doc, 'K-001', 1)).toBe(doc)
    expect(moveRule(doc, 'K-404', 1)).toBe(doc)
  })

  it('nextRuleId — K- for categories and C- for coverage, one past the highest, three digits', () => {
    expect(nextRuleId(cat('K-002', 'K-009').rules, 'category')).toBe('K-010')
    expect(nextRuleId([], 'coverage')).toBe('C-001')
  })

  it('a new rule is a draft with no condition and no folder; a category sets Brand, a coverage rule sets nothing yet', () => {
    expect(newRule('K-004', 'category')).toEqual({ id: 'K-004', name: { en: '', ar: '' }, state: 'draft', when: [], then: [{ effect: 'setCategory', group: 'G2' }] })
    expect(newRule('C-004', 'coverage').then).toEqual([])
  })

  it('addRule goes LAST (it matches after every rule there); editRuleIn gives the same doc when nothing changed', () => {
    const doc = cat('K-001')
    const added = addRule(doc, newRule('K-002', 'category'))
    expect(added.rules.map((r) => r.id)).toEqual(['K-001', 'K-002'])
    expect(editRuleIn(doc, 'K-001', (r) => r)).toBe(doc)
    expect(editRuleIn(doc, 'K-001', (r) => ({ ...r, folder: 'Bupa contract' })).rules[0].folder).toBe('Bupa contract')
  })
})
