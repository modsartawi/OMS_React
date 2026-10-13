import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { DeliveryStatisticsFlow, DeliveryStatisticsMisses } from '@/core/models/delivery-statistics'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenDeliveryStatistics } from '@/core/oms/access'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime, toIsoDate } from '@/core/util/date-format'
import { deliveryStatisticsApi } from './api'
import { hasFigure, readAverage, readFigure } from './figures'
import { MAX_RANGE_DAYS, PERIOD_TABS, QUICK_PICKS, resolvePeriod, withPick, withTab, type RangePick } from './period'
import { buildStatisticsQuery, statisticsFromParams, statisticsToParams, type StatisticsQuery } from './query'
import ScopeControls from './ScopeControls'
import { FIELD, INPUT } from './controls'

/**
 * Delivery statistics (ticket 484, BackOffice brief 2641, ADR 0081): the till's POS Statistics view,
 * read across every store or one (485). Read-only — no figure drills into rows.
 *
 * 🚩 **The page shows what the door sends and derives nothing.** The counting rules (each delivery
 * once, on its first event; deliveries only) are the server's; Handed over is the server's figure,
 * never Delivered + Picked up; a figure the server leaves out reads "—", never 0.
 *
 * Top to bottom, and later slices mount in their slot rather than reshaping it: the control bar
 * (period tabs, then 485's store picker and leave-outs, `ScopeControls`), the flow band, the misses band with
 * Avg hand-over, the chart slot (486) and the store table slot (487).
 *
 * Behind `canOpenDeliveryStatistics` on the ONE shared OMS probe — the predicate the menu leaf
 * reads. 🚩 Its door (`SdDocumentWeb/StoreStatistics`, BackOffice 2641) is not built yet.
 */
export default function DeliveryStatisticsPage() {
  const { t } = useTranslation('delivery-statistics')
  return (
    <ScreenGate query={omsAccessQuery()} can={canOpenDeliveryStatistics} ns="delivery-statistics" title={t('title')} subtitle={t('subtitle')}>
      <Statistics />
    </ScreenGate>
  )
}

/** Today's numbers are at most 5 minutes behind, so Today asks again every 5 minutes. */
const TODAY_REFRESH_MS = 5 * 60_000

/**
 * The current time, ticking each minute, so a page left open over midnight resolves Today to the
 * new day — a new query key — rather than re-asking for the old day on its next refresh.
 */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const FLOW: readonly (keyof DeliveryStatisticsFlow)[] = ['cameIn', 'madeReady', 'outForDelivery', 'delivered', 'pickedUp', 'handedOver']
const MISSES: readonly (keyof DeliveryStatisticsMisses)[] = ['returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled']

/** A miss's accent, as on the till: the failures in danger, the re-plans in attention. */
const MISS_ACCENT: Record<keyof DeliveryStatisticsMisses, string> = {
  returnedBack: 'border-t-danger',
  rejected: 'border-t-danger',
  rescheduled: 'border-t-attention',
  closeRequested: 'border-t-attention',
  closedOrCancelled: 'border-t-border',
}

function Statistics() {
  const { t } = useTranslation('delivery-statistics')
  const { query, update } = useUrlQuery(statisticsFromParams, statisticsToParams)
  const now = useMinuteClock()
  const today = toIsoDate(now)
  const period = resolvePeriod(query, now)
  const params = period.ok ? buildStatisticsQuery(period, query) : null

  const stats = useQuery({
    queryKey: ['delivery-statistics', params],
    queryFn: () => deliveryStatisticsApi.read(params!),
    // 🚩 A refused period makes NO call.
    enabled: params !== null,
    // Today only (ruled): Yesterday and Range are closed periods and do not poll.
    refetchInterval: query.tab === 'today' ? TODAY_REFRESH_MS : false,
    retry: false,
  })
  const data = params && !stats.isError ? stats.data : undefined
  const dash = t('dash')

  return (
    <div className="flex min-w-0 flex-col gap-4" data-statistics-page="">
      <PeriodBar query={query} today={today} now={now} onChange={update}>
        <ScopeControls query={query} onChange={update} />
      </PeriodBar>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {period.ok && (
          <span data-statistics-period="">
            <Trans
              t={t}
              i18nKey="period.showing"
              values={{ range: period.from === period.to ? period.from : formatRange(period.from, period.to) }}
              components={{ v: <Ltr /> }}
            />
          </span>
        )}
        {data && (
          <span data-statistics-as-of="">
            <Trans t={t} i18nKey="asOf" values={{ time: formatDateTime(data.asOf) || dash }} components={{ v: <Ltr /> }} />
          </span>
        )}
        {params && stats.isFetching && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('loading')}
          </span>
        )}
      </div>

      {!period.ok && (
        <p role="alert" className="text-sm text-danger-800" data-statistics-refused={period.problem}>
          <Trans t={t} i18nKey={`period.problem.${period.problem}`} values={{ max: String(MAX_RANGE_DAYS) }} components={{ v: <Ltr /> }} />
        </p>
      )}

      {params && stats.isError && (
        <ErrorBanner className="p-2.5" title={t('failedTitle')} message={apiErrorMessage(stats.error, t('failed'))} />
      )}

      {data && (
        <>
          <section className="flex flex-col gap-2" data-statistics-band="flow">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('band.flow')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {FLOW.map((key) => (
                <Tile key={key} id={key} caption={t(`flow.${key}`)} value={readFigure(data.flow[key], dash)}>
                  {key === 'outForDelivery' && (
                    <span className="text-xs text-muted-foreground" data-figure="trips">
                      <Trans t={t} i18nKey="flow.trips" values={{ n: readFigure(data.flow.trips, dash) }} components={{ v: <Ltr /> }} />
                    </span>
                  )}
                </Tile>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2" data-statistics-band="misses">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('band.misses')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {MISSES.map((key) => (
                <Tile key={key} id={key} caption={t(`misses.${key}`)} value={readFigure(data.misses[key], dash)} accent={MISS_ACCENT[key]} />
              ))}
              <Tile
                id="avgHandOver"
                caption={t('avgHandOver.caption')}
                value={readAverage(data.avgHandOverMinutes, dash)}
                // A unit beside the dash would read as a value: only a number carries one.
                unit={hasFigure(data.avgHandOverMinutes) ? t('avgHandOver.unit') : undefined}
                accent="border-t-primary"
              />
            </div>
          </section>

          {/* 486 mounts the Came in / Handed over chart here. */}
          {/* 487 mounts the per-store table here. */}
        </>
      )}
    </div>
  )
}

