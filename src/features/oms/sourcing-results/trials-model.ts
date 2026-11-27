/**
 * The Trials tab and "Set beside it" (ticket 973, spec 4354 §18, BO 4283 decisions 3–18), on BO 4394's trial doors: the
 * list of trials, a trial's result (orders solved, refused by reason, no plan, failed), the factor table, the form that
 * starts a trial, and a set read beside the candidate set — two finished trials over the same period
 * (`Trials/Beside?trialId=<candidate>&otherId=<set>`): the plans that differ, each set against what happened, the estimate
 * between them, and the promise check under the set beside it.
 *
 * Pure. Every count and share is the reply's as sent: the model orders, filters and checks that parts add up, and
 * never recomputes a share. No riyal anywhere (spec §18: "no riyal sum").
 */
import {
  TRIAL_CHANGE_KINDS,
  TRIAL_FACTORS,
  TRIAL_REFUSALS,
  type FactorTableReply,
  type TrialChangeKind,
  type TrialFactor,
  type TrialReply,
  type TrialSide,
  type TrialStartRequest,
  type TrialState,
  type TrialsBeside,
} from '@/core/models/sourcing-results'

const inOrder = (order: readonly string[], key: string): number => {
  const i = order.indexOf(key)
  return i < 0 ? order.length : i
}

const counted = <K extends string>(order: readonly K[], map: Record<string, number>) =>
  Object.entries(map)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => inOrder(order, a) - inOrder(order, b))

// ── The list ────────────────────────────────────────────────────────────────────────────────────────

export interface TrialListRow extends TrialReply {
  /** A done trial of a set other than its candidate opens beside the candidate's trial (BO 4283 decision 18). */
  canOpenBeside: boolean
}

export interface TrialsList {
  /** Newest first, by when each was added. */
  rows: TrialListRow[]
  /** One trial runs at a time (BO 4283 decision 10). */
  running: TrialReply | null
  waiting: number
}

const isCandidateItself = (t: TrialReply) => t.name === t.besideCandidate && t.version === t.besideCandidateVersion

export function trialsList(trials: readonly TrialReply[]): TrialsList {
  const rows = trials
    .filter((t) => !t.factorOff)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
    .map((t) => ({ ...t, canOpenBeside: t.state === 'DONE' && !!t.besideCandidate && !isCandidateItself(t) }))
  return {
    rows,
    running: rows.find((t) => t.state === 'RUNNING') ?? null,
    waiting: rows.filter((t) => t.state === 'WAITING').length,
  }
}

/** The done trial of the candidate set `trial` ran beside, over the very same period; null when it has none. */
export function candidateTrialFor(trial: TrialReply, trials: readonly TrialReply[]): TrialReply | null {
  return (
    trials.find(
      (t) =>
        !t.factorOff &&
        t.state === 'DONE' &&
        t.name === trial.besideCandidate &&
        t.version === trial.besideCandidateVersion &&
        t.from === trial.from &&
        t.to === trial.to,
    ) ?? null
  )
}

// ── One trial's result ──────────────────────────────────────────────────────────────────────────────

export interface TrialResult {
  orders: number
  solved: number
  /** Of the solved, the runs made on this very version, used as stored. */
  asStored: number
  noPlan: number
  notEnded: number
  failed: number
  /** By reason, in the server's order; a reason with no order left out. */
  refused: { reason: string; count: number }[]
  refusedTotal: number
  /** Solved + refused + no plan + not ended + failed = the orders of the period, as the server sent them. */
  addsUp: boolean
  /** Only a done trial's counts are its result; a running one's are progress. */
  done: boolean
}

export function trialResult(t: TrialReply): TrialResult {
  const sum = t.solved + t.refused + t.noPlan + t.notEnded + t.failed
  return {
    orders: t.orders,
    solved: t.solved,
    asStored: t.asStored,
    noPlan: t.noPlan,
    notEnded: t.notEnded,
    failed: t.failed,
    refused: counted(TRIAL_REFUSALS, t.refusedBy).map(([reason, count]) => ({ reason, count })),
    refusedTotal: t.refused,
    addsUp: t.state === 'DONE' ? sum === t.orders : sum <= t.orders,
    done: t.state === 'DONE',
  }
}

// ── The factor table ────────────────────────────────────────────────────────────────────────────────

export interface FactorView {
  factor: TrialFactor
  /** '' until the row's trial is started. */
  state: TrialState | ''
  compared: number
  changed: number
  /** Percent of the plans compared, as sent. */
  share: number
  /** In the comparison's order; a kind with no plan left out. */
  kinds: { kind: string; count: number }[]
  /** "A factor that changes no plan earns nothing in that period" (BO 4283 decision 16). */
  changesNone: boolean
}

export interface FactorTable {
  rows: FactorView[]
  /** Whether any row's trial was started. */
  started: boolean
}

export function factorTable(reply: FactorTableReply): FactorTable {
  const rows = [...reply.rows]
    .sort((a, b) => inOrder(TRIAL_FACTORS, a.factor) - inOrder(TRIAL_FACTORS, b.factor))
    .map((r) => ({
      factor: r.factor,
      state: r.state,
      compared: r.compared,
      changed: r.plansChanged,
      share: r.share,
      kinds: counted(TRIAL_CHANGE_KINDS, r.kinds).map(([kind, count]) => ({ kind, count })),
      changesNone: r.state === 'DONE' && !(r.plansChanged > 0),
    }))
  return { rows, started: rows.some((r) => r.state !== '') }
}

