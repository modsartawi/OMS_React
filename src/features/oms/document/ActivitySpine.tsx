import { useMemo, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Check,
  Flag,
  History,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { SdDocumentHeaderModel, SdDocumentLogModel, SdDocumentOutboxModel } from '@/core/models/sd-document'
import { hasScheduledWindow } from '@/core/oms/delivery-window'
import { timeline, timelineInputFromHeader, type TimelineStep, type TimelineStepState } from '@/core/oms/timeline'
import { spine, type JobState, type SpineEntry } from '@/core/oms/timeline-feed'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'

/** One deferred collection (Log / Jobs): `rows: null` until it resolves. */
export interface Deferred<T> {
  rows: T[] | null
  loading: boolean
  error: string | null
}

/**
 * A milestone's dot and word per step state (spec 380 D5; 368 §3's amendment to 369).
 * *Cancellation requested* is 082's `--fam-cancel-request` indigo and *Cancelled* is danger
 * red: amber is never a state colour, it is the Rewind's (attention). The current step is
 * the inspector's ringed dot. There is no "now" tag on a milestone: after a rewind the current
 * milestone can be an old row far below the Now line, so the header's badge and the Now line
 * carry "now" (371).
 */
const MILESTONE: Partial<Record<TimelineStepState, { dot: string; ink: string; Icon: LucideIcon | null }>> = {
  done: { dot: 'border-primary bg-primary text-primary-foreground', ink: 'text-foreground', Icon: Check },
  current: { dot: 'border-primary bg-card ring-[3px] ring-primary-050', ink: 'text-foreground', Icon: null },
  requested: { dot: 'border-fam-cancel-request bg-fam-cancel-request text-primary-foreground', ink: 'text-fam-cancel-request', Icon: Flag },
  cancelled: { dot: 'border-danger bg-danger text-primary-foreground', ink: 'text-danger-800', Icon: XCircle },
}

const JOB_ICON: Record<JobState, { Icon: LucideIcon; ink: string }> = {
  done: { Icon: Zap, ink: 'text-success-800' },
  queued: { Icon: Zap, ink: 'text-muted-foreground' },
  retrying: { Icon: RefreshCw, ink: 'text-attention-800' },
  failed: { Icon: AlertTriangle, ink: 'text-danger-800' },
}

/**
 * Delivery details' spine (spec 380 D4–D7, ticket 403; ruling 371 §3–4): the timeline and the
 * activity feed as ONE vertical list, newest first. It replaces 083's Log and Jobs tabs.
 *
 * Top to bottom: one banner per failed job (no Retry: its inline end keeps room for one, 410),
 * a quiet line per job that is failing and retrying, the unreached steps furthest first (the
 * next one expecting the delivery's window), the Now line (405 puts the composer on it), then
 * the past. Every time is a Log or outbox `entryTime`, through the `@/core` derivation; the
 * header alone dates nothing.
 *
 * The header's steps draw at once; the Log and the jobs arrive after it, and until the Log has
 * loaded a reached step shows no time.
 */
export default function ActivitySpine({
  document,
  logs,
  jobs,
}: {
  document: SdDocumentHeaderModel
  logs: Deferred<SdDocumentLogModel>
  jobs: Deferred<SdDocumentOutboxModel>
}) {
  const { t } = useTranslation('document')
  const view = useMemo(() => {
    const steps = timeline(timelineInputFromHeader(document, logs.rows))
    return spine(steps, logs.rows, jobs.rows)
  }, [document, logs.rows, jobs.rows])
  // D12: the schedule's range is a machine value; the slot's own day and text are free text.
  const windowIsMachine = hasScheduledWindow(document)

  return (
    <section
      aria-label={t('spine.ariaLabel')}
      data-spine=""
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      {jobs.error && <ErrorBanner message={jobs.error} className="px-3 py-1.5" />}
      {view.failed.map((job, i) => (
        <FailedJobBanner key={`${job.outboxId}-${i}`} job={job} />
      ))}
      {view.retrying.map((job, i) => (
        <RetryingJobLine key={`${job.outboxId}-${i}`} job={job} />
      ))}

      {view.future.length > 0 && (
        <ol aria-label={t('spine.future')} className="flex flex-col">
          {view.future.map((step) => (
            <FutureStep key={step.key} step={step} windowIsMachine={windowIsMachine} />
          ))}
        </ol>
      )}

      {/* The Now line. 405 sets the note composer on it. */}
      <div data-now-line="" className="relative mt-1.5 mb-1 border-t border-dashed border-border-strong">
        <span className="absolute -top-2 start-2 bg-card px-1 text-[0.625rem] leading-4 font-bold tracking-wider text-primary uppercase">
          {t('spine.now')}
        </span>
      </div>

      {logs.error && <ErrorBanner message={logs.error} className="px-3 py-1.5" />}
      {(logs.loading || jobs.loading) && (
        <p role="status" className="text-xs text-muted-foreground">
          {t('spine.loading')}
        </p>
      )}
      <ol aria-label={t('spine.past')} className="flex flex-col">
        {view.past.map((entry, i) => (
          <PastEntry key={entryKey(entry, i)} entry={entry} />
        ))}
      </ol>
    </section>
  )
}

/** A row's key: its id where it has one, and its position, so a row the server sent without an id never collides. */
function entryKey(entry: SpineEntry, i: number): string {
  if (entry.kind === 'job') return `job-${entry.job.outboxId}-${i}`
  if (entry.kind === 'milestone' && !entry.log) return `step-${entry.step.key}`
  return `log-${entry.log?.logNo}-${i}`
}

/**
 * Line one: the handler, "failed", the attempts and the time it last failed. Line two: the
 * last error. Its inline end is the slot 410's grant-gated Retry will take; it renders nothing.
 */
function FailedJobBanner({ job }: { job: SdDocumentOutboxModel }) {
  const { t } = useTranslation('document')
  const when = formatDateTime(job.lastAttemptTime) || formatDateTime(job.entryTime)
  return (
    <div
      data-job-banner="failed"
      data-outbox-id={job.outboxId}
      className="grid grid-cols-[16px_minmax(0,1fr)_auto] gap-x-2.5 rounded-lg border border-danger-border bg-danger-050 px-3 py-1.5 text-[0.8125rem] text-danger-800"
    >
      <AlertTriangle className="mt-0.5 size-4" aria-hidden />
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
        <span className="font-semibold">
          <Trans
            t={t}
            i18nKey="jobs.failed"
            count={job.attemptCount}
            values={{ handler: handlerOf(job), count: job.attemptCount }}
            components={{ handler: <bdi />, n: <Ltr /> }}
          />
        </span>
        {when && (
          <span className="text-xs" data-when="">
            <Ltr>{when}</Ltr>
          </span>
        )}
      </div>
      {/* The Retry slot (370 / BO-1, ticket 410): room kept, nothing drawn. */}
      <span data-retry-slot="" className="row-span-2" />
      {job.errorMessage && (
        <div className="col-start-2 text-xs" data-job-error="">
          <bdi>{job.errorMessage}</bdi>
        </div>
      )}
    </div>
  )
}

/** "failing, retrying automatically · attempt n · next hh:mm", then its error. Never a button. */
function RetryingJobLine({ job }: { job: SdDocumentOutboxModel }) {
  return (
    <div
      data-job-banner="retrying"
      data-outbox-id={job.outboxId}
      className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[0.8125rem] text-muted-foreground"
    >
      <RefreshCw className="mt-0.5 size-4" aria-hidden />
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
        <b className="font-semibold text-foreground">
          <bdi>{handlerOf(job)}</bdi>
        </b>
        <RetryingText job={job} />
      </div>
      {job.errorMessage && (
        <div className="col-start-2 text-xs" data-job-error="">
          <bdi>{job.errorMessage}</bdi>
        </div>
      )}
    </div>
  )
}

function RetryingText({ job }: { job: SdDocumentOutboxModel }) {
  const { t } = useTranslation('document')
  const next = formatTimeOfDay(job.nextAttemptTime)
  return (
    <span data-retrying="">
      <Trans
        t={t}
        i18nKey={next ? 'jobs.retrying' : 'jobs.retryingNoNext'}
        values={{ n: job.attemptCount, time: next }}
        components={{ n: <Ltr />, time: <Ltr /> }}
      />
    </span>
  )
}

const handlerOf = (job: SdDocumentOutboxModel) => job.actionTypeDescription || job.actionType

/** One spine row: a dot on the line, and its content. */
function Row({ dot, children, data }: { dot: ReactNode; children: ReactNode; data: Record<string, string> }) {
  return (
    <li {...data} className="group relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 pb-2.5 last:pb-0">
      <span aria-hidden className="absolute start-[11px] top-0 bottom-0 w-0.5 bg-border group-last:bottom-auto group-last:h-3" />
      <span className="relative grid h-6 place-items-center">{dot}</span>
      <div className="min-w-0 pt-0.5">{children}</div>
    </li>
  )
}

/** An unreached step: a hollow node, dashed for the next one, which may carry an expectation. */
function FutureStep({ step, windowIsMachine }: { step: TimelineStep; windowIsMachine: boolean }) {
  const { t } = useTranslation('document')
  const dot = (
    <span
      className={`size-4 rounded-full border-2 bg-card ${step.state === 'next' ? 'border-dashed border-border-strong' : 'border-border'}`}
    />
  )
  return (
    <Row dot={dot} data={{ 'data-step': step.key, 'data-state': step.state }}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] text-muted-foreground">
        <span>{t(`step.${step.key}`)}</span>
        {step.expectedWindow && (
          // An expectation, never a time: italic, and isolated by kind (D12).
          <span className="ms-auto text-xs italic" data-expect="">
            <Trans
              t={t}
              i18nKey="spine.expected"
              values={{ window: step.expectedWindow }}
              components={{ window: windowIsMachine ? <Ltr /> : <bdi /> }}
            />
          </span>
        )}
      </div>
    </Row>
  )
}

