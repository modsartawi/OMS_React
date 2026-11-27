/**
 * The comparison results page's wire (oms tickets 971, 972, 973; BackOffice spec 4354 §16–§18).
 *
 * Reconciled with BackOffice 4393 (the results doors), 4394 (trials), and 4396 (the phase 2 bar) at pricing2 35a4e56be. The doors and their DTOs:
 * - `Services/SIS.Api/Endpoints/SourcingAdvisor/ResultsEndpoints.cs` + `SourcingAdvisor/Results/ResultsReplies.cs`:
 *   answered through the house envelope with the minimal-API JSON (camelCase, nulls sent, times ISO local
 *   `yyyy-MM-ddTHH:mm:ss`, no zone).
 * - `TrialEndpoints.cs` + `SourcingAdvisor/Trials/` and `Phase2BarEndpoints.cs` + `SourcingAdvisor/Phase2Bar/`: answered
 *   with the advisor's record JSON (`RecordJson.Options`: camelCase, a null field LEFT OUT, times `yyyy-MM-dd HH:mm:ss`),
 *   and a body read strictly (an unknown field is refused). Their refusals are the weight-set doors' (`WEIGHTSET-4xx`).
 *
 * No reply on this page but one order's card carries a riyal figure (spec §16; BO 4393 `ResultsCost_NeverAnswersARiyalSum`).
 * A share is a percent with one decimal, sent beside the count it is a share of.
 */

// ── The filters (BO 4393 `ResultsQuery`, `ResultCodes.cs`) ─────────────────────────────────────────

/** The four periods, whole local days ending yesterday (`ResultPeriods`). */
export type ResultsPeriod = 'YESTERDAY' | 'DAYS_7' | 'DAYS_14' | 'DAYS_30'
export const RESULTS_PERIODS: readonly ResultsPeriod[] = ['YESTERDAY', 'DAYS_7', 'DAYS_14', 'DAYS_30']

/** The channel group filter (`ResultChannelGroups`): all, the app and the site, the call centre, or one of its two groups. */
export type ResultsChannelGroup = 'ALL' | 'APP_SITE' | 'CALL_CENTRE' | 'CALL_CENTRE_OUTBOUND' | 'CALL_CENTRE_OTHER'
export const RESULTS_CHANNEL_GROUPS: readonly ResultsChannelGroup[] = ['ALL', 'APP_SITE', 'CALL_CENTRE', 'CALL_CENTRE_OUTBOUND', 'CALL_CENTRE_OTHER']

/** The run's marks (`RunMarks`, `solve.marks`); the filter takes ONE (`runMark`). */
export type ResultsRunMark =
  | 'COVERAGE_NOT_CONFIRMED'
  | 'ROAD_NOT_MEASURED'
  | 'STOCK_PARTLY_READ'
  | 'STOCK_FEED_OLD'
  | 'READ_AFRESH'
  | 'NOT_HELD'
  | 'ASSUMED_RATES'
  | 'WALK_IN_FIGURE_OFF'
  | 'CONFIDENCE_ENDED'
export const RESULTS_RUN_MARKS: readonly ResultsRunMark[] = [
  'COVERAGE_NOT_CONFIRMED',
  'ROAD_NOT_MEASURED',
  'STOCK_PARTLY_READ',
  'STOCK_FEED_OLD',
  'READ_AFRESH',
  'NOT_HELD',
  'ASSUMED_RATES',
  'WALK_IN_FIGURE_OFF',
  'CONFIDENCE_ENDED',
]

/** The comparison's marks (`ComparisonMarks`): the marks panel, and the filter's `mark` (one). */
export type ResultsMark =
  | 'RANGE_NOT_CONFIRMED'
  | 'NO_ROUTING_EQUIVALENT'
  | 'ASSUMED_RATES'
  | 'FEE_RULES_NOT_CONFIRMED'
  | 'BEFORE_RESERVING_OFF'
  | 'AS_IT_STANDS'
  | 'SHORT_FIGURE'

/**
 * The query every results door takes: `period` (default `DAYS_7`), `channelGroup` (default `ALL`), the candidate set
 * by `set` (name) and `version`, `shortFigure` (only orders with a line the stock figure could not cover), `mark` (one
 * comparison mark) and `runMark` (one run mark). A bad value is `RESULTS-400`.
 */
