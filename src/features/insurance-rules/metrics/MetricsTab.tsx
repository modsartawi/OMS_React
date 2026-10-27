import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { formatFigure, formatMoney } from '@/core/util/number-format'
import { metricsQuery } from './api'
import { FiresBar, Legend, OutcomeBar } from './bars'
import DayChart from './DayChart'
import { METRICS_BY, metricsTotals, sortMetricsRows, totalFires, type MetricsBy, type MetricsRow } from './model'
import { NUM, Pct, RuleName, TD, Tile } from './parts'
import type { MetricsQuery } from './query'
import { DeniedCard, Loading, TH } from '@/core/insurance-rules/parts'

/** Metrics per rule, store, pharmacist or day over the window (ticket 615; `GET InsuranceRules/Metrics`). */
export default function MetricsTab({ query, onBy }: { query: MetricsQuery; onBy: (by: MetricsBy) => void }) {
  const { t } = useTranslation('insurance-metrics')
  const metrics = useQuery(metricsQuery(query))
  const rows = useMemo(() => sortMetricsRows(metrics.data ?? [], query.by), [metrics.data, query.by])
  const totals = useMemo(() => metricsTotals(rows), [rows])
  const max = Math.max(0, ...rows.map((r) => totalFires(r.fires)))

  return (
    <div className="flex flex-col gap-4" data-metrics-tab="">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('by.label')} data-by-switch="">
        <span className="text-xs text-muted-foreground">{t('by.label')}</span>
        {METRICS_BY.map((by) => (
          <Chip key={by} on={query.by === by} onClick={() => onBy(by)} data-by={by}>
            {t(`by.${by}`)}
          </Chip>
        ))}
      </div>

      {metrics.isError && isBareDenial(metrics.error) ? (
        <DeniedCard ns="insurance-metrics" hook="metrics-denied" />
      ) : metrics.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(metrics.error, t('metrics.failed'))} />
      ) : !metrics.data ? (
        <Loading text={t('metrics.loading')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5" data-tiles="">
            <Tile label={t('tiles.fires')} hook="fires">
              <Ltr>{formatFigure(totals.fires)}</Ltr>
            </Tile>
            <Tile label={t('tiles.shadowFires')} hook="shadowFires">
              <Ltr>{formatFigure(totals.shadowFires)}</Ltr>
            </Tile>
            <Tile label={t('tiles.overrideRate')} hook="overrideRate">
              <Pct share={totals.overrideRate} />
            </Tile>
            <Tile label={t('tiles.sarProtected')} hook="sarProtected" tag={t('estimate')}>
              <Ltr>{formatMoney(totals.sarProtectedEstimate)}</Ltr>
            </Tile>
            <Tile label={t('tiles.rejectionsAfterPass')} hook="rejectionsAfterPass" tone={totals.rejectionsAfterPass > 0 ? 'bad' : undefined}>
              <Ltr>{formatFigure(totals.rejectionsAfterPass)}</Ltr>
            </Tile>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-metrics-empty="">
              {t('metrics.empty')}
            </p>
          ) : (
            <>
              {query.by === 'day' && <DayChart rows={rows} />}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Legend kind="severity" />
                <Legend kind="outcome" />
              </div>
              <MetricsTable rows={rows} by={query.by} max={max} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function KeyCell({ row, by }: { row: MetricsRow; by: MetricsBy }) {
  if (by === 'rule') return <RuleName id={row.key} name={row.name} />
  return <Ltr>{by === 'day' ? formatDay(row.key) : row.key}</Ltr>
}

function MetricsTable({ rows, by, max }: { rows: MetricsRow[]; by: MetricsBy; max: number }) {
  const { t } = useTranslation('insurance-metrics')
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm" data-metrics-table={by}>
        <thead className="bg-grid-head text-grid-head-foreground">
          <tr>
            <th className={TH}>{t(`columns.${by}`)}</th>
            <th className={`${TH} w-[22%]`}>{t('columns.fires')}</th>
            <th className={`${TH} text-end`}>{t('columns.shadowFires')}</th>
            <th className={`${TH} w-[16%]`}>{t('columns.outcomes')}</th>
            <th className={`${TH} text-end`}>{t('columns.overrideRate')}</th>
            <th className={`${TH} text-end`}>
              {t('columns.sarProtected')} <span className="font-normal">{t('estimateParen')}</span>
            </th>
            <th className={`${TH} text-end`}>{t('columns.rejectionsAfterPass')}</th>
            <th className={`${TH} text-end`}>{t('columns.timeAdded')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border/60" data-row={r.key}>
              <td className={TD} data-col="key">
                <KeyCell row={r} by={by} />
              </td>
              <td className={TD} data-col="fires">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <FiresBar fires={r.fires} max={max} />
                  </span>
                  <span className="w-10 text-end tabular-nums" data-fires-total="">
                    <Ltr>{formatFigure(totalFires(r.fires))}</Ltr>
                  </span>
                </span>
              </td>
              <td className={NUM} data-col="shadowFires">
                <Ltr>{formatFigure(r.shadowFires)}</Ltr>
              </td>
              <td className={TD} data-col="outcomes">
                <OutcomeBar mix={r.outcomes} />
              </td>
              <td className={NUM} data-col="overrideRate">
                <Pct share={r.overrideRate} />
              </td>
              <td className={NUM} data-col="sarProtected">
                <Ltr>{formatMoney(r.sarProtectedEstimate)}</Ltr>
              </td>
              <td className={`${NUM} ${r.rejectionsAfterPass > 0 ? 'text-danger-800' : ''}`} data-col="rejectionsAfterPass">
                <Ltr>{formatFigure(r.rejectionsAfterPass)}</Ltr>
              </td>
              <td className={NUM} data-col="timeAdded">
                {r.timeAddedMedianMs === null ? (
                  <span className="text-muted-foreground">{t('dash')}</span>
                ) : (
                  <Trans t={t} i18nKey="unit.seconds" values={{ n: formatFigure(Math.round(r.timeAddedMedianMs / 100) / 10) }} components={{ v: <Ltr /> }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
