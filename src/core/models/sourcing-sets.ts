/**
 * The candidate log and the marking screen's wire (oms ticket 967, BackOffice spec 4354 §10 and §18), reconciled with
 * BackOffice 4360 and 4395 at pricing2 35a4e56be: `WeightSetEndpoints` (`CandidateLog`, `MarkScreen`, `Mark`),
 * `WeightSetService.cs`, `CandidateMarkChecks.cs` and `Trials/MarkTrialReview.cs`.
 *
 * The list of sets and versions is `WeightSetListItem` (`./sourcing-run`), a version's values `WeightSetVersion`.
 * Formats as the rest of the advisor's wire: local wall clock `yyyy-MM-dd HH:mm:ss`, no zone; a null is left out (the
 * serializer writes no null), so every nullable field is optional here. Shares are FRACTIONS to four decimals
 * (`0.0499`), never percents: the screen multiplies by a hundred to show one.
 */
import type { WeightSetVersionRef } from './sourcing-run'

/** The promise check of one mode under the trial's version, on the real deliveries (`TrialPromiseCheck`). */
export interface MarkPromiseCheck {
  mode: string
  checked: number
  within: number
  /** Fraction; absent when none was checked. */
  share?: number | null
}

/**
 * A kept trial's figures as the marking screen shows them and the candidate log keeps them (`MarkTrialFigures`): the
 * trial that qualifies, else the newest kept trial with why it does not (`fails`).
 */
export interface MarkTrialFigures {
  trialId: string
  /** Local wall clock; whole local days. */
  from: string
  to: string
  days: number
  /** The candidate set it ran beside: the candidate of the day it started. */
  besideCandidate: string
  besideCandidateVersion: number
  orders: number
  refused: number
  refusedShare?: number | null
  /** Orders refused, by the trial's refusal code. */
  refusedBy: Record<string, number>
  stopFindings: number
  /** The nightly plan check has read the trial's plans. */
  planChecked: boolean
  /** The candidate set's own trial over the same period; absent when there is none: the plans changed are not read. */
  candidateTrialId?: string | null
  plansCompared: number
  plansChanged: number
  plansChangedShare: number
  /** The plans changed, by the kind of change. */
  changedBy: Record<string, number>
  promise: MarkPromiseCheck[]
  /** Why this trial does not qualify (`MarkRefusalCode`s); empty when it does. */
  fails: string[]
}

/** What the evidence says of a shelf chance figure (`ShelfChanceEvidenceMarks`). */
export type ShelfChanceEvidence = 'ENOUGH' | 'TOO_FEW' | 'NOT_STEADY'

/** One shelf chance figure that differs from the candidate set's (`ShelfChanceFigure`). */
export interface ShelfChanceFigure {
  /** Its name, as the written reason must name it: `shelfChance 2/0` (units asked / left over) or `shortFigure SLOT bookAtZero`. */
  figure: string
  /** Fractions: the candidate set's, then this version's; absent where a set has no such cell. */
  candidate?: number | null
  version?: number | null
  /** Absent while the evidence is not read. */
  evidence?: ShelfChanceEvidence | null
}

/** The two exceptions to check 4 (`MarkTrialExceptions`). */
export type MarkException = 'FIRST_CANDIDATE' | 'BACK_WITHIN_90_DAYS'

/** What the marking screen shows for a version, and what the candidate log keeps (`MarkReview`). */
export interface MarkReview {
  /** False for a trial set: it is never offered at marking. */
  offered: boolean
  exception?: MarkException | null
  /** For `BACK_WITHIN_90_DAYS`: when it last stopped being the candidate set. */
  candidateUntil?: string | null
  trial?: MarkTrialFigures | null
  shelfChance: ShelfChanceFigure[]
  /** A phase 2 bar period was being counted; a marking starts that count again. */
  barPeriodCounted: boolean
  barCountedFrom?: string | null
}

/** One row of `GET SourcingAdvisor/WeightSets/CandidateLog` (run grant), newest first: never edited. */
export interface CandidateLogEntry {
  markedBy: string
  markedAt: string
  /** Absent for the first marking. */
  before?: WeightSetVersionRef | null
  after: WeightSetVersionRef
  reason: string
  /** Absent for a marking logged before BO 4395. */
  review?: MarkReview | null
}

/** Why a marking is refused (`MarkRefusalCodes`). A code never changes meaning. */
export type MarkRefusalCode =
  | 'BALANCED_GOAL_OFF'
  | 'TRIAL_SET'
  | 'CARRIER_ROW_ASSUMED'
  | 'NO_TRIAL'
  | 'TRIAL_TOO_SHORT'
  | 'TRIAL_TOO_OLD'
  | 'TRIAL_NO_ORDERS'
  | 'TRIAL_REFUSED_TOO_MANY'
  | 'TRIAL_STOP_FINDING'
  | 'TRIAL_NOT_PLAN_CHECKED'
  | 'REASON_SILENT_ON_FIGURE'

/** A refusal: its code and the server's English sentence (`MarkRefusalReason`). */
export interface MarkRefusalReason {
  code: string
  why: string
}

/**
 * `GET SourcingAdvisor/WeightSets/MarkScreen?name=&version=` (mark grant): every check's refusal — none means it may be
 * marked, given a reason that names each figure the evidence does not back — and the review. The reason is blank when
 * the screen reads, so `REASON_SILENT_ON_FIGURE` stands here until the written reason names those figures.
 */
export interface MarkScreenReply {
  name: string
  version: number
  refusals: MarkRefusalReason[]
  review?: MarkReview | null
}

/**
 * `POST SourcingAdvisor/WeightSets/Mark` (mark grant) → the new `CandidateLogEntry`. Refused with `WEIGHTSET-423`
 * (HTTP 422) and every reason in `data.refusals`; `WEIGHTSET-400` without a reason, `WEIGHTSET-409` when the set is
 * retired or the version is the candidate set already.
 */
export interface MarkRequest {
  name: string
  version: number
  reason: string
}

/** The data of a refused marking (`WEIGHTSET-423`). */
export interface MarkRefusedData {
  refusals: MarkRefusalReason[]
  review?: MarkReview | null
}