export interface ResultsQuery {
  period: ResultsPeriod
  channelGroup: ResultsChannelGroup
  set?: string
  version?: number
  shortFigure?: boolean
  mark?: ResultsMark
  runMark?: ResultsRunMark
}

/** The filter a reply was read under, echoed: `from` inclusive, `to` exclusive (local midnights). */
export interface ResultsEcho {
  period: ResultsPeriod
  from: string
  to: string
  channelGroup: ResultsChannelGroup
  set: string | null
  version: number | null
  shortFigure: boolean
  mark: string | null
  runMark: string | null
}

// ── The classes, the segments and the endings ───────────────────────────────────────────────────

/** The two views (`ResultViews`). */
export type ResultsView = 'WHOLE_PLAN' | 'STORES_ONLY'
export const RESULTS_VIEWS: readonly ResultsView[] = ['WHOLE_PLAN', 'STORES_ONLY']

/** An order's class in one view (`ComparisonClasses`). */
export type ResultsClass =
  | 'SAME_PLAN'
  | 'ANOTHER_STORE'
  | 'ANOTHER_MODE'
  | 'FEWER_SHIPMENTS'
  | 'MORE_SHIPMENTS'
  | 'OUTSIDE_RULES'
  | 'NOT_COMPARABLE'

/** A row of "where the plans differ": a class, or the callout fallback (counted apart: no store won it). */
export type ResultsDifferCode = Exclude<ResultsClass, 'NOT_COMPARABLE'> | 'CALLOUT_FALLBACK'

/** The bar's segments in the bar's order (`ResultSegments.Order`): "breaks the nesting" first, so both brackets span whole segments. */
export type ResultsSegment =
  | 'BREAKS_NESTING'
  | 'SAME_PLAN_BOTH'
  | 'SAME_STORES_OTHER_WAY'
  | 'ANOTHER_STORE'
  | 'CALLOUT_FALLBACK'
  | 'OUTSIDE_RULES'
  | 'NOT_COMPARABLE'
export const RESULTS_SEGMENTS: readonly ResultsSegment[] = [
  'BREAKS_NESTING',
  'SAME_PLAN_BOTH',
  'SAME_STORES_OTHER_WAY',
  'ANOTHER_STORE',
  'CALLOUT_FALLBACK',
  'OUTSIDE_RULES',
  'NOT_COMPARABLE',
]

/** How an order ended (`OrderEndings`), in the endings bar's order. */
export type ResultsEnding = 'ON_TIME' | 'LATE' | 'RETURNED' | 'CANCELLED' | 'CUSTOMER_CANCELLED' | 'NOT_ENDED'
export const RESULTS_ENDINGS: readonly ResultsEnding[] = ['ON_TIME', 'LATE', 'RETURNED', 'CANCELLED', 'CUSTOMER_CANCELLED', 'NOT_ENDED']

/** A delivery mode (`DeliveryModes`). */
export type ResultsShipMode = 'DAWAA_NOW' | 'SLOT' | 'CARRIER_SAME_DAY' | 'CARRIER_NEXT_DAY' | 'BEYOND_BORDER' | 'PICK_UP'

/** An estimate's middle and middle half, in minutes (`MinutesSpread`): NEGATIVE = the advisor's plan arrives earlier. */
export interface MinutesSpread {
  middle: number
  low: number
  high: number
  orders: number
}

// ── `GET SourcingAdvisor/Results/Top` ──────────────────────────────────────────────────────────

export interface ResultsSegmentCount {
  code: ResultsSegment
  orders: number
  percent: number
}

/** A bracket over the bar: the segments it spans, their orders and share. */
export interface ResultsBracket {
  segments: ResultsSegment[]
  orders: number
  percent: number
}

export interface ResultsTopReply {
  filter: ResultsEcho
  ordersCompared: number
  segments: ResultsSegmentCount[]
  /** The stores only: "same stores". */
  storesOnly: ResultsBracket
  /** The whole plan: "same plan". */
  wholePlan: ResultsBracket
  landed: number
  runNotEnded: number
  notRun: number
}

// ── `GET SourcingAdvisor/Results/Panels` ───────────────────────────────────────────────────────

