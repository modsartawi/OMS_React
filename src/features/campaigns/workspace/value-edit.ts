import type { CampaignRule, RuleBlockCatalogue, RuleCondition, RuleEffect, RuleExpr, RuleNamedValue } from '@/core/models/rule-campaign'
import { blockType, catalogueBlock, leafConditions } from '@/core/rules/sentence'
import { keyOf } from './block-keys'

// A rule's named values (ticket 507, schema 1 in 522). Pure, like `./rule-edit`: an edit copies
// what it touches and one that changes nothing answers the SAME rules, which the builder's history
// takes as "no step".
//
// Schema 1 reads a value BY NAME: a points or discount field holds `"$name"`, and an expression
// holds `"$name"` wherever it reads it. A rename therefore rewrites every `"$old"` of the rule —
// fields, the formulas of the values below and the formula conditions — so nothing is left pointing
// at the old name. Values carry no id: the builder finds one by its key (`./block-keys`).

type Rules = CampaignRule[]

function mapRule(rules: Rules, ruleId: string, fn: (r: CampaignRule) => CampaignRule): Rules {
  let changed = false
  const next = rules.map((r) => {
    if (r.id !== ruleId) return r
    const n = fn(r)
    if (n !== r) changed = true
    return n
  })
  return changed ? next : rules
}

/** A new named value, its expression still to be written. */
export const newValue = (name: string): RuleNamedValue => ({ name, expr: null })

/** How a field or an expression reads a named value. */
export const valueRef = (name: string): string => `$${name}`

const taken = (rule: Pick<CampaignRule, 'filters' | 'values'>, name: string, selfKey?: string) => {
  const n = name.trim().toLowerCase()
  return rule.values.some((v) => keyOf(v) !== selfKey && v.name.trim().toLowerCase() === n) || rule.filters.some((f) => f.name.trim().toLowerCase() === n)
}

/** The first of `<base>1`, `<base>2`, … no value or filter of the rule is called. */
export function nextValueName(rule: Pick<CampaignRule, 'filters' | 'values'>, base: string): string {
  let k = 1
  while (taken(rule, `${base}${k}`)) k++
  return `${base}${k}`
}

/** The checker's rule for a value's name: a small letter, then letters and digits only. */
const NAME = /^[a-z][A-Za-z0-9]*$/

/**
 * Why a value cannot have `name`: empty, not the checker's shape (`pattern`), or another value's or
 * a filter's name in the rule (ignoring case).
 */
export type ValueNameProblem = 'empty' | 'pattern' | 'taken' | null

export function valueNameProblem(rule: Pick<CampaignRule, 'filters' | 'values'>, name: string, selfKey?: string): ValueNameProblem {
  if (!name.trim()) return 'empty'
  if (!NAME.test(name.trim())) return 'pattern'
  return taken(rule, name, selfKey) ? 'taken' : null
}

export const addValue = (rules: Rules, ruleId: string, value: RuleNamedValue): Rules => mapRule(rules, ruleId, (r) => ({ ...r, values: [...r.values, value] }))

/** `x` with every `"$from"` replaced by `"$to"`, the same object when there was none. */
function renamed<T>(x: T, from: string, to: string): T {
  if (x === from) return to as T
  if (Array.isArray(x)) {
    let changed = false
    const next = x.map((v) => {
      const n = renamed(v, from, to)
      if (n !== v) changed = true
      return n
    })
    return (changed ? next : x) as T
  }
  if (x && typeof x === 'object') {
    let changed = false
    const next: Record<string | symbol, unknown> = { ...(x as object) }
    for (const k of Object.keys(x as object)) {
      const v = (x as Record<string, unknown>)[k]
      const n = renamed(v, from, to)
      if (n !== v) {
        changed = true
        next[k] = n
      }
    }
    return (changed ? next : x) as T
  }
  return x
}

/** Changes a value's expression. */
export function setValueExpr(rules: Rules, ruleId: string, key: string, expr: RuleExpr): Rules {
  return mapRule(rules, ruleId, (r) => {
    let changed = false
    const values = r.values.map((v) => {
      if (keyOf(v) !== key || JSON.stringify(v.expr) === JSON.stringify(expr)) return v
      changed = true
      return { ...v, expr }
    })
    return changed ? { ...r, values } : r
  })
}

/** Renames a value, and every `"$old"` of the rule with it. */
export function renameValue(rules: Rules, ruleId: string, key: string, name: string): Rules {
  return mapRule(rules, ruleId, (r) => {
    const v = r.values.find((x) => keyOf(x) === key)
    if (!v || v.name === name) return r
    const from = valueRef(v.name)
    const to = valueRef(name)
    // An empty old name reads nothing yet, and a name another value also has (or is about to have)
    // is that value's too: following it would take its readers along. Only a name of its own moves.
    const shared = (n: string) => r.values.some((x) => x !== v && x.name === n)
    if (!v.name.trim() || shared(v.name) || shared(name)) return { ...r, values: r.values.map((x) => (x === v ? { ...x, name } : x)) }
    const values = r.values.map((x) => (x === v ? { ...x, name } : { ...x, expr: renamed(x.expr, from, to) }))
    return { ...r, values, when: renamed(r.when, from, to), then: renamed(r.then, from, to) }
  })
}

/** Whether a field value reads the value (`"$name"`), or an expression reads it anywhere. */
function reads(x: unknown, ref: string): boolean {
  if (x === ref) return true
  if (Array.isArray(x)) return x.some((v) => reads(v, ref))
  return false
}

/** The fields of a block that read `value`: a points / discount field, or a formula. */
function fieldsReading(kind: 'condition' | 'effect', block: RuleCondition | RuleEffect, value: RuleNamedValue, catalogue: RuleBlockCatalogue): string[] {
  const entry = catalogueBlock(catalogue, kind, blockType(block))
  const raw = block as Record<string, unknown>
  const ref = valueRef(value.name)
  return (entry?.fields ?? []).filter((f) => (f.kind === 'points' || f.kind === 'discount' || f.kind === 'formula') && reads(raw[f.key], ref)).map((f) => f.key)
}

/** Every condition, effect and later value of the rule that reads the value. */
export function valueUses(rule: CampaignRule, key: string, catalogue: RuleBlockCatalogue): number {
  const value = rule.values.find((v) => keyOf(v) === key)
  if (!value || !value.name.trim()) return 0
  const ref = valueRef(value.name)
  const blocks =
    leafConditions(rule.when).filter((c) => fieldsReading('condition', c, value, catalogue).length > 0).length +
    rule.then.filter((e) => fieldsReading('effect', e, value, catalogue).length > 0).length
  return blocks + rule.values.filter((v) => v !== value && reads(v.expr, ref)).length
}

/** Deletes a value — only one nothing reads; a value in use answers the same rules. */
export const deleteValue = (rules: Rules, ruleId: string, key: string, catalogue: RuleBlockCatalogue): Rules =>
  mapRule(rules, ruleId, (r) => (valueUses(r, key, catalogue) > 0 || !r.values.some((v) => keyOf(v) === key) ? r : { ...r, values: r.values.filter((v) => keyOf(v) !== key) }))

/** Moves a value up or down — a value reads only the values above it. */
export function moveValue(rules: Rules, ruleId: string, key: string, delta: number): Rules {
  return mapRule(rules, ruleId, (r) => {
    const i = r.values.findIndex((v) => keyOf(v) === key)
    const j = i + delta
    if (i < 0 || j < 0 || j >= r.values.length) return r
    const values = [...r.values]
    ;[values[i], values[j]] = [values[j], values[i]]
    return { ...r, values }
  })
}
