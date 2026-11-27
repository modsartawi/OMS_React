/**
 * The advise door's wire (BackOffice spec 4354 §11; the wire is BackOffice ticket 4281, "what the advise door takes and
 * answers"). `POST SourcingAdvisor/Advise` on the user's route: the simulator sends a cart (or, later, an order or an
 * earlier run) and the reply's `data` is the run record cut to the level asked. camelCase, as ASP.NET Core emits.
 *
 * ⚠ The server does not exist yet (BackOffice 4355–4357 open). These types are 4281's tables and worked example, read
 * field by field; ticket 962 (oms-react) builds on a stub of that example. Reconcile here when the door lands.
 * Fields 4281 does not name are marked `PROVISIONAL (spec 4354: not specified)`.
 *
 * In `@/core/models/` because the simulator (962–966) and the comparison results page (971–973) both read run records,
 * and a feature may never import another. Tickets 963–966 extend these shapes (pins, weight sets, replay, the middle
 * and full levels' parts); a field of a lower level never changes its name or place at a higher one (4281 decision 20).
 *
 * Every time is local wall clock `yyyy-MM-dd HH:mm:ss` (no zone), every amount riyals to three decimals, every distance
 * km to one decimal. Every total is sent with its parts, as rounded: no reader adds up for itself (4281 decision 28).
 */

/** A sentence the server writes in both languages (the promise, a line not available, a goal with no plan). */
export interface Bilingual {
  en: string
  ar: string
}

/** The five plan goals, in the order the screen lists them (spec 4354 §3). */
export const PLAN_GOALS = ['BALANCED', 'FASTEST', 'FEWEST', 'CHEAPEST', 'PICK_UP'] as const
export type PlanGoal = (typeof PLAN_GOALS)[number]

/** The delivery modes (4281 decision 15). */
export const DELIVERY_MODES = ['DAWAA_NOW', 'SLOT', 'CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY', 'BEYOND_BORDER', 'PICK_UP'] as const
export type DeliveryMode = (typeof DELIVERY_MODES)[number]

/** How a solve ended (4281 decision 50). Each is a normal reply. */
export const SOLVE_ENDINGS = ['PROVEN_BEST', 'BEST_FOUND', 'NO_PLAN_POSSIBLE', 'FALLBACK_ANSWERED'] as const
export type SolveEnding = (typeof SOLVE_ENDINGS)[number]

/** Why a plan is not shown (4281 decision 29, plan family). The screen writes the sentence. */
export const HIDDEN_PLAN_CODES = ['NEARLY_SAME', 'WORSE_ON_EVERYTHING', 'OVER_MOST_SHOWN'] as const
export type HiddenPlanCode = (typeof HIDDEN_PLAN_CODES)[number]

/** Why a goal has no plan (4281 decision 29). The server writes the sentence too. */
export const NO_PLAN_CODES = ['GOAL_OFF', 'NO_PAIR_FOR_GOAL', 'NO_SINGLE_STORE', 'PINS_CLASH', 'FALLBACK_ANSWERED'] as const
export type NoPlanCode = (typeof NO_PLAN_CODES)[number]

/**
 * The door's error codes (4281 decision 51), each with its true HTTP status. The messages are English for developers
 * and nobody is shown one: the screen writes its own text per code, in both languages. `ADVISE-401` never reaches a
 * screen — `@/core/api`'s 401 handler signs the user out first.
 */
export const ADVISE_ERROR_CODES = [
  'ADVISE-400',
  'ADVISE-401',
  'ADVISE-403',
  'ADVISE-404',
  'ADVISE-421',
  'ADVISE-422',
  'ADVISE-423',
  'ADVISE-424',
  'ADVISE-429',
  'ADVISE-500',
  'ADVISE-503',
  'ADVISE-504',
  'ADVISE-511',
  'ADVISE-512',
  'ADVISE-513',
] as const
export type AdviseErrorCode = (typeof ADVISE_ERROR_CODES)[number]

// ── The request ──────────────────────────────────────────────────────────────────────────────────

export interface AdvisePoint {
  lat: number
  lng: number
}

/** One cart line (4281 decision 10). `lineNo` is unique in the request; `quantity` is above zero. */
export interface AdviseCartLine {
  lineNo: number
  item: string
  quantity: number
  unit: string
  namedStore?: string
}

