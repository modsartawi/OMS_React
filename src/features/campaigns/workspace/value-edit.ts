import type { CampaignRule, RuleBlockCatalogue, RuleCondition, RuleEffect, RuleNamedValue } from '@/core/models/rule-campaign'
import { catalogueBlock, leafConditions } from '@/core/rules/sentence'
import { setBlockField } from './rule-edit'

// A rule's named values (ticket 507). Pure, like `./rule-edit`: an edit copies what it touches and
// one that changes nothing answers the SAME rules, which the builder's history takes as "no step".
//
// A points or discount field reads a named value BY ID, so a rename touches the value alone and the
// effect reads the new name. (The samples' older reference by name still counts as a use, and a
// rename first pins it to the id — `pinValueRefs` — so it is not left pointing at the old name.) A
// formula reads a value by its name inside the expression, which only HQ parses: a rename that
// breaks a formula is HQ's check to report, on that formula's box.

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

/** A new named value, its formula still to be written. */
export const newValue = (id: string, name: string): RuleNamedValue => ({ id, name, formula: '' })

const taken = (rule: Pick<CampaignRule, 'filters' | 'values'>, name: string, selfId?: string) => {
  const n = name.trim().toLowerCase()
  return rule.values.some((v) => v.id !== selfId && v.name.trim().toLowerCase() === n) || rule.filters.some((f) => f.name.trim().toLowerCase() === n)
}

/** The first of `<base>1`, `<base>2`, … no value or filter of the rule is called. */
export function nextValueName(rule: Pick<CampaignRule, 'filters' | 'values'>, base: string): string {
  let k = 1
  while (taken(rule, `${base}${k}`)) k++
  return `${base}${k}`
}

/**
 * Why a value cannot have `name`: empty, or another value's or a filter's name in the rule
 * (ignoring case) — a formula reads both by name, so two of them must never share one.
 */
export type ValueNameProblem = 'empty' | 'taken' | null

export function valueNameProblem(rule: Pick<CampaignRule, 'filters' | 'values'>, name: string, selfId?: string): ValueNameProblem {
  if (!name.trim()) return 'empty'
  return taken(rule, name, selfId) ? 'taken' : null
}

export const addValue = (rules: Rules, ruleId: string, value: RuleNamedValue): Rules => mapRule(rules, ruleId, (r) => ({ ...r, values: [...r.values, value] }))

/** Changes a value's name or formula; the blocks that read it are not touched. */
export function updateValue(rules: Rules, ruleId: string, valueId: string, patch: Partial<Pick<RuleNamedValue, 'name' | 'formula'>>): Rules {
  return mapRule(rules, ruleId, (r) => {
    let changed = false
    const values = r.values.map((v) => {
      if (v.id !== valueId) return v
      if ((patch.name === undefined || patch.name === v.name) && (patch.formula === undefined || patch.formula === v.formula)) return v
      changed = true
      return { ...v, ...patch }
    })
    return changed ? { ...r, values } : r
  })
}

/** The points and discount fields of a block that read `value`, by id or by its name. */
function fieldsReading(kind: 'condition' | 'effect', block: RuleCondition | RuleEffect, value: RuleNamedValue, catalogue: RuleBlockCatalogue): string[] {
  const entry = catalogueBlock(catalogue, kind, block.type)
  const raw = block as Record<string, unknown>
  return (entry?.fields ?? []).filter((f) => (f.kind === 'points' || f.kind === 'discount') && (raw[f.key] === value.id || raw[f.key] === value.name)).map((f) => f.key)
}

/**
 * Every field that reads the value by its NAME (the samples' older wire) made to read it by id, so
 * a rename that follows keeps them. Answers the same rules when there is none.
 */
export function pinValueRefs(rules: Rules, ruleId: string, valueId: string, catalogue: RuleBlockCatalogue): Rules {
  const rule = rules.find((r) => r.id === ruleId)
  const value = rule?.values.find((v) => v.id === valueId)
  if (!rule || !value) return rules
  let next = rules
  const pin = (kind: 'condition' | 'effect', block: RuleCondition | RuleEffect) => {
    for (const key of fieldsReading(kind, block, value, catalogue)) if (block[key] === value.name) next = setBlockField(next, ruleId, block.id, key, value.id)
  }
  leafConditions(rule.when).forEach((c) => pin('condition', c))
  rule.then.forEach((e) => pin('effect', e))
  return next
}

/** Every condition and effect of the rule whose points or discount field reads the value. */
export function valueUses(rule: CampaignRule, valueId: string, catalogue: RuleBlockCatalogue): number {
  const value = rule.values.find((v) => v.id === valueId)
  if (!value) return 0
  const reads = (kind: 'condition' | 'effect', block: RuleCondition | RuleEffect) => fieldsReading(kind, block, value, catalogue).length > 0
  return leafConditions(rule.when).filter((c) => reads('condition', c)).length + rule.then.filter((e) => reads('effect', e)).length
}

/** Deletes a value — only one nothing reads; a value in use answers the same rules. */
export const deleteValue = (rules: Rules, ruleId: string, valueId: string, catalogue: RuleBlockCatalogue): Rules =>
  mapRule(rules, ruleId, (r) => (valueUses(r, valueId, catalogue) > 0 || !r.values.some((v) => v.id === valueId) ? r : { ...r, values: r.values.filter((v) => v.id !== valueId) }))

/** Moves a value up or down — a value reads only the values above it. */
export function moveValue(rules: Rules, ruleId: string, valueId: string, delta: number): Rules {
  return mapRule(rules, ruleId, (r) => {
    const i = r.values.findIndex((v) => v.id === valueId)
    const j = i + delta
    if (i < 0 || j < 0 || j >= r.values.length) return r
    const values = [...r.values]
    ;[values[i], values[j]] = [values[j], values[i]]
    return { ...r, values }
  })
}
