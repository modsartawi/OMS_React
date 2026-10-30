import { effectLevel, type CoverageEffect, type CoverageEffectKind, type CoverageRule } from '@/core/insurance-rules/coverage-model'
import type { GuardCondition } from '@/core/insurance-rules/model'

// The coverage effect editor's pure edits and refusals (oms 617; moved out of the coverage feature's
// `ruleset-edit.ts` by oms 676 so the rule playground builds rules with the same editors). The ruleset's
// order edits (move, add, next id) stay with the Coverage / Categories page.

/**
 * A coverage effect as the author picks it (3146's spelling). It applies only where the payer said nothing until
 * marked `overridesPayer: true` (the key is left out, never sent false).
 */
export function newCoverageEffect(kind: CoverageEffectKind): CoverageEffect {
  switch (kind) {
    case 'covered':
      return { effect: kind, value: false }
    case 'priorApproval':
    case 'exceptionPrescriptions':
      return { effect: kind, value: true }
    case 'deductible':
      return { effect: kind, percent: 0 }
    case 'priceCap':
    case 'quantityCap':
    case 'daysSupplyCap':
      return { effect: kind, value: 0 }
    case 'segment':
      return { effect: kind, value: 'ELITE' }
  }
}

/** The effect with its payer mark set, or cleared (the key gone). */
export function withOverridesPayer(e: CoverageEffect, on: boolean): CoverageEffect {
  if (on) return { ...e, overridesPayer: true }
  const rest: CoverageEffect = { ...e }
  delete rest.overridesPayer
  return rest
}

/** Whether a coverage value applies only where the payer said nothing, or replaces what the payer stated. */
export const payerMark = (e: Pick<CoverageEffect, 'overridesPayer'>): 'fills' | 'overrides' => (e.overridesPayer ? 'overrides' : 'fills')

/** Line facts: the item's fields and the line's own (`$item.*`, `$line.*`). */
const LINE_PATH = /^\$(item|line)\./
/** Blocks that read a request line (3146: "an invoice rule reads no `line` block"). */
const LINE_CHECKS: ReadonlySet<string> = new Set(['line', 'sfda', 'formulary', 'supply', 'volume', 'history'])

/** Whether any condition, at any depth, reads a line. */
export function readsLine(when: readonly GuardCondition[]): boolean {
  return when.some((c) => (c.check === 'group' ? readsLine(c.conditions) : LINE_CHECKS.has(c.check) || (c.check === 'fact' && LINE_PATH.test(c.path))))
}

export type CoverageRuleProblem = 'noEffect' | 'mixedEffects' | 'invoiceReadsLine' | 'deductiblePercent' | 'deductibleEmpty'
export const COVERAGE_RULE_PROBLEMS: readonly CoverageRuleProblem[] = ['noEffect', 'mixedEffects', 'invoiceReadsLine', 'deductiblePercent', 'deductibleEmpty']

/**
 * What the editor refuses in words on a coverage rule (3146): it sets at least one effect and ONE effect KIND (two
 * effects of one kind are not refused here), a rule setting an invoice value (segment, exception prescriptions) reads
 * no line block, and a deductible states a `percent` in 0–100 and/or a `max`. HQ's Validate refuses them again.
 */
export function coverageRuleProblems(rule: Pick<CoverageRule, 'when' | 'then'>): CoverageRuleProblem[] {
  if (rule.then.length === 0) return ['noEffect']
  if (new Set(rule.then.map((e) => e.effect)).size > 1) return ['mixedEffects']
  const out: CoverageRuleProblem[] = []
  if (effectLevel(rule.then[0].effect) === 'invoice' && readsLine(rule.when)) out.push('invoiceReadsLine')
  for (const e of rule.then) {
    if (e.effect !== 'deductible') continue
    if (e.percent !== undefined && !(e.percent >= 0 && e.percent <= 100)) out.push('deductiblePercent')
    else if (e.percent === undefined && e.max === undefined) out.push('deductibleEmpty')
  }
  return [...new Set(out)]
}
