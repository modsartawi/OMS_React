import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canOpenDispatchBoard, dispatchAccessQuery } from '@/core/dispatch/access'
import type { RoadShadowReport } from '@/core/models/dispatch-board'
import { lookupQueries } from '@/core/services/lookups'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair, formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { roadShadowQuery } from './api'
import {
  DEFAULT_SHADOW_DAYS,
  DEFAULT_SHADOW_TYPE,
  NORMAL_ROAD_RATIO,
  fallbackReason,
  fallbackSummary,
  headlineTiles,
  isEmptyRange,
  medianReading,
  pickRangeEnd,
  resolveShadowRange,
  shadowFiltersFromParams,
  shadowFiltersToParams,
  shadowWire,
  type ShadowFilters,
} from './road-shadow'

/**
 * Road distance (Shadow) — `/oms/dispatch-board/road-shadow` (ticket 859, BackOffice spec 3460, door 3470). What
 * deciding callouts by road WOULD have changed on the deliveries a Shadow type measured: four headline counts, the
 * straight-line fallbacks by reason, and the median road / straight ratio. The owner reads the Shadow week here to
 * decide whether QC goes On, and whether 5 / 10 km should be retuned (runbook §4–§7).
 *
 * Read-only and counts only: the door sends no delivery, store or customer, so nothing drills. Behind the board's own
 * Display grant (`canOpenDispatchBoard`), no new grant. The range and the type live in the URL.
 */
export default function RoadShadowPage() {
  const { t } = useTranslation('dispatch-board')
  return (
    <ScreenGate
      query={dispatchAccessQuery()}
      can={canOpenDispatchBoard}
      ns="dispatch-board"
      title={t('roadShadow.title')}
      subtitle={t('roadShadow.subtitle')}
    >
      <RoadShadow />
    </ScreenGate>
  )
}

function RoadShadow() {
  const { t } = useTranslation('dispatch-board')
  const { query: filters, update } = useUrlQuery(shadowFiltersFromParams, shadowFiltersToParams)
  // "Today" is read once per visit, so a default range opened at 23:59 does not slide under the reader.
  const [now] = useState(() => new Date())
  const range = useMemo(() => resolveShadowRange(filters, now), [filters, now])
  const wire = useMemo(() => (range.ok ? shadowWire(filters, range) : null), [filters, range])
  const report = useQuery(roadShadowQuery(wire))

  return (
    <div className="flex flex-col gap-3">
      <Filters filters={filters} range={range} update={update} />

      {report.isError ? (
        <div data-rs-failed="">
          <ErrorBanner className="p-2.5" title={t('roadShadow.failedTitle')} message={apiErrorMessage(report.error, t('roadShadow.failed'))} />
        </div>
      ) : report.isPending ? (
        range.ok && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-rs-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('roadShadow.loading')}
          </p>
        )
      ) : (
        <Report report={report.data} type={filters.type} />
      )}
    </div>
  )
}

