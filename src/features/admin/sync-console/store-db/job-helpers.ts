/**
 * The store database write rail as the panels read it (oms 918; BackOffice spec 4016 D12, doors 4034–4037). Pure —
 * pinned by `job-helpers.test.ts`. 919 rides the same rail for restore, drop and sp_Blitz.
 */
import type { StoreDbJob, StoreDbJobKind, StoreDbJobRequest, StoreDbJobState } from '@/core/models/store-database'
import type { Severity } from '@/core/ui/severity'
import { codeBadge, type CodeBadge } from '../helpers'

/**
 * Whether a kind waits for the night window unless Run now is chosen. The server holds EVERY kind for its store's
 * window when `runNow` is false (`StoreDatabaseJobWindow.NotBefore`, pricing2 fa2759e8f); owner ruling: follow it, so
 * every kind defaults to tonight with a Run now override.
 */
export const runsTonightByDefault = (_kind: StoreDbJobKind): boolean => true

/** The kinds that need `StoreDatabase.Restore` and are asked at their own door (BO 4038). */
const RESTORE_KINDS: ReadonlySet<StoreDbJobKind> = new Set(['RestoreSideCopy', 'DropSideCopy'])

/** The door a kind is asked at: `POST StoreDatabase/RestoreJobs` (Restore) or `POST StoreDatabase/Jobs` (Act). */
export const jobDoor = (kind: StoreDbJobKind): 'StoreDatabase/Jobs' | 'StoreDatabase/RestoreJobs' =>
  RESTORE_KINDS.has(kind) ? 'StoreDatabase/RestoreJobs' : 'StoreDatabase/Jobs'

/** A job request's body. `target` is what the kind acts on (the `.bak` to restore, the side copy to drop). */
export function jobRequest(code: string, kind: StoreDbJobKind, reason: string, runNow: boolean, target?: string): StoreDbJobRequest {
  return target === undefined ? { code, kind, reason, runNow } : { code, kind, reason, runNow, target }
}

/**
 * The refusal codes of the store database doors (pricing2 fa2759e8f), each with words at `storeDb.jobs.refusals.<CODE>`;
 * the server's own text is drawn beside them by `ReasonDialog` through `apiErrorMessage`. An unknown code shows that
 * text alone.
 */
export const STORE_DB_REFUSAL_CODES: readonly string[] = [
  'BAD_REQUEST',
  'REASON_REQUIRED',
  'UNKNOWN_KIND',
  'NO_STORE',
  'NO_READING',
  'JOB_OPEN',
  'STORE_UNREACHABLE',
  'RESTORE_GRANT_REQUIRED',
  'NOT_A_RESTORE_KIND',
  'SHRINK_FREE_LOW',
  'DISK_LOW',
  'CLEANUP_OFF',
  'NEWER_ENGINE',
  'NOT_A_SIDE_COPY',
  'BACKUP_UNREADABLE',
  'NOT_A_FULL_BACKUP',
  'BACKUP_FOLDER',
  'BAD_SCHEDULE',
  'BLITZ_NOT_INSTALLED',
  'BLITZ_FAILED',
  'NO_BLITZ_BUILD',
]

const REFUSAL_CODES = new Set(STORE_DB_REFUSAL_CODES)

/** The words for a refusal code (`ReasonDialog`'s `codeLabel`), or `null` for one this bundle does not know. */
export const refusalKey = (code: string | null): string | null => (code && REFUSAL_CODES.has(code) ? `storeDb.jobs.refusals.${code}` : null)

/** A job's run-time error (the runner refused it, or it failed three times) — `null` for a job that has none. */
export const jobFailure = (job: Pick<StoreDbJob, 'error'>): string | null => (job.error && job.error.trim() !== '' ? job.error : null)

const JOB_STATE_SEVERITY: Record<StoreDbJobState, Severity> = {
  Waiting: 'mute',
  Running: 'go',
  // Open after a failed attempt: tried again at the next tick.
  Retrying: 'warn',
  Done: 'ok',
  Failed: 'bad',
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
