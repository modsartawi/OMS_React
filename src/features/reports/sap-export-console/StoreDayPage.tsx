import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { ArrowLeft, Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { StoreDay } from '@/core/models/sap-export'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { canOpenSapExport, sapExportAccessQuery } from './access'
import { storeDayQuery } from './api'
import { LABEL_TOKEN_CLASS, WORST_FIRST, accountingToken, labelToken, unknownLabelCounts } from './label-helpers'
import { presentStates, stateMeaningKey } from './state-helpers'
import { STORE_DAY_DEFAULT_COL_DEF, buildStoreDayColumns } from './storeday-columns'
import {
  DEFAULT_STORE_DAY_FILTER,
  STORE_DAY_PAGE_SIZE,
  figure,
  storeDayErrorKey,
  toggleLabel,
  toggleState,
  type StoreDayFilter,
} from './storeday-helpers'
import TokenBadgeView from './TokenBadgeView'

/**
 * One store-day (BackOffice spec 2579, ticket 461) — `/reports/sap-export/store/:code/day/:day`,
 * the console's deepest view, classified LIVE by the door (not from the rollup).
 *
 * Top to bottom: the header (store, day, "as of", the total, the export-accounting verdict),
 * a chip per label that drives the repeated `label` filter, the state legend that drives the
 * repeated `state` filter, then that day's transactions — worst label first, in the door's
 * order, paged at 50 — each linking to the IDoc inspector.
 *
 * 🚩 **Read-only.** Nothing on this page acts on SAP data; resets are out of scope (spec 2579).
 */
export default function StoreDayPage() {
  const { t } = useTranslation('sap-export-console')
  const { code = '', day = '' } = useParams()
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      {/* Keyed on the store-day, so a link to another one starts from its own filters and page. */}
      <StoreDayView key={`${code}/${day}`} code={code} day={day} />
    </ScreenGate>
  )
}

function StoreDayView({ code, day }: { code: string; day: string }) {
  const { t } = useTranslation('sap-export-console')
  const [filter, setFilter] = useState<StoreDayFilter>(DEFAULT_STORE_DAY_FILTER)
  const query = useQuery(storeDayQuery(code, day, filter))
  const columns = useMemo(() => buildStoreDayColumns(t, code), [t, code])

  // The header and its chips draw the settled answer, and stay on the last good one while the
  // next read loads or after it fails, so a failed filtered read can still be undone from them.
  // The rows of a failed read are never drawn.
  const fresh = query.data && !query.isPlaceholderData && !query.isError ? query.data : undefined
  const [kept, setKept] = useState<StoreDay | undefined>(undefined)
  useEffect(() => {
    if (fresh) setKept(fresh)
  }, [fresh])
  const header = fresh ?? kept

  const shown = query.isError ? undefined : query.data
  const rows = shown?.rows
  const total = rows?.total ?? 0
  // A failed inner page has no total to page over; the pager then reads it as the last page,
  // so Previous is the way back and Next asks for nothing.
  const pagerTotal = shown ? total : filter.page * STORE_DAY_PAGE_SIZE

  // A later read can shrink the list under an inner page; an emptied page falls back to the last.
  const settled = rows && !query.isPlaceholderData ? rows : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: STORE_DAY_PAGE_SIZE,
    })
    if (last !== settled.page) setFilter((f) => (f.page === settled.page ? { ...f, page: last } : f))
  }, [settled])

  const errorKey = query.isError ? storeDayErrorKey(apiErrorCode(query.error)) : null
  const filtered = filter.labels.length > 0 || filter.states.length > 0

  return (
    <div className="flex min-w-0 flex-col gap-4" data-store-day-page={`${code}/${day}`}>
      <Link
        to="/reports/sap-export"
        className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('storeDay.back')}
      </Link>

      {query.isPending && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('storeDay.loading')}
        </div>
      )}

      {query.isError && (
        <ErrorBanner
          className="p-3"
          message={errorKey ? t(errorKey) : apiErrorMessage(query.error, t('storeDay.failed'))}
        />
      )}

      {header && <Header data={header} filter={filter} filtered={filtered} onFilter={setFilter} />}

      {shown && rows && (
        <section className="flex flex-col gap-2" data-store-day-list="">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span data-listed={total}>
              <Trans t={t} i18nKey="storeDay.listed" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
            </span>
            {query.isPlaceholderData && (
              <span className="inline-flex items-center gap-1 text-xs" role="status" data-store-day-refreshing="">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('storeDay.refreshing')}
              </span>
            )}
          </div>
          {rows.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-store-day-empty="">
              {t(filter.page > 1 ? 'storeDay.emptyPage' : filtered ? 'storeDay.emptyFiltered' : 'storeDay.empty')}
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/60" data-store-day-grid="">
              <AgGridReact
                theme={omsGridTheme}
                rowData={rows.items}
                columnDefs={columns}
                defaultColDef={STORE_DAY_DEFAULT_COL_DEF}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                domLayout="autoHeight"
                animateRows={false}
                suppressColumnVirtualisation
              />
            </div>
          )}
        </section>
      )}

      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {((shown && showsPager(total, STORE_DAY_PAGE_SIZE)) || filter.page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager
            page={filter.page}
            pageSize={STORE_DAY_PAGE_SIZE}
            totalMatches={pagerTotal}
            busy={query.isPlaceholderData}
            onPage={(page) => setFilter((f) => ({ ...f, page }))}
          />
        </div>
      )}
    </div>
  )
}

