/**
 * The controls' pure logic (spec 444, ticket 447): which controls a store offers, the
 * reason every control requires, the 50-store selection cap, the per-row result
 * summary, and the audit feed's query. No React, no network — pinned by
 * `control-helpers.test.ts`.
 *
 * 448 (Re-push, Cancel) and 449 (Dismiss, Edit store, Edit location) reuse the reason,
 * the cap and the result summary from here rather than growing their own.
 */
import type {
  AuditAction,
  ControlAction,
  DeadLetter,
  StoreRow,
  SyncConsoleAccess,
} from '@/core/models/sync-console'

// ── The controls a store offers ─────────────────────────────────────────────────

/**
 * The controls a store's page renders, in the order they are drawn.
 *
 * - Without `canOperate`: none — the controls are absent, not disabled.
 * - A WPF store: only Move to worker (448 adds Test connection).
 * - A worker store: Pause, or Resume when the door says it `isPaused`; then Hand back.
 *
 * The host and the paused flag are the door's fields, never a guess from health.
 */
export function allowedControls(
  row: Pick<StoreRow, 'host' | 'isPaused'>,
  access: Pick<SyncConsoleAccess, 'canOperate'> | null | undefined,
): ControlAction[] {
  if (access?.canOperate !== true) return []
  if (row.host === 'Wpf') return ['Move']
  if (row.host === 'Worker') return [row.isPaused ? 'Resume' : 'Pause', 'HandBack']
  return []
}

// ── The reason ──────────────────────────────────────────────────────────────────

/** The reason as it is sent: trimmed. */
export const cleanReason = (text: string): string => text.trim()

/** Whether a reason may be sent — not blank once trimmed. The confirm button reads this. */
export const reasonReady = (text: string): boolean => cleanReason(text) !== ''

// ── The selection cap ───────────────────────────────────────────────────────────

/** Nothing over 50 stores in one request (the door's `TOO_MANY_STORES`, ruled). */
export const SELECTION_CAP = 50

export interface CappedSelection {
  /** The selection kept: the old one, plus every addition that fits under the cap. */
  codes: string[]
  /** How many additions were refused. */
  refused: number
  /** The `sync-console` key of the refusal sentence, or `null` when nothing was refused. */
  messageKey: string | null
}

/**
 * The selection after a change, capped at `cap`.
 *
 * `wanted` is the whole selection the user asked for. A removal always goes through;
 * additions are taken in the order given until the cap is reached, and the rest (the
 * 51st and on) are refused with a message key. A selection already over the cap (it
 * cannot be, but a caller's bug must not grow it) only shrinks.
 */
export function selectionCap(current: readonly string[], wanted: readonly string[], cap = SELECTION_CAP): CappedSelection {
  const had = new Set(current)
  const want = [...new Set(wanted)]
  const kept = want.filter((c) => had.has(c))
  const added = want.filter((c) => !had.has(c))
  const room = Math.max(0, cap - kept.length)
  const taken = added.slice(0, room)
  const refused = added.length - taken.length
  const keep = new Set([...kept, ...taken])
  return {
    // The old order first, then the additions, so a refused click never reshuffles the list.
    codes: [...current.filter((c) => keep.has(c)), ...taken],
    refused,
    messageKey: refused > 0 ? 'selection.capped' : null,
  }
}

// ── Per-row results ─────────────────────────────────────────────────────────────

/** The refusal codes this bundle has words for; any other shows as its raw code. */
const FAILURE_CODES = new Set([
  'NOT_ON_WORKER',
  'NO_STORE',
  'NO_STORES',
  'TOO_MANY_STORES',
  'REASON_REQUIRED',
  // 448's command doors.
  'DUPLICATE_PENDING',
  'NOT_PENDING',
  // 449's onboarding doors.
  'BAD_CODE',
  'LOCATION_EXISTS',
  'NO_TEMPLATE',
  'DUPLICATE_IN_BATCH',
  'STORE_EXISTS',
  // Met on the built doors (450): a field over its width, and a row whose own write faulted.
  'BAD_FIELD',
  'FAILED',
])

/** A failure code's `sync-console` label key, or `null` — the caller then shows the raw code. */
export function failureLabelKey(code: string): string | null {
  return FAILURE_CODES.has(code) ? `failures.${code}` : null
}

export interface RowFailure {
  /** The row it is about — a store code, or a command id. */
  id: string
  /** The door's code, as sent; `''` when a failed row carried none. */
  code: string
  labelKey: string | null
}

export type ResultOutcome = 'allOk' | 'someFailed' | 'allFailed' | 'empty'

export interface ResultSummary {
  /** Picks the one toast sentence: `<group>.<outcome>` (`resultSentence`), interpolating `ok`, `failed` and `total`. */
  outcome: ResultOutcome
  ok: number
  failed: number
  total: number
  /** Every failed row, in the door's order, with its code. */
  failures: RowFailure[]
}