/** Where a promise check stands against its band (`PromisePills`). Pick-up has a target and no band. */
export type ResultsPromisePill = 'INSIDE' | 'UNDER' | 'OVER' | 'NO_BAND' | 'NONE_CHECKED'

/** One promise check: Dawaa Now with the 85% to 95% band and the express stamp's own share; pick-up per channel group. */
export interface ResultsPromiseCheckRow {
  mode: ResultsShipMode
  /** `APP_SITE` or `CALL_CENTRE` on a pick-up row; null on Dawaa Now. */
  channelGroup: ResultsChannelGroup | null
  checked: number
  within: number
  percent: number
  pill: ResultsPromisePill
  bandLow: number | null
  bandHigh: number | null
  withinExpressStamp: number | null
  expressStampPercent: number | null
}

/** A rate of the set's money rows (`RateRow`): real with its source, or assumed. No amount. */
export interface ResultsRate {
  part: string
  mode: string | null
  channel: string | null
  source: string
  assumed: boolean
}

/** The cost panel: counts only, never a riyal figure. */
export interface ResultsCostPanel {
  /** The set the rates are read from: the filter's, else the one most of the period's orders ran on. */
  setName: string | null
  setVersion: number | null
  ratesAssumed: number
  ratesTotal: number
  rates: ResultsRate[]
  /** "No riyal total" stands while any rate is assumed, or the set's rates cannot be read. */
  noRiyalTotal: boolean
  ordersOnAssumedRates: number
  ordersWithPlans: number
  planShipments: number
  realDeliveries: number
  feeCompared: number
  feeLower: number
  feeSame: number
  feeHigher: number
  feeRulesNotConfirmed: boolean
}

export interface ResultsMarkCount {
  code: ResultsMark
  /** 0 greys it. */
  orders: number
}

export interface ResultsPanelsReply {
  filter: ResultsEcho
  promiseCheck: ResultsPromiseCheckRow[]
  cost: ResultsCostPanel
  marks: ResultsMarkCount[]
}

// ── `GET SourcingAdvisor/Results/Differ?view=` ─────────────────────────────────────────────────

export interface ResultsEndingCount {
  code: ResultsEnding
  orders: number
}

export interface ResultsDifferRow {
  code: ResultsDifferCode
  orders: number
  /** Null for outside the rules and the callout fallback, and for a row with no estimate. */
  estimate: MinutesSpread | null
  /** One count per ending, in `RESULTS_ENDINGS` order. */
  endings: ResultsEndingCount[]
}

export interface ResultsDifferReply {
  filter: ResultsEcho
  view: ResultsView
  /** The classes that differ first, "same plan" last as the reference. */
  rows: ResultsDifferRow[]
}

// ── The orders behind a figure, and one order ──────────────────────────────────────────────────

/**
 * Which figure a drawer opens (BO 4393 `ResultsFigure`): a bar segment; a view's row of "where the plans differ"
 * (and an ending); an outside reason (and its step); a breakdown row; an hour with a later slot cheaper. A mark opens
 * through the query's own `mark` filter.
 */
export type ResultsFigure =
  | { kind: 'segment'; segment: ResultsSegment }
  | { kind: 'class'; view: ResultsView; cls: ResultsDifferCode; ending?: ResultsEnding }
  | { kind: 'outside'; code: string; step: string }
  | { kind: 'breakdown'; by: ResultsBreakdownBy; key: string }
  | { kind: 'laterSlot'; hour: number }
  | { kind: 'mark'; mark: ResultsMark }

/** How the orders list is sorted (`ResultSorts`); `ESTIMATE` sorts by the view's estimate, orders without one last. */
export type ResultsOrderSort = 'LANDED' | 'ORDER' | 'CHANNEL' | 'CITY' | 'ESTIMATE' | 'ENDING'

/** The figure's query names on `Results/Orders`, beside paging (1-based; `pageSize` 50 by default, 200 at most) and sorting. */
export interface ResultsFigureParams {
  segment?: string
  view?: ResultsView
  class?: string
  ending?: string
  outside?: string
  outsideStep?: string
  by?: string
  key?: string
  hour?: number
}

