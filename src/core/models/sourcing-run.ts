/**
 * The advise door's wire (BackOffice spec 4354 §11; the door ticket 4281; built by BackOffice 4355–4381).
 * `POST SourcingAdvisor/Advise` on the user's route: the simulator sends a cart, an order to replay or an earlier run,
 * and the reply's `data` is the run record cut to the level asked (`RunRecord`, `Services/SIS.Api/SourcingAdvisor/Record`).
 *
 * Reconciled with BackOffice 4355–4381 at pricing2 35a4e56be: every name here is the server's (`[JsonPropertyName]` on
 * `RunRecord`, `RunRecordParts`, `RunInputs`, `AdviseRequest`). The record is written with `RecordJson.Options`: camelCase,
 * a null is LEFT OUT (so every nullable field is optional here), and every time is local wall clock
 * `yyyy-MM-dd HH:mm:ss` with no zone. A filter step is a number on the wire, or `"CUT"`.
 *
 * In `@/core/models/` because the simulator (962–969) and the comparison results page (971–973) both read run records,
 * and a feature may never import another. Every amount is riyals to three decimals, every distance km to one decimal.
 * Every total is sent with its parts, as rounded: no reader adds up for itself (4281 decision 28).
 */

/** A sentence the server writes in both languages (the promise, a line not available, a goal with no plan). */
export interface Bilingual {
  en: string
  ar: string
}

/** The five plan goals, in the order the screen lists them (spec 4354 §3; server `PlanGoals`). */
export const PLAN_GOALS = ['BALANCED', 'FASTEST', 'FEWEST', 'CHEAPEST', 'PICK_UP'] as const
export type PlanGoal = (typeof PLAN_GOALS)[number]

/** The delivery modes, in the server's order (`DeliveryModes.All`). */
export const DELIVERY_MODES = ['DAWAA_NOW', 'SLOT', 'CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY', 'BEYOND_BORDER', 'PICK_UP'] as const
export type DeliveryMode = (typeof DELIVERY_MODES)[number]

/** How a solve ended (`SolveEndings`). Each is a normal reply. */
export const SOLVE_ENDINGS = ['PROVEN_BEST', 'BEST_FOUND', 'NO_PLAN_POSSIBLE', 'FALLBACK_ANSWERED'] as const
export type SolveEnding = (typeof SOLVE_ENDINGS)[number]

/** Why a plan is not shown (`PlanCodes`, plan family). The screen writes the sentence. */
export const HIDDEN_PLAN_CODES = ['NEARLY_SAME', 'WORSE_ON_EVERYTHING', 'OVER_MOST_SHOWN'] as const
export type HiddenPlanCode = (typeof HIDDEN_PLAN_CODES)[number]

/** Why a goal has no plan (`PlanCodes`). The server writes the sentence too. */
export const NO_PLAN_CODES = ['GOAL_OFF', 'NO_PAIR_FOR_GOAL', 'NO_SINGLE_STORE', 'PINS_CLASH', 'FALLBACK_ANSWERED'] as const
export type NoPlanCode = (typeof NO_PLAN_CODES)[number]

/**
 * The door's fifteen errors (`AdviseErrors`), each with its true HTTP status. The messages are English for developers
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

export type ReplyLevel = 'plans' | 'reasons' | 'full'

// ── The request (`AdviseRequest`, read strictly: a field it does not know is `ADVISE-400`) ──────────────────────

export interface AdvisePoint {
  lat: number
  lng: number
}

/** One cart line. `lineNo` is unique in the request; `quantity` is above zero; `unit` is required. */
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
 * The cart form of the request: `channel`, `lines` and a place to plan for (the customer's point, a district or a store
 * to collect from; none is `ADVISE-422`), with the user route's own fields.
 */
export interface AdviseCartRequest {
  channel: string
  lines: AdviseCartLine[]
  customer: AdviseCustomer
  goodsTotal?: number
  collectFrom?: string
  /** The local time to plan for, `yyyy-MM-dd HH:mm:ss`. Absent means now. */
  plannedFor?: string
  level: ReplyLevel
  allPlans?: boolean
  /** The pins (BackOffice 4359). Each applies to every goal of the run. */
  pins?: AdvisePin[]
  /** The weight set (BackOffice 4360): a saved version or the simulator's draft in full. Absent: the candidate set. */
  weightSet?: AdviseWeightSetRef
}