export interface AdviseCustomer {
  point?: AdvisePoint
  city?: string
  district?: string
}

/**
 * The cart form of the request (4281 decision 11): `channel`, `lines` and `customer`, with the user route's own
 * fields. The order form (`orderNumber`, 964) and the earlier-run form (`basedOnRun`, 963) are added by their tickets.
 */
export interface AdviseCartRequest {
  channel: string
  lines: AdviseCartLine[]
  customer: AdviseCustomer
  goodsTotal?: number
  collectFrom?: string
  /** The local time to plan for, `yyyy-MM-dd HH:mm:ss`. Absent means now. */
  plannedFor?: string
  level: 'plans' | 'reasons' | 'full'
  allPlans?: boolean
  /** The pins (4281 decision 15, ticket 963). Each applies to every goal of the run. */
  pins?: AdvisePin[]
  /** The weight set (4281 decision 16, ticket 963): a saved version or the simulator's draft in full. Absent: the candidate set. */
  weightSet?: AdviseWeightSetRef
}

/**
 * The five pins (4281 decision 15; BackOffice 4359). A pin applies to every goal of the run, is never loosened silently
 * and never overrides a filter or a rule; one that cannot hold is refused before the solve and listed in `refusedPins`.
 */
export type AdvisePin =
  | { kind: 'LINE_STORE'; lineNo: number; store: string }
  | { kind: 'LINE_MODE'; lineNo: number; mode: DeliveryMode }
  | { kind: 'NOT_STORE'; store: string }
  | { kind: 'NOT_MODE'; mode: DeliveryMode }
  | { kind: 'ONE_SHIPMENT' }
export type AdvisePinKind = AdvisePin['kind']

/**
 * A weight set's values, the whole document (BackOffice 4243 decision 19). Carried as read and sent back in full.
 * PROVISIONAL (spec 4354: not specified) — BackOffice 4360 names no key inside a set's document; the keys the simulator's
 * panel edits are ours (`WEIGHT_CONTROLS` in the simulator's `draft-model.ts`).
 */
export type WeightSetValues = Record<string, unknown>

/** A saved version of a weight set, by name and number. */
export interface WeightSetVersionRef {
  name: string
  version: number
}

/** How the request names its weight set (4281 decision 16): a saved version, or the unsaved values in full. */
export type AdviseWeightSetRef = WeightSetVersionRef | { draft: { basedOn: WeightSetVersionRef; values: WeightSetValues } }

/**
 * The earlier-run form (4281 decisions 11 and 13, ticket 963): plan again on the figures of a held run, under the weight
 * set and the pins now sent. No outside read and no stock read; a change that needs a figure the run never read is read
 * afresh as a new run (`READ_AFRESH`). Mixed with the cart's fields it is refused (`ADVISE-400`).
 */
export interface AdviseRerunRequest {
  basedOnRun: string
  weightSet?: AdviseWeightSetRef
  pins?: AdvisePin[]
  level: 'plans' | 'reasons' | 'full'
  allPlans?: boolean
}

// ── The reply ────────────────────────────────────────────────────────────────────────────────────

export interface AdviseWeightSetUsed {
  name: string
  version: number
  candidate: boolean
  trial: boolean
  draft: boolean
  basedOn?: { name: string; version: number }
}

/** The time of each stage, in milliseconds (4281 decision 22). */
export interface AdviseStageTimes {
  waited: number
  localReads: number
  stockRead: number
  roadDistance: number
  coverage: number
  slots: number
  solve: number
  total: number
}

/** The order the stage times are listed in. */
export const STAGE_NAMES = ['waited', 'localReads', 'stockRead', 'roadDistance', 'coverage', 'slots', 'solve', 'total'] as const satisfies readonly (keyof AdviseStageTimes)[]

