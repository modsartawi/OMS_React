/**
 * The controls' pure logic (spec 444, ticket 447): which controls a store offers, the
 * reason every control requires, the 50-store selection cap, the per-row result
 * summary, and the audit feed's query. No React, no network — pinned by
 * `control-helpers.test.ts`.
 *
 * 448 (Re-push, Cancel) and 449 (Dismiss, Edit store, Edit location) reuse the reason,
 * the cap and the result summary from here rather than growing their own.
 */
import { CONTROL_ACTIONS } from '@/core/models/sync-console'
import type {
  AuditAction,
  ControlAction,
  DeadLetter,
  DisablePreviewStore,
  PausedStore,
  StoreRow,
  SyncAudit,
  StoreControlRequest,
} from '@/core/models/sync-console'
import type { FleetView } from './helpers'
import { canOperateSyncConsole } from './access'
import type { Permissions } from '@/core/permissions'

// ── The controls a store offers ─────────────────────────────────────────────────

/**
 * The controls a store's page renders, in the order they are drawn.
 *
 * - Without `canOperate`: none — the controls are absent, not disabled.
 * - A WPF store: only Move to worker (448 adds Test connection).
 * - A disabled store (BackOffice 3913): only Enable. It is paused underneath, but the door
 *   refuses Resume, Pause and Hand back on it (`DISABLED`), so none of them is offered.
 * - A worker store: Pause, or Resume when the door says it `isPaused`; then Disable, then Hand back.
 *
 * The host and the paused and disabled flags are the door's fields, never a guess from health.
 * A door that sends no `isDisabled` (pre-3914) reads as an active store.
 */
export function allowedControls(
  row: Pick<StoreRow, 'host' | 'isPaused' | 'isDisabled'>,
  permissions: Permissions,
): ControlAction[] {
  if (!canOperateSyncConsole(permissions)) return []
  if (row.isDisabled === true) return ['Enable']
  if (row.host === 'Wpf') return ['Move']
  if (row.host === 'Worker') return [row.isPaused ? 'Resume' : 'Pause', 'Disable', 'HandBack']
  return []
}

// ── The fleet's bulk bar (BackOffice 3913, ticket 900) ───────────────────────────

/** A bulk bar button: a lasting control, or 448's previewed Re-push. */
export type BulkAction = ControlAction | 'RePush'

/**
 * The bulk bar's buttons, in the order they are drawn. The two views never share a
 * selection (switching clears it), so each offers only what its stores can take:
 * the active view every lasting control but Enable, then Re-push, then Disable; the
 * disabled view only Enable — the door refuses everything else on a disabled store.
 */
export function bulkActions(view: FleetView, selected = 0): BulkAction[] {
  if (view === 'disabled') return ['Enable']
  // A selection over 50 ("Select all matching", ticket 902) goes through the bulk door, and the
  // screen offers a group only Pause, Resume and Disable (3913: Move and Hand back are not offered
  // for groups; Re-push has no bulk door).
  if (controlRoute(selected) === 'bulk') return ['Pause', 'Resume', 'Disable']
  return ['Move', 'HandBack', 'Pause', 'Resume', 'RePush', 'Disable']
}

// ── The Disable warnings (BackOffice 3913 "Disable warns, then allows", ticket 901) ──

/** The kinds of work HQ may not have yet, in the order the table's columns draw them. */
export type DisableWork = 'pendingActions' | 'tillBacklog' | 'deadLetters' | 'scriptsWaiting'

export interface DisableWarningRow {
  store: DisablePreviewStore
  /** What this store still holds; empty = nothing outstanding, the row is not highlighted. */
  work: DisableWork[]
}

export interface DisableWarnings {
  /** One row per store, in the door's order. */
  rows: DisableWarningRow[]
  total: number
  /** How many stores hold anything ("3 of 12 stores still hold work HQ has not received"). */
  outstanding: number
}

/**
 * The Disable preview read as warnings: which stores still hold work HQ has not received,
 * and how many. Work is a count above zero; a till backlog never measured (`null`) is not
 * work known to be held, and a failed last pass or an old connect is shown but flags nothing.
 */
export function disableWarnings(stores: readonly DisablePreviewStore[]): DisableWarnings {
  const rows = stores.map((store) => {
    const work: DisableWork[] = []
    if (store.pendingActions > 0) work.push('pendingActions')
    if ((store.tillBacklogCount ?? 0) > 0) work.push('tillBacklog')
    if (store.openDeadLetters > 0) work.push('deadLetters')
    if (store.scriptsWaiting > 0) work.push('scriptsWaiting')
    return { store, work }
  })
  return { rows, total: rows.length, outstanding: rows.filter((r) => r.work.length > 0).length }
}