// ── The form that starts a trial ────────────────────────────────────────────────────────────────────

/**
 * SERVER GAP (spec 4354) — the trial doors send neither the longest period nor how long the run records are kept
 * (`TrialSettings` 30 and 90 days); the form checks against these defaults and the server refuses past its own.
 */
export const TRIAL_LONGEST_DAYS = 30
export const RECORD_KEPT_DAYS = 90

export interface TrialStartForm {
  name: string
  version: number
  /** Local dates `yyyy-MM-dd`, both ends included. */
  from: string
  to: string
}

/** Why the form cannot start a trial yet; each has its own words. */
export type TrialStartProblem = 'NO_VERSION' | 'NO_PERIOD' | 'ENDS_BEFORE_START' | 'NOT_ENDED' | 'TOO_LONG' | 'BEFORE_KEPT'

export interface TrialStart {
  request: TrialStartRequest | null
  /** Whole local days in the period, both ends included; null until both days are given. */
  days: number | null
  problem: TrialStartProblem | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayNumber = (d: string): number | null => {
  if (!DAY.test(d)) return null
  const ms = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null
}

/** The server reads a day as `yyyy-MM-dd HH:mm:ss`, whole (`RecordJson`, strict). */
export const wireDay = (day: string): string => `${day} 00:00:00`

/** `today` is the local `yyyy-MM-dd`: the last day of a period must have ended. */
export function trialStart(form: TrialStartForm, today: string): TrialStart {
  const from = dayNumber(form.from)
  const to = dayNumber(form.to)
  const now = dayNumber(today) ?? Number.POSITIVE_INFINITY
  const days = from != null && to != null ? to - from + 1 : null
  const refuse = (problem: TrialStartProblem): TrialStart => ({ request: null, days, problem })
  if (!form.name.trim() || !(form.version >= 1)) return refuse('NO_VERSION')
  if (from == null || to == null || days == null) return refuse('NO_PERIOD')
  if (days < 1) return refuse('ENDS_BEFORE_START')
  if (to >= now) return refuse('NOT_ENDED')
  if (days > TRIAL_LONGEST_DAYS) return refuse('TOO_LONG')
  if (from < now - RECORD_KEPT_DAYS) return refuse('BEFORE_KEPT')
  return { request: { name: form.name.trim(), version: form.version, from: wireDay(form.from), to: wireDay(form.to) }, days, problem: null }
}

// ── Set beside it ───────────────────────────────────────────────────────────────────────────────────

export interface BesideView {
  set: Pick<TrialSide, 'trialId' | 'name' | 'version' | 'trialSet'>
  candidate: Pick<TrialSide, 'trialId' | 'name' | 'version' | 'trialSet'>
  orders: number
  compared: number
  leftOut: number
  leftOutBy: { reason: string; count: number }[]
  /** The plans that differ between the two sets, by kind in the comparison's order. */
  differ: { count: number; share: number; kinds: { kind: string; count: number }[] }
  /** Each set against what happened: orders whose plan is the same, and whose stores are. */
  against: { candidate: { samePlan: number; sameStores: number }; beside: { samePlan: number; sameStores: number } }
  /** The set beside it minus the candidate, minutes; null when no plan was compared. */
  estimate: { middle: number; low: number; high: number } | null
  shipments: { candidate: number; beside: number }
  fee: { lower: number; same: number; higher: number }
  /** "The real deliveries, as this set would have promised them." */
  promise: TrialSide['promise']
}

const LEFT_OUT_ORDER: readonly string[] = [...TRIAL_REFUSALS, 'NO_PLAN', 'NOT_ENDED', 'FAILED', 'MISSING']
const sideOf = ({ trialId, name, version, trialSet }: TrialSide) => ({ trialId, name, version, trialSet })
const againstOf = (s: TrialSide) => ({ samePlan: s.wholeClasses.SAME_PLAN ?? 0, sameStores: s.storesClasses.SAME_PLAN ?? 0 })

export function besideView(b: TrialsBeside): BesideView {
  return {
    set: sideOf(b.second),
    candidate: sideOf(b.first),
    orders: b.orders,
    compared: b.compared,
    leftOut: b.leftOut,
    leftOutBy: counted(LEFT_OUT_ORDER, b.leftOutBy).map(([reason, count]) => ({ reason, count })),
    differ: {
      count: b.plansDiffer,
      share: b.plansDifferShare,
      kinds: counted<TrialChangeKind>(TRIAL_CHANGE_KINDS, b.differBy).map(([kind, count]) => ({ kind, count })),
    },
    against: { candidate: againstOf(b.first), beside: againstOf(b.second) },
    estimate:
      b.minutesMiddle != null
        ? { middle: b.minutesMiddle, low: b.minutesMiddleHalfFrom ?? b.minutesMiddle, high: b.minutesMiddleHalfTo ?? b.minutesMiddle }
        : null,
    shipments: { candidate: b.first.shipments, beside: b.second.shipments },
    fee: { lower: b.feeLower, same: b.feeSame, higher: b.feeHigher },
    promise: b.second.promise,
  }
}
