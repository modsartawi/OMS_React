import type { RuleDraftSave, RuleFeature } from '@/core/models/rule-campaign'
import { campaignIdProblem, suggestCampaignId, type CampaignIdProblem } from '@/core/rules/campaign-id'

/**
 * The Create campaign dialog's form (tickets 502, 522): the name in English and in Arabic — BOTH
 * required, because every campaign name is read in both languages — the campaign's id, which the
 * author picks (suggested from the English name until they edit it), and the optional features.
 * Points starts on and Coupons off, as in the prototype's dialog.
 */
export interface CreateCampaignForm {
  nameEn: string
  nameAr: string
  /** The id as typed; `''` while it still follows the suggestion. */
  id: string
  /** True once the author typed in the id: the suggestion stops following the name. */
  idEdited: boolean
  coupons: boolean
  points: boolean
}

export const EMPTY_CREATE_FORM: CreateCampaignForm = { nameEn: '', nameAr: '', id: '', idEdited: false, coupons: false, points: true }

/** The id the form sends: the typed one, or the suggestion while the author has not edited it. */
export const formId = (form: CreateCampaignForm): string => (form.idEdited ? form.id.trim() : suggestCampaignId(form.nameEn))

/** A field the form refuses, keyed to its locale message. */
export type CreateFormProblem = 'nameEnRequired' | 'nameArRequired' | CampaignIdProblem

/** Every reason the form cannot be sent yet; empty = it can. A name of only spaces is no name.
 *  `taken`: the ids of the campaigns listed. */
export function createFormProblems(form: CreateCampaignForm, taken: readonly string[] = []): CreateFormProblem[] {
  const problems: CreateFormProblem[] = []
  if (!form.nameEn.trim()) problems.push('nameEnRequired')
  if (!form.nameAr.trim()) problems.push('nameArRequired')
  const idProblem = campaignIdProblem(formId(form), taken)
  if (idProblem) problems.push(idProblem)
  return problems
}

/**
 * The create is the campaign's first `Drafts/Save` (2758 has no create door): revision 0, the
 * picked id, both names trimmed, no rules yet, and the features as chosen.
 */
export function toCreateSave(form: CreateCampaignForm): RuleDraftSave {
  const features: RuleFeature[] = [...(form.coupons ? (['coupons'] as const) : []), ...(form.points ? (['points'] as const) : [])]
  return {
    campaign: { id: formId(form), name: { en: form.nameEn.trim(), ar: form.nameAr.trim() }, rules: [] },
    features,
    revision: 0,
  }
}
