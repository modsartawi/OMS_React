import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { PRICE_SOURCES, type EffectivePriceJobRun, type FeedCrossCheck, type FeedHealthCompetitor, type PriceSource, type PriceWatchFeedHealth } from '@/core/models/price-watch'
import { usePermissions } from '@/core/permissions'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { formatFigure, formatMoney } from '@/core/util/number-format'
import { canManagePriceWatch } from './access'
import { priceFeedHealthApi } from './api'
import { formatPercent, materialHref, requestAuthorityChange, runState, sourceRuns, type RunState, type SourceRunRow } from './feed-health'

const NS = 'price-command-center'
const FEED_HEALTH_KEY = ['price-watch', 'feed-health'] as const

const RUN_SEVERITY: Record<RunState, Severity> = { never: 'mute', running: 'go', blocked: 'bad', quotaOrAuth: 'bad', failures: 'warn', ok: 'ok' }

/**
 * The Feed health tab (oms 939, BackOffice spec 4127 decision 8): per competitor, its authoritative source, whether it is
 * enabled or blocked (with the reason — no door clears a block), its stale and gone listings and its latest run per
 * price source; the nightly effective-price job's last run. ⚠ Per-source runs, the cross-check and the authority setting
 * are on GUESSED contracts (BO 4131 / 4128); a server without them still renders the shipped feed health.
 */
export default function FeedHealthTab() {
  const { t } = useTranslation(NS)
  const canManage = canManagePriceWatch(usePermissions())
  const client = useQueryClient()
  const read = useQuery({ queryKey: FEED_HEALTH_KEY, queryFn: () => priceFeedHealthApi.read(), retry: false })
  const change = useMutation({
    mutationFn: ({ competitor, to }: { competitor: FeedHealthCompetitor; to: PriceSource }) => requestAuthorityChange(t, competitor, to),
    onSuccess: (setting, { competitor, to }) => {
      if (setting === null) return // cancelled
      toast.success(t('feedHealth.change.done', { competitor: fsi(competitor.name || competitor.competitorCode), to: fsi(t(`feedHealth.source.${to}`)) }))
      void client.invalidateQueries({ queryKey: FEED_HEALTH_KEY })
    },
  })

  if (read.isError) return <ErrorBanner className="p-3" title={t('feedHealth.failed')} message={apiErrorMessage(read.error, t('feedHealth.failedHint'))} />
  if (read.isPending) return <p className="text-sm text-muted-foreground">{t('feedHealth.loading')}</p>
  return (
    <div className="flex flex-col gap-3">
      {change.isError && (
        <ErrorBanner className="p-3" title={t('feedHealth.change.failed')} message={apiErrorMessage(change.error, t('feedHealth.failedHint'))}>
          {apiErrorCode(change.error) && (
            <span className="font-mono text-xs" data-authority-refusal={apiErrorCode(change.error)}>
              <Ltr>{apiErrorCode(change.error)}</Ltr>
            </span>
          )}
        </ErrorBanner>
      )}
      <FeedHealthView
        health={read.data}
        canManage={canManage}
        busyCode={change.isPending ? (change.variables?.competitor.competitorCode ?? null) : null}
        onChangeAuthority={(competitor, to) => !change.isPending && change.mutate({ competitor, to })}
      />
    </div>
  )
}

/** The feed health as drawn from one read — exported for the component test. */
export function FeedHealthView({
  health,
  canManage,
  busyCode,
  onChangeAuthority,
}: {
  health: PriceWatchFeedHealth
  canManage: boolean
  /** The competitor whose authority change is being sent, if any. */
  busyCode: string | null
  onChangeAuthority: (competitor: FeedHealthCompetitor, source: PriceSource) => void
}) {
  const { t } = useTranslation(NS)
  return (
    <div className="flex flex-col gap-3" data-feed-health="">
      <p className="text-xs text-muted-foreground">
        {t('feedHealth.asOf', { at: fsi(formatDateTime(health.at)), hours: fsi(formatFigure(health.staleAfterHours)) })}
      </p>
      {health.effectivePriceJob !== undefined && <EffectivePriceJob job={health.effectivePriceJob} />}
      {health.competitors.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">{t('feedHealth.empty')}</p>
      ) : (
        health.competitors.map((c) => (
          <CompetitorFeed key={c.competitorCode} competitor={c} margin={health.crossCheckMarginPercent} canManage={canManage} busy={busyCode === c.competitorCode} onChangeAuthority={onChangeAuthority} />
        ))
      )}
    </div>
  )
}

