import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenDeliveryStatistics } from '@/core/oms/access'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime, toIsoDate } from '@/core/util/date-format'
import { deliveryStatisticsApi } from './api'
import { courierTableTracks, courierTracks, hidesPickUp, isOfferedCourier } from './courier-scope'
import { readFigure } from './figures'
import { readHeadline } from './headline'
import HeadlineStrip from './HeadlineStrip'
import Funnels from './Funnels'
import { readLanes, showsUnspecified } from './lanes'
import { readMissesRows, type MissId, type MissesRow } from './misses-rows'
import { MAX_RANGE_DAYS, PERIOD_TABS, QUICK_PICKS, resolvePeriod, withPick, withTab, type RangePick } from './period'
import { buildStatisticsQuery, keepsPreviousAnswer, statisticsFromParams, statisticsKey, statisticsToParams, type StatisticsQuery } from './query'
import ScopeControls from './ScopeControls'
import StatisticsChart from './StatisticsChart'
import StoreTable from './StoreTable'
import Tile from './Tile'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

/**
 * Delivery statistics (ticket 484, BackOffice brief 2641, ADR 0081): the till's POS Statistics view,
 * read across every store or one (485). Read-only — no figure drills into rows.
 *
 * 🚩 **The page shows what the door sends and derives nothing.** The counting rules (each delivery
 * once, on its first event; deliveries only) are the server's; Handed over is the server's figure,
 * never Delivered + Picked up; a figure the server leaves out reads "—", never 0.
 *
 * Top to bottom, and later slices mount in their slot rather than reshaping it: the control bar
 * (period tabs, then 485's store picker and leave-outs, `ScopeControls`), the headline strip (812, spec
 * 811: six server figures and their change, `headline.ts` + `HeadlineStrip`; then Unspecified), the Delivery and Pick-up
 * funnels (489 lanes, 814 funnels: `lanes.ts` + `Funnels`), the misses band's Delivery and Pick-up rows (490, `misses-rows.ts`), the
 * Came in / Handed over chart (486; `core/charts` since 815, `StatisticsChart`) and the per-store table (487, `StoreTable`). The
 * lanes and the misses rows are the server's `tracks`, never derived from the store-wide figures nor
 * added into them.
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

/** A miss's accent, as on the till: the failures in danger, the re-plans in attention. */
const MISS_ACCENT: Record<MissId, string> = {
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

  const key = statisticsKey(query.tab, params)
  const stats = useQuery({
    queryKey: key,
    queryFn: () => deliveryStatisticsApi.read(params!),
    // 815: a refetch keeps its answer, so the chart dims rather than blanks; across keys only Today's midnight roll-over does.
    placeholderData: (previous, previousQuery) => (keepsPreviousAnswer(previousQuery?.queryKey, key) ? previous : undefined),
    // 🚩 A refused period makes NO call.
    enabled: params !== null,
    // Today only (ruled): Yesterday and Range are closed periods and do not poll.
    refetchInterval: query.tab === 'today' ? TODAY_REFRESH_MS : false,
    retry: false,
  })
  const data = params && !stats.isError ? stats.data : undefined
  // Today rolled past midnight: the previous day's answer is held while the new day's is asked (815). It
  // is NOT the current answer, so every band reads as not current — dimmed and busy alike, not the chart
  // alone (spec 811 review). A same-key Today refresh re-asks the current answer: only the chart dims.
  const stale = data !== undefined && stats.isPlaceholderData
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

      {hidesPickUp(query.courier) && (
        <p className="text-sm text-muted-foreground" data-statistics-courier-caption={query.courier}>
          <Trans
            t={t}
            i18nKey="courier.caption"
            values={{ courier: isOfferedCourier(query.courier) ? t(`courier.name.${query.courier}`) : query.courier }}
            components={{ v: <bdi className="font-medium text-foreground" /> }}
          />
        </p>
      )}

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
          <StaleBands stale={stale}>
            <HeadlineStrip tiles={readHeadline(data, dash)} previous={data.previous}>
              {showsUnspecified(data.unspecified) && (
                <Tile id="unspecified" caption={t('unspecified.caption')} value={readFigure(data.unspecified, dash)} accent="border-t-attention">
                  <span className="text-xs text-muted-foreground">{t('unspecified.note')}</span>
                </Tile>
              )}
            </HeadlineStrip>

            {/* 814: the funnels draw the lanes they are given; under a chosen courier the Pick-up funnel is
                not drawn (813, `courier-scope.ts`). */}
            <Funnels lanes={courierTracks(readLanes(data.tracks, dash), query.courier)} />

            {/* One row per track (490); the store-wide `misses` is not drawn — it stays for the table's All view. */}
            <section className="flex flex-col gap-3" data-statistics-band="misses">
              <h2 id="statistics-misses" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('band.misses')}
              </h2>
              {courierTracks(readMissesRows(data.tracks, dash), query.courier).map((row) => (
                <MissesRowBand key={row.track} row={row} />
              ))}
            </section>
          </StaleBands>

          {params && <StatisticsChart series={data.series} granularity={params.Granularity} busy={stats.isFetching} />}
          <StaleBands stale={stale}>
            <StoreTable
              stores={data.stores}
              track={query.track}
              courier={query.courier}
              views={courierTableTracks(query.courier)}
              onTrack={(track) => update((q) => ({ ...q, track }))}
            />
          </StaleBands>
        </>
      )}
    </div>
  )
}

