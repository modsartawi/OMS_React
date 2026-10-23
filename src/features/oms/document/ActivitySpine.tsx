import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Award,
  Ban,
  Check,
  CircleSlash,
  Clock,
  CornerDownLeft,
  Eye,
  EyeOff,
  Flag,
  History,
  Inbox,
  Megaphone,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Store,
  TimerOff,
  Unlock,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { countdownLeft, formatClock } from '@/core/dispatch/view'
import type { DeliveryCalloutRecord } from '@/core/models/delivery-callout'
import type { CalloutMoment, CalloutMomentKind } from '@/core/oms/callout-moments'
import type {
  DonorRequestModel,
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
} from '@/core/models/sd-document'
import { hasScheduledWindow } from '@/core/oms/delivery-window'
import { donorOutcome, elapsedSince, type DonorOutcome } from '@/core/oms/donor-moments'
import { timeline, timelineInputFromHeader, type TimelineStep, type TimelineStepState } from '@/core/oms/timeline'
import { spine, type JobState, type SpineEntry } from '@/core/oms/timeline-feed'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatCount } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'

/** One deferred collection (Log / Jobs / donor requests): `rows: null` until it resolves. */
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

/**
 * A donor moment's ink (ticket 429): the primary tone, one icon for every donor row. An Ended row
 * takes its outcome's tone: refused and expired need attention (amber), cancelled is history.
 */