export interface ResultsOrderRow {
  orderNumber: string
  landedAt: string
  channel: string
  channelGroup: string
  city: string
  wholeClass: ResultsClass
  storesClass: ResultsClass
  segment: ResultsSegment
  /** Minutes, negative = the advisor's plan earlier; null where there is none. */
  wholeEstimate: number | null
  storesEstimate: number | null
  ending: ResultsEnding
  marks: string[]
  shortFigure: boolean
  runId: string
}

/** `GET SourcingAdvisor/Results/Orders` + `ResultsQuery` + the figure + `page`, `pageSize`, `sort`, `desc`. */
export interface ResultsOrdersReply {
  filter: ResultsEcho
  total: number
  page: number
  pageSize: number
  sort: ResultsOrderSort
  desc: boolean
  rows: ResultsOrderRow[]
}

/** A shipment on the card: the advisor's (whole plan, stores only) or a real delivery (`CardShipment`). */
export interface ResultsCardShipment {
  no: number
  deliveryNo: string
  store: string
  mode: ResultsShipMode
  /** The order's line numbers it carries. */
  lines: number[]
  slotFrom: string | null
  slotTo: string | null
  promisedBy: string | null
  matched: boolean
  promiseChecked: boolean
  withinPromise: boolean
  handedOverAt: string | null
  distanceBand: string
  ending: string
  cancelledBy: string
  late: boolean
  stockChecked: boolean
  covered: boolean
  failedPick: boolean
  listFee: number | null
  feePaid: number | null
  feeSource: string
}

/** A riyal figure of one order, with its source (decision 4: riyals appear on one order only). */
export interface ResultsSourcedMoney {
  amount: number
  source: string
}

/** `GET SourcingAdvisor/Results/Order?orderNumber=` — one order's card; `RESULTS-404` when it has no summary. */
export interface ResultsOrderCard {
  orderNumber: string
  landedAt: string
  channel: string
  channelGroup: string
  city: string
  /** The stored run the simulator opens. */
  runId: string
  madeBy: string
  ownRunReason: string
  ranAt: string
  weightSetName: string
  weightSetVersion: number
  wholeClass: ResultsClass
  storesClass: ResultsClass
  segment: ResultsSegment
  notComparableWhy: string
  outsideCode: string
  outsideStepCode: string
  outsideRule: string
  outsideLineNo: number
  outsideStore: string
  outsideMode: string
  wholeEstimate: number | null
  storesEstimate: number | null
  ending: ResultsEnding
  marks: string[]
  shortFigureLines: number
  asItStands: boolean
  halfCancelled: boolean
  expressToFallback: boolean
  handMoved: boolean
  ownSplit: string
  laterSlotCheaper: boolean
  pairsBeforeCut: number
  pairsCut: number
  feeCompared: string
  wholeListFee: ResultsSourcedMoney | null
  realListFee: ResultsSourcedMoney | null
  feePaid: ResultsSourcedMoney
  wholeCompanyCost: ResultsSourcedMoney | null
  realCompanyCost: ResultsSourcedMoney | null
  wholePlan: ResultsCardShipment[]
  storesOnly: ResultsCardShipment[]
  deliveries: ResultsCardShipment[]
}

/** `GET SourcingAdvisor/Results/Codes`: the advisor's code list with its words in both languages (under the view grant). */
export interface AdvisorCode {
  family: string
  code: string
  en: string
  ar: string
}

// ── The five reading tabs (ticket 972) ───────────────────────────────────────────────────────────

/** The Breakdowns tab's groupings (`BreakdownRows`). */
export type ResultsBreakdownBy = 'MODE' | 'CITY' | 'CHANNEL' | 'DAY' | 'MADE_BY' | 'OWN_SPLIT' | 'SHORT_FIGURE'
export const RESULTS_BREAKDOWN_BYS: readonly ResultsBreakdownBy[] = ['MODE', 'CITY', 'CHANNEL', 'DAY', 'MADE_BY', 'OWN_SPLIT', 'SHORT_FIGURE']

/** An order's modes, as its real deliveries were (`OrderModeMixes`): the MODE and SHORT_FIGURE row keys. */
export type ResultsModeMix = 'SLOT_ONLY' | 'DAWAA_NOW_ONLY' | 'SLOT_AND_DAWAA_NOW' | 'BEYOND_BORDER' | 'PICK_UP_ONLY' | 'OTHER'
export const RESULTS_MODE_MIXES: readonly ResultsModeMix[] = ['SLOT_ONLY', 'DAWAA_NOW_ONLY', 'SLOT_AND_DAWAA_NOW', 'BEYOND_BORDER', 'PICK_UP_ONLY', 'OTHER']

