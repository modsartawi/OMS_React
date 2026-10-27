/** Ticket 617 — category and coverage rulesets: order is the rule (first match wins), one effect per rule, the payer mark. */
import { describe, expect, it } from 'vitest'
import type { CategoryRuleset, CoverageEffect, CoverageRule } from '@/core/insurance-rules/coverage-model'
import type { GuardCondition } from '@/core/insurance-rules/model'
import { addRule, coverageRuleProblems, editRuleIn, moveRule, newCoverageEffect, newRule, nextRuleId, payerMark } from './ruleset-edit'

const cat = (...ids: string[]): CategoryRuleset => ({
  schema: 1,
  kind: 'category',
  revision: 3,
  rules: ids.map((id) => ({ id, name: { en: id, ar: id }, state: 'live', when: [], then: [{ effect: 'setCategory', group: 'G1' }] })),
})

const cov = (then: CoverageRule['then'], when: CoverageRule['when'] = []): CoverageRule => ({ id: 'C-009', name: { en: 'x', ar: 'x' }, state: 'draft', when, then })

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

  it('payerMark — a value applies where the payer said nothing unless it carries overridesPayer: true', () => {
    const fills: CoverageEffect = { effect: 'deductible', percent: 0 }
    expect(payerMark(fills)).toBe('fills')
    expect(payerMark({ ...fills, overridesPayer: true })).toBe('overrides')
  })

  it('newCoverageEffect — the built spelling, no overridesPayer key until marked', () => {
    expect(newCoverageEffect('deductible')).toEqual({ effect: 'deductible', percent: 0 })
    expect(newCoverageEffect('covered')).toEqual({ effect: 'covered', value: false })
    expect(newCoverageEffect('quantityCap')).toEqual({ effect: 'quantityCap', value: 0 })
    expect(newCoverageEffect('segment')).toEqual({ effect: 'segment', value: 'ELITE' })
    expect(newCoverageEffect('exceptionPrescriptions')).toEqual({ effect: 'exceptionPrescriptions', value: true })
  })

  it('coverageRuleProblems_refusesAnInvoiceRuleThatReadsTheLine — and a rule with no effect or more than one', () => {
    const itemFact: GuardCondition = { check: 'fact', path: '$item.ItemCode', op: 'anyOf', value: ['100245'] }
    const payerFact: GuardCondition = { check: 'fact', path: '$request.payer', op: 'anyOf', value: ['BUPA'] }
    expect(coverageRuleProblems(cov([{ effect: 'segment', value: 'SABIC' }], [payerFact]))).toEqual([])
    expect(coverageRuleProblems(cov([{ effect: 'segment', value: 'SABIC' }], [{ check: 'group', mode: 'any', conditions: [itemFact] }]))).toEqual(['invoiceReadsLine'])
    expect(coverageRuleProblems(cov([{ effect: 'deductible', percent: 0 }], [itemFact]))).toEqual([])
    expect(coverageRuleProblems(cov([]))).toEqual(['noEffect'])
    expect(coverageRuleProblems(cov([{ effect: 'covered', value: true }, { effect: 'priceCap', value: 5 }]))).toEqual(['oneEffect'])
  })
})