export interface AdviseSolve {
  ending: SolveEnding
  /** For the fallback: what failed in the search. */
  why?: string | null
  plansChecked: number
  workBudget: number
  pairs: { beforeCut: number; cut: number; offered: number }
  ms: AdviseStageTimes
  stoodIn: { read: string; why: 'LATE' | 'FAILED' | 'EMPTY' | string; standIn: string }[]
  marks: string[]
  /**
   * With the mark `READ_AFRESH`: why the change needed a figure the earlier run never read (4281 decision 13: "the
   * reply says so with the mark `READ_AFRESH` and why").
   * PROVISIONAL (spec 4354: not specified) — 4281 gives the "why" no field; `readAfreshWhy` is ours.
   */
  readAfreshWhy?: string | null
}

export interface AdvisePromise extends Bilingual {
  /** The last shipment's promise time. */
  by: string
}

export interface AdviseShipmentPromise extends Bilingual {
  kind: 'BY' | 'BETWEEN' | 'READY_BY' | string
  from?: string
  by: string
}

export type FeeSource = 'MEASURED' | 'FINANCE' | 'ASSUMED' | string

export interface AdviseShipment {
  no: number
  store: string
  storeName: string
  mode: DeliveryMode | string
  /** The line numbers this shipment carries. */
  lines: number[]
  promise: AdviseShipmentPromise
  slotCode?: string
  fee: number
  feeSource: FeeSource
  companyCost: number
  km: number | null
  kmKind: 'ROAD' | 'STRAIGHT_LINE' | string | null
  /** The middle level and up: each part of the company's cost (4281 decision 26). */
  costParts?: AdviseCostPart[]
  /** The middle level and up: each part of the promise (4281 decision 26). */
  promiseParts?: AdvisePromiseParts
}

export interface AdviseLineMark {
  lineNo: number
  code: 'FIGURE_SHORT' | string
  store: string
  stockClass: string
  figures: { tillStock: number; sapStock: number; heldByOrders: number; heldByDeliveries: number; shown: number; asked: number }
  row: number
  factor: number
  chance: number
  cost: number
}

/** A line not on a plan (or, on `NO_PLAN_POSSIBLE`, at the top of `data`), with the server's sentence. */
export interface AdviseMissingLine extends Bilingual {
  lineNo: number
  code: string
  bestStore?: string | null
  bestStoreUnits?: number | null
  asked?: number
  stockClass?: string
  pairsCut?: number
}

/**
 * The balanced sum in parts (4281 decision 26, the middle level): the company's cost, the customer's fees, the price
 * of waiting, the cover cost, the split penalty, and the balanced total they add to.
 * PROVISIONAL (spec 4354: not specified) — 4281 names the parts in words only; these field names are ours.
 */
export interface AdvisePlanSum {
  companyCost: number
  fees: number
  waiting: number
  cover: number
  split: number
  total: number
}

export interface AdvisePlan {
  goal: PlanGoal
  /** The other goals this same plan answers ("Recommended · also fewest deliveries"). */
  alsoGoals: PlanGoal[]
  label: Bilingual
  promise: AdvisePromise
  bestFound: boolean
  fallback: boolean
  trialSet: boolean
  totals: { shipments: number; linesServed: number; fee: number; companyCost: number }
  shipments: AdviseShipment[]
  lineMarks: AdviseLineMark[]
  missingLines: AdviseMissingLine[]
  /** The middle level and up. */
  sum?: AdvisePlanSum
}

export interface AdviseNoPlan extends Bilingual {
  goal: PlanGoal
  code: NoPlanCode | string
  /** For the pick-up goal: the lines no single store holds together. */
  lines?: number[]
}

export interface AdviseHiddenPlan {
  goal: PlanGoal
  code: HiddenPlanCode | string
  /** The goal it lost to. */
  as?: PlanGoal
  minutesApart?: number
  riyalsApart?: number
  /** With `allPlans`: the plan itself. PROVISIONAL (spec 4354: not specified) — 4281 says "each also holds the plan itself" without a field name. */
  plan?: AdvisePlan
}

/**
 * A pin the run refused before the solve (4281 decision 24; BackOffice 4359): the pin as sent, its code (`PIN_PAIR_REMOVED`,
 * `PIN_NO_STOCK`, `PIN_NO_STOCK_ROW`, `PINS_CLASH`) and the figures behind it — for a removed pair the filter step and its
 * code and the rule; for pins that clash together, the pins and the rule they break.
 */