/**
 * A per-row answer (Control, Commands, RePush, Cancel, Locations, Onboard, the mirror
 * dead letters) as one toast sentence plus the list of failures. `idOf` names the row
 * (a store code by default; Cancel passes the command id), and `labelOf` words its
 * code (the store doors' `failureLabelKey` by default; 458 passes `mirrorRefusalLabel`).
 */
export function controlResultSummary<R extends { ok: boolean; error: string | null }>(
  results: readonly R[],
  idOf: (row: R) => string = (row) => (row as unknown as { code: string }).code,
  labelOf: (code: string) => string | null = failureLabelKey,
): ResultSummary {
  const failures: RowFailure[] = results
    .filter((r) => !r.ok)
    .map((r) => {
      const code = r.error ?? ''
      return { id: idOf(r), code, labelKey: code ? labelOf(code) : null }
    })
  const total = results.length
  const failed = failures.length
  const ok = total - failed
  const outcome: ResultOutcome = total === 0 ? 'empty' : failed === 0 ? 'allOk' : ok === 0 ? 'allFailed' : 'someFailed'
  return { outcome, ok, failed, total, failures }
}

// ── The mirror dead letters (spec 2563, ticket 458) ─────────────────────────────

/** What the Mirror tab can do to a selection of dead letters, in the order the buttons are drawn. */
export type DeadLetterAction = 'retry' | 'acknowledge'

/**
 * The actions a selection of dead letters may be sent, each offered only when every
 * selected row can take it — so a request never carries a row the console already
 * knows the door will refuse.
 *
 * - Without `canOperate`: none (the tab is read only, the bar absent).
 * - Retry: every row has the door's `canRetry` (apply stage, unacknowledged). It is
 *   read as sent and never recomputed from the stage.
 * - Acknowledge as lost: every row is unacknowledged, of either stage.
 */
export function deadLetterActions(
  rows: readonly Pick<DeadLetter, 'canRetry' | 'acknowledgedAt'>[],
  canOperate: boolean,
): DeadLetterAction[] {
  if (!canOperate || rows.length === 0) return []
  const actions: DeadLetterAction[] = []
  if (rows.every((r) => r.canRetry === true)) actions.push('retry')
  if (rows.every((r) => r.acknowledgedAt == null)) actions.push('acknowledge')
  return actions
}

/** The dead-letter doors' per-row refusals (2569) this bundle has words for. */
const MIRROR_REFUSALS = new Set(['PULL_STAGE', 'ACKNOWLEDGED', 'NOT_DEAD_LETTER', 'NOT_FOUND'])

/** A dead-letter refusal's `sync-console` label key, or `null` — the caller then shows the raw code. */
export function mirrorRefusalLabel(code: string): string | null {
  return MIRROR_REFUSALS.has(code) ? `mirrorRefusals.${code}` : null
}

// ── The audit feed ──────────────────────────────────────────────────────────────

/** The audit door pages; the console asks for 50 a page, as every console table does. */
export const AUDIT_PAGE_SIZE = 50

/** The fleet-wide feed's filters, as typed. Dates are bare local `yyyy-MM-dd`, `''` = unset. */
export interface AuditFilter {
  from: string
  to: string
  who: string
  code: string
}

export const EMPTY_AUDIT_FILTER: AuditFilter = { from: '', to: '', who: '', code: '' }

/** Whether a filter may be asked: an end date before the start date is refused here, not sent. */
export const auditRangeValid = (f: Pick<AuditFilter, 'from' | 'to'>): boolean =>
  f.from === '' || f.to === '' || f.from <= f.to

/**
 * The `GET ActionSync/Audit` parameters. Text is trimmed and a blank value is dropped
 * by the core query builder; the code is sent as typed (existing codes are shown as
 * stored, so the console never re-cases one).
 */
export function auditQuery(filter: AuditFilter, page: number): Record<string, unknown> {
  return {
    from: filter.from,
    to: filter.to,
    who: filter.who.trim(),
    code: filter.code.trim(),
    page: Math.max(1, Math.floor(page)),
    pageSize: AUDIT_PAGE_SIZE,
  }
}

/** Every `AuditAction` the bundle labels — a `Record`, so a new action in the model fails to compile here. */
const AUDIT_ACTIONS: Record<AuditAction, true> = {
  Move: true,
  HandBack: true,
  Pause: true,
  Resume: true,
  RePush: true,
  RetryNow: true,
  ConnectionTest: true,
  CancelCommand: true,
  CreateLocation: true,
  EditLocation: true,
  DismissPending: true,
  OnboardStore: true,
  EditStore: true,
  // The mirror rail and rail agreement (spec 2563, ticket 458).
  MirrorRetry: true,
  MirrorAcknowledge: true,
  AgreementRecheck: true,
}

/** An audit action's label key, or `null` for one this bundle does not know (show the raw code). */
export function auditActionKey(action: string): string | null {
  return Object.hasOwn(AUDIT_ACTIONS, action) ? `auditActions.${action}` : null
}