/**
 * Who · when (D12): the user is free text in either script (`<bdi>`), the time a machine value
 * (`Ltr`). Two isolates side by side, never one string glued with a separator.
 */
function Meta({ who, at }: { who?: string; at: string | null }) {
  const when = formatDateTime(at)
  if (!who && !when) return null
  return (
    <span className="ms-auto flex shrink-0 items-baseline gap-2 text-xs text-muted-foreground" data-meta="">
      {who && (
        <span className="text-ink-3" data-who="">
          <bdi>{who}</bdi>
        </span>
      )}
      {when && (
        <span className="tabular-nums" data-when="">
          <Ltr>{when}</Ltr>
        </span>
      )}
    </span>
  )
}

/**
 * A Log row's own words under its title: its note, then its action data and the value it
 * replaced (what the retired Log tab's columns showed), each isolated as free text.
 */
function Detail({ log }: { log: SdDocumentLogModel | null }) {
  const { t } = useTranslation('document')
  if (!log || (!log.note && !log.actionData && !log.actionOldData)) return null
  return (
    <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground" data-detail="">
      {log.note && <bdi>{log.note}</bdi>}
      {log.actionData && <bdi>{log.actionData}</bdi>}
      {log.actionOldData && (
        <span data-old-value="">
          <Trans t={t} i18nKey="spine.was" values={{ value: log.actionOldData }} components={{ value: <bdi /> }} />
        </span>
      )}
    </div>
  )
}

