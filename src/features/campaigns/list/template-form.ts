import type { RuleCampaignTemplate, RuleTemplateDraft, RuleTemplateValue } from '@/core/models/rule-campaign'

/**
 * "From a template" (ticket 503): the placeholders a template asks for, as the dialog holds them,
 * and the fill that turns the template's draft into the campaign it makes.
 *
 * A template's draft marks a value with `{ placeholder: key }` (replaced whole, by the typed
 * value) or with `{{key}}` inside a string (replaced by the value as text) — the provisional shape
 * of `@/core/models/rule-campaign`. The fill only swaps marks for values: it never reads a formula
 * (ADR 0089), a `{{key}}` in one is plain text to it.
 */

/** The dialog's form: a number or a choice as typed, a pick as its codes, by placeholder key. */
export type TemplateForm = Record<string, string | string[]>

/** What the dialog starts with: each placeholder's default, or empty. */
export function templateFormFor(template: RuleCampaignTemplate): TemplateForm {
  const form: TemplateForm = {}
  for (const p of template.placeholders) {
    const d = p.default
    if (p.kind === 'pick') form[p.key] = Array.isArray(d) ? [...d] : typeof d === 'string' && d ? [d] : []
    else form[p.key] = d == null || Array.isArray(d) ? '' : String(d)
  }
  return form
}

export type TemplateProblemCode = 'required' | 'notNumber' | 'belowMin' | 'aboveMax'

/** A placeholder the form refuses, keyed to its locale message. */
export interface TemplateProblem {
  key: string
  problem: TemplateProblemCode
}

const DECIMAL = /^-?\d+(\.\d+)?$/
const text = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '')
const codes = (v: string | string[] | undefined) => (Array.isArray(v) ? v : [])

/** Every reason the form cannot be sent yet, one per placeholder at most; empty = it can. */
export function templateProblems(template: RuleCampaignTemplate, form: TemplateForm): TemplateProblem[] {
  const problems: TemplateProblem[] = []
  for (const p of template.placeholders) {
    const v = form[p.key]
    if (p.kind === 'pick') {
      if (codes(v).length === 0) problems.push({ key: p.key, problem: 'required' })
      continue
    }
    const typed = text(v)
    if (p.kind === 'choice') {
      if (!(p.options ?? []).some((o) => o.code === typed)) problems.push({ key: p.key, problem: 'required' })
      continue
    }
    if (typed === '') {
      problems.push({ key: p.key, problem: 'required' })
      continue
    }
    // A plain decimal only: Number() would also take `0x1E` or `1e2`, and the name would then read a
    // value the marketer never typed.
    const n = DECIMAL.test(typed) ? Number(typed) : NaN
    if (!Number.isFinite(n)) problems.push({ key: p.key, problem: 'notNumber' })
    else if (p.min != null && n < p.min) problems.push({ key: p.key, problem: 'belowMin' })
    else if (p.max != null && n > p.max) problems.push({ key: p.key, problem: 'aboveMax' })
  }
  return problems
}

/** The form's values as the template takes them: a number as a number, a pick as its codes. Read
 *  only once `templateProblems` is empty. */
export function templateValues(template: RuleCampaignTemplate, form: TemplateForm): Record<string, RuleTemplateValue> {
  const values: Record<string, RuleTemplateValue> = {}
  for (const p of template.placeholders) {
    const v = form[p.key]
    values[p.key] = p.kind === 'pick' ? [...codes(v)] : p.kind === 'number' ? Number(text(v)) : text(v)
  }
  return values
}

export type FillResult = { ok: true; draft: RuleTemplateDraft } | { ok: false; unset: string[] }

const TOKEN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g

const isMark = (v: unknown): v is { placeholder: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 1 && typeof (v as { placeholder?: unknown }).placeholder === 'string'

const asText = (v: RuleTemplateValue) => (Array.isArray(v) ? v.join(', ') : String(v))

/**
 * The template's draft with every placeholder replaced by its value. A mark whose key has no value
 * is never left in: the fill refuses, naming each such key once, in the order it met them.
 */
export function fillTemplate(draft: RuleTemplateDraft, values: Record<string, RuleTemplateValue>): FillResult {
  const unset: string[] = []
  const has = (key: string) => Object.prototype.hasOwnProperty.call(values, key)
  const miss = (key: string) => {
    if (!unset.includes(key)) unset.push(key)
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string')
      return v.replace(TOKEN, (whole, key: string) => {
        if (has(key)) return asText(values[key])
        miss(key)
        return whole
      })
    if (Array.isArray(v)) return v.map(walk)
    if (isMark(v)) {
      if (has(v.placeholder)) {
        const value = values[v.placeholder]
        return Array.isArray(value) ? [...value] : value
      }
      miss(v.placeholder)
      return v
    }
    if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  const filled = walk(draft) as RuleTemplateDraft
  return unset.length ? { ok: false, unset } : { ok: true, draft: filled }
}
