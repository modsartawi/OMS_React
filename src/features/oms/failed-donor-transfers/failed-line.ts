/**
 * One line of the Failed donor transfers queue as HQ reads it (ticket 434, spec 430 D12). Pure: no
 * React, no `t` — the screen words what this decides.
 *
 * Lifted from WPF `FailedDonorTransferLine` (BackOffice ticket 2372): the job's label, what the line
 * asks of HQ, and whether it may be re-run. D12 adds the re-run grant to WPF's `CanReRun`.
 */
import type { FailedDonorTransferRow } from '@/core/models/failed-donor-transfer'
import { isBlankDate } from '@/core/util/date-format'

/** The job's state in words; `raw` keeps a status this side does not know, as sent. */
export type JobLabel = { kind: 'failed' } | { kind: 'retrying' } | { kind: 'completed' } | { kind: 'raw'; status: string }

/** The donor request's state as 2371 sends it; anything else is kept as sent. */
export const REQUEST_STATES = ['FULFILLED', 'TRANSFERRED', 'CANCELLED'] as const
export type RequestState = { kind: 'known'; state: (typeof REQUEST_STATES)[number] } | { kind: 'raw'; state: string }

export function requestState(wire: string | null | undefined): RequestState {
  const raw = wire ?? ''
  const norm = raw.trim().toUpperCase()
  const known = REQUEST_STATES.find((s) => s === norm)
  return known ? { kind: 'known', state: known } : { kind: 'raw', state: raw }
}

/** What the line asks of HQ. */
export type LineAction = { kind: 'reverse'; sto: string } | { kind: 'reRun' } | { kind: 'retrying' }

export interface FailedLine {
  row: FailedDonorTransferRow
  job: JobLabel
  requestState: RequestState
  action: LineAction
  /** May THIS user re-run it: D12's truth table, the grant included. 435 draws the action. */
  canReRun: boolean
  /** The job's times, or `null` when unset (`0001-…`, absent or unreadable). */
  lastAttemptAt: string | null
  deadlineAt: string | null
}

/**
 * The outbox statuses, by WPF's `SdOutboxStatusConstants` letter and by the word spec 430 D12 uses
 * for it — the door is not built, so either spelling reads alike (HITL 434).
 */
const STATUS: Record<string, 'failed' | 'retrying' | 'completed'> = {
  F: 'failed',
  FAILED: 'failed',
  P: 'retrying',
  PENDING: 'retrying',
  C: 'completed',
  COMPLETED: 'completed',
}

export function jobLabel(status: string | null | undefined): JobLabel {
  const raw = status ?? ''
  const known = STATUS[raw.trim().toUpperCase()]
  return known ? { kind: known } : { kind: 'raw', status: raw }
}

/** A wire time, or `null` when it is the .NET unset `DateTime`, absent or unreadable. */
export function whenSet(value: string | null | undefined): string | null {
  if (!value) return null
  return isBlankDate(new Date(value)) ? null : value
}

/**
 * WPF's re-run test, before the grant: never a reverse-by-hand line (its stock already moved), only
 * a FAILED job (a retrying one is still the outbox processor's), and only with an outbox ID.
 */
function reRunnable(row: FailedDonorTransferRow): boolean {
  return !row.reverseByHand && jobLabel(row.outboxStatus).kind === 'failed' && !!row.outboxId?.trim()
}

/**
 * The line, for a user who does (`canReRunGrant`) or does not hold the re-run grant.
 *
 * The sentence says what the LINE needs, so it does not hang on the grant: a failed line still
 * asks to be re-run when its reader cannot run it (HITL 434).
 */
export function failedLine(row: FailedDonorTransferRow, canReRunGrant: boolean): FailedLine {
  const runnable = reRunnable(row)
  const action: LineAction = row.reverseByHand
    ? { kind: 'reverse', sto: (row.transferStoNo ?? '').trim() }
    : runnable
      ? { kind: 'reRun' }
      : { kind: 'retrying' }
  return {
    row,
    job: jobLabel(row.outboxStatus),
    requestState: requestState(row.requestState),
    action,
    canReRun: runnable && canReRunGrant,
    lastAttemptAt: whenSet(row.lastAttemptTime),
    deadlineAt: whenSet(row.retryDeadline),
  }
}