function PastEntry({ entry }: { entry: SpineEntry }) {
  const { t } = useTranslation('document')
  switch (entry.kind) {
    case 'milestone': {
      const look = MILESTONE[entry.step.state] ?? MILESTONE.done!
      const Icon = look.Icon
      return (
        <Row
          data={{ 'data-entry': 'milestone', 'data-step': entry.step.key, 'data-state': entry.step.state }}
          dot={
            <span className={`grid size-6 place-items-center rounded-full border-2 ${look.dot}`}>
              {Icon && <Icon className="size-3.5" strokeWidth={entry.step.state === 'done' ? 3 : 2} aria-hidden />}
            </span>
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className={`text-sm font-semibold ${look.ink}`} data-label="">
              {t(`step.${entry.step.key}`)}
            </b>
            {entry.log && <Meta who={entry.log.entryUser} at={entry.at} />}
          </div>
          <Detail log={entry.log} />
        </Row>
      )
    }
    case 'superseded':
      return (
        <Row
          data={{ 'data-entry': 'superseded', 'data-step': entry.step }}
          dot={<span className="size-3 rounded-full border-2 border-border-strong bg-card" />}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] text-muted-foreground">
            <s data-label="">{t(`step.${entry.step}`)}</s>
            <span className="text-xs">{t('spine.earlierPass')}</span>
            <Meta who={entry.log.entryUser} at={entry.at} />
          </div>
        </Row>
      )
    case 'rewind':
      return (
        <Row
          data={{ 'data-entry': 'rewind', 'data-rewind': entry.rewind }}
          dot={
            <span className="grid size-6 place-items-center rounded-full border-2 border-attention bg-attention-050 text-attention-800">
              <RotateCcw className="size-3" aria-hidden />
            </span>
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-sm font-semibold text-attention-800" data-label="">
              {t(`spine.rewind.${entry.rewind}`)}
            </b>
            <Meta who={entry.log.entryUser} at={entry.at} />
          </div>
          <Detail log={entry.log} />
        </Row>
      )
    case 'note':
    case 'event': {
      const Icon = entry.kind === 'note' ? MessageSquare : History
      return (
        <Row
          data={{ 'data-entry': entry.kind, 'data-action': entry.log.actionType }}
          dot={<Icon className={`size-3.5 ${entry.kind === 'note' ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
            <span data-label="">
              <bdi>{entry.log.actionTypeDescription || entry.log.actionType}</bdi>
            </span>
            <Meta who={entry.log.entryUser} at={entry.at} />
          </div>
          <Detail log={entry.log} />
        </Row>
      )
    }
    case 'job': {
      const { Icon, ink } = JOB_ICON[entry.state]
      const failed = entry.state === 'failed'
      return (
        <Row
          data={{ 'data-entry': 'job', 'data-job-state': entry.state, 'data-outbox-id': entry.job.outboxId }}
          dot={<Icon className={`size-3.5 ${ink}`} aria-hidden />}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
            <span className={failed ? 'font-semibold text-danger-800' : ''} data-label="">
              <bdi>{handlerOf(entry.job)}</bdi>
            </span>
            <Meta at={entry.at} />
          </div>
          <div className={`text-xs ${failed ? 'text-danger-800' : 'text-muted-foreground'}`} data-detail="">
            {entry.state === 'retrying' ? (
              <RetryingText job={entry.job} />
            ) : entry.state === 'queued' ? (
              t('jobs.state.queued')
            ) : (
              <Trans
                t={t}
                i18nKey={`jobs.state.${entry.state}`}
                count={entry.job.attemptCount}
                values={{ count: entry.job.attemptCount }}
                components={{ n: <Ltr /> }}
              />
            )}
            {(failed || entry.state === 'retrying') && entry.job.errorMessage && (
              <div data-job-error="">
                <bdi>{entry.job.errorMessage}</bdi>
              </div>
            )}
          </div>
        </Row>
      )
    }
  }
}
