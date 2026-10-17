import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleBlockKind,
  RuleCatalogueBlock,
  RuleCatalogueField,
  RuleCondition,
  RuleEffect,
  RuleFeature,
} from '@/core/models/rule-campaign'
import { RULE_GROUP_CHECK } from '@/core/models/rule-campaign'

// The builder's palette (ticket 505, schema 1 in 522): which blocks "+ Condition" / "+ Effect"
// offers, grouped by the catalogue's palette groups, and the new block a pick adds. Pure.
//
// A block is offered only when
//   - the catalogue says it is decided (a block the map has not decided is left out, not greyed);
//   - the campaign's features switch it on (points blocks with points, coupon blocks with coupons).
// Every field kind has its control in the panel; a formula is written with the guided ƒx helper (507).

export interface PaletteGroup {
  key: string
  blocks: RuleCatalogueBlock[]
}

export interface Palette {
  groups: PaletteGroup[]
  /** Features that are off and would add blocks here — so the palette can say where they are. */
  hiddenFeatures: RuleFeature[]
}

export function paletteFor(catalogue: RuleBlockCatalogue, kind: RuleBlockKind, features: readonly RuleFeature[]): Palette {
  const candidates = catalogue.blocks.filter((b) => b.kind === kind && b.decided)
  const offered = candidates.filter((b) => b.feature === null || features.includes(b.feature))
  const groups = catalogue.groups
    .filter((g) => g.kind === kind)
    .map((g) => ({ key: g.key, blocks: offered.filter((b) => b.group === g.key) }))
    .filter((g) => g.blocks.length > 0)
  const hiddenFeatures = [...new Set(candidates.flatMap((b) => (b.feature !== null && !features.includes(b.feature) ? [b.feature] : [])))]
  return { groups, hiddenFeatures }
}

/** A new, empty value for a field, by its kind; `undefined` leaves the field out (a number is left
 *  unset, so the sentence says "not picked yet"; a clause stays off). */
function emptyValue(field: RuleCatalogueField, rule: Pick<CampaignRule, 'filters'>, kind: RuleBlockKind): unknown {
  if (field.default !== undefined) return field.default
  switch (field.kind) {
    case 'items':
      // An effect usually works on the rule's own filter; a condition starts on all merchandise.
      return kind === 'effect' ? rule.filters[0]?.id : undefined
    case 'choice':
      return field.options?.[0]
    case 'choices':
    case 'codes':
      return []
    case 'says':
      return { en: '', ar: '' }
    default:
      return undefined
  }
}

/** A new rule: no name yet, no filter, no condition (it reads "always") and no effect. */
export const newRule = (id: string): CampaignRule => ({ id, name: '', filters: [], values: [], when: [], then: [] })

/** The block a palette pick adds: `{ check | effect: type, ...defaults }` (schema 1 gives a block no id). */
export function newBlock(block: RuleCatalogueBlock, rule: Pick<CampaignRule, 'filters'>): RuleCondition | RuleEffect {
  const fields: Record<string, unknown> = {}
  for (const f of block.fields) {
    const v = emptyValue(f, rule, block.kind)
    if (v !== undefined) fields[f.key] = v
  }
  if (block.kind === 'condition') {
    if (block.type === RULE_GROUP_CHECK) return { check: block.type, ...fields, conditions: [] }
    return { check: block.type, ...fields, says: { en: '', ar: '' } }
  }
  return { effect: block.type, ...fields }
}

/** The effects a rule's `bundle` prices; picking one on a rule with no bundle gives it one. */
export const BUNDLE_EFFECTS: readonly string[] = ['bundlePrice', 'bundleDiscount', 'discountCheapestInBundle']

/** A new bundle list: one unit of the rule's first filter. */
export const newBundleList = (rule: Pick<CampaignRule, 'filters'>) => ({ filter: rule.filters[0]?.id ?? '', count: 1 })