/** The nightly effective-price job's last run (GUESSED, BO 4131): its day, watched count, priced and unpriced. */
function EffectivePriceJob({ job }: { job: EffectivePriceJobRun | null }) {
  const { t } = useTranslation(NS)
  if (job === null)
    return (
      <section className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm" data-effective-price-job="never">
        <h3 className="font-medium">{t('feedHealth.job.title')}</h3>
        <p className="text-muted-foreground">{t('feedHealth.job.never')}</p>
      </section>
    )
  const sev: Severity = job.hasError ? 'bad' : !job.isFinished ? 'go' : job.failures > 0 ? 'warn' : 'ok'
  const state = job.hasError ? 'error' : !job.isFinished ? 'running' : job.failures > 0 ? 'failures' : 'ok'
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-sm" data-effective-price-job={job.runId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{t('feedHealth.job.title')}</h3>
        <StatusBadge sev={sev}>{t(`feedHealth.job.state.${state}`)}</StatusBadge>
        <span className="text-xs text-muted-foreground">
          <Ltr>{formatDateTime(job.startedAt)}</Ltr>
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <Fact label={t('feedHealth.job.watched')} value={formatFigure(job.materials)} />
        <Fact label={t('feedHealth.job.priced')} value={formatFigure(job.priced)} />
        <Fact label={t('feedHealth.job.unpriced')} value={formatFigure(job.unpriced)} />
        <Fact label={t('feedHealth.job.failures')} value={formatFigure(job.failures)} />
        <Fact label={t('feedHealth.job.store')} value={job.referenceStore} />
      </dl>
      {job.hasError && job.errorMessage && (
        <p className="text-xs text-destructive">
          <bdi>{job.errorMessage}</bdi>
        </p>
      )}
    </section>
  )
}

