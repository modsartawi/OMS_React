/**
 * The campaign page's pure logic (spec 558, ticket 560): a job's state in words, a failure reason
 * in words, whether to keep polling, a table's progress, and the page's URL. No React, no network —
 * each one is pinned by `job-helpers.test.ts`.
 *
 * 🚩 **States come from the door.** Nothing here decides a job's status; it only names what the
 * door said, and why (the wait or hold reason) when the door says why.
 */
import { apiErrorCode } from '@/core/api'
import type { Severity } from '@/core/ui/severity'
import {
  DATA_SYNC_PAGE_SIZE,
  JOB_FAILURE_REASONS,
  JOB_STATUSES,
  TABLE_FAILURE_CODES,
  type Campaign,
  type Job,
  type JobFailureReason,
  type JobStatus,
  type JobsQuery,
  type StoreRef,
  type TableTask,
  type TableTaskStatus,
} from '@/core/models/data-sync'
import { codeBadge, type CodeBadge } from './helpers'

// ── A job's state in words ──────────────────────────────────────────────────────

const JOB_STATUS_SEVERITY: Record<JobStatus, Severity> = {
  Queued: 'mute', // waiting for a slot — nothing to do (a wait reason raises it to warn)
  Running: 'go',
  Pausing: 'go',
  Paused: 'warn', // held until a person (or a now-safe store) resumes it
  Cancelling: 'go',
  Succeeded: 'ok',
  Failed: 'bad',
  Cancelled: 'bad',
}

export interface JobStateWords {
  /** `jobStatus.*`, or `null` for a status this bundle does not know (show the raw code). */
  labelKey: string | null
  sev: Severity
  /** `jobPhase.*` — only while Running. */
  phaseKey: string | null
  /** Why it waits (`waitReason.*`, Queued only) or who holds it (`holdReason.*`, Paused only). */
  reasonKey: string | null
  /** With `waitReason.BackingOff`: the time it will be retried (UTC, drawn local). */
  notBefore: string | null
}

/**
 * A job's status, phase and reason as the screen says them. The door sends the phase only while
 * Running, a wait reason only while Queued and a hold reason only while Paused; a reason sent
 * outside its status is ignored rather than shown against the wrong state. A queued job with a
 * reason is waiting on something outside the slot pool — ActionSync's pause, or a back-off after
 * a fault — so it reads as needing attention.
 */
export function jobStateWords(job: Pick<Job, 'status' | 'phase' | 'waitReason' | 'holdReason' | 'notBefore'>): JobStateWords {
  const badge = codeBadge(JOB_STATUS_SEVERITY, 'jobStatus', job.status)
  const out: JobStateWords = { labelKey: badge.labelKey, sev: badge.sev, phaseKey: null, reasonKey: null, notBefore: null }
  if (job.status === 'Running' && job.phase) out.phaseKey = `jobPhase.${job.phase}`
  if (job.status === 'Queued' && job.waitReason) {
    out.sev = 'warn'
    if (job.waitReason === 'BackingOff') {
      out.notBefore = job.notBefore
      out.reasonKey = job.notBefore ? 'waitReason.BackingOff' : 'waitReason.BackingOffNoTime'
    } else out.reasonKey = `waitReason.${job.waitReason}`
  }
  if (job.status === 'Paused' && job.holdReason) out.reasonKey = `holdReason.${job.holdReason}`
  return out
}

const TABLE_STATUS_SEVERITY: Record<TableTaskStatus, Severity> = {
  Pending: 'mute',
  Running: 'go',
  Paused: 'warn',
  Succeeded: 'ok',
  Failed: 'bad',
}

/** A table task's status badge (`tableStatus.*`). */
export function tableTaskStatusBadge(status: string): CodeBadge {
  return codeBadge(TABLE_STATUS_SEVERITY, 'tableStatus', status)
}

// ── A failure in words ──────────────────────────────────────────────────────────