/** The period tabs and, on Range, its quick picks and custom From–To; then the scope (485) after them. */
function PeriodBar({
  query,
  today,
  now,
  onChange,
  children,
}: {
  query: StatisticsQuery
  today: string
  now: Date
  onChange: (change: (prev: StatisticsQuery) => StatisticsQuery) => void
  children?: ReactNode
}) {
  const { t } = useTranslation('delivery-statistics')
  const picks: RangePick[] = [...QUICK_PICKS, 'custom']
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3" data-statistics-controls="">
      <div role="group" aria-label={t('period.label')} className="inline-flex h-9 items-center gap-1 rounded-full border border-border/60 bg-background p-1">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={query.tab === tab}
            onClick={() => onChange((q) => withTab(q, tab))}
            className={`${PILL} ${query.tab === tab ? PILL_ON : PILL_OFF}`}
            data-period-tab={tab}
          >
            {t(`period.tab.${tab}`)}
          </button>
        ))}
      </div>

      {query.tab === 'range' && (
        <>
          <fieldset className={FIELD}>
            <legend className="mb-1">
              <Trans t={t} i18nKey="period.rangeCaption" values={{ max: String(MAX_RANGE_DAYS) }} components={{ v: <Ltr /> }} />
            </legend>
            <div className="inline-flex h-9 items-center gap-1 rounded-full border border-border/60 bg-background p-1">
              {picks.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  aria-pressed={query.pick === pick}
                  onClick={() => onChange((q) => withPick(q, pick, now))}
                  className={`${PILL} ${query.pick === pick ? PILL_ON : PILL_OFF}`}
                  data-range-pick={pick}
                >
                  {pick === 'custom' ? (
                    t('period.custom')
                  ) : (
                    <Trans t={t} i18nKey="period.days" count={pick} values={{ n: String(pick) }} components={{ v: <Ltr /> }} />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          {query.pick === 'custom' && (
            <>
              <label className={FIELD}>
                {t('period.from')}
                <input
                  type="date"
                  value={query.from}
                  max={today}
                  onChange={(e) => {
                    const from = e.target.value
                    onChange((q) => ({ ...q, from }))
                  }}
                  className={`${INPUT} w-40`}
                  data-range-from=""
                />
              </label>
              <label className={FIELD}>
                {t('period.to')}
                <input
                  type="date"
                  value={query.to}
                  max={today}
                  onChange={(e) => {
                    const to = e.target.value
                    onChange((q) => ({ ...q, to }))
                  }}
                  className={`${INPUT} w-40`}
                  data-range-to=""
                />
              </label>
            </>
          )}
        </>
      )}
      {/* At the inline end, so a tab's own controls coming and going never move the scope. */}
      {children && <div className="ms-auto flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  )
}

const PILL = 'h-7 rounded-full px-3 text-sm font-medium transition-colors'
const PILL_ON = 'bg-primary text-primary-foreground'
const PILL_OFF = 'text-muted-foreground hover:bg-muted hover:text-foreground'

/** One figure: its caption, its value isolated whole, and an optional line under it. */
function Tile({
  id,
  caption,
  value,
  unit,
  accent = 'border-t-border',
  children,
}: {
  id: string
  caption: string
  value: string
  unit?: string
  accent?: string
  children?: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border border-t-2 border-border/60 bg-card p-3 ${accent}`} data-figure-tile={id}>
      <span className="text-xs font-medium text-muted-foreground">{caption}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums" data-figure={id}>
        <Ltr>{value}</Ltr>
        {unit && <span className="ms-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </span>
      {children}
    </div>
  )
}
