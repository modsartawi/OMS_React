/**
 * The marking screen's model (ticket 967; spec 4354 §10 and §18), over BackOffice 4360 / 4395 as built (pricing2
 * 35a4e56be: `GET SourcingAdvisor/WeightSets/MarkScreen`, `POST SourcingAdvisor/WeightSets/Mark`). Pure.
 *
 * The owner's variant A: one long form read top to bottom. The four checks show first and Mark stays off while one
 * fails; then the trial's figures (plans changed against the candidate set, orders refused, the promise check per mode
 * under the new version); then every shelf chance figure that differs with what its evidence says; then ONE written
 * reason, with a tick for each "too few" or "not steady" figure. The server reads the reason for each such figure's
 * NAME (`ReasonSpeaksToFigures`), so a tick writes the name into the reason and is ticked while the reason names it.
 *
 * The screen door runs every check with a blank reason, so it always answers `REASON_SILENT_ON_FIGURE` while such a
 * figure exists: that refusal is the reason's to answer, not a check. Figures are shown as sent; nothing re-summed.
 */
import { ApiError } from '@/core/api'
import type { WeightSetListItem, WeightSetVersionRef } from '@/core/models/sourcing-run'
import type {
  MarkException,
  MarkRefusalCode,
  MarkRefusalReason,
  MarkRefusedData,
  MarkRequest,
  MarkScreenReply,
  MarkTrialFigures,
  ShelfChanceFigure,
} from '@/core/models/sourcing-sets'

/** The four checks of spec 4354 §10, in its order. */
export type MarkCheckKey = 'BALANCED_ON' | 'NO_WHAT_IF' | 'NO_ASSUMED_CARRIER_ROW' | 'KEPT_TRIAL'
export const MARK_CHECKS: readonly MarkCheckKey[] = ['BALANCED_ON', 'NO_WHAT_IF', 'NO_ASSUMED_CARRIER_ROW', 'KEPT_TRIAL']

/** Which check each refusal code of the server belongs to (`MarkRefusalCodes`). */
const CHECK_OF: Record<Exclude<MarkRefusalCode, 'REASON_SILENT_ON_FIGURE'>, MarkCheckKey> = {
  BALANCED_GOAL_OFF: 'BALANCED_ON',
  TRIAL_SET: 'NO_WHAT_IF',
  CARRIER_ROW_ASSUMED: 'NO_ASSUMED_CARRIER_ROW',
  NO_TRIAL: 'KEPT_TRIAL',
  TRIAL_TOO_SHORT: 'KEPT_TRIAL',
  TRIAL_TOO_OLD: 'KEPT_TRIAL',
  TRIAL_NO_ORDERS: 'KEPT_TRIAL',
  TRIAL_REFUSED_TOO_MANY: 'KEPT_TRIAL',
  TRIAL_STOP_FINDING: 'KEPT_TRIAL',
  TRIAL_NOT_PLAN_CHECKED: 'KEPT_TRIAL',
}
const SILENT: MarkRefusalCode = 'REASON_SILENT_ON_FIGURE'
export const KNOWN_REFUSALS: readonly string[] = [...Object.keys(CHECK_OF), SILENT]

/** The version the list marks as the candidate set; null before any marking. */
export function candidateOf(sets: readonly WeightSetListItem[]): WeightSetVersionRef | null {
  for (const s of sets) {
    const v = s.versions.find((x) => x.candidate)
    if (v) return { name: s.name, version: v.version }
  }
  return null
}

/**
 * The versions the marking screen offers: not a retired set's, not the candidate set itself, and no trial set's,
 * which can never be marked (review 2 #9; as the set list offers Mark).
 */
export const markableVersions = (sets: readonly WeightSetListItem[]): WeightSetVersionRef[] =>
  sets.filter((s) => !s.retired).flatMap((s) => s.versions.filter((v) => !v.candidate && !v.trial).map((v) => ({ name: s.name, version: v.version })))

export interface MarkingCheck {
  check: MarkCheckKey
  passed: boolean
  refusals: MarkRefusalReason[]
  /** The exception that let the fourth check through. */
  exception?: MarkException | null
}

export interface MarkingView {
  target: WeightSetVersionRef
  /** The candidate set it would replace, as the list marks it. */
  candidate: WeightSetVersionRef | null
  /** A set with a what-if on planner data: never offered, never marked. */
  trialSet: boolean
  checks: MarkingCheck[]
  /** No refusal stands but the reason's own: only then may it be marked. */
  checksPass: boolean
  /** Every refusal but the reason's, in the checks' order; one the screen does not know last. */
  refusals: MarkRefusalReason[]
  trial: MarkTrialFigures | null
  /** Orders refused and plans changed, by code, most first. */
  refusedBy: [string, number][]
  changedBy: [string, number][]
  candidateUntil: string | null
  /** Every shelf chance figure that differs from the candidate set's, in the server's order. */
  shelf: ShelfChanceFigure[]
  /** The figures the reason must name: those the evidence marks "too few" or "not steady". */
  mustSpeakTo: ShelfChanceFigure[]
  bar: { counted: boolean; from: string | null }
}