/** One row of the Breakdowns tab: every figure a COUNT of the row's orders (`BreakdownRow`). */
export interface ResultsBreakdownRow {
  key: string
  orders: number
  samePlanWhole: number
  samePlanStores: number
  /** The whole plan's middle estimate, minutes, negative = the advisor's plan earlier; null where none. */
  middleEstimate: number | null
  /** Orders that ended on time. */
  promiseKept: number
  late: number
  returned: number
  cancelled: number
  customerCancelled: number
  noStock: number
  pairsCut: number
}

/** `GET SourcingAdvisor/Results/Breakdown?by=` (default `MODE`). Rows by day in day order, else by orders; `total` keyed `TOTAL`. */
export interface ResultsBreakdownReply {
  filter: ResultsEcho
  by: ResultsBreakdownBy
  rows: ResultsBreakdownRow[]
  total: ResultsBreakdownRow
}

/** `GET SourcingAdvisor/Results/Outside`: by the refused pin's code and the step that removed the pair (a FILTER code, or ''). */
export interface ResultsOutsideReply {
  filter: ResultsEcho
  ordersCompared: number
  outside: number
  /** `percent` is the reason's share of the orders compared. */
  reasons: { code: string; stepCode: string; orders: number; percent: number }[]
}

/** Dawaa Now's distance bands (`DistanceBands`). */
export type ResultsDistanceBand = 'KM_0_2' | 'KM_2_4' | 'KM_4_6' | 'KM_6_UP'

/** `GET SourcingAdvisor/Results/Checks`: the promise check, Dawaa Now by distance band, the stock check by mode. */
export interface ResultsChecksReply {
  filter: ResultsEcho
  promiseCheck: ResultsPromiseCheckRow[]
  dawaaNowByBand: {
    band: ResultsDistanceBand
    checked: number
    within: number
    percent: number
    withinExpressStamp: number
    expressStampPercent: number
  }[]
  /** Real deliveries of the mode, read at their own store, covered, and failed picks. */
  stockCheck: { mode: ResultsShipMode; deliveries: number; stockChecked: number; covered: number; failedPicks: number }[]
}

/** `GET SourcingAdvisor/Results/LaterSlots`: evidence for phase 2, never a limit. `byHour` holds all 24 hours. */
export interface ResultsLaterSlotsReply {
  filter: ResultsEcho
  ordersWithSlot: number
  laterSlotCheaper: number
  percent: number
  byHour: { hour: number; orders: number; laterSlotCheaper: number }[]
}

/** `GET SourcingAdvisor/Results/NotRun`: orders not run by reason (`NotRunReasons`), and orders OMS ran itself (`OwnRunReasons`). */
export interface ResultsNotRunReply {
  filter: ResultsEcho
  notRun: { code: string; orders: number }[]
  ownRun: { code: string; orders: number }[]
}

// ── Trials (ticket 973; BO 4394) ─────────────────────────────────────────────────────────────────
// Record JSON: a null field is left out, so every nullable field below is optional.

/** Why a trial refused an order (`TrialRefusals`), in the server's order. */
export type TrialRefusal =
  | 'MODE_SWITCHED_ON'
  | 'NEEDS_WIDER_READ'
  | 'LONGER_WAITING_AGE_CAP'
  | 'PAIR_CAP_RAISED'
  | 'PRODUCT_RULE_SWITCHED_ON'
  | 'STORE_NOT_READ'
export const TRIAL_REFUSALS: readonly TrialRefusal[] = [
  'MODE_SWITCHED_ON',
  'NEEDS_WIDER_READ',
  'LONGER_WAITING_AGE_CAP',
  'PAIR_CAP_RAISED',
  'PRODUCT_RULE_SWITCHED_ON',
  'STORE_NOT_READ',
]

/** Where a trial stands (`TrialStates`). One runs at a time; others wait in order. */
export type TrialState = 'WAITING' | 'RUNNING' | 'DONE' | 'FAILED'

