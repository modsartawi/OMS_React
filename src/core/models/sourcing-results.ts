/**
 * The comparison results page's wire (oms ticket 971, BackOffice spec 4354 §16–§17, results page ticket 4282).
 *
 * 🚩 Built on stubs. BackOffice 4393 ("the results doors") names the CONTENT of its replies and nothing else: no door
 * path, no query name, no field name. Every path and field below is this build's design, drawn from the spec and the
 * prototype `.scratch/proto/4282-comparison-results`, and each is marked
 * `// PROVISIONAL (spec 4354: not specified)` until it is reconciled with BO 4393 as built. The codes that DO come from
 * the wire already settled are said so where they stand (the run's marks and the shipment modes are BO 4281's).
 *
 * Tickets 972 (the five reading tabs) and 973 (Trials, Phase 2 bar) extend this file with their own replies.
 *
 * Formats as the rest of the advisor's wire (BO 4379): local wall clock `yyyy-MM-dd HH:mm:ss`, no zone. Every share is
 * sent as a percent with one decimal, beside the count it is a share of — "every total is sent with its parts, as
 * rounded; no reader recomputes". No reply on this page carries a riyal sum (spec §16, BO 4393
 * `ResultsCost_NeverAnswersARiyalSum`); riyals appear on one order only.
 */

// ── The filters ─────────────────────────────────────────────────────────────────────────────────

/** The four fixed periods, in whole local days: yesterday, 7, 14 or 30 days (spec §17). */
export type ResultsPeriod = 1 | 7 | 14 | 30
export const RESULTS_PERIODS: readonly ResultsPeriod[] = [1, 7, 14, 30]

/** The channel groups (results ticket decision 7). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type ResultsChannelGroup = 'ALL' | 'APP_SITE' | 'CALL_CENTRE'
export const RESULTS_CHANNEL_GROUPS: readonly ResultsChannelGroup[] = ['ALL', 'APP_SITE', 'CALL_CENTRE']

/** The run's marks a reader may filter by (results ticket amendment by BO 4281): the codes are BO 4281's `solve.marks`. */
export type ResultsRunMark = 'COVERAGE_NOT_CONFIRMED' | 'ROAD_NOT_MEASURED' | 'STOCK_FEED_OLD'
export const RESULTS_RUN_MARKS: readonly ResultsRunMark[] = ['COVERAGE_NOT_CONFIRMED', 'ROAD_NOT_MEASURED', 'STOCK_FEED_OLD']

/** A weight set by name and version, as BO 4360 names one. */
export interface ResultsWeightSet {
  name: string
  version: number
  /** The candidate set the OMS runs were made on. */
  candidate?: boolean // PROVISIONAL (spec 4354: not specified)
  /** A trial set, shown under its banner. */
  trial?: boolean // PROVISIONAL (spec 4354: not specified)
}

/**
 * The query every results door takes (the page's filter bar).
 * PROVISIONAL (spec 4354: not specified) — every query name: `period`, `channelGroup`, `weightSet`, `weightSetVersion`,
 * `besideSet`, `besideSetVersion`, `stockShortLine`, `marks` (comma-joined).
 */
export interface ResultsQuery {
  period: ResultsPeriod
  channelGroup: ResultsChannelGroup
  weightSet?: string
  weightSetVersion?: number
  besideSet?: string
  besideSetVersion?: number
  /** Only orders with a line the stock figure could not cover (results ticket amendment by BO 4304). */
  stockShortLine?: boolean
  marks?: string
}

// ── The classes, the segments and the endings ───────────────────────────────────────────────────

/** The two views (spec §16). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type ResultsView = 'WHOLE_PLAN' | 'STORES_ONLY'
export const RESULTS_VIEWS: readonly ResultsView[] = ['WHOLE_PLAN', 'STORES_ONLY']

/**
 * An order's class in one view: the spec's seven (§16, BO 4244 302-316) and "callout fallback", which the stores-only
 * view counts apart (results ticket decision 1).
 */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type ResultsClass =
  | 'SAME_PLAN'
  | 'ANOTHER_STORE'
  | 'ANOTHER_MODE'
  | 'FEWER_SHIPMENTS'
  | 'MORE_SHIPMENTS'
  | 'CALLOUT_FALLBACK'
  | 'OUTSIDE_RULES'
  | 'NOT_COMPARABLE'

