// An insurer's settings (BackOffice 3144 as BUILT: an HQ row per insurer, edited under
// `BackOfficeScreen[InsurerSettings, 02]`, every change logged, NOT versioned — so no draft, no approval: a PUT and a
// log line). Pure: the shapes, the problems the screen refuses before the PUT (HQ refuses again with 400
// `INSURER_SETTINGS_BAD_REQUEST`, one error per problem), and what a log row changed.
//
// `{payer}` is the insurer's SAP customer id (`0001100041`), or `*` — the estate default an insurer inherits where its
// own row is empty: an empty list or a 0 means "the `*` row's value".

/** The estate default's `{payer}`. */
export const ESTATE_DEFAULT = '*'

/** What a benefit code means to pricing (3144). A meaning HQ adds later is shown as its code. */
export const BENEFIT_MEANINGS = ['genericCopay', 'brandCopay', 'dayBenefit', 'nonMedCopayPct', 'nonMedCopayMax'] as const
/** Where the code is read in the eligibility answer: a `benefit[]` row, or the table of benefits (`tob[]`). */
export const BENEFIT_SOURCES = ['benefit', 'tob'] as const
export type BenefitSource = (typeof BENEFIT_SOURCES)[number]

/** `GET / PUT InsuranceRules/Insurers/{payer}/Settings`; `GET InsuranceRules/Insurers` lists every insurer's row. */
export interface InsurerSettings {
  payer: string
  hasFixedDiscount: boolean
  /** 0–100. */
  fixedDiscountPct: number
  /** The SAP customer the insurer's receivable posts to. */
  receivableCustomer: string | null
  createsInsuranceCoupon: boolean
  /** 0 = inherit; `pattern` empty = inherit. */
  memberId: { minLength: number; maxLength: number; pattern: string | null }
  /** Days; 0 = inherit. */
  daysSupply: { min: number; max: number; default: number }
  directDispense: boolean
  fullQuantityReturnsOnly: boolean
  brandMaxWhenZero: boolean
  /** `meaning` is one of BENEFIT_MEANINGS, or a newer one HQ knows. */
  benefitCategories: { source: BenefitSource; code: string; meaning: string }[]
  /** Payer names pinned to this insurer (`Vitality`). */
  payerPins: string[]
  /** The author's note on the PUT; shown in the log. */
  note?: string | null
  updatedBy: string | null
  /** Local moment. */
  updatedAt: string | null
}

/** `GET …/Settings/Log` row, newest first. `before` is null when the PUT created the insurer. */
export interface SettingsLogRow {
  changeId: number | string
  changedBy: string
  /** Local moment. */
  changedAt: string
  note: string | null
  before: InsurerSettings | null
  after: InsurerSettings
}

/** A new insurer's row: every value inherits the estate default. */
export const blankSettings = (payer: string): InsurerSettings => ({
  payer,
  hasFixedDiscount: false,
  fixedDiscountPct: 0,
  receivableCustomer: null,
  createsInsuranceCoupon: false,
  memberId: { minLength: 0, maxLength: 0, pattern: null },
  daysSupply: { min: 0, max: 0, default: 0 },
  directDispense: false,
  fullQuantityReturnsOnly: false,
  brandMaxWhenZero: false,
  benefitCategories: [],
  payerPins: [],
  updatedBy: null,
  updatedAt: null,
})

export type SettingsProblem =
  | 'discountRange'
  | 'memberIdLength'
  | 'memberIdPattern'
  | 'daysSupplyRange'
  | 'daysSupplyDefault'
  | 'benefitCodeMissing'
  | 'benefitCodeTwice'
  | 'pinMissing'
  | 'pinTwice'

export const SETTINGS_PROBLEMS: readonly SettingsProblem[] = [
  'discountRange',
  'memberIdLength',
  'memberIdPattern',
  'daysSupplyRange',
  'daysSupplyDefault',
  'benefitCodeMissing',
  'benefitCodeTwice',
  'pinMissing',
  'pinTwice',
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
const whole = (n: number) => Number.isInteger(n) && n >= 0

/** What is wrong with the settings, in screen order; empty = the PUT may go. */
export function settingsProblems(s: InsurerSettings): SettingsIssue[] {
  const out: SettingsIssue[] = []
  if (!(s.fixedDiscountPct >= 0 && s.fixedDiscountPct <= 100)) out.push({ problem: 'discountRange' })
  const { minLength, maxLength, pattern } = s.memberId
  if (!whole(minLength) || !whole(maxLength) || (minLength > 0 && maxLength > 0 && minLength > maxLength)) out.push({ problem: 'memberIdLength' })
  if (pattern && !parses(pattern)) out.push({ problem: 'memberIdPattern' })
  const { min, max, default: dflt } = s.daysSupply
  if (!whole(min) || !whole(max) || !whole(dflt) || (min > 0 && max > 0 && min > max)) out.push({ problem: 'daysSupplyRange' })
  else if (dflt > 0 && ((min > 0 && dflt < min) || (max > 0 && dflt > max))) out.push({ problem: 'daysSupplyDefault' })

  const codes = new Set<string>()
  s.benefitCategories.forEach((b, at) => {
    const code = b.code.trim()
    const key = `${b.source}|${code.toLowerCase()}`
    if (!code) out.push({ problem: 'benefitCodeMissing', at })
    else if (codes.has(key)) out.push({ problem: 'benefitCodeTwice', at })
    codes.add(key)
  })
  const pins = new Set<string>()
  s.payerPins.forEach((p, at) => {
    const pin = p.trim().toLowerCase()
    if (!pin) out.push({ problem: 'pinMissing', at })
    else if (pins.has(pin)) out.push({ problem: 'pinTwice', at })
    pins.add(pin)
  })
  return out
}

/** The stamp and the note are not settings: a log row's changes leave them out. */
const NOT_SETTINGS = new Set(['note', 'updatedBy', 'updatedAt'])

function leavesOf(v: unknown, at: string, out: Record<string, string | null>) {
  if (Array.isArray(v)) v.forEach((x, i) => leavesOf(x, `${at}[${i}]`, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (at || !NOT_SETTINGS.has(k)) && leavesOf(x, at ? `${at}.${k}` : k, out)
  else out[at] = v === null || v === undefined ? null : String(v)
  return out
}

/** Each setting a log row moved, by path (`benefitCategories[3].code`), in the after row's order. */
export function settingsChanges(before: InsurerSettings | null, after: InsurerSettings): { field: string; from: string | null; to: string | null }[] {
  const b = before ? leavesOf(before, '', {}) : {}
  const a = leavesOf(after, '', {})
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => (b[k] ?? null) !== (a[k] ?? null)).map((field) => ({ field, from: b[field] ?? null, to: a[field] ?? null }))
}