/** A trial as the trial doors answer it (`TrialReply`). */
export interface TrialReply {
  trialId: string
  name: string
  version: number
  /** A trial set: tried under its banner, never marked. */
  trialSet: boolean
  /** The factor table's row ('' = the version as saved). */
  factorOff: string
  factorTableOf: string
  /** The period's first and last whole local day, `yyyy-MM-dd 00:00:00`, both included. */
  from: string
  to: string
  startedBy: string
  /** The candidate set when the trial was started: the set it is read beside. */
  besideCandidate: string
  besideCandidateVersion: number
  state: TrialState
  /** The trials waiting before this one (WAITING only). */
  ahead?: number
  /** True when the answer is a kept trial of the same version over the same period. */
  repeat: boolean
  addedAt: string
  endedAt?: string
  durationMs: number
  orders: number
  solved: number
  asStored: number
  refused: number
  refusedBy: Partial<Record<TrialRefusal, number>> & Record<string, number>
  noPlan: number
  notEnded: number
  failed: number
  stopFindings: number
  error?: string
}

/** `POST SourcingAdvisor/Trials/Start` and `POST SourcingAdvisor/Trials/FactorTable` (the save grant's). Days are `yyyy-MM-dd HH:mm:ss`, whole. */
export interface TrialStartRequest {
  name: string
  version: number
  from: string
  to: string
}

/** The factor table's rows (`TrialFactors`), in its order: each cost factor switched off in turn, the count factor on. */
export type TrialFactor =
  | 'SLOT_LOAD'
  | 'SLOT_TIMING'
  | 'RECORD_SLOT_LATE'
  | 'RECORD_SLOT_RETURNED'
  | 'RECORD_SLOT_CANCELLED'
  | 'RECORD_PICK_UP_NEVER_READY'
  | 'RECORD_PICK_UP_CANCELLED'
  | 'RECORD_PICK_UP_READY_LATE'
  | 'RECORD_DAWAA_NOW_CALLOUT_IGNORED'
  | 'RECORD_DAWAA_NOW_LATE'
  | 'COVER'
  | 'SHELF_CHANCE'
  | 'SHORT_FIGURE_FACTOR'
  | 'NAMED_STORE_STAYS'
  | 'COUNT_FACTOR_ON'
export const TRIAL_FACTORS: readonly TrialFactor[] = [
  'SLOT_LOAD',
  'SLOT_TIMING',
  'RECORD_SLOT_LATE',
  'RECORD_SLOT_RETURNED',
  'RECORD_SLOT_CANCELLED',
  'RECORD_PICK_UP_NEVER_READY',
  'RECORD_PICK_UP_CANCELLED',
  'RECORD_PICK_UP_READY_LATE',
  'RECORD_DAWAA_NOW_CALLOUT_IGNORED',
  'RECORD_DAWAA_NOW_LATE',
  'COVER',
  'SHELF_CHANCE',
  'SHORT_FIGURE_FACTOR',
  'NAMED_STORE_STAYS',
  'COUNT_FACTOR_ON',
]

