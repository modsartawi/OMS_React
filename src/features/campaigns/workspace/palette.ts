import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleBlockKind,
  RuleCampaignFeatures,
  RuleCatalogueBlock,
  RuleCatalogueField,
  RuleCondition,
  RuleEffect,
} from '@/core/models/rule-campaign'

// The builder's palette (ticket 505): which blocks "+ Condition" / "+ Effect" offers, grouped by the
// catalogue's palette groups, and the new block a pick adds. Pure.
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
  hiddenFeatures: (keyof RuleCampaignFeatures)[]
}

export function paletteFor(catalogue: RuleBlockCatalogue, kind: RuleBlockKind, features: RuleCampaignFeatures): Palette {
  const candidates = catalogue.blocks.filter((b) => b.kind === kind && b.decided)
  const offered = candidates.filter((b) => b.feature === null || features[b.feature])
  const groups = catalogue.groups
    .filter((g) => g.kind === kind)
    .map((g) => ({ key: g.key, blocks: offered.filter((b) => b.group === g.key) }))
    .filter((g) => g.blocks.length > 0)
  const hiddenFeatures = [...new Set(candidates.flatMap((b) => (b.feature !== null && !features[b.feature] ? [b.feature] : [])))]
  return { groups, hiddenFeatures }
}

/** A new, empty value for a field, by its kind. A number is left unset: the sentence says "not picked yet". */
function emptyValue(field: RuleCatalogueField, rule: Pick<CampaignRule, 'filters'>, kind: RuleBlockKind): unknown {
  if (field.default !== undefined) return field.default
  switch (field.kind) {
    case 'items':
      // An effect usually works on the rule's own filter; a condition starts on all merchandise.
      return kind === 'effect' ? (rule.filters[0]?.id ?? '') : ''
    case 'itemParts':
      return [{ of: rule.filters[0]?.id ?? '', count: 1 }]
    case 'choice':
      return field.options?.[0] ?? ''
    case 'choices':
    case 'codes':
      return []
    case 'says':
      return { en: '', ar: '' }
    case 'timing':
      return { mode: 'none', value: null }
    case 'flag':
      return false
    case 'code':
    case 'text':
    case 'formula':
    case 'budget':
      return ''
    case 'money':
    case 'count':
    case 'days':
    case 'discount':
    case 'points':
      return null
  }
}

/** A new rule: no name yet, no filter, no condition (it reads "always") and no effect. */
export const newRule = (id: string): CampaignRule => ({
  id,
  name: '',
  filters: [],
  values: [],
  when: { mode: 'all', items: [] },
  then: [],
  partial: 'refuse',
})

/** The block a palette pick adds, every field present and empty; `id` is the browser's own. */
export function newBlock(block: RuleCatalogueBlock, rule: Pick<CampaignRule, 'filters'>, id: string): RuleCondition | RuleEffect {
  const fields: Record<string, unknown> = {}
  for (const f of block.fields) fields[f.key] = emptyValue(f, rule, block.kind)
  if (block.type === 'group') fields.items = []
  if (block.kind === 'condition') return { says: { en: '', ar: '' }, ...fields, id, type: block.type } as RuleCondition
  return { ...fields, id, type: block.type }
}