/** The most rows the Disable warnings table draws: a Select-all Disable can reach thousands of stores. */
export const DISABLE_ROWS_SHOWN = 200

/**
 * The rows the warnings table draws: the stores still holding work first, then the rest, each in the
 * door's order, cut at `limit`. `hidden` counts the rows left out, so the table can say so.
 */
export function disableWarningRowsShown(
  w: DisableWarnings,
  limit = DISABLE_ROWS_SHOWN,
): { rows: DisableWarningRow[]; hidden: number } {
  const ordered = [...w.rows.filter((r) => r.work.length > 0), ...w.rows.filter((r) => r.work.length === 0)]
  return { rows: ordered.slice(0, limit), hidden: Math.max(0, ordered.length - limit) }
}

/** A long list cut at `limit`: the first ones, and how many more there are. */
export function limitedList<T>(items: readonly T[], limit: number): { shown: T[]; more: number } {
  return { shown: items.slice(0, limit), more: Math.max(0, items.length - limit) }
}

/** The preview as the dialog holds it: read, still being read, or failed. */
export type DisablePreviewState = DisableWarnings | 'loading' | 'failed'

/**
 * Whether Disable may be confirmed. **Nothing is refused** (3913): a closed store is often
 * unreachable, so the warnings — and a preview still loading or failed — never hold Confirm
 * back. The reason is the one gate, as on every control.
 */
export function disableConfirmReady(reason: string, _preview: DisablePreviewState): boolean {
  return reasonReady(reason)
}

// ── Resume all paused (BackOffice 3913, ticket 903) ─────────────────────────────

/** The preview starts with every paused store ticked: the common case is one confirm. */
export const resumeAllTicks = (stores: readonly PausedStore[]): string[] => stores.map((s) => s.code)

/** Ticks or unticks one store. The ticks are always kept in the preview's order. */
export function toggleResumeTick(stores: readonly PausedStore[], ticked: readonly string[], code: string): string[] {
  const on = new Set(ticked)
  if (on.has(code)) on.delete(code)
  else on.add(code)
  return stores.map((s) => s.code).filter((c) => on.has(c))
}

/** Tick every store, or none. */
export const tickAllResume = (stores: readonly PausedStore[], on: boolean): string[] => (on ? resumeAllTicks(stores) : [])

/**
 * The Resume the dialog sends through the bulk door (`syncConsoleApi.controlBulk`, whatever the count):
 * the ticked codes, in the preview's order, with the trimmed reason. An unticked store is left paused.
 * `null` while nothing is ticked or the reason is blank — Confirm stays off.
 */
export function resumeAllRequest(
  stores: readonly PausedStore[],
  ticked: readonly string[],
  reason: string,
): StoreControlRequest | null {
  const on = new Set(ticked)
  const codes = stores.map((s) => s.code).filter((c) => on.has(c))
  // Nothing is sent without a store or a reason: Confirm reads this.
  if (codes.length === 0 || !reasonReady(reason)) return null
  return { action: 'Resume', codes, reason: cleanReason(reason) }
}

/** What the Resume-all dialog draws: the empty state (no paused store — never an error), or the ticked list. */
export type ResumeAllView =
  | { state: 'empty' }
  | { state: 'list'; ticked: number; total: number; all: 'all' | 'some' | 'none' }

