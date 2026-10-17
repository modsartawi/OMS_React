import type { CampaignRule, RuleBlockCatalogue, RuleCatalogueBlock, RuleCondition, RuleEffect, RuleItemFilter } from '@/core/models/rule-campaign'
import { catalogueBlock, leafConditions, RX_CATEGORY } from './sentence'

// A rule's named cart-item filters (ticket 506). Pure. Conditions and effects reference a filter BY
// ID (`of`, `on`, a bundle part's `of`), so renaming one is a change to the filter alone and every
// block that uses it reads the new name through its id (2734 point 3). Nothing is changed in
// place: an edit copies what it touches, and one that changes nothing answers the SAME rules, which
// the builder's history takes as "no step".
//
// Prescription (A006) is kept out of a new filter by default; a filter — or a discount on a filter,
// or on all merchandise — that can reach a Prescription line is flagged.

type Rules = CampaignRule[]

/** The never-discount categories a new filter starts with. */
export const DEFAULT_EXCLUDED_CATEGORIES: readonly string[] = [RX_CATEGORY]

/** A new filter: every item, Prescription kept out. */
export const newFilter = (id: string, name: string): RuleItemFilter => ({
  id,
  name,
  cats: [],
  colls: [],
  skus: [],
  exclCats: [...DEFAULT_EXCLUDED_CATEGORIES],
  scope: 'items',
})

const taken = (filters: readonly RuleItemFilter[], name: string, selfId?: string) =>
  filters.some((f) => f.id !== selfId && f.name.trim().toLowerCase() === name.trim().toLowerCase())

/** The first of `<base>1`, `<base>2`, … this rule has no filter called. */
export function nextFilterName(filters: readonly RuleItemFilter[], base: string): string {
  let k = 1
  while (taken(filters, `${base}${k}`)) k++
  return `${base}${k}`
}

/**
 * Why a filter cannot have `name` in this rule: empty, or another filter's or a named value's
 * (ignoring case) — a formula reads both by name (ticket 507), so they never share one.
 */
export type FilterNameProblem = 'empty' | 'taken' | null

export function filterNameProblem(
  filters: readonly RuleItemFilter[],
  name: string,
  selfId?: string,
  values: readonly { name: string }[] = [],
): FilterNameProblem {
  if (!name.trim()) return 'empty'
  const n = name.trim().toLowerCase()
  return taken(filters, name, selfId) || values.some((v) => v.name.trim().toLowerCase() === n) ? 'taken' : null
}

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

export const addFilter = (rules: Rules, ruleId: string, filter: RuleItemFilter): Rules =>
  mapRule(rules, ruleId, (r) => ({ ...r, filters: [...r.filters, filter] }))

/** Changes a filter's own fields; the blocks that use it are not touched. */
export function updateFilter(rules: Rules, ruleId: string, filterId: string, patch: Partial<Omit<RuleItemFilter, 'id'>>): Rules {
  return mapRule(rules, ruleId, (r) => {
    let changed = false
    const filters = r.filters.map((f) => {
      if (f.id !== filterId) return f
      const keys = Object.keys(patch) as (keyof typeof patch)[]
      if (keys.every((k) => JSON.stringify(f[k]) === JSON.stringify(patch[k]))) return f
      changed = true
      return { ...f, ...patch }
    })
    return changed ? { ...r, filters } : r
  })
}

/** A rename is the filter's own name and nothing else: every reference is its id. */
export const renameFilter = (rules: Rules, ruleId: string, filterId: string, name: string): Rules => updateFilter(rules, ruleId, filterId, { name })

/** Every filter id a block points at, through its catalogue fields of kind `items` and `itemParts`. */
export function blockFilterRefs(block: RuleCondition | RuleEffect, entry: RuleCatalogueBlock | undefined): string[] {
  if (!entry) return []
  const raw = block as Record<string, unknown>
  return entry.fields.flatMap((field) => {
    const v = raw[field.key]
    if (field.kind === 'items') return [typeof v === 'string' ? v : '']
    if (field.kind === 'itemParts') return (Array.isArray(v) ? (v as { of?: unknown }[]) : []).map((p) => (typeof p.of === 'string' ? p.of : ''))
    return []
  })
}

/** How many of the rule's references (conditions at any depth, effects, bundle parts) point at a filter. */
export function filterUses(
  rule: Pick<CampaignRule, 'when' | 'then'>,
  filterId: string,
  catalogue: RuleBlockCatalogue,
): number {
  const refs = [
    ...leafConditions(rule.when).flatMap((c) => blockFilterRefs(c, catalogueBlock(catalogue, 'condition', c.type))),
    ...rule.then.flatMap((e) => blockFilterRefs(e, catalogueBlock(catalogue, 'effect', e.type))),
  ]
  return refs.filter((id) => id === filterId).length
}

/**
 * Deletes a filter nothing in the rule uses. A filter in use stays: deleting it would leave its
 * blocks pointing at nothing, and a discount must never widen to all merchandise by accident.
 */
export function deleteFilter(rules: Rules, ruleId: string, filterId: string, catalogue: RuleBlockCatalogue): Rules {
  return mapRule(rules, ruleId, (r) =>
    !r.filters.some((f) => f.id === filterId) || filterUses(r, filterId, catalogue) > 0 ? r : { ...r, filters: r.filters.filter((f) => f.id !== filterId) },
  )
}

/**
 * "Copy filter from rule N": the source filter's picks under a new id in this rule, its name kept
 * unless this rule already has it (then `<name>2`, `<name>3`, …).
 */
export function copyFilterInto(rules: Rules, ruleId: string, source: RuleItemFilter, id: string): Rules {
  return mapRule(rules, ruleId, (r) => {
    let name = source.name
    for (let k = 2; taken(r.filters, name); k++) name = `${source.name}${k}`
    return { ...r, filters: [...r.filters, { ...structuredClone(source), id, name }] }
  })
}

/**
 * Whether a filter can reach a Prescription line: it does not keep A006 out, and it is not held to
 * fee lines or to other categories only (a filter's steps narrow each other, so `category A002`
 * alone cannot match an A006 line). A collection or a product is not known to be Rx-free here.
 */
export function filterLetsRxIn(f: RuleItemFilter): boolean {
  if (f.exclCats.includes(RX_CATEGORY)) return false
  if (f.scope === 'fees') return false
  if (f.cats.length > 0 && !f.cats.includes(RX_CATEGORY)) return false
  return true
}

/**
 * Whether an effect gives its discount to Prescription lines: one of its items fields is all
 * merchandise, or a filter that lets Rx in. A filter that is gone is a check of its own (508), not
 * an Rx flag; an effect with no items field (points, a message) never is one.
 */
export function effectLetsRxIn(effect: RuleEffect, entry: RuleCatalogueBlock | undefined, filters: readonly RuleItemFilter[]): boolean {
  return blockFilterRefs(effect, entry).some((id) => {
    if (id === '') return true
    const f = filters.find((x) => x.id === id)
    return f ? filterLetsRxIn(f) : false
  })
}
