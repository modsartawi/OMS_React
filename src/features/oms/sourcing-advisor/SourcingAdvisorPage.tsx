import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { CalendarClock, RotateCcw } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { canViewSourcingAdvisor, sourcingAdvisorAccessQuery } from '@/core/sourcing-advisor/access'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { TD, TH } from '@/core/ui/sheet-table'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatRange } from '@/core/util/bidi'
import { sourcingAdvisorApi } from './api'
import { sar } from './explain-model'
import { explainPath } from './paths'
import PlaceholderBanner from './PlaceholderBanner'
import { refusalKey } from './refusal'
import { topColumns } from './summary-columns'
import { refusedScoredThrough, summaryModel, type BreakdownRow, type TopRow } from './summary-model'
import {
  DEFAULT_SUMMARY_FILTERS,
  MAX_DAYS,
  resolveSummaryRange,
  summaryFiltersFromParams,
  summaryFiltersToParams,
  summaryWireQuery,
  type SummaryFilters,
} from './summary-query'

/**
 * The sourcing advisor (tickets 738 + 739, spec 734 D15/D19/D20/D21). It opens on the simulation of the
 * last 30 days: the headline figures, the same by city, channel and delivery type, and the top-savings
 * orders, each drilling into its explanation (738). An order can still be opened by its number.
 *
 * Behind `canViewSourcingAdvisor`, the predicate the menu leaf and Delivery details' link read.
 *
 * 🚩 Read-only, and the door's figures as sent (`./summary-model`): the screen never recomputes a saving.
 * "Placeholder rates" shows while the reply says so; "Scored through" when the range runs past what
 * the nightly job has scored (the reply's `scoredThrough`, or a `SOURCING-404` refusal's).
 */