export function resumeAllView(stores: readonly PausedStore[], ticked: readonly string[]): ResumeAllView {
  if (stores.length === 0) return { state: 'empty' }
  const on = new Set(ticked)
  const n = stores.filter((s) => on.has(s.code)).length
  return { state: 'list', ticked: n, total: stores.length, all: n === stores.length ? 'all' : n === 0 ? 'none' : 'some' }
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

/**
 * "Select all matching" (BackOffice spec 3913, ticket 902): the selection becomes every
 * code `GET ActionSync/Fleet/Codes` matched under the page's filter — past the 50 cap,
 * in the door's order, each code once. It replaces the selection rather than adding to it.
 * The cap still guards clicks: `selectionCap` lets a selection already over it only shrink.
 *
 * Over `BULK_CAP` codes nothing is selected (`tooMany`): no door would take the group, so it is
 * refused here, before a reason is typed, and the operator narrows the filter instead.
 */
export function selectAllMatching(codes: readonly string[], cap = BULK_CAP): { codes: string[]; tooMany: boolean } {
  const unique = [...new Set(codes)]
  return unique.length > cap ? { codes: [], tooMany: true } : { codes: unique, tooMany: false }
}

/** The bulk door and the Disable preview take at most 5,000 distinct codes (BackOffice 3916, 3917). */
export const BULK_CAP = 5000

/**
 * The selection once the table's filter changes. Ticks (50 or fewer) are kept across filters, as
 * ever; a selection over 50 can only have come from "Select all matching" under the OLD filter, so
 * it is emptied — it would otherwise act on stores the table no longer shows.
 */
export function selectionOnFilterChange(selected: readonly string[]): string[] {
  return selected.length > SELECTION_CAP ? [] : [...selected]
}

// ── Where a control is sent (BackOffice 3913/3916, ticket 902) ──────────────────

/** The door a control goes through: the 50-store `Stores/Control`, or the bulk `Stores/Control/Bulk`. */
export type ControlRoute = 'control' | 'bulk'

/** Over 50 stores the bulk door takes it (50-store chunks, one batch); 50 or fewer keep today's door. */
export const controlRoute = (count: number): ControlRoute => (count > SELECTION_CAP ? 'bulk' : 'control')

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
  // A disabled store (BackOffice 3914): every control but Enable is refused on it, and Enable on an active one.
  'DISABLED',
  'NOT_DISABLED',
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

/** An audit row as the feed draws it: a bulk run's chunks folded into one event (ticket 902). */
export interface AuditEvent extends SyncAudit {
  /** How many audit rows (50-store chunks) the event holds; 1 for an ordinary row. */
  chunks: number
  /** Part of its batch is on another page of the feed: the door pages audit rows, not events. */
  cut: boolean
}

/** The lasting controls the bulk door writes in chunks; only their rows are folded by batch. */
const BULK_CONTROL_ACTIONS: ReadonlySet<string> = new Set<string>(CONTROL_ACTIONS)

/** The rows one event may fold: the same bulk batch, the same control, the same before and after. */
const foldKey = (r: SyncAudit): string | null =>
  r.batchId && BULK_CONTROL_ACTIONS.has(r.action)
    ? JSON.stringify([r.batchId, r.action, r.before ?? null, r.after ?? null])
    : null

/**
 * The bulk door (BackOffice 3916) writes one audit row per 50-store chunk, all sharing one
 * `batchId`. The feed draws the chunks of one batch as ONE event, where its newest chunk sits,
 * with the chunk count and every chunk's stores in the order they were sent (the door pages
 * newest first, so the oldest chunk is the first sent).
 *
 * Only a lasting control's rows are folded, and only rows with the same action, `before` and
 * `after`: anything else sharing a batch id (448's Re-push, a chunk whose change reads otherwise)
 * stays a row of its own, so one summary never misstates a change. A row with no batch is drawn
 * as it came.
 *
 * Only the page in hand is grouped: the door pages audit rows, so a batch it cuts shows its part on
 * each page. `paging` says whether a page lies before this one (`before`) or after it (`after`); the
 * event at a cut edge is marked `cut`, so the feed says the batch continues on another page.
 */
export function groupAuditByBatch(
  rows: readonly SyncAudit[],
  paging: { before: boolean; after: boolean } = { before: false, after: false },
): AuditEvent[] {
  const byKey = new Map<string, SyncAudit[]>()
  for (const r of rows) {
    const key = foldKey(r)
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), r])
  }
  const first = rows[0]
  const last = rows[rows.length - 1]
  const events: AuditEvent[] = []
  for (const r of rows) {
    const key = foldKey(r)
    const chunks = key ? byKey.get(key)! : [r]
    if (chunks[0] !== r) continue // drawn with its batch's newest chunk
    const cut = key !== null && ((paging.before && chunks.includes(first)) || (paging.after && chunks.includes(last)))
    events.push({ ...r, codes: [...chunks].reverse().flatMap((c) => c.codes), chunks: chunks.length, cut })
  }
  return events
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
  // Today's transactions (spec 2586): a view of one receipt's snapshot is audited (2589).
  TransactionSnapshotView: true,
  // Receipt replay (spec 470): one row per push.
  ReceiptReplay: true,
  // Object enrolment (BackOffice 2558, ticket 662): one row per enrolment.
  EnrolObject: true,
  // Store scripts (BackOffice spec 3202 D13, ticket 664): one row per send, withdraw and hand retry.
  SendScript: true,
  WithdrawScript: true,
  RetryScript: true,
  // A disabled store (BackOffice 3913/3914): one row per Disable and per Enable.
  Disable: true,
  Enable: true,
}

/** An audit action's label key, or `null` for one this bundle does not know (show the raw code). */
export function auditActionKey(action: string): string | null {
  return Object.hasOwn(AUDIT_ACTIONS, action) ? `auditActions.${action}` : null
}
