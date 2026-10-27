import type { Says } from '@/core/insurance-rules/model'

// An insurer's settings (BackOffice 3144, "insurer settings": an HQ table per insurer, edited under the insurance
// grant, every change logged, NOT versioned — so no draft, no approval: a PUT and a log line). Pure: the shapes
// and the problems the screen refuses before the PUT (HQ refuses again).
//
// ⚠️ PROVISIONAL (617), 618 reconciles: the brief names the settings — "fixed discount %, receivable customer,
// member-id length and format, the benefit-category mapping `[{ code, meaning }]`, days-supply bounds, direct
// dispense, payer pins" — and spells only the mapping. Every other field name below, the insurers' list door,
// and the log row are guesses.

/** ⚠️ PROVISIONAL `GET InsuranceRules/Insurers` row — the brief has no door listing the insurers. */
export interface InsurerRow {
  /** The payer code `{payer}` in `Insurers/{payer}/Settings`. */
  payer: string
  name: Says
}

/** What a benefit code means to pricing (3144: 66 Generic copay, 57 Brand copay, 13 day benefit; "…" = more to come). */
export const BENEFIT_MEANINGS = ['genericCopay', 'brandCopay', 'dayBenefit'] as const

export interface InsurerSettings {
  payer: string
  /** The contract's fixed discount, 0–100; null = none. */
  fixedDiscountPct: number | null
  /** The SAP customer the insurer's receivable posts to. */
  receivableCustomer: string | null
  /** `format` is a pattern the member id must match (e.g. `^\d{15}$`); null = any. */
  memberId: { length: number | null; format: string | null }
  /** `meaning` is one of BENEFIT_MEANINGS, or a newer one HQ knows (shown as its code). */
  benefitCategories: { code: string; meaning: string }[]
  /** The days of supply a line may ask for; null = no bound. */
  daysSupply: { min: number | null; max: number | null }
  /** Direct dispense (no prior request): allowed, and the day benefit assumed when the insurer sends none (SAR). */
  directDispense: { allowed: boolean; defaultDayBenefit: number | null }
  /** The payer code pinned per SAP document type. */
  payerPins: { documentType: string; payer: string }[]
}

/** ⚠️ PROVISIONAL `GET …/Settings/Log` row: who, when, and each field's value before and after. */
export interface SettingsLogRow {
  /** Local moment. */
  at: string
  by: string
  changes: { field: string; from: string | null; to: string | null }[]
}

export type SettingsProblem =
  | 'discountRange'
  | 'memberIdLength'
  | 'memberIdFormat'
  | 'daysSupplyRange'
  | 'dayBenefitNegative'
  | 'benefitCodeMissing'
  | 'benefitCodeTwice'
  | 'pinDocumentTypeMissing'
  | 'pinDocumentTypeTwice'
  | 'pinPayerMissing'

export const SETTINGS_PROBLEMS: readonly SettingsProblem[] = [
  'discountRange',
  'memberIdLength',
  'memberIdFormat',
  'daysSupplyRange',
  'dayBenefitNegative',
  'benefitCodeMissing',
  'benefitCodeTwice',
  'pinDocumentTypeMissing',
  'pinDocumentTypeTwice',
  'pinPayerMissing',
]

/** `at` = the row of the mapping / pins table the problem is on. */
export interface SettingsIssue {
  problem: SettingsProblem
  at?: number
}

const parses = (pattern: string): boolean => {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

/** What is wrong with the settings, in screen order; empty = the PUT may go. */
export function settingsProblems(s: InsurerSettings): SettingsIssue[] {
  const out: SettingsIssue[] = []
  if (s.fixedDiscountPct !== null && !(s.fixedDiscountPct >= 0 && s.fixedDiscountPct <= 100)) out.push({ problem: 'discountRange' })
  if (s.memberId.length !== null && !(Number.isInteger(s.memberId.length) && s.memberId.length > 0)) out.push({ problem: 'memberIdLength' })
  if (s.memberId.format && !parses(s.memberId.format)) out.push({ problem: 'memberIdFormat' })
  const { min, max } = s.daysSupply
  if ((min !== null && min < 1) || (max !== null && max < 1) || (min !== null && max !== null && min > max)) out.push({ problem: 'daysSupplyRange' })
  if (s.directDispense.defaultDayBenefit !== null && s.directDispense.defaultDayBenefit < 0) out.push({ problem: 'dayBenefitNegative' })

  const codes = new Set<string>()
  s.benefitCategories.forEach((b, at) => {
    const code = b.code.trim()
    if (!code) out.push({ problem: 'benefitCodeMissing', at })
    else if (codes.has(code)) out.push({ problem: 'benefitCodeTwice', at })
    codes.add(code)
  })
  const types = new Set<string>()
  s.payerPins.forEach((p, at) => {
    const type = p.documentType.trim()
    if (!type) out.push({ problem: 'pinDocumentTypeMissing', at })
    else if (types.has(type)) out.push({ problem: 'pinDocumentTypeTwice', at })
    types.add(type)
    if (!p.payer.trim()) out.push({ problem: 'pinPayerMissing', at })
  })
  return out
}