/**
 * The bands around the chart while the answer on screen is the previous day's (`stale`): dimmed as the
 * chart's `ChartFrame` dims, `aria-busy`, and not clickable, so nothing reads it as the current answer.
 * The chart keeps its own frame (busy, with its "Updating" mark), so it is not dimmed twice.
 */
function StaleBands({ stale, children }: { stale: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-4 transition-opacity duration-300 ${stale ? 'pointer-events-none opacity-35' : ''}`}
      aria-busy={stale}
      data-statistics-stale={stale ? 'stale' : 'current'}
    >
      {children}
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
      <div role="group" aria-label={t('period.label')} className="inline-flex items-center gap-1">
        {PERIOD_TABS.map((tab) => (
          <Chip
            key={tab}
            on={query.tab === tab}
            onClick={() => onChange((q) => withTab(q, tab))}
            data-period-tab={tab}
          >
            {t(`period.tab.${tab}`)}
          </Chip>
        ))}
      </div>

      {query.tab === 'range' && (
        <>
          <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            <legend className="mb-1">
              <Trans t={t} i18nKey="period.rangeCaption" values={{ max: String(MAX_RANGE_DAYS) }} components={{ v: <Ltr /> }} />
            </legend>
            <div className="inline-flex items-center gap-1">
              {picks.map((pick) => (
                <Chip
                  key={pick}
                  on={query.pick === pick}
                  onClick={() => onChange((q) => withPick(q, pick, now))}
                  data-range-pick={pick}
                >
                  {pick === 'custom' ? (
                    t('period.custom')
                  ) : (
                    <Trans t={t} i18nKey="period.days" count={pick} values={{ n: String(pick) }} components={{ v: <Ltr /> }} />
                  )}
                </Chip>
              ))}
            </div>
          </fieldset>
          {query.pick === 'custom' && (
            <>
              <Field label={t('period.from')}>
                <Input
                  type="date"
                  value={query.from}
                  max={today}
                  onChange={(e) => {
                    const from = e.target.value
                    onChange((q) => ({ ...q, from }))
                  }}
                  className="w-40"
                  data-range-from=""
                />
              </Field>
              <Field label={t('period.to')}>
                <Input
                  type="date"
                  value={query.to}
                  max={today}
                  onChange={(e) => {
                    const to = e.target.value
                    onChange((q) => ({ ...q, to }))
                  }}
                  className="w-40"
                  data-range-to=""
                />
              </Field>
            </>
          )}
        </>
      )}
      {/* At the inline end, so a tab's own controls coming and going never move the scope. */}
      {children && <div className="ms-auto flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  )
}

/**
 * One track's "Did not go to plan" row (490), captioned with the track. The Pick-up row may carry two
 * tiles or five (`misses-rows.ts` hides what a pick-up cannot have at zero); its tiles keep the grid's
 * columns from the reading start rather than lining up under the Delivery row's same miss. The group is
 * named by the band's heading and the track ("Did not go to plan, Delivery"), so it is never read as
 * the Delivery lane.
 */
function MissesRowBand({ row }: { row: MissesRow }) {
  const { t } = useTranslation('delivery-statistics')
  const { track } = row
  return (
    <div
      role="group"
      aria-labelledby={`statistics-misses statistics-misses-${track}`}
      className="flex flex-col gap-2"
      data-statistics-misses-row={track}
    >
      <h3 id={`statistics-misses-${track}`} className="text-xs font-medium text-muted-foreground">
        {t(`lane.${track}`)}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {row.misses.map((miss) => (
          <Tile key={miss.id} id={`${track}.${miss.id}`} caption={t(`misses.${miss.id}`)} value={miss.value} accent={MISS_ACCENT[miss.id]} />
        ))}
      </div>
    </div>
  )
}
