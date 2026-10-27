// An insurer's settings row as BackOffice 3144 BUILT it: `GET InsuranceRules/Insurers` lists every insurer's row (the
// estate default `*` among them), `GET / PUT …/Insurers/{payer}/Settings` reads and writes one. In core because two
// features read the same door: 617's Insurers page (the rows) and 610's class-list entry picker (the insurers a class
// entry may name). One query, one cache entry (`insurerSettingsQuery` in `./registry-api`); the picker derives its
// view with `select`.
//
// `{payer}` is the insurer's SAP customer id (`0001100041`), or `*` — the estate default an insurer inherits where its
// own row is empty: an empty list or a 0 means "the `*` row's value".

/** The estate default's `{payer}` (3144) — a settings row, never an insurer a class-list entry can name. */
export const ESTATE_DEFAULT = '*'

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
  /** `meaning` is one of the benefit meanings, or a newer one HQ knows. */
  benefitCategories: { source: BenefitSource; code: string; meaning: string }[]
  /** Payer names pinned to this insurer (`Vitality`). */
  payerPins: string[]
  /** The author's note on the PUT; shown in the log. */
  note?: string | null
  updatedBy: string | null
  /** Local moment. */
  updatedAt: string | null
}
