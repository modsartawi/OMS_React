import type { RuleFromTemplateBody, RuleLookupKind, RuleTemplate, RuleTemplatePlaceholder } from '@/core/models/rule-campaign'
import { campaignIdProblem, suggestCampaignId, type CampaignIdProblem } from '@/core/rules/campaign-id'

/**
 * "From a template" (tickets 503, 524; BackOffice 2759's `Templates/List` + `Drafts/FromTemplate`):
 * the values a template's placeholders ask for, as the dialog holds them, and the body that makes
 * the draft. A placeholder names a field inside the template's campaign (`path`, e.g.
 * `rules[0].then[0].value`) and HQ puts the sent JSON there — the client never fills the campaign
 * itself, and an unsent value keeps the template's default. How a value is asked for follows its
 * default's JSON: a number, a text, yes / no, a list of codes, or anything else as JSON.
 */

/** How the dialog asks for a placeholder's value. */
export type PlaceholderKind = 'number' | 'text' | 'bool' | 'codes' | 'json'

/** The kind a placeholder's default says. */
export function placeholderKind(p: Pick<RuleTemplatePlaceholder, 'default'>): PlaceholderKind {
  const d = p.default
  if (typeof d === 'number') return 'number'
  if (typeof d === 'string') return 'text'
  if (typeof d === 'boolean') return 'bool'
  if (Array.isArray(d) && d.every((x) => typeof x === 'string')) return 'codes'
  return 'json'
}

/** The lookup a list of codes is picked through, by the field its path ends in: the builder's item
 *  picker for categories, articles and stores; null for any other list (typed, comma-separated). */
export function placeholderLookup(p: Pick<RuleTemplatePlaceholder, 'path'>): RuleLookupKind | null {
  const field = /([A-Za-z]+)(?:\[\d+\])?$/.exec(p.path)?.[1] ?? ''
  if (field === 'categories') return 'categories'
  if (field === 'articles') return 'materials'
  if (field === 'stores') return 'stores'
  return null
}

/** The dialog's form: each placeholder's value as typed (a list of codes as its codes), the new
 *  draft's id — suggested from the English name until the author edits it — and its names. */
export interface TemplateForm {
  values: Record<string, string | string[]>
  nameEn: string
  nameAr: string
  /** The id as typed; `''` while it still follows the suggestion. */
  id: string
  idEdited: boolean
}

/** What the dialog starts with: each placeholder's default, and the template campaign's names. */
export function templateFormFor(template: RuleTemplate): TemplateForm {
  const values: TemplateForm['values'] = {}
  for (const p of template.placeholders) {
    const kind = placeholderKind(p)
    const d = p.default
    values[p.name] =
      kind === 'codes' ? [...(d as string[])] : kind === 'json' ? (d === undefined ? '' : JSON.stringify(d)) : String(d)
  }
  return { values, nameEn: template.campaign?.name?.en ?? '', nameAr: template.campaign?.name?.ar ?? '', id: '', idEdited: false }
}

/** The id the form sends: the typed one, or the suggestion while the author has not edited it. */
export const templateFormId = (form: TemplateForm): string => (form.idEdited ? form.id.trim() : suggestCampaignId(form.nameEn))

export type TemplateProblemCode = 'required' | 'notNumber' | 'notJson'

/** A placeholder the form refuses, keyed to its locale message. */
export interface TemplateProblem {
  name: string
  problem: TemplateProblemCode
}

/** Every reason the form cannot be sent yet. */
export interface TemplateFormProblems {
  values: TemplateProblem[]
  id: CampaignIdProblem | null
  nameEnRequired: boolean
  nameArRequired: boolean
}

const DECIMAL = /^-?\d+(\.\d+)?$/
const text = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '')
const codes = (v: string | string[] | undefined) => (Array.isArray(v) ? v : text(v).split(',').map((x) => x.trim()).filter(Boolean))

/** The JSON a typed text holds, or `undefined` when it holds none. */
function parseJson(typed: string): unknown {
  try {
    return JSON.parse(typed)
  } catch {
    return undefined
  }
}

/** Every reason the form cannot be sent yet. `taken`: the ids of the campaigns listed. */
export function templateProblems(template: RuleTemplate, form: TemplateForm, taken: readonly string[] = []): TemplateFormProblems {
  const values: TemplateProblem[] = []
  for (const p of template.placeholders) {
    const v = form.values[p.name]
    const kind = placeholderKind(p)
    if (kind === 'bool') continue
    if (kind === 'codes') {
      if (codes(v).length === 0) values.push({ name: p.name, problem: 'required' })
      continue
    }
    const typed = text(v)
    if (typed === '') values.push({ name: p.name, problem: 'required' })
    // A plain decimal only: Number() would also take `0x1E` or `1e2`, a value the marketer never typed.
    else if (kind === 'number' && !DECIMAL.test(typed)) values.push({ name: p.name, problem: 'notNumber' })
    else if (kind === 'json' && parseJson(typed) === undefined) values.push({ name: p.name, problem: 'notJson' })
  }
  return {
    values,
    id: campaignIdProblem(templateFormId(form), taken),
    nameEnRequired: !form.nameEn.trim(),
    nameArRequired: !form.nameAr.trim(),
  }
}

/** Whether the form can be sent. */
export const templateReady = (p: TemplateFormProblems): boolean => p.values.length === 0 && !p.id && !p.nameEnRequired && !p.nameArRequired

/** `Drafts/FromTemplate`'s body: every placeholder's value as JSON, the picked id and both names.
 *  Read only once `templateReady` holds. */
export function templateBody(template: RuleTemplate, form: TemplateForm): RuleFromTemplateBody {
  const values: Record<string, unknown> = {}
  for (const p of template.placeholders) {
    const v = form.values[p.name]
    const kind = placeholderKind(p)
    values[p.name] =
      kind === 'number' ? Number(text(v)) : kind === 'bool' ? text(v) === 'true' : kind === 'codes' ? [...codes(v)] : kind === 'json' ? parseJson(text(v)) : text(v)
  }
  return { template: template.code, campaign: templateFormId(form), name: { en: form.nameEn.trim(), ar: form.nameAr.trim() }, values }
}
