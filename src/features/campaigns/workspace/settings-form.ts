import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleCampaign,
  RuleCondition,
  RuleDraft,
  RuleDraftSave,
  RuleFeature,
  Says,
} from '@/core/models/rule-campaign'
import type { CampaignStateInput } from '@/core/rules/campaign-state'
import { blockType } from '@/core/rules/sentence'

// The Settings pages' pure parts (tickets 509, 522): the whole-draft save, the Details form and
// the feature-off guard.

/**
 * What a Settings page sends (ticket 522): the loaded draft with the page's part put into its
 * campaign, saved WHOLE at the revision it was loaded at (`Rules/Authoring/Drafts/Save`). The
 * Features page sends its own list; every other page the draft's. No `tree`: the live order stays.
 */
export function draftSave(draft: Pick<RuleDraft, 'campaign' | 'features' | 'revision'>, part: Partial<RuleCampaign>, features?: RuleFeature[]): RuleDraftSave {
  return { campaign: { ...draft.campaign, ...part }, features: features ?? draft.features, revision: draft.revision }
}

/** What a loaded draft's state is read from: a draft's state only when there IS a draft (Load
 *  answers the newest version, `source: published`, when there is none). */
export function draftStateInput(d: Pick<RuleDraft, 'source' | 'state' | 'campaignStatus' | 'campaign'>): CampaignStateInput {
  return { state: d.source === 'draft' ? d.state : null, campaignStatus: d.campaignStatus, window: d.campaign.window }
}

/** Settings ▸ Details' fields: the name in both languages — both required. */
export interface DetailsForm {
  nameEn: string
  nameAr: string
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

/** The campaign's name the Details page saves — trimmed. */
export function toDetailsName(form: DetailsForm): Says {
  return { en: form.nameEn.trim(), ar: form.nameAr.trim() }
}

/** A feature being switched off while rules still use it, and those rules, in rule order. */
export interface FeatureInUse {
  feature: RuleFeature
  rules: { id: string; name: string }[]
}

/** Every condition of a When, a group's own included (groups nest through `conditions`). */
function conditionsOf(items: readonly RuleCondition[]): RuleCondition[] {
  return items.flatMap((c) => [c, ...(Array.isArray(c.conditions) ? conditionsOf(c.conditions as RuleCondition[]) : [])])
}

/**
 * The features `next` switches off that a block of the saved `rules` still needs (the catalogue
 * says which feature a block type needs — the palette's own gate, 505), with the rules that use it.
 * Empty = the change can be saved. Switching a feature on is never refused. HQ's validation warns
 * at a block of a feature the draft has not switched on, whatever the page draws.
 */
export function featuresInUse(
  current: readonly RuleFeature[],
  next: readonly RuleFeature[],
  rules: readonly CampaignRule[],
  catalogue: RuleBlockCatalogue,
): FeatureInUse[] {
  const needs = new Map(catalogue.blocks.map((b) => [`${b.kind}:${b.type}`, b.feature]))
  const off = current.filter((f) => !next.includes(f))
  return off.flatMap((feature) => {
    const using = rules.filter(
      (r) =>
        conditionsOf(r.when).some((c) => needs.get(`condition:${blockType(c)}`) === feature) ||
        r.then.some((e) => needs.get(`effect:${blockType(e)}`) === feature),
    )
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