/**
 * The bar's segments, in the spec's order (§17, results ticket decision 1). `BREAKS_NESTING` is the results ticket's
 * "Not checked": orders that are "same plan" in the whole plan but not in the stores only get a segment of their own,
 * sent only when there are any.
 */
// PROVISIONAL (spec 4354: not specified) — the codes, and `BREAKS_NESTING` as a segment of the reply.
export type ResultsSegment =
  | 'SAME_PLAN'
  | 'SAME_STORES_OTHER_WAY'
  | 'ANOTHER_STORE'
  | 'CALLOUT_FALLBACK'
  | 'OUTSIDE_RULES'
  | 'NOT_COMPARABLE'
  | 'BREAKS_NESTING'

/** How a real order ended (results ticket decision 3; BO 4393). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type ResultsEnding = 'ON_TIME' | 'LATE' | 'RETURNED' | 'CANCELLED' | 'CUSTOMER_CANCELLED' | 'NOT_ENDED'

/** A count and its share, as sent. */
export interface ResultsShare {
  count: number
  /** Percent, one decimal. */
  percent: number
}

// ── The summary door: the top, the three panels, where the plans differ ─────────────────────────

/**
 * `GET SourcingAdvisor/Results/Summary` + `ResultsQuery`.
 * PROVISIONAL (spec 4354: not specified) — the path, and every field of the reply.
 */
export interface ResultsSummaryReply {
  /** The period read, local dates `yyyy-MM-dd`. */
  period: { from: string; to: string }
  /** The candidate set the runs in the period were made on. */
  candidate: ResultsWeightSet
  /** The sets a reader may pick, for the candidate filter and "Set beside it". */
  sets: ResultsWeightSet[]
  top: ResultsTop
  promise: ResultsPromiseRow[]
  cost: ResultsCost
  marks: ResultsMarkInForce[]
  differ: ResultsDifferRow[]
  /** "Set beside it" (ticket 973): sent only when `besideSet` was asked for. */
  beside?: ResultsBeside | null // PROVISIONAL (spec 4354: not specified)
}

/** The top: the sentence and the bar (spec §17). */
export interface ResultsTop {
  ordersCompared: number
  /** The stores only: same stores (the bar's first two segments). */
  sameStores: ResultsShare
  /** The whole plan: same plan (the bar's first segment). */
  samePlan: ResultsShare
  segments: ResultsSegmentFigure[]
  landed: number
  runNotEnded: number
  notRun: number
}

export interface ResultsSegmentFigure extends ResultsShare {
  segment: ResultsSegment
}

/** The modes the promise check reads (BO 4281's mode codes). */
export type ResultsPromiseMode = 'DAWAA_NOW' | 'SLOT' | 'PICK_UP'

/**
 * One row of the promise check (results ticket decision 9): Dawaa Now and slot delivery with the 85% to 95% band,
 * pick-up as two rows by channel group, each with its target and no band.
 */
export interface ResultsPromiseRow {
  mode: ResultsPromiseMode
  /** Pick-up's two rows; null on a delivery mode. */
  channelGroup: Exclude<ResultsChannelGroup, 'ALL'> | null
  /** Shipments that match a real delivery (pick-ups, for pick-up). */
  count: number
  /** The share kept, percent with one decimal. */
  percent: number
  /** The band, percent; null for a target with no band. */
  band: { from: number; to: number } | null
  /** Pick-up's target, in minutes. */
  targetMinutes?: number | null
}

/** A rate behind a plan's cost (results ticket decision 4). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type ResultsRate = 'DAWAA_NOW' | 'SLOT' | 'BEYOND_BORDER' | 'HANDLING' | 'FAILURE_PRICE' | 'WAITING_PRICE'

/** The cost panel: counts only, never a riyal sum (spec §16–§17). */
export interface ResultsCost {
  ratesAssumed: number
  ratesTotal: number
  planShipments: number
  realDeliveries: number
  /** The customer's list fee, both sides under the advisor's fee rule. */
  listFee: { lowerPercent: number; samePercent: number; higherPercent: number }
  feeRulesConfirmed: boolean
  rates: { rate: ResultsRate; assumed: boolean; source: string | null; quotes: number | null }[]
}

