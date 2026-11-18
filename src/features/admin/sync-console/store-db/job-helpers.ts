/**
 * The store database write rail as the panels read it (oms 918; BackOffice spec 4016 D12, doors 4034–4037). Pure —
 * pinned by `job-helpers.test.ts`. 919 rides the same rail for restore, drop and sp_Blitz.
 */
import type { StoreDbJob, StoreDbJobKind, StoreDbJobRequest, StoreDbJobState } from '@/core/models/store-database'
import type { Severity } from '@/core/ui/severity'
import { codeBadge, type CodeBadge } from '../helpers'

/**
 * The kinds that wait for the night window unless Run now is chosen (spec D13/story 26–27: the ones that take the
 * store's sync locks). Every other kind runs at once — the dialog offers no choice for it.
 */
const NIGHT_WINDOW_KINDS: ReadonlySet<StoreDbJobKind> = new Set(['ShrinkData', 'RestoreSideCopy', 'DropSideCopy'])

export const runsTonightByDefault = (kind: StoreDbJobKind): boolean => NIGHT_WINDOW_KINDS.has(kind)

/** The extra field a kind carries (919: the `.bak` for a restore, the side copy for a drop). */
export type StoreDbJobExtra = Pick<StoreDbJobRequest, 'file' | 'database'>

/** The `POST StoreDatabase/Jobs` body. A light kind always runs now; `runNow` is honoured for the heavy ones only. */
export function jobRequest(code: string, kind: StoreDbJobKind, reason: string, runNow: boolean, extra: StoreDbJobExtra = {}): StoreDbJobRequest {
  return { code, kind, reason, runNow: runsTonightByDefault(kind) ? runNow : true, ...extra }
}

/**
 * The refusal codes this bundle has words for (`storeDb.jobs.refusals.<CODE>`). GUESSED spellings (contract.md §7);
 * an unknown code still shows the server's own text — `ReasonDialog` draws that text through `apiErrorMessage`.
 */
const REFUSAL_CODES = new Set([
  'REASON_REQUIRED',
  'UNKNOWN_KIND',
  'NOT_WORKER_STORE',
  'JOB_OPEN',
  'TOO_LITTLE_FREE',
  'DISK_TOO_LOW',
  'CLEANUP_OFF',
  'NEWER_ENGINE',
  'NOT_A_SIDE_COPY',
  'BLITZ_NOT_INSTALLED',
])

/** The words for a refusal code (`ReasonDialog`'s `codeLabel`), or `null` for one this bundle does not know. */
export const refusalKey = (code: string | null): string | null => (code && REFUSAL_CODES.has(code) ? `storeDb.jobs.refusals.${code}` : null)

/** A job's run-time error (the runner refused it, or it failed three times) — `null` for a job that has none. */
export const jobFailure = (job: Pick<StoreDbJob, 'error'>): string | null => (job.error && job.error.trim() !== '' ? job.error : null)

const JOB_STATE_SEVERITY: Record<StoreDbJobState, Severity> = {
  Queued: 'mute',
  Running: 'go',
  Done: 'ok',
  Failed: 'bad',
  // Gave way to a sync visit holding the store's locks; retried next tick without an attempt (4036/4037).
  Deferred: 'warn',
}

/** A job state's badge; an unknown state is neutral with no key (the cell shows the raw word). */
export const jobStateBadge = (state: string): CodeBadge => codeBadge(JOB_STATE_SEVERITY, 'storeDb.jobs.states', state)

/** The job kinds this bundle has words for (`storeDb.jobs.kinds.<Kind>`). */
export const JOB_KINDS: readonly StoreDbJobKind[] = [
  'ShrinkLog',
  'ShrinkData',
  'Backup',
  'RestoreSideCopy',
  'DropSideCopy',
  'Cleanup',
  'InstallBlitz',
  'RemoveBlitz',
]

/** A kind's label key, or `null` for a kind a newer door sends. */
export const jobKindKey = (kind: string): string | null =>
  (JOB_KINDS as readonly string[]).includes(kind) ? `storeDb.jobs.kinds.${kind}.label` : null
