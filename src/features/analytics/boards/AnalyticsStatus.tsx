import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Activity } from 'lucide-react'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsHealth } from '@/core/models/analytics'
import StatusBadge from '@/core/ui/StatusBadge'
import Ltr from '@/core/ui/Ltr'
import { formatCount, formatPair } from '@/core/util/bidi'
import { ANALYTICS_HEALTH_KEY, analyticsApi } from './api'
import {
  HEALTH_REFRESH_MS,
  KNOWN_JOBS,
  KNOWN_RUN_STATUSES,
  firstLoadTone,
  headlineKey,
  healthTone,
  monthLabel,
  parseLastRun,
  runTone,
  storedTime,
} from './health'
import { analyticsRefusal, refusalWords } from './wire'

/**
 * The analytics status card (oms-react 785, BackOffice 3386): whether Cube is up and how the dbt runs are
 * going, from `GET Analytics/Health`. Curators only. The home renders it only when `canCurate`, and the
 * door answers `ANALYTICS-402` to anyone else. It asks again every minute while it is on screen.
 */
export default function AnalyticsStatus() {
  const { t } = useTranslation('boards')
  const health = useQuery({
    queryKey: ANALYTICS_HEALTH_KEY,
    queryFn: () => analyticsApi.health(),
    refetchInterval: HEALTH_REFRESH_MS,
    retry: false,
  })

  let body: ReactNode
  if (health.error) {
    const refusal = analyticsRefusal(health.error, t('status.loadFailed'))
    body = (
      <p className="text-sm text-muted-foreground" data-analytics-status-failed>
        {refusalWords(refusal, t)}
      </p>
    )
  } else if (!health.data) {
    body = (
      <p className="text-sm text-muted-foreground" role="status">
        {t('status.loading')}
      </p>
    )
  } else {
    body = <StatusBody h={health.data} />
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" aria-label={t('status.title')} data-analytics-status>
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Activity className="size-4 text-muted-foreground" aria-hidden />
        {t('status.title')}
      </h2>
      {body}
    </section>
  )
}

/** A stored `yyyy-MM-dd HH:mm:ss` as "date · time" in the active locale. */
const when = (stored: string, lang: string): string => {
  const iso = storedTime(stored)
  return formatPair(formatDay(iso, lang), formatClock(iso, lang))
}