/**
 * The five pins (`PinKinds`; BackOffice 4359), each with exactly the fields its kind takes. A pin applies to every
 * goal of the run, is never loosened silently and never overrides a filter or a rule; one that cannot hold is refused
 * before the solve and listed in `refusedPins`.
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
 * panel edits are ours (`WEIGHT_CONTROLS` in `@/core/sourcing-advisor/weight-controls`).
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
 * The earlier-run form (BackOffice 4380, `AdviseRequestCheck.CheckBasedOnRun`): plan again on the figures of a held
 * (the caller's own) or stored run, with only `weightSet`, `pins`, `level` and `allPlans` beside it. No outside read and
 * no stock read; a change that needs a figure the run never read is read afresh as a new run (`READ_AFRESH`, with
 * `readAfresh` in the reply). A cart's field beside it is `ADVISE-400`.
 */
export interface AdviseRerunRequest {
  basedOnRun: string
  weightSet?: AdviseWeightSetRef
  pins?: AdvisePin[]
  level: ReplyLevel
  allPlans?: boolean
}

// ── The reply (`RunRecord`) ──────────────────────────────────────────────────────────────────────

export interface AdviseWeightSetUsed {
  name: string
  version: number
  candidate: boolean
  trial: boolean
  draft: boolean
  /** For a draft only: the saved version it was changed from. */
  basedOn?: WeightSetVersionRef
}

/** The time of each stage, in whole milliseconds. */
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

/** One assumed money row a run used (BackOffice 4363): its part (`MoneyRowCodes`), the mode or channel, its source. */
export interface AdviseAssumedRow {
  part: string
  mode?: string
  channel?: string
  source: string
}

export interface AdviseSolve {
  ending: SolveEnding
  /** For the fallback: what failed in the search. */
  why?: string
  plansChecked: number
  workBudget: number
  pairs: { beforeCut: number; cut: number; offered: number }
  ms: AdviseStageTimes
  stoodIn: { read: string; why: string; standIn: string }[]
  /** The run's marks (`RunMarks`): `ROAD_NOT_MEASURED`, `ASSUMED_RATES`, `READ_AFRESH`, `NOT_HELD`, … */
  marks: string[]
  /** Every assumed money row the shown plans stand on, once each; absent when none (BackOffice 4363). */
  assumed?: AdviseAssumedRow[]
}

export interface AdvisePromise extends Bilingual {
  /** The last shipment's promise time. */
  by: string
}

export interface AdviseShipmentPromise extends Bilingual {
  /** `PromiseKinds`: `BY`, `BETWEEN`, `READY_BY`. */
  kind: 'BY' | 'BETWEEN' | 'READY_BY' | string
  from?: string
  by: string
}

export type FeeSource = 'MEASURED' | 'FINANCE' | 'ASSUMED' | string

/** A carrier shipment's contract row (BackOffice 4361), and whether the row is an assumption. */
export interface AdviseShipmentContract {
  contract: string
  courier: string
  cutOff: string
  assumed: boolean
}

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
  /** Absent when the store or the customer has no point. */
  km?: number
  /** `ROAD`, `CALLOUT_KM` or `STRAIGHT_LINE`. */
  kmKind: string
  contract?: AdviseShipmentContract
  /** `ShipmentMarks`: `NO_LOCATION`, `NO_TOTAL`, `LATER_SLOT_CHEAPER`. Absent when none. */
  marks?: string[]
  /** The middle level and up: each part of the company's cost, with its source; they add up to `companyCost`. */
  costParts?: AdviseCostPart[]
  /** The middle level and up: the promise in its parts (`InputPromiseParts`). */
  promiseParts?: AdvisePromiseParts
  /** The middle level and up (BackOffice 4376): the no-stock cost, part of `companyCost`. */
  noStockCost?: number
  /** The middle level and up (BackOffice 4386): the store record cost with a line per measure. */
  storeRecord?: AdviseStoreRecordCost
  /** The middle level and up (BackOffice 4386): slot delivery's slot taken and the store's next listed slots. */
  slotCosts?: AdviseSlotCosts
  /** The middle-level parts no screen reads yet (`shelfChances`, `storeCount`). */
  shelfChances?: unknown[]
  storeCount?: unknown
}