function Filters({
  filters,
  range,
  update,
}: {
  filters: ShadowFilters
  range: ReturnType<typeof resolveShadowRange>
  update: (change: (prev: ShadowFilters) => ShadowFilters) => void
}) {
  const { t } = useTranslation('dispatch-board')
  const types = useQuery(lookupQueries.deliveryDocumentTypes())
  // QC is always offered (it is the default), and so is a type a pasted URL holds that the lookup does not list.
  const options = useMemo(() => {
    const listed = (types.data ?? []).map((d) => ({ code: d.documentType.trim().toUpperCase(), description: d.description }))
    for (const code of [DEFAULT_SHADOW_TYPE, filters.type])
      if (code && !listed.some((d) => d.code === code)) listed.unshift({ code, description: '' })
    return listed
  }, [types.data, filters.type])
  const shownFrom = filters.from || (range.ok ? range.from : '')
  const shownTo = filters.to || (range.ok ? range.to : '')

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3" data-rs-filters="">
      <Field label={t('roadShadow.filters.from')}>
        <Input
          type="date"
          value={shownFrom}
          onChange={(e) => update((prev) => pickRangeEnd(prev, 'from', e.target.value, { from: shownFrom, to: shownTo }))}
          className="w-40"
          data-rs-filter="from"
        />
      </Field>
      <Field label={t('roadShadow.filters.to')}>
        <Input
          type="date"
          value={shownTo}
          onChange={(e) => update((prev) => pickRangeEnd(prev, 'to', e.target.value, { from: shownFrom, to: shownTo }))}
          className="w-40"
          data-rs-filter="to"
        />
      </Field>
      <Field label={t('roadShadow.filters.type')}>
        <Select
          value={filters.type}
          onChange={(e) => update((prev) => ({ ...prev, type: e.target.value }))}
          className="w-56"
          data-rs-filter="type"
        >
          <option value="">{t('roadShadow.filters.allTypes')}</option>
          {options.map((d) => (
            <option key={d.code} value={d.code}>
              {fsi(d.description ? formatPair(d.code, d.description) : d.code)}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="outlined" onClick={() => update(() => ({ from: '', to: '', type: DEFAULT_SHADOW_TYPE }))} data-rs-reset="">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t('roadShadow.filters.reset', { days: fsi(String(DEFAULT_SHADOW_DAYS)), type: fsi(DEFAULT_SHADOW_TYPE) })}
      </Button>
      {!range.ok && (
        <p role="alert" className="basis-full text-xs text-danger-800" data-rs-problem="incomplete">
          {t('roadShadow.incomplete')}
        </p>
      )}
    </div>
  )
}

function Report({ report, type }: { report: RoadShadowReport; type: string }) {
  const { t } = useTranslation('dispatch-board')
  const dash = t('roadShadow.dash')
  const tiles = headlineTiles(report, dash)
  const fallbacks = fallbackSummary(report, dash)
  const median = medianReading(report.medianRoadToStraightRatio)
  const formPath = type ? `/admin/delivery-types/${encodeURIComponent(type)}` : '/admin/delivery-types'

  return (
    <div className="flex flex-col gap-3" data-rs-report="">
      <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span data-rs-as-of="">
          <Trans t={t} i18nKey="roadShadow.asOf" values={{ at: formatDateTime(report.asOf) }} components={{ at: <Ltr /> }} />
        </span>
        <span data-rs-covers="">
          <Trans
            t={t}
            i18nKey="roadShadow.covers"
            values={{ range: formatRange(report.from.slice(0, 10), report.to.slice(0, 10)) }}
            components={{ r: <Ltr /> }}
          />
        </span>
      </p>

      {isEmptyRange(report) ? (
        <div className="flex flex-col items-start gap-1 rounded-lg border border-border/60 bg-card p-4 text-sm" data-rs-empty="">
          <span>{t('roadShadow.empty.title')}</span>
          <Link to={formPath} className="text-primary underline underline-offset-2" data-rs-type-form={formPath}>
            {t('roadShadow.empty.link')}
          </Link>
        </div>
      ) : (
        <>
          <section aria-label={t('roadShadow.tiles.label')} className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2" data-rs-tiles="">
            {tiles.map((tile) => (
              <div
                key={tile.key}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border/60 border-t-border bg-card px-3 py-2"
                data-rs-tile={tile.key}
                data-rs-tile-value={tile.value}
              >
                <span className="text-xs text-muted-foreground">{t(`roadShadow.tiles.${tile.key}`)}</span>
                <span className="font-mono text-xl font-medium tabular-nums">
                  <Ltr>{String(tile.value)}</Ltr>
                </span>
                <span className="text-xs text-muted-foreground" data-rs-tile-share={tile.share}>
                  <Trans t={t} i18nKey="roadShadow.tiles.share" values={{ share: tile.share }} components={{ v: <Ltr /> }} />
                </span>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <section
              aria-label={t('roadShadow.fallbacks.title')}
              className={
                'flex flex-1 flex-col gap-2 rounded-lg border p-3 ' +
                (fallbacks.high ? 'border-attention-border bg-attention-050' : 'border-border/60 bg-card')
              }
              data-rs-fallbacks=""
              data-rs-fallbacks-high={fallbacks.high ? 'true' : 'false'}
            >
              <h2 className="text-sm font-medium">{t('roadShadow.fallbacks.title')}</h2>
              {fallbacks.high && (
                <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800" role="alert" data-rs-fallbacks-warning="">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t('roadShadow.fallbacks.high')}
                </p>
              )}
              {report.fallbacks.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-rs-fallbacks-none="">
                  {t('roadShadow.fallbacks.none')}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs text-muted-foreground">
                      <th className="py-1 text-start font-medium">{t('roadShadow.fallbacks.reason')}</th>
                      <th className="py-1 text-end font-medium">{t('roadShadow.fallbacks.count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.fallbacks.map((f) => (
                      <FallbackRow key={f.reason} reason={f.reason} count={f.count} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium" data-rs-fallbacks-total={fallbacks.total} data-rs-fallbacks-share={fallbacks.share}>
                      <td className="pt-1.5">
                        {t('roadShadow.fallbacks.total')}
                        <span className="ms-2 text-xs font-normal text-muted-foreground">
                          <Trans t={t} i18nKey="roadShadow.fallbacks.totalShare" values={{ share: fallbacks.share }} components={{ v: <Ltr /> }} />
                        </span>
                      </td>
                      <td className="pt-1.5 text-end font-mono tabular-nums">
                        <Ltr>{String(fallbacks.total)}</Ltr>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            <section
              aria-label={t('roadShadow.median.title')}
              className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-3 lg:w-80"
              data-rs-median=""
            >
              <h2 className="text-sm font-medium">{t('roadShadow.median.title')}</h2>
              {'ratio' in median ? (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xl font-medium tabular-nums" data-rs-median-ratio={median.ratio}>
                    <Ltr>{median.ratio}</Ltr>
                  </span>
                  <span className="text-xs text-muted-foreground" data-rs-median-bids={report.measuredBids}>
                    <Trans
                      t={t}
                      i18nKey="roadShadow.median.bids"
                      count={report.measuredBids}
                      values={{ n: String(report.measuredBids) }}
                      components={{ v: <Ltr /> }}
                    />
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground" data-rs-median-none="">
                  {t(median.noneKey)}
                </span>
              )}
              <p className="text-xs text-muted-foreground">
                <Trans t={t} i18nKey="roadShadow.median.hint" values={{ normal: NORMAL_ROAD_RATIO }} components={{ v: <Ltr /> }} />
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function FallbackRow({ reason, count }: { reason: string; count: number }) {
  const { t } = useTranslation('dispatch-board')
  const reading = fallbackReason(reason)
  return (
    <tr className="border-b border-border/40 align-top last:border-b-0" data-rs-fallback={reading.code} data-rs-fallback-known={String(reading.known)}>
      <td className="py-1.5 pe-3">
        {reading.known ? (
          <>
            <span className="block" data-rs-fallback-label="">
              {t(reading.labelKey)} <span className="text-xs text-muted-foreground"><Ltr>{reading.code}</Ltr></span>
            </span>
            <span className="block text-xs text-muted-foreground" data-rs-fallback-hint="">
              {t(reading.hintKey)}
            </span>
          </>
        ) : (
          <>
            <span className="block font-mono" data-rs-fallback-label="">
              {reading.code ? <Ltr>{reading.code}</Ltr> : t('roadShadow.fallbacks.blank')}
            </span>
            <span className="block text-xs text-muted-foreground">{t('roadShadow.fallbacks.unknownHint')}</span>
          </>
        )}
      </td>
      <td className="py-1.5 text-end font-mono tabular-nums">
        <Ltr>{String(count)}</Ltr>
      </td>
    </tr>
  )
}
