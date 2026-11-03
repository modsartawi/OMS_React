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

/**
 * The six ranked store measures (ruling 2948 D4; spec 3326 added `failedTakeRate`, lower is better), as
 * the card and the rank columns name them.
 */
export type DispatchScorecardMeasure =
  | 'ignoreRate'
  | 'medianAnswerSeconds'
  | 'slowQuarterAnswerSeconds'
  | 'winRate'
  | 'declineRate'
  | 'failedTakeRate'

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
  | 'failedTakes'
  | 'fallbackCancels'
  | 'refusedCloses'
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

/**
 * One store's row: the six ranked measures, their ranks among stores that are not too few, and context.
 *
 * The spec 3326 fields are optional (`?:`): a server not yet on 3326 sends none of them, and the screen
 * reads that as a missing figure, never 0.
 */
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
  /** Spec 3326: failed takes / `won`; `null` when the store won nothing. */
  failedTakeRate?: number | null

  ignoreRateRank: number | null
  medianAnswerRank: number | null
  slowQuarterAnswerRank: number | null
  winRateRank: number | null
  declineRateRank: number | null
  /** Named like `medianAnswerRank`: `failedTakeRank`, not `failedTakeRateRank`. */
  failedTakeRank?: number | null

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
  failedTakes?: number
  fallbacksReceived: number
  /** Spec 3326: the fallback deliveries this store then closed. Context only, not in the rate. */
  fallbackCancels?: number
  /** BO 3339: callouts this store won and then tried to close, refused by the lock. Once per callout. Context only. */
  refusedCloses?: number
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
  /** Spec 3326: the takes this person made that failed, whoever closed them. Never ranked (no rank field). */
  failedTakes?: number
  failedTakeRate?: number | null
  /** BO 3339: the takes this person won whose store then tried to close and was refused. Never ranked. */
  refusedCloses?: number
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

/**
 * A bid class as the door names it (`ScorecardBidClass`), plus the drill's callout-level classes
 * (`Fallback`, `Released`, and spec 3326's `FallbackCancel`, the class of a `fallbackCancels` row): on those
 * `bidId` is `''`.
 */
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
  | 'FallbackCancel'

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

/**
 * What became of a callout after the take (spec 3326). Only `StoreClosed` and `CourierBlamedStore` are
 * failed takes; `''` = nothing after the take yet. Open: an outcome the screen does not know reads as sent.
 */
export type DispatchScorecardAfterTakeOutcome =
  | 'StoreClosed'
  | 'CourierBlamedStore'
  | 'FallbackStoreClosed'
  | 'CourierOtherReason'
  | 'CourierNoReason'
  | 'OtherClose'
  | ''
  | (string & {})

/** A delivery line on a failed-take row (`DispatchScorecardDrillItem`). */
export interface DispatchScorecardDrillItem {
  itemNumber: string
  quantity: number
  uom: string
}

/**
 * One short basket line of a bid's ATP snapshot at offer (`CalloutOfferedLine`, `DeliveryCalloutStock.cs`).
 * Not `DispatchBid.atpShortLines`, which is a number.
 */
export interface CalloutOfferedLine {
  line: number
  material: string
  quantity: number
  uom: string
  neededBase: number
  /** `null` = no stock row was on record: "Not on record", never 0. */
  availableBase: number | null
}

/** One close the lock refused (a `CloseRefused` event, BO 3339). */
export interface DispatchScorecardRefusedClose {
  at: string
  closedBy: string
  register: string
  reason: string
}

/** One bid behind a figure (or one callout, `bidId` `''`, for the callout-level figures). */
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

  // Spec 3326 — optional (`?:`): a server not yet on 3326 sends none of them.
  /** The closer (`'Outbox'` on a courier cancel). `answeredBy` stays the taker. On every row, whatever the figure. */
  closedBy?: string
  /** Local time, no offset. */
  closedAt?: string | null
  afterTakeOutcome?: DispatchScorecardAfterTakeOutcome
  /** The pharmacist's note, or the courier's exact text — may be Arabic. Shown as sent. `''` = none given. */
  afterTakeReason?: string
  /** The courier as OTO names it (e.g. `alshrouqexpress`). `''` = not a courier cancel. */
  afterTakeCourier?: string
  /**
   * The delivery's lines: only in the failedTakes / failedTakeRate / fallbackCancels drills, and only on a
   * row whose outcome is a failed take or `FallbackStoreClosed`.
   */
  items?: DispatchScorecardDrillItem[]
  /** The bid's own short-line count at offer: holds even when the snapshot cannot be read. Same rows as `items`. */
  atpShortLineCount?: number
  atpShortLines?: CalloutOfferedLine[]
  /**
   * BO 3339: only in the refusedCloses drill, oldest first. The events are swept after 6 months while the
   * figure counts the callout, so an older row still counts and this list is empty.
   */
  refusedAttempts?: DispatchScorecardRefusedClose[]
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
