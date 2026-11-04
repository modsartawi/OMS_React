import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { DispatchScorecardDrillRow, DispatchScorecardFigure, DispatchScorecardQuery } from '@/core/models/dispatch-scorecard'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { gridSheet, textSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { canOpenDispatchScorecard, dispatchScorecardAccessQuery } from './access'
import { dispatchScorecardApi } from './api'
import {
  CLOSES_TABS,
  FAILED_TAKE_OUTCOMES,
  closedRows,
  closesFiltersFromParams,
  closesFiltersToParams,
  outcomeCounts,
  reasonCounts,
  withOutcomes,
  type ClosesFilters,
} from './closes'
import { CLOSES_TEXT_COLUMNS, closesColumns, refusedColumns } from './closes-columns'
import FilterForm from './FilterForm'
import { DEFAULT_FILTERS, refusalKey, resolveRange, wireQuery } from './range'

/**
 * Closes after a take (ticket 758, spec 3326): every delivery closed or cancelled after a store took it,
 * estate-wide unless a store is picked, by kind, with who caused it and the reason as given — so the team
 * can analyse the reasons. A second tab lists the closes the lock refused.
 *
 * No backend of its own: `DispatchScorecard/Drill` answers for the whole estate when neither `store` nor
 * `staff` is sent. `failedTakeRate` (every take won) narrowed to the closed ones, plus `fallbackCancels`;
 * `refusedCloses` feeds the second tab. Behind the scorecard's own probe (`canOpenDispatchScorecard`).
 *
 * 🚩 The screen computes no rate, rank or median. The counts above the grid count the rows the door sent.
 */
export default function ClosesPage() {
  const { t } = useTranslation('dispatch-scorecard')
  return (
    <ScreenGate
      query={dispatchScorecardAccessQuery()}
      can={canOpenDispatchScorecard}
      ns="dispatch-scorecard"
      title={t('closes.title')}
      subtitle={t('closes.subtitle')}
    >
      <Closes />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef<DispatchScorecardDrillRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

const CLOSES_DEFAULTS: ClosesFilters = { ...DEFAULT_FILTERS, tab: 'closes', outcomes: [...FAILED_TAKE_OUTCOMES] }

/** One estate-wide (or one store's) drill read; the cache key is the drawer's, so the two share it. */
function useDrill(wire: Required<DispatchScorecardQuery> | null, figure: DispatchScorecardFigure, enabled: boolean) {
  return useQuery({
    queryKey: ['oms', 'dispatch-scorecard', 'drill', wire, figure, ''],
    queryFn: () => dispatchScorecardApi.drill(wire!, figure, ''),
    enabled: enabled && wire !== null,
    retry: false,
  })
}

function Closes() {
  const { t } = useTranslation('dispatch-scorecard')
  const { query: filters, update, changedFromOutside } = useUrlQuery(closesFiltersFromParams, closesFiltersToParams)
  // "Today" is read once per visit: a range defaulted at 23:59 does not slide under the reader.
  const [now] = useState(() => new Date())
  const range = useMemo(() => resolveRange(filters, now), [filters, now])
  // Over 92 days, reversed or half-typed: no call at all (the door would refuse it as CALLOUT-301/302).
  const wire = useMemo(() => (range.ok ? wireQuery({ ...filters, tab: 'stores' }, range) : null), [filters, range])
  const onCloses = filters.tab === 'closes'

  const taken = useDrill(wire, 'failedTakeRate', onCloses)
  const fallback = useDrill(wire, 'fallbackCancels', onCloses)
  const refused = useDrill(wire, 'refusedCloses', !onCloses)
  const reads = onCloses ? [taken, fallback] : [refused]
  const failed = reads.find((r) => r.isError)
  const loaded = reads.every((r) => r.isSuccess)
  const fetching = reads.some((r) => r.isFetching)

  const allClosed = useMemo(() => closedRows(taken.data?.rows ?? [], fallback.data?.rows ?? []), [taken.data, fallback.data])
  const counts = useMemo(() => outcomeCounts(allClosed), [allClosed])
  const shownCloses = useMemo(() => withOutcomes(allClosed, filters.outcomes), [allClosed, filters.outcomes])
  const reasons = useMemo(() => reasonCounts(shownCloses), [shownCloses])
  const refusedRows = refused.data?.rows ?? []
  const rows = failed ? [] : onCloses ? shownCloses : refusedRows
  const asOf = onCloses ? taken.data : refused.data

  const columns = useMemo(() => (onCloses ? closesColumns(t) : refusedColumns(t)), [t, onCloses])
  const gridApi = useRef<GridApi<DispatchScorecardDrillRow> | null>(null)

  const toggle = (outcome: string) =>
    update((prev) => ({
      ...prev,
      outcomes: prev.outcomes.includes(outcome) ? prev.outcomes.filter((o) => o !== outcome) : [...prev.outcomes, outcome],
    }))

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t(onCloses ? 'closes.export.sheet' : 'closes.export.refusedSheet'), {
        asText: (colId) => CLOSES_TEXT_COLUMNS.has(colId),
      })
      const sheets = onCloses
        ? [
            sheet,
            textSheet(
              t('closes.export.reasonsSheet'),
              [t('closes.reasons.reason'), t('closes.reasons.count')],
              reasons.map((r) => [r.reason ?? t('drill.noReason'), String(r.count)]),
            ),
          ]
        : [sheet]
      await writeWorkbook(sheets, xlsxFileName(t(onCloses ? 'closes.export.fileName' : 'closes.export.refusedFileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const refusal = failed ? refusalKey(failed.error) : null

  return (
    <div className="flex flex-col gap-3">
      <FilterForm
        filters={filters}
        range={range}
        update={update}
        changedFromOutside={changedFromOutside}
        onReset={() => update((prev) => ({ ...CLOSES_DEFAULTS, tab: prev.tab }))}
      />

      {failed && (
        <div data-sc-refusal={refusal ?? ''}>
          <ErrorBanner
            className="p-2.5"
            title={t('closes.failedTitle')}
            message={refusal ? t(refusal) : apiErrorMessage(failed.error, t('closes.failed'))}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('closes.tabs.label')} className="flex gap-1">
          {CLOSES_TABS.map((tab) => (
            <Chip key={tab} variant="tab" on={filters.tab === tab} onClick={() => update((prev) => ({ ...prev, tab }))} data-sc-tab={tab}>
              {t(`closes.tabs.${tab}`)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {loaded && asOf && (
            <span className="text-xs text-muted-foreground" data-sc-count={rows.length}>
              <Trans
                t={t}
                i18nKey="drill.count"
                count={rows.length}
                values={{ n: String(rows.length), from: asOf.from.slice(0, 10), to: asOf.to.slice(0, 10) }}
                components={{ n: <Ltr />, from: <Ltr />, to: <Ltr /> }}
              />
            </span>
          )}
          <Button variant="outlined" disabled={!loaded || rows.length === 0} onClick={() => void exportXlsx()} data-sc-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {onCloses ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-1.5" data-sc-outcomes="">
            <span className="text-xs font-medium text-muted-foreground">{t('closes.outcomes.label')}</span>
            <div className="flex flex-wrap gap-1.5">
              {counts.map(({ outcome, count }) => (
                <Chip
                  key={outcome}
                  on={filters.outcomes.includes(outcome)}
                  onClick={() => toggle(outcome)}
                  data-sc-outcome={outcome}
                >
                  <bdi>{t(`afterTake.${outcome}`, { defaultValue: outcome })}</bdi>
                  <span className="tabular-nums">
                    <Ltr>{String(count)}</Ltr>
                  </span>
                </Chip>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Chip
                on={counts.every((c) => filters.outcomes.includes(c.outcome))}
                onClick={() => update((prev) => ({ ...prev, outcomes: counts.map((c) => c.outcome) }))}
                data-sc-outcomes-all=""
              >
                {t('closes.outcomes.all')}
              </Chip>
              <Chip
                on={filters.outcomes.length === FAILED_TAKE_OUTCOMES.length && FAILED_TAKE_OUTCOMES.every((o) => filters.outcomes.includes(o))}
                onClick={() => update((prev) => ({ ...prev, outcomes: [...FAILED_TAKE_OUTCOMES] }))}
                data-sc-outcomes-failed=""
              >
                {t('closes.outcomes.failedTakes')}
              </Chip>
            </div>
          </div>
          <section className="flex flex-col gap-1.5 lg:w-[28rem]" aria-label={t('closes.reasons.title')} data-sc-reasons="">
            <span className="text-xs font-medium text-muted-foreground">{t('closes.reasons.title')}</span>
            {reasons.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t('closes.reasons.empty')}</span>
            ) : (
              <ol className="flex max-h-40 flex-col overflow-y-auto rounded-md border border-border/60 text-sm">
                {reasons.map((r) => (
                  <li
                    key={r.reason ?? ''}
                    className="flex items-baseline justify-between gap-3 border-b border-border/40 px-2 py-1 last:border-b-0"
                    data-sc-reason-count={r.count}
                  >
                    {r.reason === null ? (
                      <span className="text-muted-foreground" data-sc-reason-text="">
                        {t('drill.noReason')}
                      </span>
                    ) : (
                      <bdi data-sc-reason-text="">{r.reason}</bdi>
                    )}
                    <span className="shrink-0 tabular-nums">
                      <Ltr>{String(r.count)}</Ltr>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground" data-sc-refused-note="">
          {t('closes.refusedNote')}
        </p>
      )}

      <div className="relative h-[calc(100vh-24rem)] min-h-96" data-sc-grid={filters.tab}>
        <AgGridReact<DispatchScorecardDrillRow>
          key={filters.tab}
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={({ data }) => `${data.calloutId}|${data.bidId}|${data.class}`}
          onGridReady={({ api }) => {
            gridApi.current = api
          }}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          suppressColumnVirtualisation
          loading={fetching && !loaded}
          noRowsOverlayComponent={onCloses ? NoCloses : NoRefused}
          suppressNoRowsOverlay={!!failed || !range.ok}
        />
      </div>
    </div>
  )
}

function NoCloses() {
  const { t } = useTranslation('dispatch-scorecard')
  return <span className="text-sm text-muted-foreground">{t('closes.empty')}</span>
}

function NoRefused() {
  const { t } = useTranslation('dispatch-scorecard')
  return <span className="text-sm text-muted-foreground">{t('closes.emptyRefused')}</span>
}
