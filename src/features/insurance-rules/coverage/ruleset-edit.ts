import { type InsuranceRule, type InsuranceRuleset } from '@/core/insurance-rules/coverage-model'

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

// oms 680: the new-rule id and blank rule live in core (`@/core/insurance-rules/coverage-model`), so the rule
// playground mints the same ones; re-exported here so this page's callers are unchanged.
export { newRule, nextRuleId } from '@/core/insurance-rules/coverage-model'
