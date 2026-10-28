import type { FieldScope, FieldType, NewRegistryField, RegistryField } from '@/core/insurance-rules/registry'

/**
 * Adding a field to the registry (ticket 610; BackOffice 3132). Rules and lists name a field by its `key`, so
 * a key is never reused — not even a retired field's — and it is compared without case.
 */
export interface FieldForm {
  source: string
  key: string
  labelEn: string
  labelAr: string
  scope: FieldScope
  type: FieldType
  unit: string
}

export type FieldProblem = 'sourceMissing' | 'keyMissing' | 'keyInvalid' | 'keyTaken' | 'labelMissing'

/**
 * HQ's key shape (3132): a letter, then letters, digits, `.`, `_`, `[`, `]` or `*`, up to 100 — eligibility facts are
 * dotted and indexed (`coverage.periodEnd`, `benefit[*].copayPct`).
 */
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_.[\]*]{0,99}$/

export function fieldProblems(form: FieldForm, existing: readonly RegistryField[]): FieldProblem[] {
  const out: FieldProblem[] = []
  if (!form.source.trim()) out.push('sourceMissing')
  const key = form.key.trim()
  if (!key) out.push('keyMissing')
  else if (!FIELD_KEY.test(key)) out.push('keyInvalid')
  else if (existing.some((f) => f.key.toLowerCase() === key.toLowerCase())) out.push('keyTaken')
  if (!form.labelEn.trim() || !form.labelAr.trim()) out.push('labelMissing')
  return out
}

export function fieldBody(form: FieldForm): NewRegistryField {
  return {
    key: form.key.trim(),
    label: { en: form.labelEn.trim(), ar: form.labelAr.trim() },
    scope: form.scope,
    type: form.type,
    unit: form.unit.trim() || null,
    source: form.source.trim(),
  }
}

/** The key a source column suggests: `ItemInfo.HouseBrand` → `HouseBrand`; `ItemInfo.ECode / EDesc` → `ECode`. */
export function suggestKey(source: string): string {
  const first = source.split('/')[0].trim()
  return first.slice(first.lastIndexOf('.') + 1).replace(/[^A-Za-z0-9_]/g, '')
}
