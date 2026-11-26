/**
 * The Trials tab and "Set beside it" (ticket 973, spec 4354 §18, BO 4283 decisions 1–18, BO 4394): the list of
 * trials, a trial's result (orders solved, refused by reason, failed), the factor table, the form that starts a
 * trial, and the tried set read beside the candidate set — the banner, the thin second bar, the plans that differ
 * between the two sets and the promise check under the set beside it.
 *
 * Pure. Every count and share is the reply's as sent: the model orders, filters and checks that parts add up, and
 * never recomputes a share. No riyal anywhere (spec §18: "no riyal sum").
 */
import {
  TRIAL_CHANGE_KINDS,
  TRIAL_FACTORS,
  TRIAL_REFUSALS,
  type FactorRow,
  type FactorTableReply,
  type ResultsBeside,
  type ResultsBesideCell,
  type ResultsShare,
  type ResultsWeightSet,
  type TrialChangeKind,
  type TrialRefusal,
  type TrialRow,
  type TrialStartRequest,
  type TrialsReply,
} from '@/core/models/sourcing-results'
import { promisePanel, type PromisePanelRow } from './promise-panel-model'
import { resultsBar, type ResultsBar } from './results-bar-model'
import { percentText } from './text'

// ── The list ────────────────────────────────────────────────────────────────────────────────────────

export interface TrialListRow extends TrialRow {
  /** A done trial's result opens the results page with its set in "Set beside it" (BO 4283 decision 18). */
  canOpenBeside: boolean
}

export interface TrialsList {
  /** Newest first, by when each was started. */
  rows: TrialListRow[]
  /** One trial runs at a time (BO 4283 decision 10). */
  running: TrialRow | null
  waiting: number
}

export function trialsList(reply: TrialsReply): TrialsList {
  const rows = [...reply.trials]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .map((t) => ({ ...t, canOpenBeside: t.state === 'DONE' }))
  return {
    rows,
    running: rows.find((t) => t.state === 'RUNNING') ?? null,
    waiting: rows.filter((t) => t.state === 'WAITING').length,
  }
}

// ── One trial's result ──────────────────────────────────────────────────────────────────────────────

export interface TrialResult {
  orders: number
  solved: number
  failed: number
  leftOutNoPlan: number
  /** By reason, in the spec's order; a reason with no order left out. */
  refused: { reason: TrialRefusal; count: number }[]
  refusedTotal: number
  /** Solved + refused + failed + left out = the orders of the period, as the server sent them. */
  addsUp: boolean
  /** Only a done trial's counts are its result; a running one's are progress. */
  done: boolean
}

const inOrder = <K extends string>(order: readonly K[], key: K): number => {
  const i = order.indexOf(key)
  return i < 0 ? order.length : i
}

export function trialResult(t: TrialRow): TrialResult {
  const refused = t.refused
    .filter((r) => r.count > 0)
    .sort((a, b) => inOrder(TRIAL_REFUSALS, a.reason) - inOrder(TRIAL_REFUSALS, b.reason))
    .map(({ reason, count }) => ({ reason, count }))
  const refusedTotal = refused.reduce((sum, r) => sum + r.count, 0)
  const counted = t.solved + refusedTotal + t.failed + t.leftOutNoPlan
  return {
    orders: t.orders,
    solved: t.solved,
    failed: t.failed,
    leftOutNoPlan: t.leftOutNoPlan,
    refused,
    refusedTotal,
    // A trial still running has solved part of its orders: its counts add up to no more than the whole.
    addsUp: t.state === 'DONE' ? counted === t.orders : counted <= t.orders,
    done: t.state === 'DONE',
  }
}

// ── The factor table ────────────────────────────────────────────────────────────────────────────────

export interface FactorView {
  /** `FACTOR` or `STORE_RECORD:<MEASURE>`. */
  key: string
  factor: FactorRow['factor']
  measure: string | null
  switched: FactorRow['switched']
  changed: ResultsShare
  /** In the comparison's order; a kind with no plan left out. */
  kinds: { kind: TrialChangeKind; count: number }[]
  /** "A factor that changes no plan earns nothing in that period" (BO 4283 decision 16). */
  changesNone: boolean
}

export interface FactorTable {
  state: FactorTableReply['state']
  plans: number
  rows: FactorView[]
}