const DONOR_INK = 'text-primary'
const ENDED_INK: Record<DonorOutcome | 'none', string> = {
  refused: 'text-attention-800',
  expired: 'text-attention-800',
  cancelled: 'text-muted-foreground',
  none: 'text-muted-foreground',
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
 * next one expecting the delivery's window), the Now line with the note composer (405), then
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
  donors,
  callouts,
  calloutsReadAt = 0,
  composer,
}: {
  document: SdDocumentHeaderModel
  logs: Deferred<SdDocumentLogModel>
  jobs: Deferred<SdDocumentOutboxModel>
  /** A delivery's donor requests (ticket 429); a failure leaves the rest of the spine drawn. */
  donors?: Deferred<DonorRequestModel>
  /** A delivery's callouts (ticket 542); a failure leaves the rest of the spine drawn. */
  callouts?: Deferred<DeliveryCalloutRecord>
  /** When the callout read arrived (client clock), for an open callout's countdown. */
  calloutsReadAt?: number
  /** The note composer, set on the Now line (D8, ticket 405). The page owns its post. */
  composer?: ReactNode
}) {
  const { t } = useTranslation('document')
  const view = useMemo(() => {
    const steps = timeline(timelineInputFromHeader(document, logs.rows))
    return spine(steps, logs.rows, jobs.rows, donors?.rows, callouts?.rows)
  }, [document, logs.rows, jobs.rows, donors?.rows, callouts?.rows])
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
      {view.waiting.map((request, i) => (
        <WaitingOnDonorLine key={`${request.requestNo}-${i}`} request={request} />
      ))}
      {view.onCallout.map((callout, i) => (
        <OnCalloutLine key={`${callout.calloutId}-${i}`} callout={callout} readAt={calloutsReadAt} />
      ))}

      {/* The Now line, carrying the note composer (D4, D8): new notes join the past just below. */}
      <div
        data-now-line=""
        className="relative -mx-3 mt-1.5 mb-1 border-y border-dashed border-border-strong bg-card-2 px-3 pt-3 pb-2"
      >
        <span className="absolute -top-2 start-3 bg-card-2 px-1 text-[0.625rem] leading-4 font-bold tracking-wider text-primary uppercase">
          {t('spine.now')}
        </span>
        {composer}
      </div>

      {logs.error && <ErrorBanner message={logs.error} className="px-3 py-1.5" />}
      {donors?.error && (
        <div data-donor-error="">
          <ErrorBanner message={donors.error} className="px-3 py-1.5" />
        </div>
      )}
      {callouts?.error && (
        <div data-callout-error="">
          <ErrorBanner message={callouts.error} className="px-3 py-1.5" />
        </div>
      )}
      {(logs.loading || jobs.loading || donors?.loading || callouts?.loading) && (
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
  if (entry.kind === 'donor') return `donor-${entry.request.requestNo}-${entry.moment}-${i}`
  if (entry.kind === 'callout') return `callout-${entry.moment.callout.calloutId}-${entry.moment.event?.eventId ?? entry.moment.kind}-${i}`
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

/** The current time, ticking each minute, so an elapsed wait counts up while the page is open. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * "Waiting on donor D012 · 1h 20m" (ticket 429): one line per OPEN request nobody has picked yet,
 * below the future steps and above Now. The elapsed time is one machine value, isolated whole.
 */
function WaitingOnDonorLine({ request }: { request: DonorRequestModel }) {
  const { t } = useTranslation('document')
  const now = useMinuteClock()
  const since = elapsedSince(request.raisedAt, now)
  const elapsed = !since
    ? ''
    : since.days
      ? t('donor.elapsed.days', { d: since.days, h: since.hours })
      : since.hours
        ? t('donor.elapsed.hours', { h: since.hours, m: since.minutes })
        : t('donor.elapsed.minutes', { m: since.minutes })
  return (
    <div
      data-donor-waiting=""
      data-request-no={request.requestNo}
      className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 rounded-lg border border-dashed border-border-strong bg-card px-3 py-1.5 text-[0.8125rem] text-muted-foreground"
    >
      <ArrowLeftRight className={`mt-0.5 size-4 ${DONOR_INK}`} aria-hidden />
      <span>
        <Trans
          t={t}
          i18nKey={elapsed ? 'donor.waiting' : 'donor.waitingNoTime'}
          values={{ store: request.donorStore, elapsed }}
          // The elapsed time carries words (`1h 20m`, `1 س 20 د`): dir auto keeps each locale in its own order.
          components={{ store: <Ltr />, elapsed: <bdi /> }}
        />
      </span>
    </div>
  )
}

type DonorEntry = Extract<SpineEntry, { kind: 'donor' }>

/** A donor moment's line: what happened, at which donor, and the moment's own figures. */
function DonorText({ entry }: { entry: DonorEntry }) {
  const { t } = useTranslation('document')
  const r = entry.request
  const store = r.donorStore
  const isolate = { store: <Ltr />, n: <Ltr />, sto: <Ltr /> }
  switch (entry.moment) {
    case 'raised':
      return <Trans t={t} i18nKey="donor.raised" count={r.required} values={{ store, count: r.required }} components={isolate} />
    case 'picked':
      return (
        <Trans
          t={t}
          i18nKey="donor.picked"
          count={r.required}
          values={{ store, units: formatCount(r.picked, r.required) }}
          components={isolate}
        />
      )
    case 'transferred':
      return <Trans t={t} i18nKey="donor.transferred" values={{ store, sto: r.transferStoNo }} components={isolate} />
    case 'ended':
      return <Trans t={t} i18nKey={`donor.ended.${donorOutcome(r) ?? 'none'}`} values={{ store }} components={isolate} />
    default:
      return <Trans t={t} i18nKey={`donor.${entry.moment}`} values={{ store }} components={isolate} />
  }
}

/** Who acted on a donor moment, from the request's own record. */
function donorWho(entry: DonorEntry): string | undefined {
  const r = entry.request
  switch (entry.moment) {
    case 'raised':
      return r.raisedBy
    case 'edited':
      return r.changedBy
    case 'stamped':
      return r.lockedBy
    case 'ended':
      return r.outcomeBy
    default:
      return undefined
  }
}

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
    case 'donor': {
      const outcome = entry.moment === 'ended' ? (donorOutcome(entry.request) ?? 'none') : null
      const ink = outcome ? ENDED_INK[outcome] : DONOR_INK
      return (
        <Row
          data={{
            'data-entry': 'donor',
            'data-moment': entry.moment,
            'data-request-no': entry.request.requestNo,
            ...(outcome ? { 'data-outcome': outcome } : {}),
          }}
          dot={<ArrowLeftRight className={`size-3.5 ${ink}`} aria-hidden />}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
            <span className={outcome ? ink : ''} data-label="">
              <DonorText entry={entry} />
            </span>
            <Meta who={donorWho(entry)} at={entry.at} />
          </div>
          {entry.moment === 'ended' && entry.request.outcomeReason && (
            <div className="text-xs text-muted-foreground" data-detail="">
              <bdi>{entry.request.outcomeReason}</bdi>
            </div>
          )}
        </Row>
      )
    }
    case 'callout':
      return <CalloutMomentRow moment={entry.moment} />
    case 'job': {
      const { Icon, ink } = JOB_ICON[entry.state]
      const failed = entry.state === 'failed'
      return (
        <Row
          data={{
            'data-entry': 'job',
            'data-job-state': entry.state,
            'data-outbox-id': entry.job.outboxId,
            ...(entry.donor ? { 'data-donor-store': entry.donor.donorStore } : {}),
          }}
          dot={<Icon className={`size-3.5 ${ink}`} aria-hidden />}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
            <span className={failed ? 'font-semibold text-danger-800' : ''} data-label="">
              {entry.donor ? (
                // The DRTR transfer names its donor (ticket 429) in the donor tint; its state is unchanged.
                <span className="inline-flex items-baseline gap-1">
                  <ArrowLeftRight className={`size-3 self-center ${DONOR_INK}`} aria-hidden />
                  <Trans t={t} i18nKey="donor.job" values={{ store: entry.donor.donorStore }} components={{ store: <Ltr /> }} />
                </span>
              ) : (
                <bdi>{handlerOf(entry.job)}</bdi>
              )}
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

/** The current time, ticking each second, so an open callout's countdown moves between reads. */
function useSecondClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * "On callout · 2:20 left · waiting on 3 stores" (ticket 542; 2950 Answer point 2): one line per
 * callout still open, below the future steps and above Now. The countdown is the board's (541):
 * the door's `secondsLeft` less what the client clock has moved since the read, never below 0.
 */
function OnCalloutLine({ callout, readAt }: { callout: DeliveryCalloutRecord; readAt: number }) {
  const { t } = useTranslation('document')
  const now = useSecondClock()
  const left = countdownLeft(callout.secondsLeft, readAt || now, now)
  const waiting = callout.bids.filter((b) => b.status === 'OPEN').length
  return (
    <div
      data-on-callout={callout.calloutId}
      className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 rounded-lg border border-dashed border-primary/60 bg-card px-3 py-1.5 text-[0.8125rem] text-muted-foreground"
    >
      <Megaphone className="mt-0.5 size-4 text-primary" aria-hidden />
      <span>
        <Trans
          t={t}
          i18nKey={left === 0 ? 'callout.onCalloutDue' : 'callout.onCallout'}
          count={waiting}
          values={{ left: formatClock(left ?? 0), count: waiting }}
          components={{ left: <Ltr />, n: <Ltr /> }}
        />
      </span>
    </div>
  )
}

/** A callout moment's icon and ink: success for the award, amber where a store did not answer. */
const CALLOUT_LOOK: Record<CalloutMomentKind, { Icon: LucideIcon; ink: string }> = {
  opened: { Icon: Megaphone, ink: 'text-primary' },
  delivered: { Icon: Inbox, ink: 'text-muted-foreground' },
  shown: { Icon: Eye, ink: 'text-primary' },
  bidOpened: { Icon: Eye, ink: 'text-primary' },
  dismissed: { Icon: EyeOff, ink: 'text-muted-foreground' },
  took: { Icon: Award, ink: 'text-success-800' },
  awardedElsewhere: { Icon: CircleSlash, ink: 'text-muted-foreground' },
  passed: { Icon: SkipForward, ink: 'text-attention-800' },
  answeredLate: { Icon: Clock, ink: 'text-muted-foreground' },
  answered: { Icon: Clock, ink: 'text-muted-foreground' },
  fellBack: { Icon: CornerDownLeft, ink: 'text-attention-800' },
  withdrawn: { Icon: Ban, ink: 'text-muted-foreground' },
  lockReleased: { Icon: Unlock, ink: 'text-primary' },
  fallbackFailed: { Icon: AlertTriangle, ink: 'text-danger-800' },
  fallbackDelivered: { Icon: Store, ink: 'text-muted-foreground' },
  fallbackShown: { Icon: Store, ink: 'text-primary' },
  fallbackOpened: { Icon: Store, ink: 'text-primary' },
  fallbackDismissed: { Icon: Store, ink: 'text-muted-foreground' },
  bidExpired: { Icon: TimerOff, ink: 'text-attention-800' },
  notCompeted: { Icon: ArrowRight, ink: 'text-muted-foreground' },
  other: { Icon: History, ink: 'text-muted-foreground' },
}

/** Which word list a moment's `reason` is read against, under `callout.*`. */
const REASON_GROUP: Partial<Record<CalloutMomentKind, string>> = {
  answeredLate: 'answer',
  answered: 'answer',
  fellBack: 'endReason',
  withdrawn: 'withdrawOutcome',
  lockReleased: 'releaseReason',
  bidExpired: 'ignoreReason',
  notCompeted: 'notOpened',
}

/** A reason as its words when the client knows it, else the raw value as one machine value. */
function ReasonText({ group, value }: { group: string; value: string }) {
  const { t, i18n } = useTranslation('document')
  const key = `callout.${group}.${value}`
  return i18n.exists(`document:${key}`) ? <>{t(key)}</> : <Ltr>{value}</Ltr>
}

/** The moment's own line: what happened and at which store. */
function CalloutText({ moment }: { moment: CalloutMoment }) {
  const { t } = useTranslation('document')
  const c = moment.callout
  const isolate = { store: <Ltr />, n: <Ltr />, kind: <Ltr /> }
  switch (moment.kind) {
    case 'opened':
      return (
        <Trans
          t={t}
          i18nKey={c.fallbackParty ? 'callout.moment.opened' : 'callout.moment.openedNoFallback'}
          count={c.bids.length}
          values={{ store: c.fallbackParty, count: c.bids.length }}
          components={isolate}
        />
      )
    case 'notCompeted':
      return (
        <Trans
          t={t}
          i18nKey={moment.party ? 'callout.moment.notCompeted' : 'callout.moment.notCompetedNoStore'}
          values={{ store: moment.party }}
          components={isolate}
        />
      )
    case 'other':
      return <Trans t={t} i18nKey="callout.moment.other" values={{ kind: moment.raw, store: moment.party }} components={isolate} />
    default:
      return <Trans t={t} i18nKey={`callout.moment.${moment.kind}`} values={{ store: moment.party }} components={isolate} />
  }
}

/** A callout moment (ticket 542): beside the donor moments, one row on the spine. */
function CalloutMomentRow({ moment }: { moment: CalloutMoment }) {
  const { t } = useTranslation('document')
  const look = CALLOUT_LOOK[moment.kind]
  const group = REASON_GROUP[moment.kind]
  const reason = moment.reason.trim()
  const raw = moment.kind === 'fallbackFailed' || moment.kind === 'other' ? reason : ''
  const hasDetail = Boolean((group && reason) || raw || moment.note || moment.register || moment.kind === 'notCompeted')
  return (
    <Row
      data={{
        'data-entry': 'callout',
        'data-moment': moment.kind,
        'data-callout-id': moment.callout.calloutId,
        ...(moment.party ? { 'data-party': moment.party } : {}),
        ...(reason ? { 'data-reason': reason } : {}),
      }}
      dot={<look.Icon className={`size-3.5 ${look.ink}`} aria-hidden />}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
        <span className={look.ink === 'text-muted-foreground' ? '' : look.ink} data-label="">
          <CalloutText moment={moment} />
        </span>
        <Meta who={moment.staff || undefined} at={moment.at} />
      </div>
      {hasDetail && (
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground" data-detail="">
          {group && reason && (
            <span data-reason-text="">
              <ReasonText group={group} value={reason} />
            </span>
          )}
          {moment.kind === 'notCompeted' && (
            <span>
              <Trans
                t={t}
                i18nKey="callout.candidates"
                count={moment.callout.candidateCount}
                values={{ count: moment.callout.candidateCount }}
                components={{ n: <Ltr /> }}
              />
            </span>
          )}
          {raw && <bdi>{raw}</bdi>}
          {moment.note && (
            <span data-note="">
              <bdi>{moment.note}</bdi>
            </span>
          )}
          {moment.register && (
            <span>
              <Trans t={t} i18nKey="callout.register" values={{ reg: moment.register }} components={{ r: <Ltr /> }} />
            </span>
          )}
        </div>
      )}
    </Row>
  )
}