export interface AdviseRefusedPin {
  pin?: AdvisePin
  /**
   * For `PINS_CLASH`: the pins that clash together.
   * PROVISIONAL (spec 4354: not specified) — 4281 says a clash carries "the pins and the rule they break" without a field
   * name; `pins` is ours.
   */
  pins?: AdvisePin[]
  code: 'PIN_PAIR_REMOVED' | 'PIN_NO_STOCK' | 'PIN_NO_STOCK_ROW' | 'PINS_CLASH' | string
  step?: number | string | null
  stepCode?: string | null
  rule?: string | null
}

/** The same run without its pins, at the plans-only level (4281 decision 24), only when pins were sent. */
export interface AdviseWithoutPins {
  plans: AdvisePlan[]
  noPlan?: AdviseNoPlan[]
  hiddenPlans?: AdviseHiddenPlan[]
}

export interface AdviseReplyLine {
  lineNo: number
  item: string
  quantity: number
  unit: string
  namedStore?: string | null
  namedBy?: string | null
}

/**
 * The reply's `data`: the run record at the level asked. The middle and full levels' parts (`inputs`, `filterSteps`,
 * `used`, `search`) are typed as their tickets read them (963–966); 962 reads the header, `solve`, the plans and what
 * stands beside them.
 */
export interface AdviseReply {
  runId: string
  formatVersion: number
  engine: { name: string; version: string }
  kind: 'HAND_BUILT' | 'REPLAY' | 'REPLAY_MOVED_POINT' | 'CHECKOUT' | 'COMPARISON' | string
  level: 'plans' | 'reasons' | 'full'
  ranAt: string
  plannedFor: string
  madeBy: string
  channel: string
  orderNumber?: string | null
  orderRef?: string | null
  cartRef?: string | null
  weightSet: AdviseWeightSetUsed
  basedOnRun?: string | null
  figuresReadAt?: string | null
  held?: { until: string } | null
  solve: AdviseSolve
  lines: AdviseReplyLine[]
  plans: AdvisePlan[]
  noPlan: AdviseNoPlan[]
  hiddenPlans: AdviseHiddenPlan[]
  refusedPins: AdviseRefusedPin[]
  /** Only when pins were sent: the run without them, at the plans-only level. */
  withoutPins?: AdviseWithoutPins | null
  /** On `NO_PLAN_POSSIBLE`: a reason for every line. */
  missingLines?: AdviseMissingLine[]
  inputs?: AdviseInputs
  filterSteps?: AdviseFilterStep[]
  used?: AdviseUsedFactor[]
  search?: AdviseSearch
  customerPoint?: AdvisePoint | null
  customerPointWithheld?: CustomerPointWithheld | string | null
  /** On a replay (964): what routing did with the order. See {@link AdviseWhatHappened}. */
  whatHappened?: AdviseWhatHappened | null
}

/**
 * What the simulator's workbench reads before a run: Google's key for the map the customer is placed on.
 * PROVISIONAL (spec 4354: not specified) — no key source is decided for the advisor (the advise reply carries no
 * `maps` part); `GET SourcingAdvisor/Workbench` is our name for a door that would carry one.
 */
export interface SimulatorWorkbench {
  maps?: { key: string; mapId?: string } | null
}

// ── The weight-set doors (ticket 963; BackOffice 4360) ──────────────────────────────────────────

/**
 * One weight set in the list the simulator's picker reads (BackOffice 4360: "list sets and versions").
 * PROVISIONAL (spec 4354: not specified) — 4360 names the doors but not their paths or replies; every field is ours.
 */
export interface WeightSetListItem {
  name: string
  /** The set's owner; null for the baseline set, which belongs to nobody. */
  owner: string | null
  /** Its saved versions, oldest first. */
  versions: number[]
  /** The version marked as the candidate set, when one of this set's is. */
  candidateVersion: number | null
  /** A set with a what-if on planner data: runs under a banner, never the candidate. */
  trial: boolean
}

/**
 * One saved version, read whole (BackOffice 4360: "read a version").
 * PROVISIONAL (spec 4354: not specified) — the reply's shape is ours.
 */
export interface WeightSetVersion extends WeightSetVersionRef {
  values: WeightSetValues
  candidate: boolean
  trial: boolean
}

