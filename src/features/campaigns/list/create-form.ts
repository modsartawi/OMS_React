import type { RuleCampaignCreate } from '@/core/models/rule-campaign'

/**
 * The Create campaign dialog's form (ticket 502): the name in English and in Arabic — BOTH
 * required, because every campaign name is read in both languages — and the optional features.
 * Points starts on and Coupons off, as in the prototype's dialog.
 */
export interface CreateCampaignForm {
  nameEn: string
  nameAr: string
  coupons: boolean
  points: boolean
}

export const EMPTY_CREATE_FORM: CreateCampaignForm = { nameEn: '', nameAr: '', coupons: false, points: true }

/** A field the form refuses, keyed to its locale message. */
export type CreateFormProblem = 'nameEnRequired' | 'nameArRequired'

/** Every reason the form cannot be sent yet; empty = it can. A name of only spaces is no name. */
export function createFormProblems(form: CreateCampaignForm): CreateFormProblem[] {
  const problems: CreateFormProblem[] = []
  if (!form.nameEn.trim()) problems.push('nameEnRequired')
  if (!form.nameAr.trim()) problems.push('nameArRequired')
  return problems
}

/** The body the create door takes — both names trimmed. */
export function toCreateBody(form: CreateCampaignForm): RuleCampaignCreate {
  return {
    name: { en: form.nameEn.trim(), ar: form.nameAr.trim() },
    features: { coupons: form.coupons, points: form.points },
  }
}
