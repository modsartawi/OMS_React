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
