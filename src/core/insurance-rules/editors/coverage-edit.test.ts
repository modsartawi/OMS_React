/** Ticket 617 (moved by 676) — a coverage rule's effect: one effect kind per rule, the payer mark, the editor's refusals. */
import { describe, expect, it } from 'vitest'
import type { CoverageEffect, CoverageRule } from '@/core/insurance-rules/coverage-model'
import type { GuardCondition } from '@/core/insurance-rules/model'
import { coverageRuleProblems, newCoverageEffect, payerMark } from './coverage-edit'

const cov = (then: CoverageRule['then'], when: CoverageRule['when'] = []): CoverageRule => ({ id: 'C-009', name: { en: 'x', ar: 'x' }, state: 'draft', when, then })

describe('coverage rule effects', () => {
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
  })

  it('coverageRuleProblems_refusesMixedEffectKinds — two effects of one kind are not refused', () => {
    expect(coverageRuleProblems(cov([{ effect: 'covered', value: true }, { effect: 'priceCap', value: 5 }]))).toEqual(['mixedEffects'])
    expect(coverageRuleProblems(cov([{ effect: 'priceCap', value: 5 }, { effect: 'priceCap', value: 7, overridesPayer: true }]))).toEqual([])
  })

  it('coverageRuleProblems_refusesADeductibleOutOfRangeOrEmpty', () => {
    expect(coverageRuleProblems(cov([{ effect: 'deductible', percent: 100 }]))).toEqual([])
    expect(coverageRuleProblems(cov([{ effect: 'deductible', max: 50 }]))).toEqual([])
    expect(coverageRuleProblems(cov([{ effect: 'deductible', percent: 101 }]))).toEqual(['deductiblePercent'])
    expect(coverageRuleProblems(cov([{ effect: 'deductible', percent: -1, max: 5 }]))).toEqual(['deductiblePercent'])
    expect(coverageRuleProblems(cov([{ effect: 'deductible' }]))).toEqual(['deductibleEmpty'])
  })
})