/** The six figures behind a mark. The two held figures are absent when the stock service could not split them. */
export interface AdviseLineFigures {
  tillStock: number
  sapStock?: number
  heldByOrders?: number
  heldByDeliveries?: number
  shown: number
  asked: number
  splitUnknown?: boolean
}

/** A line planned with a mark (`LineCodes`; today `FIGURE_SHORT`), at every level. */
export interface AdviseLineMark {
  lineNo: number
  code: 'FIGURE_SHORT' | string
  store: string
  mode: string
  stockClass: string
  figures: AdviseLineFigures
  row: number
  factor: number
  chance: number
  cost: number
}

/** A line not on a plan (or, on `NO_PLAN_POSSIBLE`, at the top of `data`), with the server's sentence. */
export interface AdviseMissingLine extends Bilingual {
  lineNo: number
  code: string
  bestStore?: string
  bestStoreUnits?: number
  asked?: number
  stockClass?: string
  pairsCut?: number
}

/**
 * The balanced sum in its parts (`RecordSum`, the middle level): the company's cost and the customer's fees, each held
 * as it counts (times its weight), the price of waiting, the cover cost, the split penalty, and the total they add to.
 */
export interface AdvisePlanSum {
  companyCostWeight: number
  feeWeight: number
  companyCost: number
  fees: number
  waiting: number
  cover: number
  splitPenalty: number
  total: number
}

export interface AdvisePlanTotals {
  shipments: number
  linesServed: number
  fee: number
  companyCost: number
  /** The company's cost less the customer's fees, shown and ranking nothing (BackOffice 4363). */
  companyNet: number
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
  /** The plan's marks (BackOffice 4362), e.g. `RANGE_NOT_CONFIRMED`. Absent when none. */
  marks?: string[]
  totals: AdvisePlanTotals
  shipments: AdviseShipment[]
  lineMarks: AdviseLineMark[]
  missingLines: AdviseMissingLine[]
  /** The middle level and up. */
  sum?: AdvisePlanSum
}

export interface AdviseNoPlan extends Bilingual {
  goal: PlanGoal
  code: NoPlanCode | string
  /** With `NO_SINGLE_STORE`: the lines no single store holds together. */
  lines?: number[]
}

export interface AdviseHiddenPlan {
  goal: PlanGoal
  code: HiddenPlanCode | string
  /** The goal it lost to. */
  as?: PlanGoal
  minutesApart?: number
  riyalsApart?: number
  /** With `allPlans`: the plan itself. */
  plan?: AdvisePlan
}

/**
 * A pin the run refused before the solve, or pins that clash together on some goals (`RecordRefusedPin`): the pin as
 * sent (`pin`) or the pins that clash (`pins`), its code (`PinCodes`) and the figures behind it — for a removed pair the
 * filter step (absent at the cut) and its code, the pair, a product rule's id and sentence; for no stock the units
 * offered and asked; for a clash the rule they break and the goals left without a plan.
 */
export interface AdviseRefusedPin {
  pin?: AdvisePin
  pins?: AdvisePin[]
  code: 'PIN_PAIR_REMOVED' | 'PIN_NO_STOCK' | 'PIN_NO_STOCK_ROW' | 'PINS_CLASH' | string
  step?: number
  stepCode?: string
  store?: string
  mode?: string
  units?: number
  asked?: number
  rule?: string
  goals?: string[]
  en?: string
  ar?: string
}

/** The same run without its pins, at the plans-only level, only when pins were sent. */
export interface AdviseWithoutPins {
  solve: AdviseSolve
  plans: AdvisePlan[]
  noPlan: AdviseNoPlan[]
  missingLines?: AdviseMissingLine[]
}

export interface AdviseReplyLine {
  lineNo: number
  item: string
  quantity: number
  unit: string
  /** The quantity in the stock read's unit, when it differs (a part-pack line, BackOffice 4381). */
  stockQuantity?: number
  namedStore?: string
  /** `NamedByCodes`: `REQUEST`, `COLLECT_FROM`, `DELIVERY`, `PIN`. */
  namedBy?: string
}

/** A run asked as `basedOnRun` whose change needed a figure that run never read, so it was read afresh (BackOffice 4380). */
export interface AdviseReadAfresh {
  /** The run named in `basedOnRun`. */
  fromRun: string
  /** Each change that needed a new read (`AfreshReasons`): `MODE_SWITCHED_ON`, `REACH_WIDENED`, `PAIR_CAP_RAISED`, `PIN_ONTO_CUT_PAIR`. */
  why: string[]
}

