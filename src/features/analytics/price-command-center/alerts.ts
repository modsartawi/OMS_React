/**
 * The Alerts tab's pure rules (oms 934, BackOffice spec 4127): which door and query a filter reads, the client-side
 * narrowing the wire does not do, the ranking, the recommended price while the cost floor is unset, and the dismissal's
 * reason/note rule. No React, no `t`.
 *
 * ⚠ The wire carries no brand, B-level or product title (BO ask, ticket 934 Comments), so the filters are only those it
 * supports: whose (Mine / All), A-level (`category`), competitor and state.
 */
import {
  DISMISS_NOTE_MAX,
  DISMISS_REASONS,
  type DismissAlertBody,
  type DismissReason,
  type PriceAlertListStatus,
  type PriceAlertQuery,
  type PriceAlertStatus,
  type PriceAlertView,
} from '@/core/models/price-watch'

/** Whose price alerts the list reads: the caller's own (`Alerts/Mine`, the default) or everyone's (`Alerts`). */
export type AlertScope = 'mine' | 'all'

/**
 * The state filter. `live`, `resolved` and `all` are the server's `status`; `open`, `accepted` and `dismissed` read the
 * live list and narrow it here (the server has no per-state filter).
 */
export const ALERT_STATES = ['live', 'open', 'accepted', 'dismissed', 'resolved', 'all'] as const
export type AlertState = (typeof ALERT_STATES)[number]

export interface AlertFilter {
  scope: AlertScope
  state: AlertState
  /** A-level code, exact; '' = any. */
  category: string
  /** Competitor code, exact; '' = any. */
  competitor: string
}

export const DEFAULT_ALERT_FILTER: AlertFilter = { scope: 'mine', state: 'live', category: '', competitor: '' }

const NARROWED: Partial<Record<AlertState, PriceAlertStatus>> = { open: 'OPEN', accepted: 'ACCEPTED', dismissed: 'DISMISSED' }

/** The door and query a filter reads. Blank filters are left for `buildQuery` to drop. */
export function alertsRequest(filter: AlertFilter): { scope: AlertScope; query: PriceAlertQuery } {
  const status: PriceAlertListStatus = filter.state in NARROWED ? 'live' : (filter.state as PriceAlertListStatus)
  const query: PriceAlertQuery = { status }
  const category = filter.category.trim()
  const competitor = filter.competitor.trim()
  if (category) query.category = category
  if (competitor) query.competitor = competitor
  return { scope: filter.scope, query }
}

/** The server's own order, kept on the client: value at risk, then gap, both widest first, then the alert id. */
function byValueAtRisk(a: PriceAlertView, b: PriceAlertView): number {
  return b.valueAtRisk - a.valueAtRisk || b.gapPercent - a.gapPercent || (a.alertId < b.alertId ? -1 : a.alertId > b.alertId ? 1 : 0)
}

/** The rows the table draws for a state: narrowed where the server could not, ranked by value at risk. */
export function shownAlerts(rows: readonly PriceAlertView[], state: AlertState): PriceAlertView[] {
  const only = NARROWED[state]
  return rows.filter((row) => !only || row.status === only).sort(byValueAtRisk)
}

/** Why a dismissal may not be sent yet, or `null` when it may. */
export type DismissProblem = 'reasonRequired' | 'noteRequired' | 'noteTooLong'

const isReason = (value: string): value is DismissReason => (DISMISS_REASONS as readonly string[]).includes(value)

/**
 * The server's dismissal rule, checked before sending: a known reason (PWT-00036), a note on OTHER (PWT-00037), and the
 * note within `DISMISS_NOTE_MAX` once trimmed (the column's width). White space alone is no note.
 */
export function dismissProblem(reason: string, note: string): DismissProblem | null {
  if (!isReason(reason)) return 'reasonRequired'
  const trimmed = note.trim()
  if (reason === 'OTHER' && trimmed.length === 0) return 'noteRequired'
  if (trimmed.length > DISMISS_NOTE_MAX) return 'noteTooLong'
  return null
}

/** The body sent — call only once `dismissProblem` is null. */
export function dismissBody(reason: DismissReason, note: string): DismissAlertBody {
  return { reason, note: note.trim() }
}

/** The cost floor's one state on the wire until BO 3507 (`PriceWatchFloorStatuses`). */
export const FLOOR_NOT_SET = 'NOT_SET'

/**
 * What the recommended-price cell says.
 *
 * 🚩 While the floor is NOT_SET the server's `recommendedPrice` is NOT floored — it is only the lowest alertable competitor
 * price — so it is shown as that fact beside "awaiting cost", never as a recommendation, and no "can't match profitably"
 * verdict exists in any state (the screen holds no sentence for one). Once BO 3507 sets floors, a set floor shows the
 * server's recommended price.
 */
export type RecommendedView =
  | { kind: 'awaitingCost'; lowestPrice: number; lowestFrom: string }
  | { kind: 'price'; price: number; from: string }

export function recommendedView(alert: PriceAlertView): RecommendedView {
  return alert.floorStatus === FLOOR_NOT_SET
    ? { kind: 'awaitingCost', lowestPrice: alert.recommendedPrice, lowestFrom: alert.recommendedFrom }
    : { kind: 'price', price: alert.recommendedPrice, from: alert.recommendedFrom }
}

/**
 * An alert's gap percent as drawn: "11.33%". 🔑 The alert wire's sense — positive = the competitor is cheaper — is kept
 * as is (the column reads "Competitor cheaper by"); the drill-down's comparison gap has the opposite sign and is never
 * fed through this.
 */
export function formatGapPercent(percent: number): string {
  return `${percent.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}
