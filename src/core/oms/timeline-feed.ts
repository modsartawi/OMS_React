import type { SdDocumentLogModel, SdDocumentOutboxModel } from '@/core/models/sd-document'
import {
  compareLogRows,
  entryTimeValue,
  latestLogFor,
  realTime,
  rewindOfLogAction,
  stepOfLogAction,
  type RewindKind,
  type TimelineStep,
  type TimelineStepKey,
} from '@/core/oms/timeline'

// Delivery details' spine (spec 380 D4–D7, ticket 403; ruling 371 §3–4): the timeline and the
// activity feed as ONE vertical list, newest first. Beside the timeline derivation in `@/core`
// because it extends it with the Log; only Details draws it (the inspector reads the row and
// fetches nothing, 367).
//
// Top to bottom the spine is: one banner per failed job, a quiet line per job that is failing
// and retrying, the unreached steps (furthest first), the Now line, then the past, newest first.
// This module builds everything but the Now line. Pure: no React, no `t`.

/** What an outbox job's status says (369 §5): `F` is terminal after five attempts. */
export type JobState = 'failed' | 'retrying' | 'queued' | 'done'

const normCode = (value: string | null | undefined) => (value ?? '').trim().toUpperCase()

/**
 * `F` failed, `C` done. A `P` job with an error is failing and retrying automatically; any other
 * job is queued.
 */
export function jobState(job: SdDocumentOutboxModel): JobState {
  const status = normCode(job.outboxStatus)
  if (status === 'F') return 'failed'
  if (status === 'C') return 'done'
  return status === 'P' && (job.errorMessage ?? '').trim() ? 'retrying' : 'queued'
}

/** One merged row: a Log row or an outbox job, at its `entryTime` (null when it has none). */
export type FeedItem =
  | { source: 'log'; at: string | null; log: SdDocumentLogModel }
  | { source: 'job'; at: string | null; job: SdDocumentOutboxModel }

const idValue = (id: string | null | undefined) => {
  const value = Number(id)
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
}

/** Newest first: by time; on a tie the Log row comes first (D6); then the higher number. */
function newestFirst(a: FeedItem, b: FeedItem): number {
  const byTime = entryTimeValue(b.at) - entryTimeValue(a.at)
  if (byTime) return byTime
  if (a.source !== b.source) return a.source === 'log' ? -1 : 1
  if (a.source === 'log' && b.source === 'log') return compareLogRows(b.log, a.log)
  if (a.source === 'job' && b.source === 'job') return idValue(b.job.outboxId) - idValue(a.job.outboxId)
  return 0
}

/**
 * The Log and the outbox jobs merged on one key, their `entryTime`, newest first (D6). On a
 * tie the Log row comes first. No server change: both reads already carry the time. A row with
 * no real time sinks to the oldest end.
 */
export function feed(
  logs: readonly SdDocumentLogModel[] | null | undefined,
  jobs: readonly SdDocumentOutboxModel[] | null | undefined,
): FeedItem[] {
  const items: FeedItem[] = [
    ...(logs ?? []).map((log): FeedItem => ({ source: 'log', at: realTime(log.entryTime), log })),
    ...(jobs ?? []).map((job): FeedItem => ({ source: 'job', at: realTime(job.entryTime), job })),
  ]
  return items.sort(newestFirst)
}

/** One row of the past (D5). */
export type SpineEntry =
  /** The latest Log row that reached a step on the timeline, or the step alone when no row did. */
  | { kind: 'milestone'; at: string | null; step: TimelineStep; log: SdDocumentLogModel | null }
  /** An earlier pass of a lifecycle step, superseded: struck through, "earlier pass". */
  | { kind: 'superseded'; at: string | null; step: TimelineStepKey; log: SdDocumentLogModel }
  /** A Rewind (`DRBK` / `DRSC` / `DCHC`): an amber node. */
  | { kind: 'rewind'; at: string | null; rewind: RewindKind; log: SdDocumentLogModel }
  | { kind: 'note'; at: string | null; log: SdDocumentLogModel }
  /** Any other Log row. */
  | { kind: 'event'; at: string | null; log: SdDocumentLogModel }
  | { kind: 'job'; at: string | null; job: SdDocumentOutboxModel; state: JobState }

/** The four steps a rewind can send a delivery back past (371 §3). The cancellation steps are final. */
const LIFECYCLE: readonly TimelineStepKey[] = ['created', 'ready', 'out', 'delivered']

