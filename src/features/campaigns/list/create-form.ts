import type { RuleDraftSave, RuleFeature } from '@/core/models/rule-campaign'

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

/** A campaign id (2758): at most 40 of `A-Z a-z 0-9 . _ -`. */
export const CAMPAIGN_ID_MAX = 40
const CAMPAIGN_ID = /^[A-Za-z0-9._-]+$/

/** The static leaves under `/campaigns/…`: a campaign with one of these ids would be shadowed. */
export const RESERVED_CAMPAIGN_IDS: readonly string[] = ['priority', 'simulator', 'sessions', 'coupon-finder', 'customers']

/** An id suggested from the English name: upper-case, every other character a dash, at most 40. */
export function suggestCampaignId(nameEn: string): string {
  return nameEn
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, CAMPAIGN_ID_MAX)
    .replace(/-+$/, '')
}

/** The id the form sends: the typed one, or the suggestion while the author has not edited it. */
export const formId = (form: CreateCampaignForm): string => (form.idEdited ? form.id.trim() : suggestCampaignId(form.nameEn))

export type CampaignIdProblem = 'idRequired' | 'idTooLong' | 'idCharacters' | 'idReserved' | 'idTaken'

/**
 * Why an id cannot be used, or null. A reserved leaf is refused in any case; so is the id of a
 * campaign the list holds (`taken`), in any case too: HQ takes a first save at revision 0 over a live
 * campaign with no draft as that campaign's new draft, so Create would quietly draft over it.
 */
export function campaignIdProblem(id: string, taken: readonly string[] = []): CampaignIdProblem | null {
  if (!id) return 'idRequired'
  if (id.length > CAMPAIGN_ID_MAX) return 'idTooLong'
  if (!CAMPAIGN_ID.test(id)) return 'idCharacters'
  if (RESERVED_CAMPAIGN_IDS.includes(id.toLowerCase())) return 'idReserved'
  if (taken.some((x) => x.toLowerCase() === id.toLowerCase())) return 'idTaken'
  return null
}

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