function StatusBody({ h }: { h: AnalyticsHealth }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const tone = healthTone(h)
  const headline = headlineKey(h)
  const answered = h.status === 'ok' || h.status === 'fail'
  const lastGood = h.marts.lastGoodRunAtRiyadh ? when(h.marts.lastGoodRunAtRiyadh, lang) : ''
  const lastRun = parseLastRun(h.marts.lastRun)
  const checked = formatClock(h.checkedAt, lang)

  return (
    <div className="flex flex-col gap-3" data-analytics-status-tone={tone}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span data-analytics-status-headline={headline}>
          <StatusBadge sev={tone}>{t(`status.headline.${headline}`)}</StatusBadge>
        </span>
        {checked && (
          <span className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="status.checked" values={{ at: checked }} components={{ at: <Ltr /> }} />
          </span>
        )}
      </div>

      {answered && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">{t('status.cubeLabel')}</dt>
          <dd data-analytics-status-cube={h.cube}>
            <StatusBadge sev={h.cube === 'ready' ? 'ok' : 'bad'}>{t(`status.cube.${h.cube || 'unknown'}`)}</StatusBadge>
          </dd>

          <dt className="text-muted-foreground">{t('status.martsLabel')}</dt>
          <dd data-analytics-status-marts={h.marts.status}>
            <StatusBadge sev={h.marts.status === 'fresh' ? 'ok' : h.marts.status === 'stale' ? 'warn' : 'bad'}>
              {t(`status.marts.${h.marts.status || 'unknown'}`)}
            </StatusBadge>
          </dd>

          {h.firstLoad.status && <FirstLoadRow h={h} lang={lang} />}

          <dt className="text-muted-foreground">{t('status.lastGood')}</dt>
          <dd data-analytics-status-last-good>
            {lastGood ? (
              <>
                <Ltr>{lastGood}</Ltr>
                {h.marts.minutesSince !== null && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    <Trans t={t} i18nKey="status.ago" values={{ minutes: h.marts.minutesSince }} components={{ n: <Ltr /> }} />
                  </span>
                )}
                {h.marts.maxMinutes !== null && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    <Trans t={t} i18nKey="status.allowed" values={{ minutes: h.marts.maxMinutes }} components={{ n: <Ltr /> }} />
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{t('status.none')}</span>
            )}
          </dd>

          <dt className="text-muted-foreground">{t('status.lastRun')}</dt>
          <dd className="flex flex-wrap items-center gap-2" data-analytics-status-last-run={lastRun?.status ?? ''}>
            {lastRun ? (
              <>
                <span>{lastRun.job ? <JobName job={lastRun.job} /> : t('status.job.byHand')}</span>
                <StatusBadge sev={runTone(lastRun.status)}>
                  <RunOutcome status={lastRun.status} />
                </StatusBadge>
                <Ltr>{when(lastRun.at, lang)}</Ltr>
              </>
            ) : (
              <span className="text-muted-foreground">{t('status.none')}</span>
            )}
          </dd>

          {h.version && (
            <>
              <dt className="text-muted-foreground">{t('status.versionLabel')}</dt>
              <dd>
                <Ltr>{h.version}</Ltr>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}

/**
 * Image 1.2.0: the first load after a deploy (a full rebuild, then the 2026 backfill one month at a
 * time). Shown only when the container reports it; an older image sends nothing.
 */
function FirstLoadRow({ h, lang }: { h: AnalyticsHealth; lang: string }) {
  const { t } = useTranslation('boards')
  const f = h.firstLoad
  const month = monthLabel(f.currentMonth, lang)
  let detail: ReactNode = null
  if (f.status === 'running' && f.phase === 'backfill' && f.monthsDone !== null && f.monthsTotal !== null) {
    detail = (
      <Trans
        t={t}
        i18nKey={month ? 'status.firstLoad.backfillMonth' : 'status.firstLoad.backfill'}
        values={{ count: formatCount(f.monthsDone + 1, f.monthsTotal), month }}
        components={{ n: <Ltr />, m: <bdi /> }}
      />
    )
  } else if (f.status === 'running' && f.phase === 'rebuild') {
    detail = t('status.firstLoad.rebuild')
  }
  const since = f.status === 'done' ? f.finishedAtRiyadh : f.startedAtRiyadh
  return (
    <>
      <dt className="text-muted-foreground">{t('status.firstLoadLabel')}</dt>
      <dd className="flex flex-wrap items-center gap-2" data-analytics-status-first-load={f.status}>
        <StatusBadge sev={firstLoadTone(f.status)}>{t(`status.firstLoad.${f.status}`)}</StatusBadge>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        {since && (
          <span className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey={f.status === 'done' ? 'status.firstLoad.finishedAt' : 'status.firstLoad.startedAt'}
              values={{ at: when(since, lang) }}
              components={{ at: <Ltr /> }}
            />
          </span>
        )}
      </dd>
    </>
  )
}

/** A known job by its name; anything else as sent, a machine code. */
function JobName({ job }: { job: string }) {
  const { t } = useTranslation('boards')
  return (KNOWN_JOBS as readonly string[]).includes(job) ? <>{t(`status.job.${job}`)}</> : <Ltr>{job}</Ltr>
}

function RunOutcome({ status }: { status: string }) {
  const { t } = useTranslation('boards')
  return (KNOWN_RUN_STATUSES as readonly string[]).includes(status) ? <>{t(`status.run.${status}`)}</> : <Ltr>{status}</Ltr>
}
