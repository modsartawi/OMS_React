/**
 * The marking screen's model (ticket 967; spec 4354 §10 and §18; BO 4360 and 4395). Pure.
 *
 * The owner's variant A: one long form read top to bottom. The four checks show first and Mark stays off while one
 * fails; then the trial's figures (plans changed against the candidate set, orders refused, the promise check per mode
 * under the new version); then every shelf chance figure that differs with its reading; then ONE written reason, with a
 * tick for each "too few" or "not steady" figure saying the reason speaks to it.
 *
 * Figures are shown as sent ("every total is sent with its parts, as rounded; no reader recomputes"); the model only
 * orders them. The server checks again at the mark; its refusal is read by `refusalLines`.
 */
import {
  MARKING_CHECKS,
  MARKING_REFUSALS,
  type MarkingCheck,
  type MarkingCheckKey,
  type MarkingReply,
  type MarkingShelfFigure,
  type MarkingTrialFigures,
  type MarkRequest,
} from '@/core/models/sourcing-sets'
import { RESULTS_LEFT_OVERS, TRIAL_REFUSALS, type ResultsPromiseRow } from '@/core/models/sourcing-results'

export interface MarkingRefusalLine {
  check: MarkingCheckKey
  code: string
  /** A machine value (days, a percent, a contract row's code); null when the reason has none. */
  figure: string | null
}

export interface MarkingView {
  target: MarkingReply['target']
  candidate: MarkingReply['candidate']
  trialSet: boolean
  /** The four checks in the spec's order; a check the reply left out is shown failed. */
  checks: MarkingCheck[]
  /** Every check passed and the set is no trial set: only then may it be marked. */
  checksPass: boolean
  /** Why it is refused: each failed check's reasons, in the checks' order. */
  refusals: MarkingRefusalLine[]
  trial: (MarkingTrialFigures & { endedDaysAgo: number }) | null
  lastCandidate: MarkingReply['lastCandidate']
  /** Every shelf chance figure that differs, by mode, units asked and units left over. */
  shelf: MarkingShelfFigure[]
  /** The figures the reason must speak to: every reading but "enough". */
  mustSpeakTo: MarkingShelfFigure[]
}

const MODES = ['DAWAA_NOW', 'SLOT', 'PICK_UP'] as const
const GROUPS = [null, 'APP_SITE', 'CALL_CENTRE'] as const

const promiseOrder = (p: ResultsPromiseRow) => MODES.indexOf(p.mode) * 10 + GROUPS.indexOf(p.channelGroup)
const shelfOrder = (f: MarkingShelfFigure) => MODES.indexOf(f.mode) * 10000 + f.asked * 100 + RESULTS_LEFT_OVERS.indexOf(f.leftOver)
const refusalOrder = (reason: string) => {
  const i = TRIAL_REFUSALS.indexOf(reason as (typeof TRIAL_REFUSALS)[number])
  return i < 0 ? TRIAL_REFUSALS.length : i
}

/**
 * A trial's figures in the order shown, here and in the candidate log: the refusals in the spec's order, the promise
 * check Dawaa Now, slot, then pick-up for the app and the site and for the call centre. Nothing re-summed.
 */
export function orderedTrial<T extends MarkingTrialFigures>(trial: T): T {
  return {
    ...trial,
    refusedBy: [...trial.refusedBy].sort((a, b) => refusalOrder(a.reason) - refusalOrder(b.reason)),
    promise: [...trial.promise].sort((a, b) => promiseOrder(a) - promiseOrder(b)),
  }
}

export function markingView(reply: MarkingReply): MarkingView {
  const checks = MARKING_CHECKS.map(
    (key): MarkingCheck =>
      reply.checks.find((c) => c.check === key) ?? {
        check: key,
        passed: false,
        why: [],
      },
  )
  const refusals = checks
    .filter((c) => !c.passed)
    .flatMap((c) =>
      c.why.map((w) => ({
        check: c.check,
        code: w.code,
        figure: w.figure ?? null,
      })),
    )
  const trial = reply.trial && orderedTrial(reply.trial)
  const shelf = reply.shelf.filter((f) => f.from !== f.to).sort((a, b) => shelfOrder(a) - shelfOrder(b))
  return {
    target: reply.target,
    candidate: reply.candidate,
    trialSet: reply.trialSet,
    checks,
    checksPass: !reply.trialSet && checks.every((c) => c.passed),
    refusals,
    trial,
    lastCandidate: reply.lastCandidate,
    shelf,
    mustSpeakTo: shelf.filter((f) => f.reading !== 'ENOUGH_TO_CHANGE'),
  }
}

export interface MarkState {
  canMark: boolean
  /** What Mark waits for: a check to pass, a written reason, or a tick on each figure it must speak to. */
  waitingFor: 'checks' | 'reason' | 'figures' | null
  spoken: number
  of: number
}

export function markState(view: MarkingView, reason: string, ticked: readonly string[]): MarkState {
  if (!view.checksPass)
    return {
      canMark: false,
      waitingFor: 'checks',
      spoken: 0,
      of: view.mustSpeakTo.length,
    }
  const of = view.mustSpeakTo.length
  const spoken = view.mustSpeakTo.filter((f) => ticked.includes(f.key)).length
  const waitingFor = !reason.trim() ? 'reason' : spoken < of ? 'figures' : null
  return { canMark: waitingFor === null, waitingFor, spoken, of }
}

/** The mark door's body; null while Mark is off. */
export function markRequest(view: MarkingView, reason: string, ticked: readonly string[]): MarkRequest | null {
  if (!markState(view, reason, ticked).canMark) return null
  return {
    name: view.target.name,
    version: view.target.version,
    reason: reason.trim(),
    spokenTo: view.mustSpeakTo.filter((f) => ticked.includes(f.key)).map((f) => f.key),
  }
}

export interface RefusalLine {
  code: string
  /** The screen writes its own words for a code it knows; the server's words stand for one it does not. */
  known: boolean
  message: string
}

/** The mark door's refusal: one line per error the envelope carried. */
export function refusalLines(details: readonly { errorCode: string; errorMessage: string }[]): RefusalLine[] {
  return details
    .filter((d) => d.errorCode)
    .map((d) => ({
      code: d.errorCode,
      known: (MARKING_REFUSALS as readonly string[]).includes(d.errorCode),
      message: d.errorMessage,
    }))
}
