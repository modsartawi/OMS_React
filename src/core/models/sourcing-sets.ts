/**
 * The candidate log and the marking screen's wire (oms ticket 967, BackOffice spec 4354 §10 and §18; server tickets
 * BO 4360 "mark, read the candidate log" and BO 4395 "the marking door answers what the marking screen shows").
 *
 * 🚩 Built on stubs. Both server tickets are open and name the CONTENT of these doors only: no path, no query name, no
 * field, no refusal code and no grant name. Every shape below is this build's design and carries
 * `// PROVISIONAL (spec 4354: not specified)` until it is reconciled with BO 4360 / 4395 as built.
 *
 * The list of sets and versions is `WeightSetListItem` (`./sourcing-run`, ticket 963, extended by 967), a version's
 * values `WeightSetVersion`. Formats as the rest of the advisor's wire (BO 4379): local wall clock
 * `yyyy-MM-dd HH:mm:ss`, no zone; shares as a percent with one decimal beside their count.
 */
import type { WeightSetVersionRef } from './sourcing-run'
import type { ResultsLeftOver, ResultsPromiseRow, ResultsShare, TrialChangeKind, TrialRefusal } from './sourcing-results'

/** A share with the whole it is a share of ("every total is sent with its parts"). */
export interface MarkingShare extends ResultsShare {
  of: number
}

/** One promise check row under the new version, beside the same deliveries under the candidate set of that day. */
// PROVISIONAL (spec 4354: not specified) — `candidatePercent`.
export interface MarkingPromiseRow extends ResultsPromiseRow {
  candidatePercent: number | null
}

/**
 * A trial's figures as the candidate log keeps them and the marking screen shows them (BO 4395): the trial's number,
 * the plans changed against the candidate set, the orders refused, the promise check per mode under the new version.
 */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface MarkingTrialFigures {
  trialId: string
  /** Whole local days, `yyyy-MM-dd`, both ends included. */
  period: { from: string; to: string }
  days: number
  /** Every order of the period the trial read. */
  orders: number
  plansChanged: MarkingShare
  kinds: { kind: TrialChangeKind; count: number }[]
  refused: MarkingShare
  refusedBy: { reason: TrialRefusal; count: number }[]
  stopFindings: number
  promise: MarkingPromiseRow[]
}

/** The two exceptions to the fourth check (spec 4354 §10). */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type MarkingException = 'FIRST_CANDIDATE' | 'BACK_WITHIN_90'

/** One row of the candidate log: never edited (BO 4360), with the trial's figures (BO 4395). */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface CandidateLogEntry {
  at: string
  /** Who marked it; null for the seed (the baseline set as the first candidate set). */
  by: string | null
  before: WeightSetVersionRef | null
  after: WeightSetVersionRef
  reason: string
  /** The exception the marking went through on, when it needed no trial. */
  exception: MarkingException | null
  trial: MarkingTrialFigures | null
  /** A phase 2 bar period was being counted at the marking, on this day of its 28; the marking started it again. */
  barDay: number | null
}

/** The four checks that refuse a marking (spec 4354 §10), in the spec's order. */
// PROVISIONAL (spec 4354: not specified) — the codes.
export type MarkingCheckKey = 'BALANCED_ON' | 'NO_WHAT_IF' | 'NO_ASSUMED_CARRIER_ROW' | 'KEPT_TRIAL'
export const MARKING_CHECKS: readonly MarkingCheckKey[] = ['BALANCED_ON', 'NO_WHAT_IF', 'NO_ASSUMED_CARRIER_ROW', 'KEPT_TRIAL']

/**
 * Why a marking is refused, each with its figure where it has one (BO 4395 case 87). The marking door answers these
 * under a failed check, and the mark door refuses with the same codes as its envelope's error codes, plus the four
 * that only a write can meet.
 */