/** One competitor: authority, enabled, block, listings, runs per source, cross-check and the authority setting. */
function CompetitorFeed({
  competitor: c,
  margin,
  canManage,
  busy,
  onChangeAuthority,
}: {
  competitor: FeedHealthCompetitor
  margin: number | undefined
  canManage: boolean
  busy: boolean
  onChangeAuthority: (competitor: FeedHealthCompetitor, source: PriceSource) => void
}) {
  const { t } = useTranslation(NS)
  const current = c.authoritativeSource
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 p-3" data-feed-competitor={c.competitorCode}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">
          <Ltr>{formatPair(c.competitorCode, c.name)}</Ltr>
        </h3>
        <span className="text-xs text-muted-foreground">
          <bdi>{c.kind}</bdi>
        </span>
        <StatusBadge sev={c.isEnabled ? 'ok' : 'mute'}>{c.isEnabled ? t('feedHealth.enabled') : t('feedHealth.disabled')}</StatusBadge>
        <span className="text-xs" data-feed-authority={c.authoritativeSource ?? 'unknown'}>
          <span className="text-muted-foreground">{t('feedHealth.authority')}: </span>
          {current ? t(`feedHealth.source.${current}`) : t('feedHealth.authorityUnknown')}
        </span>
        {/* The setting needs Manage, and a server that reports the authority (GUESSED door, BO 4128). Picking the other
            source opens the confirmation; the select stays on what counts until the server says otherwise. */}
        {canManage && current && (
          <Field label={t('feedHealth.change.label')} className="ms-auto w-56">
            <Select
              value={current}
              disabled={busy}
              onChange={(e) => onChangeAuthority(c, e.target.value as PriceSource)}
              data-authority-change={c.competitorCode}
            >
              {PRICE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`feedHealth.source.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {c.isBlocked && (
        <ErrorBanner className="p-2" title={t('feedHealth.blocked', { at: fsi(formatDateTime(c.blockedAt)) })} message={c.blockReason || t('feedHealth.noReason')}>
          <span className="text-xs text-muted-foreground" data-feed-blocked={c.competitorCode}>
            {t('feedHealth.blockHint')}
          </span>
        </ErrorBanner>
      )}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <Fact label={t('feedHealth.listings.matched')} value={formatFigure(c.matchedListings)} />
        <Fact label={t('feedHealth.listings.stale')} value={formatFigure(c.staleListings)} />
        <Fact label={t('feedHealth.listings.gone')} value={formatFigure(c.goneListings)} />
      </dl>
      <RunsTable competitor={c} />
      {c.crossCheck && <CrossCheck code={c.competitorCode} check={c.crossCheck} margin={margin} />}
    </section>
  )
}

/**
 * Where our scraper and Mindsite disagree above the margin at one competitor (GUESSED, BO 4131): the count, and the
 * example materials, each linked to its drill-down through `CrossCheckMaterial`.
 */
function CrossCheck({ code, check, margin }: { code: string; check: FeedCrossCheck; margin: number | undefined }) {
  const { t } = useTranslation(NS)
  if (check.disagreements === 0)
    return (
      <p className="text-xs text-muted-foreground" data-cross-check={code} data-cross-check-count={0}>
        {t('feedHealth.crossCheck.title')}: {t('feedHealth.crossCheck.none')}
      </p>
    )
  const n = fsi(formatFigure(check.disagreements))
  const th = 'px-2 py-1 text-start text-xs font-medium text-muted-foreground'
  const td = 'px-2 py-1 text-xs tabular-nums'
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/60 p-2" data-cross-check={code} data-cross-check-count={check.disagreements}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge sev="warn">{t('feedHealth.crossCheck.title')}</StatusBadge>
        <span>
          {margin === undefined
            ? t('feedHealth.crossCheck.flagNoMargin', { n })
            : t('feedHealth.crossCheck.flag', { n, margin: fsi(formatPercent(margin)) })}
        </span>
      </div>
      {check.examples.length > 0 && (
        <>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('feedHealth.crossCheck.material')}</th>
                <th className={th}>{t('feedHealth.crossCheck.day')}</th>
                <th className={th}>{t('feedHealth.crossCheck.scraper')}</th>
                <th className={th}>{t('feedHealth.crossCheck.mindsite')}</th>
                <th className={th}>{t('feedHealth.crossCheck.difference')}</th>
              </tr>
            </thead>
            <tbody>
              {check.examples.map((ex) => (
                <tr key={`${ex.materialNumber}:${ex.day}`} className="border-t border-border/60">
                  <td className={td}>
                    <CrossCheckMaterial material={ex.materialNumber} />
                  </td>
                  <td className={td}>
                    <Ltr>{formatDay(ex.day)}</Ltr>
                  </td>
                  <td className={td}>
                    <Ltr>{formatMoney(ex.scraperPaidPrice)}</Ltr>
                  </td>
                  <td className={td}>
                    <Ltr>{formatMoney(ex.mindsitePaidPrice)}</Ltr>
                  </td>
                  <td className={td}>
                    <Ltr>{formatPercent(ex.differencePercent)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">{t('feedHealth.crossCheck.more', { count: fsi(formatCount(check.examples.length, check.disagreements)) })}</p>
        </>
      )}
    </div>
  )
}

/**
 * 🔀 One cross-check material, linked to its drill-down. oms 936 (built in parallel) provides the drill-down's link
 * helper; at the merge this one function (and `materialHref`) is swapped for it — nothing else in the tab changes.
 */
function CrossCheckMaterial({ material }: { material: string }) {
  return (
    <Link to={materialHref(material)} className="font-mono text-primary underline-offset-2 hover:underline" data-cross-check-material={material}>
      <Ltr>{material}</Ltr>
    </Link>
  )
}

/** A competitor's latest run per price source, one row each. */
function RunsTable({ competitor }: { competitor: FeedHealthCompetitor }) {
  const { t } = useTranslation(NS)
  const th = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className={th}>{t('feedHealth.runs.source')}</th>
            <th className={th}>{t('feedHealth.runs.state')}</th>
            <th className={th}>{t('feedHealth.runs.pass')}</th>
            <th className={th}>{t('feedHealth.runs.started')}</th>
            <th className={th}>{t('feedHealth.runs.finished')}</th>
            <th className={th}>{t('feedHealth.runs.read')}</th>
            <th className={th}>{t('feedHealth.runs.written')}</th>
            <th className={th}>{t('feedHealth.runs.failures')}</th>
            <th className={th}>{t('feedHealth.runs.gone')}</th>
          </tr>
        </thead>
        <tbody>
          {sourceRuns(competitor).map((row) => (
            <RunRow key={row.source ?? 'any'} code={competitor.competitorCode} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunRow({ code, row }: { code: string; row: SourceRunRow }) {
  const { t } = useTranslation(NS)
  const { run } = row
  const state = runState(run)
  const td = 'px-2 py-1.5 align-top text-xs'
  const num = (n: number) => <Ltr>{formatFigure(n)}</Ltr>
  const error = run?.errorMessage || (run?.isBlocked ? run.blockReason : '')
  return (
    <tr className="border-t border-border/60" data-feed-run={`${code}:${row.source ?? 'any'}`}>
      <td className={td}>{row.source ? t(`feedHealth.source.${row.source}`) : t('feedHealth.sourceAny')}</td>
      <td className={td} data-run-state={state}>
        <StatusBadge sev={RUN_SEVERITY[state]}>{t(`feedHealth.runState.${state}`)}</StatusBadge>
        {error && (
          <div className="mt-1 text-muted-foreground">
            <bdi>{error}</bdi>
          </div>
        )}
      </td>
      {run === null ? (
        <td className={td} colSpan={7} />
      ) : (
        <>
          <td className={td}>{t(`feedHealth.pass.${run.passKind}`, { defaultValue: run.passKind })}</td>
          <td className={td + ' whitespace-nowrap'}>
            <Ltr>{formatDateTime(run.startedAt)}</Ltr>
          </td>
          <td className={td + ' whitespace-nowrap'}>{run.finishedAt === null ? t('feedHealth.runs.stillRunning') : <Ltr>{formatDateTime(run.finishedAt)}</Ltr>}</td>
          <td className={td + ' tabular-nums'}>{num(run.listingsRead)}</td>
          <td className={td + ' tabular-nums'}>{num(run.pricesWritten)}</td>
          <td className={td + ' tabular-nums'} data-run-failures={run.failures}>
            {num(run.failures)}
          </td>
          <td className={td + ' tabular-nums'}>{num(run.listingsGone)}</td>
        </>
      )}
    </tr>
  )
}

/** One labelled machine value: "Watched 1,250". */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        <Ltr>{value}</Ltr>
      </dd>
    </div>
  )
}