function Header({
  data,
  filter,
  filtered,
  onFilter,
}: {
  data: StoreDay
  filter: StoreDayFilter
  /** Whether any label or state is chosen — the view's own reading, passed down. */
  filtered: boolean
  onFilter: (update: (f: StoreDayFilter) => StoreDayFilter) => void
}) {
  const { t } = useTranslation('sap-export-console')
  const verdict = accountingToken(data.accounting)
  const states = presentStates(data.states, filter.states)
  const unknownLabels = unknownLabelCounts(data.labels)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-store-day-header="">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">
            <Trans t={t} i18nKey="storeDay.heading" values={{ pair: formatPair(data.code, formatDay(data.day)) }} components={{ v: <Ltr /> }} />
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span data-as-of="">
              <Trans t={t} i18nKey="storeDay.asOf" values={{ at: formatDateTime(data.asOf) }} components={{ at: <Ltr /> }} />
            </span>
            <span data-total={data.total}>
              <Trans t={t} i18nKey="storeDay.total" values={{ n: figure(data.total) }} components={{ n: <Ltr /> }} />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm" data-accounting={data.accounting}>
          <span className="text-muted-foreground">{t('accounting.label')}</span>
          <TokenBadgeView badge={verdict} value={data.accounting} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('storeDay.labelsLabel')} data-label-chips="">
          {WORST_FIRST.map((label) => {
            const token = labelToken(label)
            const on = filter.labels.includes(label)
            return (
              <button
                key={label}
                type="button"
                onClick={() => onFilter((f) => toggleLabel(f, label))}
                aria-pressed={on}
                data-label-chip={label}
                data-token={token.token}
                className={
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-shadow ' +
                  LABEL_TOKEN_CLASS[token.token] +
                  (on ? ' ring-2 ring-primary/70' : ' hover:ring-1 hover:ring-primary/40')
                }
              >
                <span className="font-mono tabular-nums">
                  <Ltr>{figure(data.labels[label])}</Ltr>
                </span>
                {token.labelKey && t(token.labelKey)}
              </button>
            )
          })}
          {/* A label a newer door counts but this bundle does not know: shown, so the chips still add
              up to the day's total, but not a filter — the door would refuse it. */}
          {unknownLabels.map(({ label, count }) => (
            <span
              key={label}
              className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ' + LABEL_TOKEN_CLASS.neutral}
              data-label-unknown={label}
            >
              <span className="font-mono tabular-nums">
                <Ltr>{figure(count)}</Ltr>
              </span>
              <Ltr>{label}</Ltr>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('storeDay.labelsHint')}</p>
      </div>

      {states.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">{t('storeDay.legend')}</div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('storeDay.legend')} data-state-legend="">
            {states.map(({ code, count }) => {
              const key = stateMeaningKey(code)
              const on = (filter.states as string[]).includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  // An unknown code is shown, but cannot filter: the door would refuse it.
                  disabled={!key}
                  onClick={() => onFilter((f) => toggleState(f, code))}
                  aria-pressed={on}
                  data-state-chip={code}
                  className={
                    'inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-default ' +
                    (on ? 'border-primary bg-primary-050 text-primary-800' : 'border-border/60 bg-card hover:bg-accent')
                  }
                >
                  <span className="font-mono font-medium">
                    <Ltr>{code}</Ltr>
                  </span>
                  {key && <span>{t(key)}</span>}
                  <span className="font-mono tabular-nums text-muted-foreground">
                    <Ltr>{figure(count)}</Ltr>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('storeDay.legendHint')}</p>
        </div>
      )}

      {filtered && (
        <button
          type="button"
          onClick={() => onFilter(() => DEFAULT_STORE_DAY_FILTER)}
          className="w-fit text-xs font-medium text-primary underline-offset-2 hover:underline"
          data-clear-filters=""
        >
          {t('storeDay.clear')}
        </button>
      )}
    </section>
  )
}