const PROMISE_MODES = ['DAWAA_NOW', 'SLOT', 'CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY', 'BEYOND_BORDER', 'PICK_UP']
const modeOrder = (m: string) => {
  const i = PROMISE_MODES.indexOf(m)
  return i < 0 ? PROMISE_MODES.length : i
}
const mostFirst = (counts: Record<string, number> | undefined): [string, number][] =>
  Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

export function markingView(reply: MarkScreenReply, candidate: WeightSetVersionRef | null): MarkingView {
  const review = reply.review ?? null
  const standing = reply.refusals.filter((r) => r.code !== SILENT)
  const checks = MARK_CHECKS.map((check): MarkingCheck => {
    const refusals = standing.filter((r) => CHECK_OF[r.code as keyof typeof CHECK_OF] === check)
    return {
      check,
      passed: refusals.length === 0,
      refusals,
      exception: check === 'KEPT_TRIAL' && refusals.length === 0 ? (review?.exception ?? null) : null,
    }
  })
  const unknown = standing.filter((r) => !(r.code in CHECK_OF))
  const trial = review?.trial ? { ...review.trial, promise: [...review.trial.promise].sort((a, b) => modeOrder(a.mode) - modeOrder(b.mode)) } : null
  const shelf = (review?.shelfChance ?? []).filter((f) => f.candidate !== f.version)
  return {
    target: { name: reply.name, version: reply.version },
    candidate,
    trialSet: review?.offered === false || reply.refusals.some((r) => r.code === 'TRIAL_SET'),
    checks,
    checksPass: standing.length === 0 && review?.offered !== false,
    refusals: [...checks.flatMap((c) => c.refusals), ...unknown],
    trial,
    refusedBy: mostFirst(trial?.refusedBy),
    changedBy: mostFirst(trial?.changedBy),
    candidateUntil: review?.candidateUntil ?? null,
    shelf,
    mustSpeakTo: shelf.filter((f) => f.evidence === 'TOO_FEW' || f.evidence === 'NOT_STEADY'),
    bar: { counted: !!review?.barPeriodCounted, from: review?.barCountedFrom ?? null },
  }
}

export type FigureName = { kind: 'shelf'; asked: number; leftOver: number } | { kind: 'short'; mode: string; row: string }

/** A figure's name read back: `shelfChance 2/0` or `shortFigure SLOT bookAtZero`; null for one the screen does not know. */
export function figureName(figure: string): FigureName | null {
  const shelf = /^shelfChance (\d+)\/(\d+)$/.exec(figure)
  if (shelf) return { kind: 'shelf', asked: Number(shelf[1]), leftOver: Number(shelf[2]) }
  const short = /^shortFigure ([A-Z_]+) ([A-Za-z]+)$/.exec(figure)
  return short ? { kind: 'short', mode: short[1], row: short[2] } : null
}

/** Whether the reason names the figure, as the server reads it: anywhere, in any case. */
export const speaksTo = (reason: string, figure: string) => reason.toLowerCase().includes(figure.toLowerCase())

/** The reason with the figure's name written on a line of its own, for the planner to go on; once only. */
export function withFigure(reason: string, figure: string): string {
  if (speaksTo(reason, figure)) return reason
  return reason === '' ? `${figure}: ` : `${reason.replace(/\n+$/, '')}\n${figure}: `
}

/** The reason with every mention of the figure's name taken out (and a line left holding only it). */
export function withoutFigure(reason: string, figure: string): string {
  const escaped = figure.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return reason
    .replace(new RegExp(`\\n?${escaped}: ?(?=\\n|$)`, 'gi'), '')
    .replace(new RegExp(escaped, 'gi'), '')
    .trimEnd()
}

export interface MarkState {
  canMark: boolean
  /** What Mark waits for: a check to pass, a written reason, or the reason to name each figure it must speak to. */
  waitingFor: 'checks' | 'reason' | 'figures' | null
  spoken: number
  of: number
}

export function markState(view: MarkingView, reason: string): MarkState {
  const of = view.mustSpeakTo.length
  if (!view.checksPass) return { canMark: false, waitingFor: 'checks', spoken: 0, of }
  const spoken = view.mustSpeakTo.filter((f) => speaksTo(reason, f.figure)).length
  const waitingFor = !reason.trim() ? 'reason' : spoken < of ? 'figures' : null
  return { canMark: waitingFor === null, waitingFor, spoken, of }
}

/** The mark door's body (`MarkCandidateRequest`); null while Mark is off. */
export function markRequest(view: MarkingView, reason: string): MarkRequest | null {
  if (!markState(view, reason).canMark) return null
  return { name: view.target.name, version: view.target.version, reason: reason.trim() }
}

export interface RefusalLine {
  code: string
  /** The screen writes its own words for a code it knows; the server's words stand for one it does not. */
  known: boolean
  why: string
}

/** A refused marking's reasons (`WEIGHTSET-423`, every reason in `data.refusals`); none for any other failure. */
export function refusalLines(err: unknown): RefusalLine[] {
  if (!(err instanceof ApiError)) return []
  const data = err.data as Partial<MarkRefusedData> | null
  return (Array.isArray(data?.refusals) ? data.refusals : []).map((r) => ({ code: r.code, known: KNOWN_REFUSALS.includes(r.code), why: r.why }))
}
