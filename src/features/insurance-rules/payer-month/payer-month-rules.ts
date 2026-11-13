/**
 * The payer-month screen's pure rules (oms 896; BackOffice spec 1623, tickets 1628, 1639, 1644, 1648). No React,
 * no i18n calls: each answer is a key or a value the page renders, so every rule here is tested in node.
 */
import { apiErrorCode, isBareDenial } from '@/core/api'
import type {
  PayerMonthActRequest,
  PayerMonthAuditEntry,
  PayerMonthRow,
} from '@/core/models/insurance-payer-month'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'

// ---- the reason -----------------------------------------------------------------------------------------------

/** The ledger's `Reason` column is `VARCHAR(512)` (BackOffice 1648): the field counts against it. */
export const REASON_MAX = 512

export interface ReasonMeter {
  length: number
  max: number
  over: boolean
  blank: boolean
}

/** What the field shows under itself. Counted TRIMMED, as the ledger counts it (it trims, then bounds). */
export function reasonMeter(reason: string): ReasonMeter {
  const length = reason.trim().length
  return { length, max: REASON_MAX, over: length > REASON_MAX, blank: length === 0 }
}

/** What an act is about. Close all carries the count it states, read from the activity list. */
export type ActTarget =
  | { kind: 'close' | 'reopen'; row: PayerMonthRow; year: number; month: number }
  | { kind: 'closeAll'; count: number; year: number; month: number }

/**
 * The body an act posts, or `null` when it must not be sent: a blank reason, or one past the column. The page
 * sends nothing on `null`, so "close without a reason" never reaches the server.
 *
 * 🔑 No actor: the server reads it off the cookie session. Close all names no payer: the server derives its list.
 */
export function actBody(target: ActTarget, reason: string): PayerMonthActRequest | null {
  const meter = reasonMeter(reason)
  if (meter.blank || meter.over) return null
  const text = reason.trim()
  if (target.kind === 'closeAll') return { year: target.year, month: target.month, reason: text }
  return { customerId: target.row.customerId, year: target.year, month: target.month, reason: text }
}

// ---- a row ----------------------------------------------------------------------------------------------------

/** The one act a row offers: Reopen on a closed row only, Close otherwise. */
export const rowAct = (row: PayerMonthRow): 'close' | 'reopen' => (row.isClosed ? 'reopen' : 'close')

/** Closed, reopened, or open because nobody has acted — `hasRow` tells the last two apart. */
export function rowState(row: PayerMonthRow): 'closed' | 'reopened' | 'open' {
  if (row.isClosed) return 'closed'
  return row.hasRow ? 'reopened' : 'open'
}

/** The row's action and the corrections count it carries (1639: closing is a review, not a button). */
export const closeAction = (row: PayerMonthRow) => ({ act: rowAct(row), corrections: row.correctionCount })

const samePayer = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

/** An act's answer in place of its row (payers compare case-insensitively, as the server's do); appended if absent. */
export function mergeRow(rows: readonly PayerMonthRow[], answer: PayerMonthRow): PayerMonthRow[] {
  const at = rows.findIndex((r) => samePayer(r.customerId, answer.customerId))
  if (at < 0) return [...rows, answer]
  return rows.map((r, i) => (i === at ? answer : r))
}

// ---- close all ------------------------------------------------------------------------------------------------

export interface CloseAllOffer {
  /** Every payer the activity list holds — what close-all closes (the server derives the same set). */
  count: number
  /** Of those, already closed: close-all records them again rather than skipping them. */
  alreadyClosed: number
  /** Corrections across the month, so the one ask still reviews them. */
  corrections: number
}

/**
 * Close all is offered only once "Show payers with activity" has been read (BackOffice 1644): the opening read
 * is the ledger alone, and a count stated from it would be short. `null` = not offered.
 */
export function closeAllOffer(view: { activity: boolean; rows: readonly PayerMonthRow[] | undefined }): CloseAllOffer | null {
  if (!view.activity || !view.rows || view.rows.length === 0) return null
  return {
    count: view.rows.length,
    alreadyClosed: view.rows.filter((r) => r.isClosed).length,
    corrections: view.rows.reduce((sum, r) => sum + r.correctionCount, 0),
  }
}

// ---- the history ----------------------------------------------------------------------------------------------

export interface HistoryLine {
  key: 'history.action.close' | 'history.action.reopen' | 'history.action.other'
  actor: string
  at: string
  reason: string
}

/** The audit as the page lists it, oldest first as the server sends it. */
export function historyLines(audit: readonly PayerMonthAuditEntry[]): HistoryLine[] {
  return audit.map((a) => ({
    key: a.action === 'Close' ? 'history.action.close' : a.action === 'Reopen' ? 'history.action.reopen' : 'history.action.other',
    actor: a.actor ?? '',
    at: formatDateTime(a.createdAt),
    reason: a.reason ?? '',
  }))
}

// ---- the period -----------------------------------------------------------------------------------------------

export interface Period {
  year: number
  month: number
}

/** The ledger's own bounds are wider; this is what a person would pick. */
const MIN_YEAR = 2000

/** The page opens on the month before today: the month a month-end closes. */
export function defaultPeriod(now: Date = new Date()): Period {
  const m = now.getMonth() // 0-based: this month's index is last month's number
  return m === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: m }
}

/** `?year=&month=` — a link to a payer-month's view. Anything unreadable opens the default. */
export function periodFromParams(params: URLSearchParams, now: Date = new Date()): Period {
  const year = Number(params.get('year'))
  const month = Number(params.get('month'))
  const ok = Number.isInteger(year) && year >= MIN_YEAR && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12
  return ok ? { year, month } : defaultPeriod(now)
}

/** A payer-month as one machine value, `yyyy-MM` (the date formats' shape); the caller isolates it whole. */
export const periodText = (p: Period): string => `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}`

export function periodToParams(period: Period): URLSearchParams {
  return new URLSearchParams({ year: String(period.year), month: String(period.month) })
}

// ---- counts ---------------------------------------------------------------------------------------------------

/** A count for a plural `t()` sentence: `count` picks the form, `n` is what the template shows, isolated (bidi). */
export const counted = (count: number) => ({ count, n: fsi(count) })

// ---- refusals -------------------------------------------------------------------------------------------------

/** The ledger's refusals (`PayerMonthErrorCodes`): payer, period, actor, reason. */
export const REFUSAL_CODES = ['INS-16261', 'INS-16262', 'INS-16263', 'INS-16264'] as const

/** The page's sentence for a refusal it knows; `null` = show the server's own. A bare 403 is the grant. */
export function refusalKey(err: unknown): string | null {
  if (isBareDenial(err)) return 'refusal.denied'
  const code = apiErrorCode(err)
  return code && (REFUSAL_CODES as readonly string[]).includes(code) ? `refusal.${code}` : null
}