/** The marks in force (results ticket decision 8 and its amendment by BO 4283). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type ResultsMark =
  | 'ASSUMED_RATES'
  | 'RANGE_NOT_CONFIRMED'
  | 'FEE_RULES_NOT_CONFIRMED'
  | 'EXPRESS_RECORD_NOT_MEASURED'
  | 'NO_ROUTING_EQUIVALENT'
  | 'BEFORE_RESERVING_FLAGS_OFF'

export interface ResultsMarkInForce {
  mark: ResultsMark
  /** Orders it applies to; null where it applies to the page, not to orders; 0 greys it ("none in this period"). */
  orders: number | null
}

/** "Where the plans differ": one class in one view (results ticket decision 3). */
export interface ResultsDifferRow {
  view: ResultsView
  cls: ResultsClass
  orders: number
  /** Share of the orders compared, percent. */
  percent: number
  /** Minutes, + = the advisor's plan arrives earlier; null where there is none. */
  estimate: { middle: number; low: number; high: number } | null
  /** How the real orders of the class ended, percent of the class. */
  endings: ResultsEndings
}

export interface ResultsEndings {
  onTime: number
  late: number
  returned: number
  cancelled: number
  /** The customer's own cancellation: shown, not counted. */
  customerCancelled: number
}

// ── The orders behind a figure, and one order ──────────────────────────────────────────────────

/**
 * Which figure a drawer opens. Encoded into one `figure` query value by the feature.
 * PROVISIONAL (spec 4354: not specified) — the whole notion and its encoding. 972 adds its tabs' figures.
 */
export type ResultsFigure =
  | { kind: 'segment'; segment: ResultsSegment }
  | { kind: 'class'; view: ResultsView; cls: ResultsClass }
  | { kind: 'promise'; mode: ResultsPromiseMode; channelGroup: Exclude<ResultsChannelGroup, 'ALL'> | null }
  | { kind: 'mark'; mark: ResultsMark }
  | { kind: 'runNotEnded' }
  | { kind: 'notRun' }

/** The columns the orders list sorts by. */
// PROVISIONAL (spec 4354: not specified) — the sort names.
export type ResultsOrderSort = 'orderNumber' | 'landedAt' | 'channel' | 'city' | 'wholePlan' | 'storesOnly' | 'estimateMinutes' | 'ending'

/**
 * `GET SourcingAdvisor/Results/Orders` + `ResultsQuery` + `figure`, `page`, `pageSize`, `sort`, `descending`.
 * PROVISIONAL (spec 4354: not specified) — the path, the query names and every field.
 */
export interface ResultsOrdersReply {
  total: number
  page: number
  pageSize: number
  rows: ResultsOrderRow[]
}

export interface ResultsOrderRow {
  orderNumber: string
  landedAt: string
  /** The channel code (BO 4281: `IOS`, `ROID`, `WEB`, a call-centre source). */
  channel: string
  city: string
  wholePlan: ResultsClass
  storesOnly: ResultsClass
  /** Minutes, + = earlier; null where there is no estimate. */
  estimateMinutes: number | null
  ending: ResultsEnding
  /** A line the stock figure could not cover (results ticket amendment by BO 4304). */
  stockShortLine?: boolean
}

/** A shipment mode (BO 4281). */
export type ResultsShipMode = 'DAWAA_NOW' | 'SLOT' | 'CARRIER_SAME_DAY' | 'CARRIER_NEXT_DAY' | 'BEYOND_BORDER' | 'PICK_UP'

/** One shipment on either side of the order card. */
export interface ResultsCardShipment {
  mode: ResultsShipMode
  store: string
  storeName: string
  /** Km to the customer; null where the store has no location. */
  km: number | null
  lines: number
  /** The promise (plan side) or what happened (real side), as the server words it in both languages. */
  when: { en: string; ar: string }
}

/**
 * `GET SourcingAdvisor/Results/Order?orderNumber=` — one order's card (results ticket decision 5).
 * PROVISIONAL (spec 4354: not specified) — the path and every field.
 */
export interface ResultsOrderCard {
  orderNumber: string
  /** The stored run the simulator opens (BO 4281's ULID). */
  runId: string
  landedAt: string
  channel: string
  city: string
  wholePlan: ResultsClass
  storesOnly: ResultsClass
  estimateMinutes: number | null
  ending: ResultsEnding
  /** The advisor's plan (Recommended). */
  plan: ResultsCardShipment[]
  /** What happened. */
  happened: ResultsCardShipment[]
}