/**
 * "Save as a named set" (BackOffice 4360: any holder of the save grant copies any version under a new name).
 * PROVISIONAL (spec 4354: not specified) — the body's shape is ours. The reply names the version saved.
 */
export interface WeightSetSaveRequest {
  name: string
  basedOn: WeightSetVersionRef
  values: WeightSetValues
}

// ── The middle and full levels' parts "why this plan" and "what the run used" read (ticket 965) ────────────────────
// 4281 decisions 26 and 27 and its worked example name what is not marked. BackOffice 4363 (money), 4366 (promise),
// 4386 (store record, slot costs) and 4379 (levels, `used[]`) build them; reconcile here when they land.

/** One part of a shipment's company's cost (4281 decision 26): `DELIVERY_RATE`, `HANDLING`, `STORE_RECORD`, `NO_STOCK`, `SLOT_LOAD`, `SLOT_TIMING`. */
export interface AdviseCostPart {
  part: string
  amount: number
  /** A source code: `MEASURED`, `FINANCE`, `ASSUMED`, `STEADIED`, `WEIGHT_SET`, … */
  source: string
}

/** A promise figure in minutes, usual and cautious, with its source (4281's `madeReady`). */
export interface AdvisePromiseFigure {
  usual: number
  cautious: number
  source: string
}

/** A lengthener (4366): its band and the minutes it adds to the usual and to the cautious figure. */
export interface AdviseLengthener {
  /** `DELIVERIES_WAITING` (4281); `BASKET_LINES` and `HOUR_OF_DAY` are PROVISIONAL (spec 4354: not specified). */
  name: string
  band: string
  usual: number
  cautious: number
}

/**
 * One of the store's next two listed slots, worked out beside the slot a plan takes (4386).
 * PROVISIONAL (spec 4354: not specified) — 4386 names the content (slot load, slot timing, the price of waiting to its
 * end), no field names.
 */
export interface AdviseNextSlot {
  code: string
  from: string
  to: string
  /** The balanced sum the plan would have had on this slot. */
  sum: number
}

export interface AdviseSlotTaken {
  code: string
  from: string
  to: string
  source: string
  /** The earlier slots passed over and why (`INSIDE_LEAD`, 4281; `NOT_ACTIVE` is PROVISIONAL (spec 4354: not specified)). */
  skipped: { from: string; why: string }[]
  /** PROVISIONAL (spec 4354: not specified) — the next two listed slots (4386). */
  next?: AdviseNextSlot[]
  /** PROVISIONAL (spec 4354: not specified) — 4386's mark "a later slot's sum was lower"; no plan takes that slot. */
  laterCheaper?: boolean
}

/** Each part of a shipment's promise (4281 decision 26: usual and cautious, with source; lengtheners; margin; pick end; slot). */
export interface AdvisePromiseParts {
  pickEnd: string
  /**
   * PROVISIONAL (spec 4354: not specified) — which rule set the pick end (spec §7): `CAUTIOUS_MADE_READY`,
   * `HALF_WAY_TO_SLOT`, `SLOT_START`, `FOUR_HOURS`, `STORE_CLOSES`.
   */
  pickEndRule?: string
  /** PROVISIONAL (spec 4354: not specified) — the usual time, shown and never planned on (model ticket 4243). */
  usualBy?: string
  madeReady?: AdvisePromiseFigure
  /** PROVISIONAL (spec 4354: not specified) — Dawaa Now's courier wait (spec §7). */
  courierWait?: AdvisePromiseFigure
  /** PROVISIONAL (spec 4354: not specified) — Dawaa Now's travel; its source says road, callout km or straight line. */
  travel?: AdvisePromiseFigure
  /** PROVISIONAL (spec 4354: not specified) — the one margin for all three parts (4281 says "the margin"). */
  margin?: { minutes: number; source: string }
  /** PROVISIONAL (spec 4354: not specified) — pick-up's target in minutes (4366: 30, a system setting). */
  target?: number
  lengtheners: AdviseLengthener[]
  slot?: AdviseSlotTaken | null
}

/**
 * One measure of a store's record for one mode (4281's `record.SLOT.late`). Measures other than `late` —
 * `returned`, `cancelled`, `neverMadeReady`, `calloutIgnored`, `readyLate` — are PROVISIONAL (spec 4354: not specified).
 */