export function factorTable(reply: FactorTableReply): FactorTable {
  const rows = reply.rows
    .map((r, sent) => ({ r, sent }))
    // Stable: the store record's measures keep the order sent, together under the factor.
    .sort((a, b) => inOrder(TRIAL_FACTORS, a.r.factor) - inOrder(TRIAL_FACTORS, b.r.factor) || a.sent - b.sent)
    .map(({ r }) => ({
      key: r.measure ? `${r.factor}:${r.measure}` : r.factor,
      factor: r.factor,
      measure: r.measure,
      switched: r.switched,
      changed: r.changed,
      kinds: r.kinds
        .filter((k) => k.count > 0)
        .sort((a, b) => inOrder(TRIAL_CHANGE_KINDS, a.kind) - inOrder(TRIAL_CHANGE_KINDS, b.kind))
        .map(({ kind, count }) => ({ kind, count })),
      changesNone: !(r.changed.count > 0),
    }))
  return { state: reply.state, plans: reply.plans, rows }
}

// ── The form that starts a trial ────────────────────────────────────────────────────────────────────

export interface TrialStartForm {
  set: Pick<ResultsWeightSet, 'name' | 'version'> | null
  /** Local dates `yyyy-MM-dd`, both ends included. */
  from: string
  to: string
}

/** Why the form cannot start a trial yet; each has its own words. */
export type TrialStartProblem = 'NO_VERSION' | 'NO_PERIOD' | 'ENDS_BEFORE_START' | 'BEFORE_KEPT' | 'NOT_ENDED' | 'TOO_LONG'

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

export function trialStart(form: TrialStartForm, reply: Pick<TrialsReply, 'maxDays' | 'earliestDay' | 'latestDay'>): TrialStart {
  const from = dayNumber(form.from)
  const to = dayNumber(form.to)
  const days = from != null && to != null ? to - from + 1 : null
  const refuse = (problem: TrialStartProblem): TrialStart => ({ request: null, days, problem })
  if (!form.set) return refuse('NO_VERSION')
  if (from == null || to == null || days == null) return refuse('NO_PERIOD')
  if (days < 1) return refuse('ENDS_BEFORE_START')
  if (form.from < reply.earliestDay) return refuse('BEFORE_KEPT')
  if (form.to > reply.latestDay) return refuse('NOT_ENDED')
  if (days > reply.maxDays) return refuse('TOO_LONG')
  return {
    request: { weightSet: form.set.name, weightSetVersion: form.set.version, from: form.from, to: form.to },
    days,
    problem: null,
  }
}

// ── Set beside it ───────────────────────────────────────────────────────────────────────────────────

export interface BesideView {
  set: ResultsWeightSet
  /** A trial set is shown under its banner (spec §10). */
  trialSet: boolean
  period: { from: string; to: string }
  leftOut: number
  /** The set against what happened: the thin second bar, read like the page's own bar. */
  bar: ResultsBar
  /** The plans that differ between the two sets, by kind in the comparison's order. */
  differ: { orders: number; share: ResultsShare; kinds: { kind: TrialChangeKind; count: number; percent: number }[] }
  estimate: ResultsBeside['estimate']
  shipments: ResultsBeside['shipments']
  listFee: ResultsBeside['listFee']
  /** "The real deliveries, as this set would have promised them." */
  promise: PromisePanelRow[]
}

export function besideView(b: ResultsBeside): BesideView {
  return {
    set: b.set,
    trialSet: !!b.set.trial,
    period: b.period,
    leftOut: b.leftOut,
    bar: resultsBar(b.top),
    differ: {
      orders: b.differ.orders,
      share: b.differ.differ,
      kinds: b.differ.kinds
        .filter((k) => k.count > 0)
        .sort((x, y) => inOrder(TRIAL_CHANGE_KINDS, x.kind) - inOrder(TRIAL_CHANGE_KINDS, y.kind)),
    },
    estimate: b.estimate,
    shipments: b.shipments,
    listFee: b.listFee,
    promise: promisePanel(b.promise),
  }
}

/**
 * The breakdowns' one more column (ticket 973): a row's same-plan share under the set beside it, as sent; '' when the
 * row carries none (the caller draws its dash). Ticket 972's Breakdowns tab draws it.
 */
export const besideCellText = (cell: ResultsBesideCell | null | undefined): string => (cell ? percentText(cell.samePlan.percent) : '')
