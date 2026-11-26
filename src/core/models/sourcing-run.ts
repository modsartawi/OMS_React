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
  inputs?: unknown
  filterSteps?: unknown[]
  used?: unknown[]
  search?: unknown
  customerPoint?: AdvisePoint | null
  customerPointWithheld?: 'NO_GRANT' | 'NOT_A_REPLAY' | 'NOT_FULL_LEVEL' | string | null
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
