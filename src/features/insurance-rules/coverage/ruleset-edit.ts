import type {
  CategoryRule,
  CoverageEffect,
  CoverageEffectKind,
  CoverageRule,
  InsuranceRule,
  InsuranceRuleKind,
  InsuranceRuleset,
} from '@/core/insurance-rules/coverage-model'

// The category and coverage editors' pure edits (oms 617). A ruleset's ORDER is part of its meaning: a category
// is set by the first rule that matches, and a coverage rule sees what the rules before it changed — so moving a
// rule is an edit like any other, saved with the whole draft. Every edit gives back the SAME document when
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
 * ⚠️ PROVISIONAL (617, as 608's guard ids): the brief has no door that mints one.
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

/** A blank draft rule: no condition (it would match every line); a category rule sets Brand (G2), the commonest case. */
export function newRule(id: string, kind: 'category'): CategoryRule
export function newRule(id: string, kind: 'coverage'): CoverageRule
export function newRule(id: string, kind: InsuranceRuleKind): InsuranceRule
export function newRule(id: string, kind: InsuranceRuleKind): InsuranceRule {
  const base = { id, name: { en: '', ar: '' }, folder: '', state: 'draft' as const, when: [] }
  return kind === 'category' ? { ...base, then: [{ effect: 'setCategory', group: 'G2' }] } : { ...base, then: [] }
}

/** A coverage effect as the author adds it: it FILLS what the payer left out until marked to override the payer. */
export function newCoverageEffect(kind: CoverageEffectKind): CoverageEffect {
  const o = { overridesPayer: false }
  switch (kind) {
    case 'covered':
      return { effect: kind, covered: false, ...o }
    case 'priorApproval':
      return { effect: kind, required: true, ...o }
    case 'deductible':
      return { effect: kind, pct: 0, max: null, ...o }
    case 'priceCap':
      return { effect: kind, max: 0, ...o }
    case 'qtyCap':
      return { effect: kind, maxQuantity: null, maxDaysSupply: null, ...o }
    case 'segment':
      return { effect: kind, segment: 'Elite', ...o }
  }
}

/** Whether a coverage value only fills the payer's gap, or replaces what the payer sent. */
export const payerMark = (e: Pick<CoverageEffect, 'overridesPayer'>): 'fills' | 'overrides' => (e.overridesPayer ? 'overrides' : 'fills')