// ── Trials (ticket 973; spec §18, BO 4283 decisions 1–18, BO 4394) ─────────────────────────────────
//
// 🚩 BO 4394 says a trial is "a job with a door of its own" and names its content only: no path, no query name, no
// field, no code. Everything below is this build's design and marked `// PROVISIONAL (spec 4354: not specified)`
// until it is reconciled with BO 4394 as built.

/** Why a trial refused an order it could not answer honestly (spec §18, BO 4394), in the ticket's order. */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type TrialRefusal =
  | 'MODE_SWITCHED_ON'
  | 'REACH_WIDER_THAN_READ'
  | 'STORE_ADDED_TO_MODE'
  | 'LONGER_WAITING_CAP'
  | 'HIGHER_PAIR_CAP_ON_CUT_RUN'
  | 'STORE_NEVER_READ'
  | 'PRODUCT_RULE_SWITCHED_ON'
export const TRIAL_REFUSALS: readonly TrialRefusal[] = [
  'MODE_SWITCHED_ON',
  'REACH_WIDER_THAN_READ',
  'STORE_ADDED_TO_MODE',
  'LONGER_WAITING_CAP',
  'HIGHER_PAIR_CAP_ON_CUT_RUN',
  'STORE_NEVER_READ',
  'PRODUCT_RULE_SWITCHED_ON',
]

/** One trial runs at a time; others wait in order (BO 4283 decision 10). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type TrialState = 'WAITING' | 'RUNNING' | 'DONE' | 'FAILED'

/** A trial's kept row (BO 4283 decision 11): who, when, the set and version, the period, solved, refused, failed. */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface TrialRow {
  trialId: string
  /** The saved version tried, by name and number (never a draft); `trial` = a trial set, shown under its banner. */
  set: ResultsWeightSet
  /** Whole local days, `yyyy-MM-dd`, both ends included. */
  period: { from: string; to: string }
  days: number
  state: TrialState
  /** The trial's place in the queue while it waits (1 = next); null otherwise. */
  queuePosition: number | null
  startedBy: string
  startedAt: string
  endedAt: string | null
  /** Every order of the period with a stored comparison run (BO 4283 decision 7). */
  orders: number
  solved: number
  /** Refused orders, by reason, never solved on a narrower read. */
  refused: { reason: TrialRefusal; count: number }[]
  failed: number
  /** Orders whose run ended with no plan: left out, and counted (BO 4283 decision 9). */
  leftOutNoPlan: number
  /** A repeat of the same version over the same period, answered from the kept trial (BO 4283 decision 11). */
  fromKept: boolean
}

/** `GET SourcingAdvisor/Trials` — the list, and what the start form may pick. */
// PROVISIONAL (spec 4354: not specified) — the path and every field.
export interface TrialsReply {
  trials: TrialRow[]
  /** The saved versions a trial may run on. */
  versions: ResultsWeightSet[]
  /** The longest period in whole local days (a system setting: 30). */
  maxDays: number
  /** The first and last day a period may hold: inside the 90 days runs are kept, up to yesterday. */
  earliestDay: string
  latestDay: string
}

/** `POST SourcingAdvisor/Trials/Start` — the save grant's (spec §18). Answers the started (or kept) trial's row. */
// PROVISIONAL (spec 4354: not specified) — the path and every field.
export interface TrialStartRequest {
  weightSet: string
  weightSetVersion: number
  from: string
  to: string
}

/** The cost factors the factor table switches in turn (BO 4283 decision 16), in its order. */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type TrialFactor =
  | 'SLOT_LOAD'
  | 'SLOT_TIMING'
  | 'STORE_RECORD'
  | 'COVER'
  | 'SHELF_CHANCE'
  | 'STORE_OWN_PART'
  | 'SHORT_FIGURE'
  | 'NAMED_STORE_STAYS'
  | 'COUNT_FACTOR'
export const TRIAL_FACTORS: readonly TrialFactor[] = [
  'SLOT_LOAD',
  'SLOT_TIMING',
  'STORE_RECORD',
  'COVER',
  'SHELF_CHANCE',
  'STORE_OWN_PART',
  'SHORT_FIGURE',
  'NAMED_STORE_STAYS',
  'COUNT_FACTOR',
]

