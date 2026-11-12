/**
 * The controls' pure logic (spec 558, ticket 563; Retry ticket 866): which Pause / Resume / Cancel / Retry a campaign or a
 * job offers, the body each control sends, and a refusal in words. No React, no network — pinned by
 * `control-helpers.test.ts`. 564 and 565 reuse `controlRefusalWords` and `isOperateDenied`.
 *
 * 🚩 **The tables are DataSync's, not ours.** They mirror the running service's state machines
 * (`CampaignStateMachine.Table`, `JobTransitions`; engine spec §2), so the page never offers a move
 * the door would refuse with `DATASYNC_INVALID_STATE`. A job's moves do NOT depend on its
 * campaign's status ([CODE] `ControlJobAsync`): a queued job may be paused before Start.
 * Start is ticket 561's, not here.
 */
import { isBareDenial } from '@/core/api'
import type { CampaignStatus, ControlRequest, JobStatus } from '@/core/models/data-sync'

export type ControlAction = 'Pause' | 'Resume' | 'Cancel' | 'Retry'

/** What a control acts on: the door's segment (`Campaigns/{id}/…` or `Jobs/{id}/…`). */
export type ControlScope = 'campaign' | 'job'

const NONE: readonly ControlAction[] = []

const CAMPAIGN_MOVES: Record<CampaignStatus, readonly ControlAction[]> = {
  Ready: ['Cancel'], // cancels at once (its jobs are all queued)
  Running: ['Pause', 'Cancel'],
  Pausing: ['Cancel'],
  Paused: ['Resume', 'Cancel'],
  Cancelling: NONE,
  Cancelled: NONE,
  Completed: NONE,
}

const JOB_MOVES: Record<JobStatus, readonly ControlAction[]> = {
  Queued: ['Pause', 'Cancel'], // any wait reason
  Running: ['Pause', 'Cancel'],
  Pausing: ['Cancel'],
  Paused: ['Resume', 'Cancel'], // held by a person or by a busy store
  Cancelling: NONE,
  Succeeded: NONE,
  Failed: NONE,
  Cancelled: NONE,
}

/**
 * Retry (ticket 866, engine spec §2.6) is NOT a status move: the server decides it and says so in
 * `Job.retryable` / `Campaign.retryableJobs` (only StoreUnreachable / TargetUnresolved, never under a
 * cancel). The page reads that answer rather than re-deriving the rule, and puts Retry last.
 */
function movesFor<K extends string>(
  table: Record<K, readonly ControlAction[]>,
  status: string,
  canOperate: boolean,
  retry: boolean,
): ControlAction[] {
  // A status newer than this bundle (or a key off Object.prototype) offers nothing — not even Retry.
  if (!canOperate || !Object.hasOwn(table, status)) return []
  const moves = [...table[status as K]]
  if (retry) moves.push('Retry')
  return moves
}

/**
 * The controls a campaign offers, in button order; `retryableJobs > 0` adds *Retry N retryable*.
 * Nothing without `DataSync.Operate`.
 */
export function campaignControls(status: string, canOperate: boolean, retryableJobs = 0): ControlAction[] {
  return movesFor(CAMPAIGN_MOVES, status, canOperate, retryableJobs > 0)
}

/** The controls one job offers, in button order; a `retryable` job adds Retry. Nothing without `DataSync.Operate`. */
export function jobControls(status: string, canOperate: boolean, retryable = false): ControlAction[] {
  return movesFor(JOB_MOVES, status, canOperate, retryable)
}

/** Pause, Cancel and Retry carry an optional note (`ControlRequest.reason`); Resume sends none. */
export const controlTakesNote = (action: ControlAction): boolean => action !== 'Resume'

/** The control's body: the note trimmed, or nothing — a blank note is no note ([CODE] trims too). */
export function controlBody(action: ControlAction, note: string): ControlRequest {
  const reason = note.trim()
  return controlTakesNote(action) && reason ? { reason } : {}
}

// ── Refusals ────────────────────────────────────────────────────────────────────

const REFUSAL_CODES: ReadonlySet<string> = new Set([
  'DATASYNC_INVALID_STATE', // the status moved on since the page read it
  'DATASYNC_STORE_BUSY', // job resume, apply: ActionSync still drives the store
  'DATASYNC_STORE_WPF_HOSTED', // job resume, apply: the store can never be applied to
  'DATASYNC_CAMPAIGN_NOT_FOUND',
  'DATASYNC_JOB_NOT_FOUND',
])

/**
 * Retry's 409s mean something else than the same codes on Pause / Resume (ticket 866): INVALID_STATE
 * is "nothing retryable any more, or the campaign is cancelling / cancelled", and BUSY says retry,
 * not resume, once ActionSync is paused. They get their own sentences (`controls.retryRefusal.<code>`).
 */
const RETRY_REFUSAL_CODES: ReadonlySet<string> = new Set([
  'DATASYNC_INVALID_STATE',
  'DATASYNC_STORE_BUSY',
  'DATASYNC_STORE_WPF_HOSTED',
])

/**
 * A control refusal's own sentence (`controls.refusal.<code>`, or `controls.retryRefusal.<code>` for
 * a Retry), shown in the dialog beside the door's message; `null` for a code it does not handle (the
 * dialog then shows the door's message and the raw code only).
 */
export function controlRefusalWords(code: string | null, action?: ControlAction): string | null {
  if (!code) return null
  if (action === 'Retry' && RETRY_REFUSAL_CODES.has(code)) return `controls.retryRefusal.${code}`
  return REFUSAL_CODES.has(code) ? `controls.refusal.${code}` : null
}

/**
 * A bare 403 on an Operate door: the grant is gone (or never held). The controls hide rather than
 * explain — the page drops `canOperate` from its cached access answer.
 */
export const isOperateDenied = (err: unknown): boolean => isBareDenial(err)