// PROVISIONAL (spec 4354: not specified) — every code.
export type MarkingRefusal =
  | 'BALANCED_OFF'
  | 'WHAT_IF_ON_PLANNER_DATA'
  | 'CARRIER_ROW_ASSUMED'
  | 'NO_TRIAL'
  | 'TRIAL_TOO_SHORT'
  | 'TRIAL_TOO_OLD'
  | 'TRIAL_REFUSED_TOO_MANY'
  | 'TRIAL_STOP_FINDING'
  | 'REASON_MISSING'
  | 'REASON_NOT_SPOKEN_TO'
  | 'ALREADY_CANDIDATE'
  | 'SET_RETIRED'
export const MARKING_REFUSALS: readonly MarkingRefusal[] = [
  'BALANCED_OFF',
  'WHAT_IF_ON_PLANNER_DATA',
  'CARRIER_ROW_ASSUMED',
  'NO_TRIAL',
  'TRIAL_TOO_SHORT',
  'TRIAL_TOO_OLD',
  'TRIAL_REFUSED_TOO_MANY',
  'TRIAL_STOP_FINDING',
  'REASON_MISSING',
  'REASON_NOT_SPOKEN_TO',
  'ALREADY_CANDIDATE',
  'SET_RETIRED',
]

// PROVISIONAL (spec 4354: not specified) — every field.
export interface MarkingCheck {
  check: MarkingCheckKey
  passed: boolean
  /** Why it failed; empty when it passed. `figure` is a machine value (days, percent, a contract row's code). */
  why: { code: string; figure?: string | null }[]
  /** The exception that let the fourth check through. */
  exception?: MarkingException | null
}

/** How a shelf chance figure stands against its evidence (spec 4354 §18, BO 4395): "enough", "too few", "not steady". */
// PROVISIONAL (spec 4354: not specified) — the codes (973's `ResultsEvidenceReading` names the same three).
export type MarkingReading = 'ENOUGH_TO_CHANGE' | 'TOO_FEW' | 'NOT_STEADY'

/** One shelf chance figure the version changes against the candidate set, with its evidence. */
// PROVISIONAL (spec 4354: not specified) — every field.
export interface MarkingShelfFigure {
  /** The figure's key: what the written reason's ticks name. */
  key: string
  mode: 'DAWAA_NOW' | 'SLOT' | 'PICK_UP'
  asked: number
  leftOver: ResultsLeftOver
  /** Percent with two decimals: the candidate set's figure, then this version's. */
  from: number
  to: number
  reading: MarkingReading
  /** Lines behind it, the failed lines among them, and the failed lines the figure expects. */
  lines: number
  failed: number
  expectedFailed: number
  /** The failed share in each half of the window, percent; null where a half has no line. */
  halves: [number | null, number | null]
}

/**
 * `GET SourcingAdvisor/WeightSets/Marking?name=&version=` — what the marking screen shows for one version, before a
 * marking: the checks, the trial's figures, every shelf chance figure that differs (BO 4395).
 */
// PROVISIONAL (spec 4354: not specified) — the door, its path, its query and every field.
export interface MarkingReply {
  target: WeightSetVersionRef
  /** The candidate set now; null before the first marking. */
  candidate: WeightSetVersionRef | null
  /** A set with a what-if on planner data: never marked (BO 4395 case 90). */
  trialSet: boolean
  checks: MarkingCheck[]
  /** The kept trial the fourth check read; null when there is none or none was needed. */
  trial: (MarkingTrialFigures & { endedDaysAgo: number }) | null
  /** Going back: when this version was last the candidate set. */
  lastCandidate: { until: string; daysAgo: number } | null
  shelf: MarkingShelfFigure[]
}

/**
 * `POST SourcingAdvisor/WeightSets/Mark` — under the marking grant. Answers the new log row; a refusal is an envelope
 * with `success:false` and one error per `MarkingRefusal`.
 */
// PROVISIONAL (spec 4354: not specified) — the door, its path, the body and its refusal codes.
export interface MarkRequest {
  name: string
  version: number
  reason: string
  /** The keys of the "too few" and "not steady" figures the reason speaks to. */
  spokenTo: string[]
}