/** The kinds a changed plan is counted under: the comparison's classes, one set against the other. */
export type TrialChangeKind = 'ANOTHER_STORE' | 'ANOTHER_MODE' | 'FEWER_SHIPMENTS' | 'MORE_SHIPMENTS'
export const TRIAL_CHANGE_KINDS: readonly TrialChangeKind[] = ['ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'MORE_SHIPMENTS']

// PROVISIONAL (spec 4354: not specified) — every field.
export interface FactorRow {
  factor: TrialFactor
  /** The store record's measure (`LATE`, `RETURNED`, `CANCELLED`, `PICK_UP_CANCELLED`); null for the other factors. */
  measure: string | null
  /** Every factor is switched off, the count factor on (it is off). */
  switched: 'OFF' | 'ON'
  /** Plans changed, of the plans solved. */
  changed: ResultsShare
  kinds: { kind: TrialChangeKind; count: number }[]
}

/** `GET SourcingAdvisor/Trials/Factors?trialId=`; `POST SourcingAdvisor/Trials/Factors` starts it (the save grant's). */
// PROVISIONAL (spec 4354: not specified) — the paths and every field.
export interface FactorTableReply {
  trialId: string
  state: 'NOT_STARTED' | TrialState
  /** Plans solved in the trial, the whole each row's share is of. */
  plans: number
  rows: FactorRow[]
}

// ── Set beside it (ticket 973; BO 4283 decisions 12–15) ───────────────────────────────────────────

/**
 * The set beside the candidate set, read as two trials over the same orders (BO 4283 decisions 12–15).
 * PROVISIONAL (spec 4354: not specified) — every field.
 */
export interface ResultsBeside {
  set: ResultsWeightSet
  /** The kept trial the figures come from; null when the set's stored runs were used as stored. */
  trialId: string | null
  period: { from: string; to: string }
  /** Orders refused for either set: left out of both, counted once (BO 4283 decision 13). */
  leftOut: number
  /** The set against what happened: the thin second bar. */
  top: ResultsTop
  /** The plans that differ between the two sets: the count, the share and the kind. */
  differ: { orders: number; differ: ResultsShare; kinds: { kind: TrialChangeKind; count: number; percent: number }[] }
  /** Between the two sets, minutes, + = the set beside it arrives earlier; null when no plan differs. */
  estimate: { middle: number; low: number; high: number } | null
  shipments: { candidate: number; beside: number }
  listFee: { lowerPercent: number; samePercent: number; higherPercent: number }
  /** "The real deliveries, as this set would have promised them" (BO 4283 decision 15). */
  promise: ResultsPromiseRow[]
}

/**
 * The breakdowns' one more column under "Set beside it": one row's figure under the set beside it. Ticket 972's
 * breakdown row carries it as `beside` when `besideSet` is asked for.
 * PROVISIONAL (spec 4354: not specified) — the field and its shape.
 */
export interface ResultsBesideCell {
  /** Same plan as what happened, under the set beside it (the whole plan). */
  samePlan: ResultsShare
}

// ── The phase 2 bar (ticket 973; spec §18, BO 4283 decisions 31–33, BO 4396) ─────────────────────
//
// 🚩 BO 4396 names "SIS.Api doors" and their content only. Every path, field and code below is this build's design.

/** The limits, a to i, in the spec's order (spec §18, BO 4283 decision 31). */
// PROVISIONAL (spec 4354: not specified) — the codes.
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

// PROVISIONAL (spec 4354: not specified) — the codes.
export type BarState = 'MET' | 'NOT_MET' | 'CANNOT_READ'

/**
 * Why a limit cannot be read yet (BO 4396): the period's six causes, then three of one limit's own (the whole plan's
 * step waits for finance's rates; the plan check has not read the period; the split check is not done on it).
 */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type BarCause =
  | 'DAY_BEFORE_FLAGS_OFF'
  | 'RAMADAN_OR_EID'
  | 'CANDIDATE_CHANGED'
  | 'SHARE_UNDER_100'
  | 'READ_REACH_OFF'
  | 'BEFORE_31ST_DAY'
  | 'WAITS_FOR_FINANCE_RATES'
  | 'PLAN_CHECK_NOT_RUN'
  | 'SPLIT_CHECK_NOT_DONE'
export const BAR_CAUSES: readonly BarCause[] = [
  'DAY_BEFORE_FLAGS_OFF',
  'RAMADAN_OR_EID',
  'CANDIDATE_CHANGED',
  'SHARE_UNDER_100',
  'READ_REACH_OFF',
  'BEFORE_31ST_DAY',
  'WAITS_FOR_FINANCE_RATES',
  'PLAN_CHECK_NOT_RUN',
  'SPLIT_CHECK_NOT_DONE',
]

/**
 * One figure of a limit or a reading, as sent: `part` names it (e.g. `RUN_SHARE`, `FIRST_HALF`, `BAND_2_4`), `of` is
 * the whole it is read against (shipments in a distance band, orders to mark), `meets` says whether this part keeps the
 * limit (null on a reading, or where it cannot be read).
 */
// PROVISIONAL (spec 4354: not specified) — every field and the part codes.
export interface BarFigure {
  part: string
  value: number
  unit: 'COUNT' | 'PERCENT' | 'PER_THOUSAND' | 'RATIO' | 'MINUTES'
  of?: number | null
  meets?: boolean | null
}

// PROVISIONAL (spec 4354: not specified) — every field.
export interface BarLimitReading {
  limit: BarLimit
  state: BarState
  figures: BarFigure[]
  /** Why it cannot be read yet; empty otherwise. */
  causes: BarCause[]
}

/** Read and never a limit (spec §18, BO 4283 decision 32). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type BarReadingCode = 'SAME_PLAN' | 'ESTIMATES' | 'FLEET_RATIO' | 'LATER_SLOTS'

/** How a person marks one of the largest differences once opened (limit g: none left "a wrong rule"). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type BarMark = 'RULE_RIGHT' | 'WRONG_RULE' | 'DATA_FAULT'
export const BAR_MARKS: readonly BarMark[] = ['RULE_RIGHT', 'WRONG_RULE', 'DATA_FAULT']

export type BarDirection = 'EARLIER' | 'LATER'

/** One of the 30 orders with the largest estimated difference, each way, in each view (limit g). */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface BarLargestRow {
  view: ResultsView
  direction: BarDirection
  orderNumber: string
  /** The order's stored run, opened in the simulator to read it before marking. */
  runId: string
  /** Minutes, + = the advisor's plan arrives earlier. */
  estimateMinutes: number
  mark: BarMark | null
  markedBy: string | null
  markedAt: string | null
}

/** A written ruling a limit waits for (limits e and h). */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface BarRuling {
  subject: 'OUTSIDE_RULES_REASON' | 'SHELF_CHANCE_FIGURE'
  /** The reason code or the shelf chance cell, as the server keys it. */
  key: string
  /** The subject in words, as the server words it in both languages. */
  label: { en: string; ar: string }
  /** Share of the orders compared (a reason outside the rules), percent; null for a shelf chance figure. */
  percent: number | null
  ruling: { text: string; by: string; at: string } | null
}

/** A reading the owner accepted, kept: who, when, the period, each figure (BO 4396). */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface BarAccepted {
  by: string
  at: string
  period: { from: string; to: string }
  limits: BarLimitReading[]
}

/** The bar is read per channel group (spec §18): the app and the site, or the call centre. */
export type BarChannelGroup = Exclude<ResultsChannelGroup, 'ALL'>
export const BAR_CHANNEL_GROUPS: readonly BarChannelGroup[] = ['APP_SITE', 'CALL_CENTRE']

/** Runs a channel made are read apart from runs OMS made (BO 4396). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type BarRuns = 'OMS' | 'CHANNEL'
export const BAR_RUNS: readonly BarRuns[] = ['OMS', 'CHANNEL']

/**
 * `GET SourcingAdvisor/Phase2Bar` + `from` (the first of the 28 whole local days; absent = the last 28), `channelGroup`,
 * `runs`.
 * PROVISIONAL (spec 4354: not specified) — the path, the query names and every field.
 */
export interface BarReply {
  period: { from: string; to: string; days: number }
  channelGroup: BarChannelGroup
  runs: BarRuns
  candidate: ResultsWeightSet | null
  /** The causes that hold for the whole period. */
  causes: BarCause[]
  limits: BarLimitReading[]
  readings: { reading: BarReadingCode; figures: BarFigure[] }[]
  largest: BarLargestRow[]
  rulings: BarRuling[]
  /** The accepted reading of this very period, channel group and runs, if any. */
  accepted: BarAccepted | null
  /** The figures are fixed; the date of the last ruling or marking that changed one. */
  lastChangedAt: string | null
}

// PROVISIONAL (spec 4354: not specified) — the query names.
export interface BarQuery {
  from?: string
  channelGroup: BarChannelGroup
  runs: BarRuns
}