export interface AdviseRecordMeasure {
  rate: number
  likeStores: number
  count: number
  /** `STEADIED`, `STORES_OWN`, `LIKE_STORES` or `NEUTRAL_DEFAULT`. */
  source: string
  /** PROVISIONAL (spec 4354: not specified) — the measure's cost (a credit below zero), 4386's per-measure figure. */
  cost?: number
}

/** A store the run read (4281 decision 26, `inputs.stores[]`). */
export interface AdviseStoreInput {
  store: string
  name: string
  point?: AdvisePoint | null
  km?: number | null
  kmKind?: string | null
  deliveriesWaiting?: number
  madeReady?: Record<string, AdvisePromiseFigure>
  /** Per mode, per measure. */
  record?: Record<string, Record<string, AdviseRecordMeasure>>
}

/** The run's inputs (4281 decision 26). The parts no screen reads yet stay untyped. */
export interface AdviseInputs {
  stores?: AdviseStoreInput[]
  storeLines?: AdviseStoreLine[]
  [part: string]: unknown
}

/**
 * How a factor ran (4281 decision 26). `REAL_DATA` and `SWITCHED_OFF` are 4281's; the other two states are named in
 * prose only — `NEUTRAL_DEFAULT` and `ASSUMED` are PROVISIONAL (spec 4354: not specified), taken from the source codes.
 */
export const USED_STATES = ['REAL_DATA', 'NEUTRAL_DEFAULT', 'ASSUMED', 'SWITCHED_OFF'] as const
export type UsedState = (typeof USED_STATES)[number]

export interface AdviseUsedFactor {
  /** `DELIVERIES_WAITING`, `RIDERS_AVAILABLE` (4281); every other factor code is PROVISIONAL (spec 4354: not specified). */
  factor: string
  state: UsedState | string
  /** A source code, or the server's own words ("live count, 38 seconds old"). */
  source: string
  /**
   * PROVISIONAL (spec 4354: not specified) — how the factor enters, the model ticket's "role":
   * `FILTER`, `OFFERED_STOCK`, `PROMISE`, `COST`, `RULE`.
   */
  entersAs?: string
}

// ── The middle and full levels' parts the solver tab reads (ticket 966; 4281 decisions 26–27, the run record 4242) ──

/**
 * A pair a filter step removed (4281's worked example, middle level): the store and the mode, and the figures the rule
 * judged on — the distance and the reach for `OUT_OF_REACH`, the line, the offered stock and the quantity asked for a
 * stock step. Which figures come depends on the code.
 */
export interface AdviseRemovedPair {
  store: string
  mode: DeliveryMode | string
  lineNo?: number
  km?: number
  kmKind?: 'ROAD' | 'STRAIGHT_LINE' | string
  reachKm?: number
  offered?: number
  asked?: number
  stockClass?: string
}

/**
 * One filter step, or the cut (`step: "CUT"`, code `OVER_PAIR_CAP`, with the `cap`), in the order the run took them
 * (spec 4354 §4): the pairs standing before and after, and each pair removed with its code and figures. The full level
 * lists every store out of reach, each with its km.
 */
export interface AdviseFilterStep {
  step: number | 'CUT'
  code: string
  before: number
  after: number
  /** On the cut only: the most pairs a run keeps (a weight-set value, 100). */
  cap?: number
  removed: AdviseRemovedPair[]
}

/** Per store and line (the middle level, `inputs.storeLines[]`): the stock working the solver planned on (spec 4354 §5). */
export interface AdviseStoreLine {
  store: string
  lineNo: number
  tillStock: number
  sapStock: number
  heldByOrders: number
  heldByDeliveries: number
  /** The stock read's figure after open demand, floored at zero: the starting figure. */
  atp: number
  buffer: number
  confidence: number
  /** That figure × the confidence, rounded, less the buffer, never below zero. The solver plans on this. */
  offered: number
  /** Shown only; plans nothing. */
  expectedAtPickEnd: number
  stockClass: string
  row: number
  cost: number
}

/** One of a kept plan's shipments: the pair and the lines it carries. */
export interface AdviseKeptShipment {
  store: string
  mode: DeliveryMode | string
  lines: number[]
}