/** Only on a stored run opened again (BackOffice 4380): the engine that solved it again, and whether it plans the same. */
export interface AdviseOpenedAgain {
  engine: { name: string; version: string }
  /** False when today's engine answers with other plans than the stored ones (the stored plans are shown). */
  samePlans: boolean
}

/**
 * The reply's `data`: the run record at the level asked. `inputs`, `filterSteps` and `used` come from the middle level
 * up, `search` at the full level only.
 */
export interface AdviseReply {
  runId: string
  formatVersion: number
  engine: { name: string; version: string }
  kind: 'HAND_BUILT' | 'REPLAY' | 'REPLAY_MOVED_POINT' | 'CHECKOUT' | 'COMPARISON' | string
  level: ReplyLevel
  ranAt: string
  plannedFor: string
  madeBy: string
  channel: string
  orderNumber?: string
  orderRef?: string
  cartRef?: string
  weightSet: AdviseWeightSetUsed
  /** On a run planned again on the same figures: the run whose figures it solved, and when they were read. */
  basedOnRun?: string
  figuresReadAt?: string
  /** A `basedOnRun` read afresh instead (with the solve mark `READ_AFRESH`). */
  readAfresh?: AdviseReadAfresh
  /** When the door stops holding the run; absent when it is not held. */
  held?: { until: string }
  /** Only on a stored run opened again. */
  openedAgain?: AdviseOpenedAgain
  solve: AdviseSolve
  lines: AdviseReplyLine[]
  plans: AdvisePlan[]
  noPlan: AdviseNoPlan[]
  hiddenPlans: AdviseHiddenPlan[]
  refusedPins: AdviseRefusedPin[]
  /** Only when pins were sent: the run without them, at the plans-only level. */
  withoutPins?: AdviseWithoutPins
  /** On `NO_PLAN_POSSIBLE`: a reason for every line. */
  missingLines?: AdviseMissingLine[]
  inputs?: AdviseInputs
  filterSteps?: AdviseFilterStep[]
  used?: AdviseUsedFactor[]
  search?: AdviseSearch
  /** Reply only (BackOffice 4381): the customer's real point (a replay, the full level, the customer-point grant), or the pin moved by hand. */
  customerPoint?: AdvisePoint
  /** Reply only: why the point asked for is not given. Never an error. */
  customerPointWithheld?: CustomerPointWithheld | string
  /** Reply only, on a replay of the order's own point (BackOffice 4381): its deliveries as they happened. */
  whatHappened?: AdviseWhatHappened[]
}

/**
 * What the simulator's workbench reads before a run: Google's key for the map the customer is placed on.
 * SERVER GAP (spec 4354) — the server has no key door for the advisor: BackOffice serves the browser key only inside
 * the analytics and insurance models (`AnalyticsMapsInfo`), each behind its own grant. `GET SourcingAdvisor/Workbench`
 * does not exist; until BackOffice adds a door the map cannot draw and the screen shows its table.
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
  /**
   * What the weight-set list (ticket 967) shows beyond the picker: the owner's note, the retired mark, and each
   * version's saver, time and "line saying what changed" (BO 4360's set and version tables). Optional, so a reply
   * without them still serves the simulator's picker.
   * PROVISIONAL (spec 4354: not specified) — the fields.
   */
  note?: string | null
  /** Retired, never deleted: kept for the runs that used it, never offered again (spec 4354 §10). */
  retired?: boolean
  saved?: WeightSetSavedVersion[]
}

