import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleBlockKind,
  RuleCatalogueBlock,
  RuleCatalogueGroup,
  RuleCondition,
  RuleEffect,
  RuleFeature,
} from '@/core/models/rule-campaign'
import { RULE_GROUP_CHECK } from '@/core/models/rule-campaign'

// The builder's palette (ticket 505; schema 1 in 522; HQ's catalogue in 523): which blocks
// "+ Condition" / "+ Effect" offers, grouped by the catalogue's palette groups, and the new block a
// pick adds. Pure.
//
// The palette reads the catalogue HQ answers for the campaign's features (`Rules/Authoring/
// Catalogue { features }`), which does not list a block of a feature the campaign lacks — so the
// palette leaves those out, as 505 ruled. It also leaves out a block HQ marks `open` (what the spec
// has not decided yet): left out, not greyed.

export interface PaletteGroup {
  group: RuleCatalogueGroup
  blocks: RuleCatalogueBlock[]
}

export interface Palette {
  groups: PaletteGroup[]
  /** Features that are off and would add blocks here — so the palette can say where they are. */
  hiddenFeatures: RuleFeature[]
}

const blocksOf = (catalogue: RuleBlockCatalogue, kind: RuleBlockKind) => (kind === 'condition' ? catalogue.conditions : catalogue.effects)

/**
 * The palette of `catalogue` (the campaign's features'). `everything` — the catalogue with every
 * feature on, when it is known — says which features that are off would add blocks of this kind.
 */
export function paletteFor(catalogue: RuleBlockCatalogue, kind: RuleBlockKind, everything?: RuleBlockCatalogue): Palette {
  const offered = blocksOf(catalogue, kind).filter((b) => b.open == null)
  const groups = catalogue.groups
    .filter((g) => g.kind === kind)
    .map((group) => ({ group, blocks: offered.filter((b) => b.group === group.id) }))
    .filter((g) => g.blocks.length > 0)
  const on = new Set(catalogue.features)
  const hiddenFeatures = everything
    ? [...new Set(blocksOf(everything, kind).flatMap((b) => (b.open == null && b.feature !== null && !on.has(b.feature) ? [b.feature] : [])))]
    : []
  return { groups, hiddenFeatures }
}

/** A new rule: no name yet, no filter, no condition (it reads "always") and no effect. */
export const newRule = (id: string): CampaignRule => ({ id, name: '', filters: [], values: [], when: [], then: [] })

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * The block a palette pick adds: HQ's `example` for it (a block the checker accepts as written)
 * — its figures, choices, yes / no and texts are the block's defaults (504/505's open question) —
 * with HQ's SAMPLE identifiers left out, since they name nothing of this campaign: a `code` or
 * `codes` (a sample store, channel, tier, coupon pattern, activity, template, flag) is left for the
 * marketer to pick ("not picked yet"), and so is a `budget`; a field of type `filter` points at the
 * rule's first filter on an effect (an effect usually works on the rule's own filter) and is left out
 * on a condition (all merchandise); a group starts empty. Schema 1 gives a block no id.
 */
export function newBlock(block: RuleCatalogueBlock, rule: Pick<CampaignRule, 'filters'>): RuleCondition | RuleEffect {
  const example = isObject(block.example) ? structuredClone(block.example) : {}
  for (const f of block.fields) {
    if (f.type === 'filter') {
      const first = block.kind === 'effect' ? rule.filters[0]?.id : undefined
      if (first) example[f.name] = first
      else delete example[f.name]
    }
    if (f.type === 'budget' || f.type === 'code') delete example[f.name]
    if (f.type === 'codes') example[f.name] = []
  }
  if (block.kind === 'condition') {
    const { check: _check, ...fields } = example
    if (block.type === RULE_GROUP_CHECK) return { check: block.type, ...fields, conditions: [] }
    return { check: block.type, ...fields }
  }
  const { effect: _effect, ...fields } = example
  return { effect: block.type, ...fields }
}

/** The effects a rule's `bundle` prices; picking one on a rule with no bundle gives it one. */
export const BUNDLE_EFFECTS: readonly string[] = ['bundlePrice', 'bundleDiscount', 'discountCheapestInBundle']

/** A new bundle list: one unit of the rule's first filter. */
export const newBundleList = (rule: Pick<CampaignRule, 'filters'>) => ({ filter: rule.filters[0]?.id ?? '', count: 1 })