export interface FailureWords {
  /** `failure.job.*` / `failure.table.*`, or `null` for a code this bundle does not know. */
  sentenceKey: string | null
  /** The recognised leading code, or `null`. */
  code: string | null
  /** What followed the code (a table's "code plus detail"), or `null`. */
  detail: string | null
  /** The reason exactly as the door sent it — what shows when the code is unknown. */
  raw: string
}

/**
 * A job's or a table's failure reason as a sentence key. A table's reason is "a code plus detail"
 * with no separator in the contract, so the LEADING whole word is matched against the known codes
 * and a `:`, `-` or dash after it is dropped from the detail. Anything unrecognised keeps its raw
 * text (`sentenceKey: null`) — a door newer than this bundle is shown, never hidden.
 */
export function failureWords(kind: 'job' | 'table', reason: string | null): FailureWords | null {
  const raw = reason?.trim() ?? ''
  if (!raw) return null
  const known: readonly string[] = kind === 'job' ? JOB_FAILURE_REASONS : TABLE_FAILURE_CODES
  const m = /^([A-Za-z]+)\b\s*(?:[:\-–—]\s*)?([\s\S]*)$/.exec(raw)
  const code = m?.[1] ?? ''
  if (!known.includes(code)) return { sentenceKey: null, code: null, detail: null, raw }
  return { sentenceKey: `failure.${kind}.${code}`, code, detail: m?.[2] ? m[2] : null, raw }
}

// ── Polling and progress ────────────────────────────────────────────────────────

/** The campaign page refetches every 5 s while anything is in flight (spec 558). */
export const CAMPAIGN_POLL_MS = 5_000

const TERMINAL_JOB: ReadonlySet<string> = new Set<JobStatus>(['Succeeded', 'Failed', 'Cancelled'])
const TERMINAL_CAMPAIGN: ReadonlySet<string> = new Set(['Completed', 'Cancelled'])

export const isTerminalJob = (status: string): boolean => TERMINAL_JOB.has(status)

/**
 * Whether the campaign page keeps polling: every 5 s while any job is non-terminal — counted from
 * the campaign's rollup (which covers every page, not just the one shown) and from the jobs on the
 * page (which may be fresher) — and never once the campaign is `Completed` or `Cancelled`. Nothing
 * before the campaign is read, so a not-found stays quiet. A hidden tab is react-query's to pause
 * (`refetchIntervalInBackground` is off by default).
 */
export function pollInterval(campaign: Campaign | undefined, jobs: readonly Pick<Job, 'status'>[] | undefined): number | false {
  if (!campaign) return false
  if (TERMINAL_CAMPAIGN.has(campaign.status)) return false
  const s = campaign.jobsByState
  const rollupInFlight = s.queued + s.running + s.paused > 0
  const pageInFlight = (jobs ?? []).some((j) => !isTerminalJob(j.status))
  return rollupInFlight || pageInFlight ? CAMPAIGN_POLL_MS : false
}

export type TableProgress =
  | { kind: 'indeterminate'; done: number }
  | { kind: 'determinate'; done: number; total: number; percent: number }

/**
 * A table's chunk progress: indeterminate until the table is sized (`chunksTotal` null), else
 * `chunksDone / chunksTotal` as a whole percentage, capped at 100. A sized table with no chunks
 * (an empty table) is complete.
 */
export function tableProgress(task: Pick<TableTask, 'chunksDone' | 'chunksTotal'>): TableProgress {
  if (task.chunksTotal == null) return { kind: 'indeterminate', done: task.chunksDone }
  const total = task.chunksTotal
  const percent = total <= 0 ? 100 : Math.min(100, Math.floor((task.chunksDone / total) * 100))
  return { kind: 'determinate', done: task.chunksDone, total, percent }
}

// ── The page's URL: the jobs filter, the page and the drawer ────────────────────

