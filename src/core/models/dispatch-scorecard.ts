/**
 * The dispatch scorecard's wire shapes (ticket 543, BackOffice spec 2952, doors 2965) — mirrored field
 * for field, camelCase, from BackOffice
 * `Sartawi.Retail.Data\Modules\Callouts\Scorecard\DispatchScorecardModels.cs`. A shape change goes
 * there first, then here.
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay
 * strings and are formatted through `@/core/util/date-format`.
 *
 * 🚩 Every figure, rank and median is the door's (ruling 2948 D4): the screen never recomputes one. A
 * missing figure is `null`, never 0.
 */

/** The five ranked store measures (ruling 2948 D4), as the card and the rank columns name them. */
export type DispatchScorecardMeasure =
  | 'ignoreRate'
  | 'medianAnswerSeconds'
  | 'slowQuarterAnswerSeconds'
  | 'winRate'
  | 'declineRate'

/** A measure's better direction. */
export type DispatchScorecardBetter = 'lower' | 'higher'

/**
 * Every figure the drill can open (`DispatchScorecardFigures`): the store row's (and the staff row's)
 * own field names.
 */
export type DispatchScorecardFigure =
  | 'bids'
  | 'won'
  | 'lostRaces'
  | 'nearMisses'
  | 'passedWithStock'
  | 'passedShort'
  | 'passedUnknown'
  | 'ignored'
  | 'unseen'
  | 'unseenNotReached'
  | 'unseenNobodySignedIn'
  | 'unseenOldBuild'
  | 'beaten'
  | 'withdrawn'
  | 'answered'
  | 'darkOffers'
  | 'medianKm'
  | 'fallbacksReceived'
  | 'releasedAfterAward'
  | DispatchScorecardMeasure

/** The scorecard's refusals (`DispatchScorecardErrorCodes`). */
export const DISPATCH_SCORECARD_REFUSALS = {
  rangeTooLong: 'CALLOUT-301',
  rangeReversed: 'CALLOUT-302',
  unknownFigure: 'CALLOUT-303',
  storeRequired: 'CALLOUT-304',
} as const

/** The query every read takes: whole local days (`yyyy-MM-dd`, both inclusive) and the filters. */
export interface DispatchScorecardQuery {
  from?: string
  to?: string
  /** The delivery document type. */
  type?: string
  /** The order's source (`RefDocumentSource`, e.g. HYBR / CMRC). */
  channel?: string
  /** The store's city (StoreArea). */
  city?: string
  /** The store's region (StoreArea). */
  region?: string
  store?: string
}

/** One store's row: the five ranked measures, their ranks among stores that are not too few, and context. */
export interface DispatchScorecardStoreRow {
  store: string
  name: string
  city: string
  region: string

  ignoreRate: number | null
  medianAnswerSeconds: number | null
  slowQuarterAnswerSeconds: number | null
  winRate: number | null
  declineRate: number | null

  ignoreRateRank: number | null
  medianAnswerRank: number | null
  slowQuarterAnswerRank: number | null
  winRateRank: number | null
  declineRateRank: number | null

  /** Answered + Ignored: the bids the 20-bid minimum counts. */
  rankedBids: number
  tooFew: boolean

  bids: number
  won: number
  lostRaces: number
  nearMisses: number
  passedWithStock: number
  passedShort: number
  passedUnknown: number
  ignored: number
  unseen: number
  unseenNotReached: number
  unseenNobodySignedIn: number
  unseenOldBuild: number
  beaten: number
  withdrawn: number
  answered: number
  darkOffers: number
  medianKm: number | null
  fallbacksReceived: number
  releasedAfterAward: number
  releasedByReason: Record<string, number>
}

/** One person's row (ruling 2948 D6): their own answers only, never ignores. */
export interface DispatchScorecardStaffRow {
  staff: string
  stores: string[]
  answers: number
  won: number
  lostRaces: number
  nearMisses: number
  passedWithStock: number
  medianAnswerSeconds: number | null
  slowQuarterAnswerSeconds: number | null
  medianAnswerRank: number | null
  slowQuarterAnswerRank: number | null
  tooFew: boolean
}

/** `GET DispatchScorecard/Grid`: stores and staff in one reply. */
export interface DispatchScorecardResult {
  asOf: string
  from: string
  to: string
  minimumBids: number
  minimumAnswers: number
  stores: DispatchScorecardStoreRow[]
  staff: DispatchScorecardStaffRow[]
}

/** One measure on the store card: its value, "#rank of `of`", and the estate median, all as sent. */
export interface DispatchScorecardCardMeasure {
  measure: DispatchScorecardMeasure
  value: number | null
  rank: number | null
  of: number
  estateMedian: number | null
  better: DispatchScorecardBetter
}

/** A bid class as the door names it (`ScorecardBidClass`), plus the drill's two callout-level classes. */
export type DispatchScorecardBidClass =
  | 'Won'
  | 'LostRace'
  | 'PassedWithStock'
  | 'PassedShort'
  | 'PassedUnknown'
  | 'Ignored'
  | 'Unseen'
  | 'Beaten'
  | 'Withdrawn'
  | 'Fallback'
  | 'Released'

export interface DispatchScorecardClassCount {
  class: DispatchScorecardBidClass
  count: number
}

/** `GET DispatchScorecard/StoreCard`. */
export interface DispatchScorecardCard {
  asOf: string
  from: string
  to: string
  row: DispatchScorecardStoreRow | null
  measures: DispatchScorecardCardMeasure[]
  classes: DispatchScorecardClassCount[]
  staff: DispatchScorecardStaffRow[]
}

/** One bid behind a figure (or one callout, `bidId` `''`, for the two callout-level figures). */
export interface DispatchScorecardDrillRow {
  calloutId: string
  bidId: string
  /** `DELIVERY` today (`CalloutSubjectTypes`). */
  subjectType: string
  subjectId: string
  party: string
  class: DispatchScorecardBidClass | string
  ignoreReason: string
  offeredAt: string
  deliveredAt: string | null
  answeredAt: string | null
  answerSeconds: number | null
  answeredBy: string
  answeredRegister: string
  awardedAt: string | null
  nearMiss: boolean
  distanceKm: number
  onlineTills: number
  signedInTills: number
  /** `covers` | `short` | `unknown` (no stock check). */
  atp: string
  releaseReason: string
  /** For a rate, the rows are its denominator and this marks the numerator; otherwise always true. */
  counted: boolean
}

/** `GET DispatchScorecard/Drill`. */
export interface DispatchScorecardDrill {
  asOf: string
  from: string
  to: string
  figure: string
  store: string
  staff: string
  rows: DispatchScorecardDrillRow[]
}

/** `GET DispatchScorecard/Access`. */
export interface DispatchScorecardAccess {
  screenAllowed: boolean
}