/**
 * One of the best plans kept for a goal (the full level, `search.kept[]`; 50 per goal, a system setting): its rank,
 * its balanced total (`sum`), what it lost by against the goal's winner and the part that cost it most.
 * The run record (BackOffice 4242) says each kept plan also has its promise, fee, company's cost and price of waiting;
 * 4281's example shows none of them, so those four names are ours.
 */
export interface AdviseKeptPlan {
  goal: PlanGoal
  rank: number
  sum: number
  lostBy: number
  /** A balanced-sum part (`WAITING` in 4281's example). Absent on the goal's winner. */
  lostMostOn?: string | null
  shipments: AdviseKeptShipment[]
  /** PROVISIONAL (spec 4354: not specified) — the last shipment's promise time, `yyyy-MM-dd HH:mm:ss`. */
  promiseBy?: string
  /** PROVISIONAL (spec 4354: not specified) — the customer's fee for the whole plan. */
  fee?: number
  /** PROVISIONAL (spec 4354: not specified) — the company's cost for the whole plan. */
  companyCost?: number
  /** PROVISIONAL (spec 4354: not specified) — the price of waiting. */
  waiting?: number
}

/**
 * "Why not" for one pair and goal (4281 decision 27): the best plan through the pair and the difference part by part,
 * or the filter step that removed it and its code.
 */
export interface AdviseWhyNot {
  store: string
  mode: DeliveryMode | string
  goal?: PlanGoal
  sum?: number
  difference?: { part: string; amount: number }[]
  removedAt?: number | string
  code?: string
}

/** The search counts: plans checked; branches cut by the shipment cap, by mixing pick-up with delivery and by pins. */
export interface AdviseSearchCounts {
  plansChecked: number
  cutByShipmentCap: number
  cutByMixing: number
  cutByPins: number
}

/** The full level's search (4281 decision 27). */
export interface AdviseSearch {
  counts?: AdviseSearchCounts
  kept?: AdviseKeptPlan[]
  whyNot?: AdviseWhyNot[]
}

// ── The replay (ticket 964; BackOffice 4381) ────────────────────────────────────────────────────

/**
 * The order form of the request (4281 decision 11): `orderNumber` alone replays that order on today's figures; with
 * `customer.point` beside it the replay plans from that point (kind `REPLAY_MOVED_POINT`). `withCustomerPoint` asks for
 * the order's real point back (4281 decision 17).
 */
export interface AdviseReplayRequest {
  orderNumber: string
  customer?: { point: AdvisePoint }
  level: 'plans' | 'reasons' | 'full'
  allPlans?: boolean
  withCustomerPoint?: boolean
}

/** Why the reply holds no customer's point (4281 decision 17). Never an error. */
export const CUSTOMER_POINT_WITHHELD = ['NO_GRANT', 'NOT_A_REPLAY', 'NOT_FULL_LEVEL'] as const
export type CustomerPointWithheld = (typeof CUSTOMER_POINT_WITHHELD)[number]

/**
 * "What happened" on a replay (BackOffice 4381: "the store and mode routing chose, when it was delivered, late or not,
 * the fee"): the order's real deliveries, joined when shown (4244), with the totals sent beside their parts.
 * PROVISIONAL (spec 4354: not specified) — 4381 names the facts in words only; every field name here is ours.
 */
export interface AdviseWhatHappened {
  /** When the order was placed, local. PROVISIONAL (spec 4354: not specified). */
  placedAt: string
  deliveries: AdviseWhatHappenedDelivery[]
  /** PROVISIONAL (spec 4354: not specified). */
  totals: { deliveries: number; fee: number }
}

/** One real delivery of the replayed order. PROVISIONAL (spec 4354: not specified) — every field name is ours. */
export interface AdviseWhatHappenedDelivery {
  /** The delivery document's number. */
  delivery: string
  store: string
  storeName: string
  mode: DeliveryMode | string
  /** The end of what it was promised by (a slot's end), local; null when none was recorded. */
  promisedBy: string | null
  /** When it was delivered, local; null while it is not. */
  deliveredAt: string | null
  /** Null while it is not delivered. */
  late: boolean | null
  minutesLate: number | null
  /** The fee the customer paid for it. */
  fee: number
}