/** What the campaign page shows. All of it lives in the URL, so a filtered page or an open drawer can be linked. */
export interface CampaignJobsView {
  status: JobStatus | null
  /** The store search (ticket 867), trimmed; `''` is no search. */
  store: string
  /** One job failure reason code (ticket 867), or `null`. */
  failureReason: JobFailureReason | null
  page: number
  /** The job whose drawer is open (`?job=`), or `null`. */
  job: string | null
}

const isJobStatus = (v: string): v is JobStatus => (JOB_STATUSES as readonly string[]).includes(v)
const isJobFailureReason = (v: string): v is JobFailureReason => (JOB_FAILURE_REASONS as readonly string[]).includes(v)

function pageFromParam(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/**
 * The view read from the address. An unknown status or failure reason is dropped (the door refuses
 * one, case-sensitively); the store search is trimmed.
 */
export function campaignJobsFromParams(params: URLSearchParams): CampaignJobsView {
  const status = params.get('status') ?? ''
  const failureReason = params.get('failureReason') ?? ''
  return {
    status: isJobStatus(status) ? status : null,
    store: (params.get('store') ?? '').trim(),
    failureReason: isJobFailureReason(failureReason) ? failureReason : null,
    page: pageFromParam(params.get('page')),
    job: params.get('job') || null,
  }
}

/** The view written to the address — only what differs from the default. */
export function campaignJobsToParams(view: CampaignJobsView): URLSearchParams {
  const out = new URLSearchParams()
  if (view.status) out.set('status', view.status)
  if (view.store) out.set('store', view.store)
  if (view.failureReason) out.set('failureReason', view.failureReason)
  if (view.page > 1) out.set('page', String(view.page))
  if (view.job) out.set('job', view.job)
  return out
}

/** The filters a jobs read is made of (the drawer's `job` is not one). */
export type JobsFilter = Pick<CampaignJobsView, 'status' | 'page'> & Partial<Pick<CampaignJobsView, 'store' | 'failureReason'>>

/** The jobs door's query: the status and failure reason by their exact names, the store search, the page, 50 a page. */
export function jobsQuery(filter: JobsFilter): JobsQuery {
  return {
    status: filter.status,
    store: filter.store?.trim() || null,
    failureReason: filter.failureReason ?? null,
    page: filter.page,
    pageSize: DATA_SYNC_PAGE_SIZE,
  }
}

/**
 * A filter change (status, store search or failure reason): back to page one — a later page of the
 * old filter means nothing under the new one. The open drawer stays. A change to the same values (a
 * debounced echo of the search already in the address) returns the view itself, so the page is kept.
 */
export function changeJobsFilter(
  view: CampaignJobsView,
  change: Partial<Pick<CampaignJobsView, 'status' | 'store' | 'failureReason'>>,
): CampaignJobsView {
  const next = { ...view, ...change }
  if (next.status === view.status && next.store === view.store && next.failureReason === view.failureReason) return view
  return { ...next, page: 1 }
}

/** The empty grid's sentence: past page one, no more jobs; under any filter, nothing matches it; else none at all. */
export function jobsEmptyKey(view: Pick<CampaignJobsView, 'status' | 'store' | 'failureReason' | 'page'>): string {
  if (view.page > 1) return 'jobs.emptyPage'
  return view.status || view.store || view.failureReason ? 'jobs.emptyFiltered' : 'jobs.empty'
}

// ── Small pieces ────────────────────────────────────────────────────────────────

/**
 * A store as DataSync names it: `client/code` (HQ `DistributionLocation`'s key, the form the
 * door's own messages use). Built HERE once, as one machine value, so the caller isolates the whole
 * string once (`<Ltr>`) — never each half (`.claude/rules/bidi.md`).
 */
export function storeLabel(store: StoreRef): string {
  return `${store.client}/${store.code}`
}

/** A 404 for the campaign or the job: the page shows a not-found state, and nothing retries it. */
export function isDataSyncNotFound(err: unknown): boolean {
  const code = apiErrorCode(err)
  return code === 'DATASYNC_CAMPAIGN_NOT_FOUND' || code === 'DATASYNC_JOB_NOT_FOUND'
}