/** Add note's action type per document category (083 D-11): a note row, not an event. */
const NOTE_ACTIONS = ['DADN', 'OADN', 'XADN']

const isReached = (step: TimelineStep) => step.state !== 'next' && step.state !== 'later'

export interface Spine {
  /** One banner per failed (`F`) job, newest first. */
  failed: SdDocumentOutboxModel[]
  /** One quiet line per `P` job that carries an error, newest first. */
  retrying: SdDocumentOutboxModel[]
  /** The unreached steps above the Now line, furthest first; the next one carries its window. */
  future: TimelineStep[]
  /** Below the Now line, newest first. */
  past: SpineEntry[]
}

/**
 * Whether a Rewind came after `log`: only then is a lifecycle row an earlier pass "superseded
 * by a rewind" (D5). Cancelled after delivery (`X`) drops Delivered from the timeline, but no
 * rewind sent the delivery back, so its `DDLR` row is a plain event, not struck.
 */
function rewoundAfter(log: SdDocumentLogModel, logs: readonly SdDocumentLogModel[]): boolean {
  return logs.some((other) => rewindOfLogAction(other.actionType) !== null && compareLogRows(other, log) > 0)
}

function logEntry(
  log: SdDocumentLogModel,
  at: string | null,
  milestones: Map<SdDocumentLogModel, TimelineStep>,
  logs: readonly SdDocumentLogModel[],
): SpineEntry {
  const milestone = milestones.get(log)
  if (milestone) return { kind: 'milestone', at, step: milestone, log }
  const rewind = rewindOfLogAction(log.actionType)
  if (rewind) return { kind: 'rewind', at, rewind, log }
  const step = stepOfLogAction(log.actionType)
  // Only a lifecycle step can be superseded. A cancellation request that was then carried
  // out is an ordinary event, not a struck pass (371 §3).
  if (step && LIFECYCLE.includes(step) && rewoundAfter(log, logs)) return { kind: 'superseded', at, step, log }
  if (NOTE_ACTIONS.includes(normCode(log.actionType))) return { kind: 'note', at, log }
  return { kind: 'event', at, log }
}

/**
 * The spine for one delivery: `steps` from `timeline()` over the header and the Log, plus the
 * Log and the jobs (`null` until each has loaded).
 *
 * A reached step's milestone is its latest matching Log row, the same row that gives the step
 * its time. A reached step with no row is still drawn, with no time: it goes just above the
 * step before it (at the very bottom for the first), because its place in time is unknown and
 * a guess would be worse than the order the steps are reached in.
 */
export function spine(
  steps: readonly TimelineStep[],
  logs: readonly SdDocumentLogModel[] | null | undefined,
  jobs: readonly SdDocumentOutboxModel[] | null | undefined,
): Spine {
  const reached = steps.filter(isReached)
  const milestones = new Map<SdDocumentLogModel, TimelineStep>()
  for (const step of reached) {
    const row = latestLogFor(logs, step.key)
    if (row) milestones.set(row, step)
  }

  const items = feed(logs, jobs)
  const past: SpineEntry[] = items.map((item) =>
    item.source === 'job'
      ? { kind: 'job', at: item.at, job: item.job, state: jobState(item.job) }
      : logEntry(item.log, item.at, milestones, logs ?? []),
  )

  // The reached steps no Log row dated, in the order they are reached.
  const drawn = new Set([...milestones.values()].map((step) => step.key))
  for (const [i, step] of reached.entries()) {
    if (drawn.has(step.key)) continue
    const before = reached.slice(0, i).map((s) => s.key)
    const anchor = past.findIndex((e) => e.kind === 'milestone' && before.includes(e.step.key))
    const entry: SpineEntry = { kind: 'milestone', at: null, step, log: null }
    if (anchor === -1) past.push(entry)
    else past.splice(anchor, 0, entry)
    drawn.add(step.key)
  }

  const jobsNewestFirst = items.flatMap((item) => (item.source === 'job' ? [item.job] : []))
  return {
    failed: jobsNewestFirst.filter((job) => jobState(job) === 'failed'),
    retrying: jobsNewestFirst.filter((job) => jobState(job) === 'retrying'),
    future: steps.filter((step) => !isReached(step)).reverse(),
    past,
  }
}
