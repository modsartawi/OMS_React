import { type CategoryRule, type CoverageRule, type InsuranceRule, type InsuranceRuleKind, type InsuranceRuleset } from '@/core/insurance-rules/coverage-model'

// The category and coverage editors' pure edits (oms 617). A ruleset's ORDER is part of its meaning: a category
// is set by the first rule that matches, and a coverage value by the first holding rule that may set it — so moving
// a rule is an edit like any other, saved with the whole draft. Every edit gives back the SAME document when
// nothing changed, so the history (`@/core/insurance-rules/editor-history`) pushes no step. The coverage effect's
// own edits and refusals are the editors' (`@/core/insurance-rules/editors/coverage-edit`, oms 676).

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