/** One version's row in the list (BO 4360's version table). PROVISIONAL (spec 4354: not specified) — every field. */
export interface WeightSetSavedVersion {
  version: number
  /** Who saved it; null for the baseline set's seed. */
  savedBy: string | null
  /** Local wall clock `yyyy-MM-dd HH:mm:ss`. */
  savedAt: string
  /** The line saying what changed. */
  change: string | null
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

// ── The middle and full levels' parts (BackOffice 4363, 4365, 4366, 4376, 4379, 4386) ───────────────────────────

/** One part of a shipment's company's cost (`CostPartCodes`), with its source (`SourceCodes`). */
export interface AdviseCostPart {
  part: string
  amount: number
  source: string
}

/** A promise figure in minutes, usual and cautious, with its source (`InputPromisePart`). */
export interface AdvisePromiseFigure {
  usual: number
  cautious: number
  source: string
}

/** Dawaa Now's travel part: the figure, and the line it stands on (km, its kind, fixed + per km, the run-over). */
export interface AdviseTravelFigure extends AdvisePromiseFigure {
  km: number
  kmKind: string
  fixed: number
  perKm: number
  runOver: number
}

/** The lengtheners (`Solver.Lengtheners`). */
export const LENGTHENERS = ['DELIVERIES_WAITING', 'BASKET_LINES', 'HOUR_OF_DAY'] as const

/**
 * One lengthener as the promise read it (BackOffice 4366): the value read and the start of its band, the minutes it
 * added to the usual and the cautious figure, and its state — `ADDS`, `NO_EFFECT`, `NO_BANDS`, `OFF` or `NOT_READ`.
 */
export interface AdviseLengthener {
  lengthener: string
  value?: number
  bandFrom?: number
  usual: number
  cautious: number
  state: string
}

/** A listed slot not taken: `INACTIVE`, `INSIDE_LEAD` or `BEFORE_READY`. */
export interface AdviseSkippedSlot {
  code?: string
  from: string
  why: string
}

/** The slot a slot delivery promises, and the listed slots it skipped (BackOffice 4364). */
export interface AdviseSlotTaken {
  code?: string
  from: string
  to: string
  /** `HYBRIS` or `RULE_TABLE`. */
  source: string
  skipped: AdviseSkippedSlot[]
}

/** The promise in its parts (`InputPromiseParts`; the wire's `shipments[].promiseParts`). */
export interface AdvisePromiseParts {
  /** Not rounded. */
  pickEnd: string
  madeReady?: AdvisePromiseFigure
  courierWait?: AdvisePromiseFigure
  travel?: AdviseTravelFigure
  /** The one margin, after the multiplier, in minutes. */
  margin: number
  marginMultiplier: number
  /** The usual figures added plus the margin, before rounding. */
  unroundedMinutes: number
  /** The promise: the unrounded minutes up to the next 5. */
  minutes: number
  /** Slot delivery only. */
  slot?: AdviseSlotTaken
  /** When the pick starts, when not at the time planned for (a store closed now). */
  pickStart?: string
  /** Pick-up only: the target, a system setting (30 minutes). */
  target?: number
  /** Absent on a record from before BackOffice 4366. */
  lengtheners?: AdviseLengthener[]
}

/** One measure of a shipment's store record cost (`RecordStoreRecordLine`): failure price × (steadied − expected). */
export interface AdviseStoreRecordLine {
  /** `StoreRecordMeasures`: `LATE`, `RETURNED`, `CANCELLED`, `NEVER_READY`, `READY_LATE`, `CALLOUT_IGNORED`. */
  measure: string
  /** `STEADIED`, `NEUTRAL_DEFAULT` (no counted delivery: costs nothing) or `SWITCHED_OFF`. */
  source: string
  badEndings: number
  deliveries: number
  storeRate: number
  likeRate: number
  expectedRate: number
  steadiedRate: number
  failurePrice: number
  /** Below zero, a credit. */
  cost: number
}

/** A shipment's store record cost (BackOffice 4386): the sum of its measures' lines. */
export interface AdviseStoreRecordCost {
  cost: number
  steadyingCount: number
  lines: AdviseStoreRecordLine[]
}

/** One slot of a slot delivery's slot costs (`RecordSlotCost`). */
export interface AdviseSlotCost {
  code?: string
  from: string
  to: string
  taken: boolean
  standing?: number
  usualSlot?: number
  load?: number
  loadPoints: number
  loadCost: number
  loadSource: string
  hoursToSlot: number
  hoursBand: string
  place: string
  returnedPoints: number
  latePoints: number
  timingCost: number
  timingSource: string
  /** The price of waiting to the slot's end. */
  waiting: number
  /** Slot load cost + slot timing cost + the price of waiting. */
  sum: number
}

/** Slot delivery's slot costs (BackOffice 4386): `slots[0]` is the slot taken, the rest the store's next listed slots. */
export interface AdviseSlotCosts {
  centre?: { returned: number; late: number }
  channelGroup: string
  slots: AdviseSlotCost[]
  /** A later slot's sum was lower than the earliest slot's (no plan takes it). */
  laterSlotCheaper: boolean
}

/** A store the run read (`InputStore`). The record carries no store's point: the map reads the store list's. */
export interface AdviseStoreInput {
  store: string
  name: string
  km?: number
  kmKind: string
  shortFigureFactor?: number
  cities?: string[]
}

/** The stock working of one store, item and mode (`RecordStockWorking`, BackOffice 4375 and 4379), written after the solve. */
export interface AdviseStockWorking {
  mode: string
  /** The stock read's figure after open demand, floored at zero. */
  netted: number
  confidence: number
  confidenceSource: string
  afterConfidence: number
  walkInOff?: string
  band: string
  rate: number
  pickEndMinutes?: number
  hours: number
  expected: number
  /** Shown only; plans nothing. */
  expectedAtPickEnd: number
  computedBuffer: number
  overrideUnits?: number
  buffer: number
  /** That figure × the confidence, less the buffer, never below zero. The solver plans on this. */
  offered: number
}

/** Per store and item (`InputStoreLine`, the middle level): the stock read's figures as read, and the working per mode. */
export interface AdviseStoreLine {
  store: string
  item: string
  /** The stock read's figure after open demand (today's ATP), as read. */
  afterOpenDemand: number
  tillStock?: number
  sapStock?: number
  heldByOrders?: number
  heldByDeliveries?: number
  /** The units of the replayed order added back to this pair. */
  addedBack?: number
  working?: AdviseStockWorking[]
}

/** A store's made-ready time for one mode (`InputMadeReady`). */
export interface AdviseMadeReady extends AdvisePromiseFigure {
  store: string
  mode: string
}

/** The run's inputs (`RunInputs`). The parts no screen reads stay untyped. */
export interface AdviseInputs {
  stores?: AdviseStoreInput[]
  storeLines?: AdviseStoreLine[]
  madeReady?: AdviseMadeReady[]
  deliveriesWaiting?: { store: string; count: number }[]
  [part: string]: unknown
}

/** How a factor ran (`UsedStates`). */
export const USED_STATES = ['REAL_DATA', 'NEUTRAL_DEFAULT', 'ASSUMPTION', 'SWITCHED_OFF'] as const
export type UsedState = (typeof USED_STATES)[number]

/** One factor of the run (`RecordUsed`): what it ran on and where that came from. */
export interface AdviseUsedFactor {
  /** `UsedFactors`: `MODES`, `STOCK`, `BUFFER`, `MADE_READY`, `DELIVERY_RATE`, … */
  factor: string
  /** For a factor read per mode (a delivery rate, a fee). */
  mode?: string
  state: UsedState | string
  /** A source code (`SourceCodes`), when one names where the figure came from. */
  source?: string
  /** On real data for some stores and its neutral default for others: how many stores ran on the default. */
  storesOnDefault?: number
}

/**
 * A pair a filter step removed (`RecordRemovedPair`): the pair, the line at a line step, the code when it is not the
 * step's own, and the figures the rule judged on.
 */
export interface AdviseRemovedPair {
  store: string
  mode: DeliveryMode | string
  lineNo?: number
  code?: string
  km?: number
  kmKind?: string
  reachKm?: number
  offered?: number
  asked?: number
  rule?: string
  /** At the cut: `MOST_PAIRS` or `MOST_STORES`. */
  cutBy?: string
  readForTrials?: boolean
}

/** The whole-store steps (1, 2, 4, 5): per mode, the count and the nearest five removed. */
export interface AdviseModeRemovals {
  mode: string
  count: number
  nearest: AdviseRemovedPair[]
}

/**
 * One filter step, or the cut (`step: "CUT"`, code `OVER_PAIR_CAP`, with its `cap`), in the order the run took them:
 * the pairs standing before and after, how many removals it made, and each removal with its figures. Steps 1 and 2 are
 * never listed pair by pair; the whole-store steps carry `byMode`, and list every removal of 4 and 5 at the full level.
 */
export interface AdviseFilterStep {
  step: number | 'CUT'
  code: string
  before: number
  after: number
  cap?: number
  mostStores?: number
  removedCount: number
  byMode?: AdviseModeRemovals[]
  removed?: AdviseRemovedPair[]
  readForTrials?: AdviseRemovedPair[]
}

/** One of a kept plan's shipments: the pair and the lines it carries. */
export interface AdviseKeptShipment {
  store: string
  mode: DeliveryMode | string
  lines: number[]
}

/** A plan as the search priced it (`RecordPricedPlan`). */
export interface AdvisePricedPlan {
  linesServed: number
  /** The last shipment's promise time. */
  by: string
  fee: number
  companyCost: number
  waiting: number
  /** The balanced sum. */
  sum: number
  shipments: AdviseKeptShipment[]
}

/** One of the best plans kept for a goal (`RecordKeptPlan`): rank 1 is the goal's own plan. */
export interface AdviseKeptPlan extends AdvisePricedPlan {
  goal: PlanGoal
  rank: number
  lostBy: number
  /** A sum part (`SumParts`); absent when no part is dearer than the winner's. */
  lostMostOn?: string
}

/**
 * "Why not" one pair (`RecordWhyNot`): for a pair the search was given, per goal, the best plan through it and its
 * difference from the goal's plan part by part (or `SERVES_FEWER` / `NOT_REACHED`); for a pair a step after reach or the
 * cut removed, the step and its code. A pair steps 1 to 5 removed is answered by `filterSteps`.
 */
export interface AdviseWhyNot {
  store: string
  mode: DeliveryMode | string
  goal?: PlanGoal
  removedAt?: number | 'CUT'
  code?: string
  /** The best plan through the pair is the goal's own plan. */
  isPlan?: boolean
  plan?: AdvisePricedPlan
  lostBy?: number
  difference?: { part: string; amount: number }[]
}

/** The search counts: plans checked; branches cut by the shipment cap, by mixing pick-up with delivery and by pins. */
export interface AdviseSearchCounts {
  plansChecked: number
  cutByShipmentCap: number
  cutByMixing: number
  cutByPins: number
}

/** The full level's search. */
export interface AdviseSearch {
  counts: AdviseSearchCounts
  kept: AdviseKeptPlan[]
  whyNot: AdviseWhyNot[]
}

// ── The replay (BackOffice 4381) ────────────────────────────────────────────────────────────────

/**
 * The order form of the request (`AdviseRequestCheck.CheckOrder`): `orderNumber`, the server reads the order's cart;
 * beside it only the pin moved by hand (`customer.point`, kind `REPLAY_MOVED_POINT`), `weightSet`, `pins`, `level`,
 * `allPlans`, `plannedFor` and `withCustomerPoint` (the order's real point back, decision 17).
 */
export interface AdviseReplayRequest {
  orderNumber: string
  customer?: { point: AdvisePoint }
  level: ReplyLevel
  allPlans?: boolean
  withCustomerPoint?: boolean
  pins?: AdvisePin[]
  weightSet?: AdviseWeightSetRef
}

/** Why the reply holds no customer's point (`CustomerPointWithheld`). Never an error. */
export const CUSTOMER_POINT_WITHHELD = ['NO_GRANT', 'NOT_A_REPLAY', 'NOT_FULL_LEVEL'] as const
export type CustomerPointWithheld = (typeof CUSTOMER_POINT_WITHHELD)[number]

/**
 * One delivery of a replayed order as it happened (`RecordWhatHappened`): the store routing chose, the advisor's mode
 * its type reads as, the lines it carried, when it came in and was delivered, late or not, and the fee paid (a fact).
 */
export interface AdviseWhatHappened {
  deliveryNo: string
  store: string
  /** Absent when no mode reads the delivery's type. */
  mode?: DeliveryMode | string
  lines: number[]
  cameInAt: string
  /** Absent while it is not delivered. */
  deliveredAt?: string
  /** Delivered after its promise; absent when either is not known. */
  late?: boolean
  fee: number
}

// ── Kept runs (BackOffice 4380) ──────────────────────────────────────────────────────────────────

/**
 * A kept run as its doors answer it (`KeptRunAnswer`): the list's row, or what a keep wrote. The list holds every kept
 * run (any holder of the run grant opens one); only its keeper may delete it (`keptBy` is the caller).
 */
export interface KeptRun {
  runId: string
  name: string
  /** The keeper's user id. */
  keptBy: string
  keptAt: string
  ranAt: string
  kind: AdviseReply['kind']
  channel: string
  madeBy: string
  /** The engine version that answered the run. */
  engineVersion: string
}

/** Keep the held run under a name (`POST SourcingAdvisor/Runs/Keep`). */
export interface KeepRunRequest {
  runId: string
  name: string
}