export default function SourcingAdvisorPage() {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <ScreenGate query={sourcingAdvisorAccessQuery()} can={canViewSourcingAdvisor} ns="sourcing-advisor" title={t('title')} subtitle={t('subtitle')}>
      <Summary />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef = { ...OMS_GRID_BASE_COL_DEF, resizable: true, sortable: true, suppressHeaderMenuButton: true }

const TEXT_FILTERS = ['city', 'channel', 'deliveryType'] as const
type TextFilters = Pick<SummaryFilters, (typeof TEXT_FILTERS)[number]>
const textFiltersOf = (f: SummaryFilters): TextFilters => ({ city: f.city, channel: f.channel, deliveryType: f.deliveryType })

function Summary() {
  const { t } = useTranslation('sourcing-advisor')
  const { query: filters, update, changedFromOutside } = useUrlQuery(summaryFiltersFromParams, summaryFiltersToParams)
  // The text filters are a draft applied together on Enter or Apply (the scorecard's way).
  const [draft, setDraft] = useState<TextFilters>(() => textFiltersOf(filters))
  useEffect(() => {
    if (changedFromOutside()) setDraft(textFiltersOf(filters))
  }, [filters, changedFromOutside])
  const applyDraft = () => {
    const applied = Object.fromEntries(TEXT_FILTERS.map((k) => [k, draft[k].trim()])) as TextFilters
    setDraft(applied)
    update((prev) => ({ ...prev, ...applied }))
  }
  const patch = (p: Partial<SummaryFilters>) => update((prev) => ({ ...prev, ...p }))

  // "Today" is read once per visit, so a default range does not slide under the reader.
  const [now] = useState(() => new Date())
  const range = useMemo(() => resolveSummaryRange(filters, now), [filters, now])
  // Over 92 days, reversed or half-typed: no call at all (the door would refuse it as SOURCING-402).
  const wire = useMemo(() => (range.ok ? summaryWireQuery(filters, range) : null), [filters, range])

  const summary = useQuery({
    queryKey: ['sourcing-advisor', 'summary', wire],
    queryFn: () => sourcingAdvisorApi.summary(wire!),
    enabled: wire !== null,
    retry: false,
  })

  const m = useMemo(() => (summary.data !== undefined && wire ? summaryModel(summary.data, wire.to) : null), [summary.data, wire])
  const refusedThrough = summary.isError ? refusedScoredThrough(summary.error) : null
  const refusal = summary.isError && refusedThrough === null ? refusalKey(summary.error) : null
  const scoredThrough = summary.isError ? refusedThrough : (m?.scoredThrough ?? null)
  const cols = useMemo(() => topColumns(t), [t])
  const context = useMemo(() => ({ t }), [t])

  return (
    <div className="flex min-w-0 flex-col gap-4" data-sourcing-summary="">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          applyDraft()
        }}
        data-sourcing-filters=""
      >
        <Field label={t('summary.filters.from')}>
          <Input
            type="date"
            value={filters.from || (range.ok ? range.from : '')}
            onChange={(e) => patch({ from: e.target.value, to: filters.to || (range.ok ? range.to : '') })}
            className="w-40"
            data-sourcing-filter="from"
          />
        </Field>
        <Field label={t('summary.filters.to')}>
          <Input
            type="date"
            value={filters.to || (range.ok ? range.to : '')}
            onChange={(e) => patch({ to: e.target.value, from: filters.from || (range.ok ? range.from : '') })}
            className="w-40"
            data-sourcing-filter="to"
          />
        </Field>
        {TEXT_FILTERS.map((key) => (
          <Field key={key} label={t(`summary.filters.${key}`)}>
            <Input
              type="text"
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              placeholder={t('summary.filters.any')}
              className="w-32"
              data-sourcing-filter={key}
            />
          </Field>
        ))}
        <Button type="submit" variant="secondary" data-sourcing-apply="">
          {t('summary.filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setDraft(textFiltersOf(DEFAULT_SUMMARY_FILTERS))
            update(() => DEFAULT_SUMMARY_FILTERS)
          }}
          data-sourcing-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('summary.filters.reset')}
        </Button>
        {!range.ok && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-sourcing-problem={range.problem}>
            <Trans t={t} i18nKey={`summary.problem.${range.problem}`} values={{ max: String(MAX_DAYS) }} components={{ max: <Ltr /> }} />
          </p>
        )}
      </form>

      <Lookup />

      {range.ok && (
        <p className="text-xs text-muted-foreground" data-sourcing-range="">
          <Trans t={t} i18nKey="summary.range" values={{ range: formatRange(range.from, range.to) }} components={{ v: <Ltr /> }} />
        </p>
      )}

      {m?.placeholderRates && !summary.isError && <PlaceholderBanner rateVersion={m.rateVersion} />}

      {scoredThrough !== null && (
        <div
          role="note"
          data-sourcing-scored-through={scoredThrough}
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
        >
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <div className="font-semibold">
              {scoredThrough === '' ? (
                t('refusal.notScoredRange')
              ) : (
                <Trans t={t} i18nKey="summary.scoredThrough.title" values={{ date: scoredThrough }} components={{ v: <Ltr /> }} />
              )}
            </div>
            <p>{t('summary.scoredThrough.body')}</p>
          </div>
        </div>
      )}

      {summary.isError && refusedThrough === null && (
        <div data-sourcing-refusal={refusal ?? 'unknown'}>
          <ErrorBanner
            className="p-3"
            title={t('summary.load.failedTitle')}
            message={refusal ? t(refusal) : apiErrorMessage(summary.error, t('summary.load.failed'))}
          />
        </div>
      )}

      {summary.isPending && wire !== null && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('summary.load.loading')}
        </p>
      )}

      {m && !summary.isError && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" data-sourcing-headline="">
            <Tile label={t('summary.headline.orders')} attr="orders">
              <Count value={m.headline.orders} />
            </Tile>
            <Tile label={t('summary.headline.ordersWithSaving')} attr="ordersWithSaving">
              <Count value={m.headline.ordersWithSaving} />
              {m.headline.share !== null && (
                <span className="ms-2 text-sm font-normal text-muted-foreground" data-share="">
                  <Share value={m.headline.share} />
                </span>
              )}
            </Tile>
            <Tile label={t('summary.headline.totalSaving')} attr="totalSaving">
              <Sar value={m.headline.totalSaving} />
            </Tile>
            <Tile label={t('summary.headline.avgSaving')} attr="avgSaving">
              <Sar value={m.headline.avgSaving} />
            </Tile>
          </section>

          <div className="grid gap-3 lg:grid-cols-3">
            <Breakdown title={t('summary.by.city')} keyLabel={t('summary.filters.city')} rows={m.byCity} attr="city" />
            <Breakdown title={t('summary.by.channel')} keyLabel={t('summary.filters.channel')} rows={m.byChannel} attr="channel" />
            <Breakdown title={t('summary.by.deliveryType')} keyLabel={t('summary.filters.deliveryType')} rows={m.byDeliveryType} attr="deliveryType" />
          </div>

          <section className="rounded-lg border border-border bg-card p-3" data-sourcing-card="top">
            <h2 className="mb-1 text-sm font-semibold">{t('summary.top.heading')}</h2>
            <p className="mb-2 text-xs text-muted-foreground">{t('summary.top.hint')}</p>
            <div data-sourcing-top="">
              <AgGridReact<TopRow>
                theme={omsGridTheme}
                rowData={m.top}
                columnDefs={cols}
                defaultColDef={DEFAULT_COL_DEF}
                context={context}
                getRowId={({ data }) => data.orderNo}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                domLayout="autoHeight"
                animateRows={false}
                suppressColumnVirtualisation
                noRowsOverlayComponent={NoTop}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function NoTop() {
  const { t } = useTranslation('sourcing-advisor')
  return <span className="text-sm text-muted-foreground">{t('summary.top.empty')}</span>
}

function Tile({ label, attr, children }: { label: string; attr: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3" data-tile={attr}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold" data-tile-value="">
        {children}
      </div>
    </div>
  )
}

function Count({ value }: { value: number | null }) {
  const { t } = useTranslation('sourcing-advisor')
  return value === null ? <>{t('dash')}</> : <Ltr>{String(value)}</Ltr>
}

function Share({ value }: { value: number }) {
  const { t } = useTranslation('sourcing-advisor')
  return <Trans t={t} i18nKey="summary.share" values={{ value: value.toFixed(1) }} components={{ v: <Ltr /> }} />
}

function Sar({ value }: { value: string | null }) {
  const { t } = useTranslation('sourcing-advisor')
  if (value === null) return <>{t('dash')}</>
  return <Trans t={t} i18nKey="unit.sar" values={{ value }} components={{ v: <Ltr /> }} />
}

function Breakdown({ title, keyLabel, rows, attr }: { title: string; keyLabel: string; rows: BreakdownRow[]; attr: string }) {
  const { t } = useTranslation('sourcing-advisor')
  const dash = t('dash')
  const sarText = (v: number | null) => sar(v) ?? dash
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-3" data-sourcing-breakdown={attr}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('summary.by.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className={TH}>{keyLabel}</th>
                <th className={`${TH} text-end`}>{t('summary.by.orders')}</th>
                <th className={`${TH} text-end`}>{t('summary.by.withSaving')}</th>
                <th className={`${TH} text-end`}>{t('summary.by.total')}</th>
                <th className={`${TH} text-end`}>{t('summary.by.avg')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/50" data-breakdown-row={r.key}>
                  <td className={TD} data-cell="key">
                    <bdi>{r.key || dash}</bdi>
                  </td>
                  <td className={`${TD} text-end`} data-cell="orders">
                    {r.orders === null ? dash : <Ltr>{String(r.orders)}</Ltr>}
                  </td>
                  <td className={`${TD} text-end`} data-cell="withSaving">
                    {r.ordersWithSaving === null ? dash : <Ltr>{String(r.ordersWithSaving)}</Ltr>}
                    {r.share !== null && (
                      <span className="ms-1 text-xs text-muted-foreground" data-share="">
                        <Share value={r.share} />
                      </span>
                    )}
                  </td>
                  <td className={`${TD} text-end`} data-cell="total">
                    <Ltr>{sarText(r.totalSaving)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`} data-cell="avg">
                    <Ltr>{sarText(r.avgSaving)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** 738's entry, kept: open one order's explanation by its number. */
function Lookup() {
  const { t } = useTranslation('sourcing-advisor')
  const navigate = useNavigate()
  const [orderNo, setOrderNo] = useState('')
  const trimmed = orderNo.trim()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (trimmed !== '') void navigate(explainPath(trimmed))
  }
  return (
    <form className="flex max-w-md flex-col gap-1" onSubmit={submit} data-sourcing-lookup="">
      <div className="flex items-end gap-2">
        <Field label={t('lookup.label')} className="flex-1">
          <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} inputMode="numeric" dir="ltr" />
        </Field>
        <Button type="submit" variant="outlined" disabled={trimmed === ''}>
          {t('lookup.open')}
        </Button>
      </div>
    </form>
  )
}
