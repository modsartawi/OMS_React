/**
 * The Mini POS scorecard (oms 918, BackOffice spec 4063, door 4075) — the wire shape mirrored field for field, camelCase,
 * from the `## Answer` of BackOffice `.issues/4075-…` (`Sartawi.Retail.Data\Modules\Pos\Services\MiniPos\MiniPosScorecard.cs`).
 * A shape change goes there first, then here.
 *
 * `GET MiniPosScorecard` on SIS.Api: cookie session only, behind `BackOfficeScreen[MiniPosScorecard, 03]`. A bad input is
 * the 400 envelope with `MINIPOS_SCORECARD_INVALID`.
 *
 * ⚠️ Every date is a LOCAL calendar day (`yyyy-MM-dd`, both ends included) and stays a string. Rates are fractions
 * (0.30 = 30%) rounded to 4 places; money is SAR net of VAT, rounded to 3 places; `null` = not computable (nothing to
 * divide by). Cost is the item master's CURRENT cost, not the cost at the time of sale.
 */

/** The query the report sends. An absent date or offset falls back to SIS.Api's configured trial calendar. */
export interface MiniPosScorecardQuery {
  trialFrom?: string
  trialTo?: string
  settlingInEnd?: string
  comparisonOffsetDays?: number
  /** The promoters' cost the panel enters, SAR. Absent = 0 = no ratio (`no-cost`). */
  promoterCost?: number
}

export type MiniPosVerdict = 'go' | 'panel' | 'no-go' | 'no-cost' | 'no-base'

export interface MiniPosScorecardInputs {
  trialFrom: string
  trialTo: string
  /** The settling-in week's last day; `null`/`''` = none (the uplift counts from `trialFrom`). */
  settlingInEnd: string | null
  comparisonOffsetDays: number
  /** The full promoter cost the panel entered, SAR. */
  promoterCost: number
  /**
   * The cost the payback ratio is judged on: `promoterCost` prorated to the counted days (the trial less the settling-in
   * week, e.g. 47/54) — owner ruling 2026-11-20. ⚠️ Not yet in the 4075 contract (named for the BackOffice review fix
   * pass); absent until then, and the screen shows it as not sent rather than computing it.
   */
  countedPromoterCost?: number | null
  /** The counted days and the trial's days the proration uses (same pending fix). */
  countedDays?: number | null
  trialDays?: number | null
  /** The day after `settlingInEnd` (or `trialFrom`). */
  upliftFrom: string
  upliftTo: string
  lastYearFrom: string
  lastYearTo: string
  nonPharmacyCategories: string[]
}

export interface MiniPosScorecardPharmacy {
  storeCode: string
  trialRole: 'Trial' | 'Control' | string
  sales: number
  cost: number
  lastYearSales: number
  growth: number | null
}

export interface MiniPosScorecardMoney {
  pharmacies: MiniPosScorecardPharmacy[]
  trialSales: number
  trialLastYearSales: number
  trialGrowth: number | null
  controlSales: number
  controlLastYearSales: number
  controlGrowth: number | null
  /** trialGrowth − controlGrowth. */
  uplift: number | null
  /** trialSales − trialLastYearSales × (1 + controlGrowth). */
  upliftSales: number | null
  trialMarginRate: number | null
  /** upliftSales × trialMarginRate. */
  grossMarginOnUplift: number | null
  /** grossMarginOnUplift / promoterCost. */
  paybackRatio: number | null
  verdict: MiniPosVerdict | string
}

export interface MiniPosPromoterHours {
  promoterStaffId: string
  storeCode: string
  plannedHours: number
  sales: number
  items: number
  salesPerHour: number | null
  itemsPerHour: number | null
}

export interface MiniPosPaidShare {
  orders: number
  paid: number
  share: number | null
}

export interface MiniPosScorecardSupporting {
  perPromoterHour: {
    promoters: MiniPosPromoterHours[]
    plannedHours: number
    sales: number
    items: number
    salesPerHour: number | null
    itemsPerHour: number | null
  }
  paidShare: MiniPosPaidShare & { pharmacies: (MiniPosPaidShare & { storeCode: string })[] }
  holdToBilled: { orders: number; medianSeconds: number | null; averageSeconds: number | null }
  refusals: { reason: string; stage: string; count: number }[]
  resubmits: { resubmits: number; orders: number }
  entryModes: {
    lines: number
    typedShare: number | null
    medianMsToRead: number | null
    modes: { entryMode: string; lines: number; medianMsToRead: number | null }[]
  }
  serialFallbacks: { refusedAsSerialised: number; scannedWithoutSerial: number }
  returnRate: {
    miniPos: { sales: number; returns: number; rate: number | null }
    ordinary: { sales: number; returns: number; rate: number | null }
  }
}

/** An item line of a Mini POS sale that should never have sold: the compliance stop (3710 M15). */
export interface MiniPosOffListLine {
  storeCode: string
  trxNumber: string
  trxDate: string
  orderNo: string
  itemNumber: string
  aCode: string
  reason: 'category' | 'list' | string
}

/** One pharmacy's paid share in one trial week (week 1 = `trialFrom` .. +6), weeks with orders only. */
export interface MiniPosWeeklyPaidShare {
  storeCode: string
  week: number
  weekFrom: string
  weekTo: string
  orders: number
  paid: number
  share: number | null
  /** paid × 2 < orders. */
  underHalf: boolean
  /** Under half this week AND the week before (3710 M15: pause the pharmacy). */
  pause: boolean
}

export interface MiniPosScorecard {
  inputs: MiniPosScorecardInputs
  money: MiniPosScorecardMoney
  supporting: MiniPosScorecardSupporting
  weekly: { offListLines: MiniPosOffListLine[]; paidShare: MiniPosWeeklyPaidShare[] }
}
