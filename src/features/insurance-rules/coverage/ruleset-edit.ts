import {
  effectLevel,
  type CategoryRule,
  type CoverageEffect,
  type CoverageEffectKind,
  type CoverageRule,
  type InsuranceRule,
  type InsuranceRuleKind,
  type InsuranceRuleset,
} from '@/core/insurance-rules/coverage-model'
import type { GuardCondition } from '@/core/insurance-rules/model'

// The category and coverage editors' pure edits (oms 617). A ruleset's ORDER is part of its meaning: a category
// is set by the first rule that matches, and a coverage value by the first holding rule that may set it — so moving
// a rule is an edit like any other, saved with the whole draft. Every edit gives back the SAME document when
// nothing changed, so the history (`@/core/insurance-rules/editor-history`) pushes no step.

/** The rule moved `delta` places (negative = earlier); the same document past either end or for an unknown id. */
export function moveRule<D extends InsuranceRuleset>(doc: D, id: string, delta: number): D {
  const from = doc.rules.findIndex((r) => r.id === id)
  const to = from + delta
  if (from < 0 || delta === 0 || to < 0 || to >= doc.rules.length) return doc
  const rules = doc.rules.slice() as InsuranceRule[]
  const [rule] = rules.splice(from, 1)
  rules.splice(to, 0, rule)
  return { ...doc, rules } as D
}

/** The ruleset with one rule edited by `fn`; the same document if unchanged or unknown. */
export function editRuleIn<D extends InsuranceRuleset>(doc: D, id: string, fn: (r: D['rules'][number]) => D['rules'][number]): D {
  const i = doc.rules.findIndex((r) => r.id === id)
  if (i < 0) return doc
  const next = fn(doc.rules[i])
  if (next === doc.rules[i]) return doc
  const rules = doc.rules.slice() as InsuranceRule[]
  rules[i] = next
  return { ...doc, rules } as D
}

/** A new rule goes LAST: it matches only after every rule already there. Move it up to let it win. */
export const addRule = <D extends InsuranceRuleset>(doc: D, rule: D['rules'][number]): D => ({ ...doc, rules: [...doc.rules, rule] }) as D

const PREFIX: Record<InsuranceRuleKind, string> = { category: 'K', coverage: 'C' }

/**
 * The next free id: `K-` (category) or `C-` (coverage) and one past the highest, three digits.
 * ⚠️ Still a guess (617, as 608's guard ids): no door mints one; HQ's seeded coverage ids are words (C-ELITE),
 * which this skips.
 */
export function nextRuleId(rules: readonly { id: string }[], kind: InsuranceRuleKind): string {
  const re = new RegExp(`^${PREFIX[kind]}-(\\d+)$`)
  let high = 0
  for (const r of rules) {
    const m = re.exec(r.id)
    if (m) high = Math.max(high, Number(m[1]))
  }
  return `${PREFIX[kind]}-${String(high + 1).padStart(3, '0')}`
}

/** A blank draft rule: no condition (it would match every line), no folder; a category rule sets Brand (G2), the commonest case. */
export function newRule(id: string, kind: 'category'): CategoryRule
export function newRule(id: string, kind: 'coverage'): CoverageRule
export function newRule(id: string, kind: InsuranceRuleKind): InsuranceRule
export function newRule(id: string, kind: InsuranceRuleKind): InsuranceRule {
  const base = { id, name: { en: '', ar: '' }, state: 'draft' as const, when: [] }
  return kind === 'category' ? { ...base, then: [{ effect: 'setCategory', group: 'G2' }] } : { ...base, then: [] }
}

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
