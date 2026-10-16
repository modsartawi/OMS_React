import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleCampaignDetails,
  RuleCampaignFeatures,
  RuleCondition,
} from '@/core/models/rule-campaign'

// The Settings pages' pure parts (ticket 509): the Details form and the feature-off guard.

/** Settings ▸ Details' fields: the name in both languages — both required — and the description. */
export interface DetailsForm {
  nameEn: string
  nameAr: string
  description: string
}

/** A field the Details form refuses, keyed to its locale message. */
export type DetailsProblem = 'nameEnRequired' | 'nameArRequired'

/** Every reason Details cannot be saved yet; empty = it can. A name of only spaces is no name. */
export function detailsProblems(form: DetailsForm): DetailsProblem[] {
  const problems: DetailsProblem[] = []
  if (!form.nameEn.trim()) problems.push('nameEnRequired')
  if (!form.nameAr.trim()) problems.push('nameArRequired')
  return problems
}

/** The body the Details door takes — everything trimmed. */
export function toDetailsBody(form: DetailsForm): RuleCampaignDetails {
  return { name: { en: form.nameEn.trim(), ar: form.nameAr.trim() }, description: form.description.trim() }
}

/** A feature being switched off while rules still use it, and those rules, in rule order. */
export interface FeatureInUse {
  feature: keyof RuleCampaignFeatures
  rules: { id: string; name: string }[]
}

/** Every condition of a When, a group's own included (groups nest through `items`). */
function conditionsOf(items: readonly RuleCondition[]): RuleCondition[] {
  return items.flatMap((c) => [c, ...(Array.isArray(c.items) ? conditionsOf(c.items as RuleCondition[]) : [])])
}

/**
 * The features `next` switches off that a block of the saved `rules` still needs (the catalogue
 * says which feature a block type needs — the palette's own gate, 505), with the rules that use it.
 * Empty = the change can be saved. Switching a feature on is never refused. The page refuses the
 * save and names the rules; HQ refuses it too, whatever the page draws. Only blocks are read: a
 * named value's formula that reads points is HQ's to find (the client never parses a formula, ADR
 * 0089), and its refusal is shown as it comes.
 */
export function featuresInUse(
  current: RuleCampaignFeatures,
  next: RuleCampaignFeatures,
  rules: readonly CampaignRule[],
  catalogue: RuleBlockCatalogue,
): FeatureInUse[] {
  const needs = new Map(catalogue.blocks.map((b) => [b.type, b.feature]))
  const off = (Object.keys(next) as (keyof RuleCampaignFeatures)[]).filter((f) => current[f] && !next[f])
  return off.flatMap((feature) => {
    const using = rules.filter((r) => [...conditionsOf(r.when.items), ...r.then].some((b) => needs.get(b.type) === feature))
    return using.length ? [{ feature, rules: using.map((r) => ({ id: r.id, name: r.name })) }] : []
  })
}

/**
 * What a page's draft becomes when HQ's saved value changes under it (`useSettingsDraft`): HQ's new
 * value when the draft had no unsaved change (it equalled `was`, the value it started from) or when
 * the change is the answer to the page's own Save (`adopt`); otherwise the marketer's draft, kept —
 * a re-read in the background never drops what they typed.
 */
export function draftAfterReread<T>(draft: T, was: string, saved: T, adopt: boolean): T {
  return adopt || JSON.stringify(draft) === was ? saved : draft
}