/** The kinds a changed plan is counted under: the comparison's classes, the second set read against the first. */
export type TrialChangeKind = 'ANOTHER_STORE' | 'ANOTHER_MODE' | 'FEWER_SHIPMENTS' | 'MORE_SHIPMENTS'
export const TRIAL_CHANGE_KINDS: readonly TrialChangeKind[] = ['ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'MORE_SHIPMENTS']

/** One row of the factor table (`FactorRow`): `state` '' until the row's trial is started. */
export interface FactorRow {
  factor: TrialFactor
  trialId: string
  state: TrialState | ''
  compared: number
  plansChanged: number
  share: number
  kinds: Partial<Record<TrialChangeKind, number>> & Record<string, number>
}

/** `GET SourcingAdvisor/Trials/FactorTable?trialId=` (the version as saved); the POST starts it and answers the same. */
export interface FactorTableReply {
  trial: TrialReply
  rows: FactorRow[]
}

/** One set over the orders compared (`TrialSide`). */
export interface TrialSide {
  trialId: string
  name: string
  version: number
  trialSet: boolean
  shipments: number
  /** The set against what happened: each view's class, counted. */
  wholeClasses: Partial<Record<ResultsClass, number>>
  storesClasses: Partial<Record<ResultsClass, number>>
  /** "The real deliveries, as this set would have promised them." */
  promise: { mode: ResultsShipMode; checked: number; within: number; share?: number }[]
}

/**
 * `GET SourcingAdvisor/Trials/Beside?trialId=&otherId=` — two finished trials over the same period, side by side
 * (`TrialsBeside`). `first` is `trialId` (the candidate set), `second` is `otherId` (the set beside it). No riyal sum.
 */
export interface TrialsBeside {
  orders: number
  compared: number
  leftOut: number
  leftOutBy: Record<string, number>
  plansDiffer: number
  plansDifferShare: number
  differBy: Partial<Record<TrialChangeKind, number>> & Record<string, number>
  first: TrialSide
  second: TrialSide
  /** The second's promise minus the first's, minutes: NEGATIVE = the set beside it promises earlier. */
  minutesMiddle?: number
  minutesMiddleHalfFrom?: number
  minutesMiddleHalfTo?: number
  feeLower: number
  feeSame: number
  feeHigher: number
}

// ── The phase 2 bar (ticket 973; BO 4396) ────────────────────────────────────────────────────────
// Record JSON: a null field is left out.

/** The limits a to i (`Phase2Limits.Order`). */
export type BarLimit =
  | 'STOP_FINDINGS'
  | 'ORDERS_RUN'
  | 'DAWAA_NOW_PROMISE'
  | 'DISTANCE_BANDS'
  | 'SHELF_CHANCE'
  | 'SPLIT_CHECK'
  | 'LARGEST_DIFFERENCES'
  | 'OUTSIDE_RULES'
  | 'RATES'
export const BAR_LIMITS: readonly BarLimit[] = [
  'STOP_FINDINGS',
  'ORDERS_RUN',
  'DAWAA_NOW_PROMISE',
  'DISTANCE_BANDS',
  'SHELF_CHANCE',
  'SPLIT_CHECK',
  'LARGEST_DIFFERENCES',
  'OUTSIDE_RULES',
  'RATES',
]

/** A limit's reading, and the bar's (`Phase2BarStates`). */
export type BarState = 'MET' | 'NOT_MET' | 'CANNOT_READ_YET'

/** The bar is read per channel group, each alone (`Phase2BarGroups`). */
export type BarChannelGroup = 'APP_SITE' | 'CALL_CENTRE'
export const BAR_CHANNEL_GROUPS: readonly BarChannelGroup[] = ['APP_SITE', 'CALL_CENTRE']

/** The two steps, named by the view each reads: step 1 the stores only, step 2 the whole plan (`Phase2BarSteps`). */
export type BarStep = 'STORES_ONLY' | 'WHOLE_PLAN'
export const BAR_STEPS: readonly BarStep[] = ['STORES_ONLY', 'WHOLE_PLAN']

/** What a person closes (`Phase2CloseKinds`). */
export type BarCloseKind = 'ORDER' | 'OUTSIDE_REASON' | 'SHELF_CHANCE' | 'SPLIT_CHECK'

/** The marks a person gives (`Phase2Marks`). */
export type BarMark = 'NO_WRONG_RULE' | 'WRONG_RULE' | 'RULED' | 'WITHIN_LIMIT' | 'OVER_LIMIT'
export const BAR_ORDER_MARKS: readonly BarMark[] = ['NO_WRONG_RULE', 'WRONG_RULE']
export const BAR_SPLIT_MARKS: readonly BarMark[] = ['WITHIN_LIMIT', 'OVER_LIMIT']

/** Which way an order's estimate goes (`Phase2Ways`). */
export type BarWay = 'ADVISOR_EARLIER' | 'ADVISOR_LATER'
export const BAR_WAYS: readonly BarWay[] = ['ADVISOR_EARLIER', 'ADVISOR_LATER']

/** One thing closed on the bar: what, which, the mark, the written text, who and when (`Phase2Close`). */
export interface BarClose {
  kind: BarCloseKind
  key: string
  mark: BarMark
  text: string
  by: string
  at: string
}

/** Why the period cannot be read yet: a `Phase2BarWhys` code and its first day or figure (`detail`, '' when none). */
export interface BarWhy {
  code: string
  detail: string
}

/** One limit: its state, why (codes), and its figures by name (a figure null where it cannot be read). */
export interface BarLimitReading {
  code: BarLimit
  state: BarState
  why: string[]
  figures: Record<string, number | null>
}

/** One of the 30 orders with the largest estimate each way, in each view (limit g). `estimate`: negative = the advisor earlier. */
export interface BarLargestOrder {
  view: ResultsView
  way: BarWay
  orderNumber: string
  estimate: number
  mark?: BarMark
  markedBy?: string
  markedAt?: string
}

/** A reason outside the advisor's rules (limit h): over 1% of the orders compared needs a written ruling. */
export interface BarOutsideReason {
  code: string
  stepCode: string
  orders: number
  percent: number
  needsRuling: boolean
  ruling?: BarClose
}

/** The evidence's verdict on a shelf chance figure (`ShelfChanceVerdicts`). */
export type ShelfChanceVerdict = 'ENOUGH_TO_CHANGE' | 'INSIDE_CHANCE' | 'TOO_FEW' | 'NOT_STEADY' | 'COUNTS_ONLY'

/** A shelf chance row judged against its evidence (limit e): one-line deliveries of the app and the site over 90 days. */
export interface BarShelfChanceRow {
  mode: ResultsShipMode
  stockClass: string
  lines: number
  failedLines: number
  verdict: ShelfChanceVerdict
  expected: number
  ratio?: number
  fits: number
  chanceGap: number
  firstHalf?: number
  secondHalf?: number
  daysCounted: number
  needsRuling: boolean
  ruling?: BarClose
}

/** A mode's fleet ratio (the three book rows together, one-line reading): read, never a limit. */
export interface BarFleetRatio {
  mode: ResultsShipMode
  ratio?: number
  expected: number
  lines: number
}

export interface BarMadeByRead {
  madeBy: string
  orders: number
  samePlanWhole: number
  sameStores: number
  wholeEstimate?: MinutesSpread
  storesEstimate?: MinutesSpread
}

/** Read and never a limit (`Phase2ReadOnly`). */
export interface BarReadOnly {
  ordersCompared: number
  /** Percents. */
  samePlanWhole: number
  sameStores: number
  wholeEstimate?: MinutesSpread
  storesEstimate?: MinutesSpread
  byMadeBy: BarMadeByRead[]
  fleetRatios: BarFleetRatio[]
  ordersWithSlot: number
  laterSlotCheaper: number
}

/** One reading of the bar (`Phase2BarReading`). `to` is exclusive: local midnight after the 28th day. */
export interface BarReading {
  from: string
  to: string
  channelGroup: BarChannelGroup
  step: BarStep
  candidateName?: string
  candidateVersion?: number
  state: BarState
  cannotReadYet: BarWhy[]
  limits: BarLimitReading[]
  largestDifferences: BarLargestOrder[]
  outsideReasons: BarOutsideReason[]
  shelfChance: BarShelfChanceRow[]
  splitCheck?: BarClose
  read: BarReadOnly
  /** The date of the last ruling that changed a figure of the bar. */
  figuresRuledOn: string
}

/** A reading the owner accepted, kept (`Phase2KeptReading`). */
export interface BarKeptReading {
  id: string
  from: string
  to: string
  channelGroup: BarChannelGroup
  step: BarStep
  candidateName: string
  candidateVersion: number
  met: boolean
  note: string
  readBy: string
  readAt: string
  figures?: unknown
}

/** `GET SourcingAdvisor/Results/Phase2Bar` (and the answer of `/Close`): the reading, and the readings kept for its period and group. */
export interface BarReply {
  reading: BarReading
  kept: BarKeptReading[]
}

/** `?from=yyyy-MM-dd` (the period's first day; absent = the 28 days ending yesterday), `channelGroup`, `step`. */
export interface BarQuery {
  from?: string
  channelGroup: BarChannelGroup
  step: BarStep
}

/** `POST SourcingAdvisor/Results/Phase2Bar/Close` — the candidate-mark grant's. `text` required but on an ORDER. */
export interface BarCloseRequest {
  from: string
  channelGroup: BarChannelGroup
  kind: BarCloseKind
  key: string
  mark: BarMark
  text: string
}

/** `POST SourcingAdvisor/Results/Phase2Bar/Accept` — the candidate-mark grant's; answers the kept reading. */
export interface BarAcceptRequest {
  from: string
  channelGroup: BarChannelGroup
  step: BarStep
  note: string
}

