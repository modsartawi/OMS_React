import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowClickedEvent } from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type {
  SerialRefusalHeldByRow,
  SerialRefusalOffenderRow,
  SerialRefusalReport,
  SerialRefusalRow,
  SerialRefusalSerialRow,
  SerialRefusalStaffRow,
  SerialRefusalStoreRow,
  SerialRefusalTotals,
} from '@/core/models/serial-refusal'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { canOpenSerialRefusals, serialRefusalAccessQuery } from './access'
import { serialRefusalApi } from './api'
import {
  TEXT_COLUMNS,
  articleColumns,
  dayColumns,
  heldByColumns,
  offenderColumns,
  refusalColumns,
  serialColumns,
  staffColumns,
  storeColumns,
} from './columns'
import {
  DEFAULT_FILTERS,
  MAX_DAYS,
  NO_DRILL,
  REPORT_TABS,
  STATUSES,
  drillInto,
  filtersFromParams,
  filtersToParams,
  isDrilled,
  normalizeStores,
  refusalKey,
  reportQuery,
  resolveRange,
  rowsQuery,
  type Drill,
  type ReportFilters,
  type ReportTab,
  type StatusFilter,
} from './filters'

/**
 * The serial refusal report (ticket 573, BackOffice 3054, spec 3049): every time head office told a till a serial
 * was already SOLD or HELD, read back to see who keeps trying to sell packs that are gone. The totals, then one tab
 * per section of the saved analysis (staff, repeat offenders, serials, stores, articles, held by, per day) and the
 * refusals themselves. A row of any section opens the refusals behind it on the Refusals tab.
 *
 * Behind `canOpenSerialRefusals` on its own probe (`SerialRefusal/Access`), the same predicate the menu leaf reads,
 * failing closed. The report ranks staff by id, so its grant is its own.
 *
 * 🚩 Every count is the door's; the grid only sorts what it was sent. A blank staff id is "unknown staff": a till that
 * sent none (an older build), many people and never one offender.
 */
export default function SerialRefusalsPage() {
  const { t } = useTranslation('serial-refusals')
  return (
    <ScreenGate
      query={serialRefusalAccessQuery()}
      can={canOpenSerialRefusals}
      ns="serial-refusals"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Report />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  sortable: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'
const TAB = 'rounded-full px-3 py-1 text-sm transition-colors'

/** The totals tiles, in reading order: the answer split, then whose sale it was, then who asked. */
const TILES: readonly (keyof SerialRefusalTotals)[] = [
  'refusals', 'sold', 'held', 'crossStore', 'sameStore', 'unknownSale', 'staff', 'unknownStaff', 'serials', 'stores',
]

function Report() {
  const { t } = useTranslation('serial-refusals')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)
  // The stores box is a draft, applied on Enter or Apply: typed into the URL on every key, each key would read.
  const [storesDraft, setStoresDraft] = useState(filters.stores)
  useEffect(() => {
    if (changedFromOutside()) setStoresDraft(filters.stores)
  }, [filters, changedFromOutside])

  // "Today" is read once per visit: a range defaulted at 23:59 does not slide under the reader.
  const [now] = useState(() => new Date())
  const range = useMemo(() => resolveRange(filters, now), [filters, now])
  const report = useMemo(() => (range.ok ? reportQuery(filters, range) : null), [filters, range])
  const rows = useMemo(() => (range.ok ? rowsQuery(filters, range) : null), [filters, range])

  const reportRead = useQuery({
    queryKey: ['oms', 'serial-refusals', 'report', report],
    queryFn: () => serialRefusalApi.report(report!),
    enabled: report !== null,
    retry: false,
  })
  const onRefusals = filters.tab === 'refusals'
  const rowsRead = useQuery({
    queryKey: ['oms', 'serial-refusals', 'rows', rows],
    queryFn: () => serialRefusalApi.rows(rows!),
    enabled: rows !== null && onRefusals,
    retry: false,
  })

  const patch = (p: Partial<ReportFilters>) => update((prev) => ({ ...prev, ...p }))
  // Stable, so the open tab's columns are built once per tab, not on every render.
  const drill = useCallback((d: Partial<Drill>) => update((prev) => drillInto(prev, d)), [update])
  // A store row narrows the scope itself (its tiles and every tab), then shows that store's refusals.
  const openStore = useCallback(
    (store: string) => {
      setStoresDraft(store)
      update((prev) => ({ ...drillInto(prev, {}), stores: store }))
    },
    [update],
  )
  // The open tab's read (its grid and export) — and the read whose failure is shown: the open list's own, else the
  // report's, which feeds the tiles on every tab, the Refusals tab included.
  const current = onRefusals ? rowsRead : reportRead
  const failed = onRefusals && rowsRead.isError ? rowsRead : reportRead.isError ? reportRead : null
  const refusal = failed ? refusalKey(failed.error) : null
  const gridApi = useRef<GridApi | null>(null)

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t(`tabs.${filters.tab}`), { asText: (colId) => TEXT_COLUMNS.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const data = reportRead.data
  const asOf = onRefusals ? rowsRead.data?.asOf : data?.asOf

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const stores = normalizeStores(storesDraft)
          setStoresDraft(stores)
          patch({ stores })
        }}
        data-sr-filters=""
      >
        <label className={FIELD}>
          {t('filters.from')}
          <input
            type="date"
            value={filters.from || (range.ok ? range.from : '')}
            onChange={(e) => patch({ from: e.target.value, to: filters.to || (range.ok ? range.to : '') })}
            className={`${INPUT} w-40`}
            data-sr-filter="from"
          />
        </label>
        <label className={FIELD}>
          {t('filters.to')}
          <input
            type="date"
            value={filters.to || (range.ok ? range.to : '')}
            onChange={(e) => patch({ to: e.target.value, from: filters.from || (range.ok ? range.from : '') })}
            className={`${INPUT} w-40`}
            data-sr-filter="to"
          />
        </label>
        <label className={FIELD}>
          {t('filters.stores')}
          <input
            type="text"
            value={storesDraft}
            onChange={(e) => setStoresDraft(e.target.value)}
            placeholder={t('filters.storesPlaceholder')}
            className={`${INPUT} w-56`}
            data-sr-filter="stores"
          />
        </label>
        <label className={FIELD}>
          {t('filters.status')}
          <select
            value={filters.status}
            onChange={(e) => patch({ status: e.target.value as StatusFilter })}
            className={`${INPUT} w-32`}
            data-sr-filter="status"
          >
            {STATUSES.map((s) => (
              <option key={s || 'any'} value={s}>
                {s ? t(`status.${s}`) : t('filters.anyStatus')}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" data-sr-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoresDraft('')
            update((prev) => ({ ...DEFAULT_FILTERS, tab: prev.tab }))
          }}
          data-sr-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.reset')}
        </Button>
        {!range.ok && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-sr-problem={range.problem}>
            {range.problem === 'tooLong' ? (
              <Trans t={t} i18nKey="problem.tooLong" values={{ max: String(MAX_DAYS) }} components={{ max: <Ltr /> }} />
            ) : (
              t(`problem.${range.problem}`)
            )}
          </p>
        )}
      </form>

      {failed && (
        <div data-sr-refusal={refusal ?? ''}>
          <ErrorBanner
            className="p-2.5"
            title={t('list.failedTitle')}
            message={refusal ? t(refusal) : apiErrorMessage(failed.error, t('list.failed'))}
          />
        </div>
      )}

      <Tiles totals={data?.totals} loading={reportRead.isFetching && !data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1 rounded-full border border-border/60 bg-card-2 p-0.5">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filters.tab === tab}
              onClick={() => patch({ tab })}
              className={`${TAB} ${filters.tab === tab ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              data-sr-tab={tab}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {asOf && (
            <span className="text-xs text-muted-foreground" data-sr-as-of={asOf}>
              <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(asOf) }} components={{ at: <Ltr /> }} />
            </span>
          )}
          <Button variant="outlined" disabled={!current.isSuccess} onClick={() => void exportXlsx()} data-sr-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {onRefusals && <DrillLine drill={filters.drill} onClear={() => patch({ drill: NO_DRILL })} />}
      {onRefusals && rowsRead.data?.truncated && (
        <p className="text-xs text-attention-800" data-sr-truncated="">
          {t('list.truncated')}
        </p>
      )}

      <div className="relative h-[calc(100vh-26rem)] min-h-96" data-sr-grid={filters.tab}>
        <TabGrid
          tab={filters.tab}
          report={data}
          refusals={rowsRead.data?.rows}
          loading={onRefusals ? rowsRead.isFetching && !rowsRead.data : reportRead.isFetching && !data}
          quiet={current.isError || !range.ok}
          onReady={(api) => {
            gridApi.current = api
          }}
          onDrill={drill}
          onStore={openStore}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-sr-note="">
        {t(onRefusals ? 'note.refusals' : 'note.sections')}
      </p>
    </div>
  )
}

function Tiles({ totals, loading }: { totals: SerialRefusalTotals | undefined; loading: boolean }) {
  const { t } = useTranslation('serial-refusals')
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-sr-tiles="">
      {TILES.map((key) => (
        <div key={key} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2" data-sr-tile={key} title={t(`tileHint.${key}`)}>
          <dt className="text-xs text-muted-foreground">{t(`tile.${key}`)}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Ltr>{loading || !totals ? t('dash') : String(totals[key])}</Ltr>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** What the Refusals tab is narrowed to, with the way back to every refusal in scope. */
function DrillLine({ drill, onClear }: { drill: Drill; onClear: () => void }) {
  const { t } = useTranslation('serial-refusals')
  if (!isDrilled(drill)) return null
  const parts = [
    drill.noStaff ? t('drill.noStaff') : drill.staff && t('drill.staff', { value: fsi(drill.staff) }),
    drill.serial && t('drill.serial', { value: fsi(drill.serial) }),
    drill.gtin && t('drill.gtin', { value: fsi(drill.gtin) }),
    drill.item && t('drill.item', { value: fsi(drill.item) }),
    drill.heldStore && t('drill.heldStore', { value: fsi(drill.heldStore) }),
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-sr-drill="">
      <span className="text-muted-foreground">{t('drill.label')}</span>
      <span className="rounded-full border border-border/60 bg-card px-2 py-0.5">{parts.join(' · ')}</span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-primary hover:bg-muted"
        data-sr-drill-clear=""
      >
        <X className="h-3 w-3" aria-hidden />
        {t('drill.clear')}
      </button>
    </div>
  )
}

/** The open tab's grid. A row of any section but Refusals and Days opens the refusals behind it. */
function TabGrid({
  tab,
  report,
  refusals,
  loading,
  quiet,
  onReady,
  onDrill,
  onStore,
}: {
  tab: ReportTab
  report: SerialRefusalReport | undefined
  refusals: SerialRefusalRow[] | undefined
  loading: boolean
  quiet: boolean
  onReady: (api: GridApi) => void
  onDrill: (drill: Partial<Drill>) => void
  onStore: (store: string) => void
}) {
  const { t } = useTranslation('serial-refusals')
  const plan = useMemo((): { columns: ColDef[]; rows: unknown[]; open?: (row: never) => void } => {
    switch (tab) {
      case 'staff':
        return {
          columns: staffColumns(t) as ColDef[],
          rows: report?.staff ?? [],
          open: (r: SerialRefusalStaffRow) => onDrill(r.staff ? { staff: r.staff } : { noStaff: true }),
        }
      case 'offenders':
        return {
          columns: offenderColumns(t) as ColDef[],
          rows: report?.offenders ?? [],
          open: (r: SerialRefusalOffenderRow) => onDrill({ staff: r.staff, gtin: r.gtin, serial: r.serial }),
        }
      case 'serials':
        return {
          columns: serialColumns(t) as ColDef[],
          rows: report?.serials ?? [],
          open: (r: SerialRefusalSerialRow) => onDrill({ gtin: r.gtin, serial: r.serial }),
        }
      case 'stores':
        return {
          columns: storeColumns(t) as ColDef[],
          rows: report?.stores ?? [],
          open: (r: SerialRefusalStoreRow) => onStore(r.store),
        }
      case 'articles':
        return {
          columns: articleColumns(t) as ColDef[],
          rows: report?.articles ?? [],
          open: (r: { itemNumber: string }) => onDrill({ item: r.itemNumber }),
        }
      case 'heldBy':
        return {
          columns: heldByColumns(t) as ColDef[],
          rows: report?.heldBy ?? [],
          open: (r: SerialRefusalHeldByRow) => onDrill({ heldStore: r.heldStore }),
        }
      case 'days':
        return { columns: dayColumns(t) as ColDef[], rows: report?.days ?? [] }
      case 'refusals':
        return { columns: refusalColumns(t) as ColDef[], rows: refusals ?? [] }
    }
  }, [tab, report, refusals, t, onDrill, onStore])

  const open = plan.open
  return (
    <AgGridReact
      key={tab}
      theme={omsGridTheme}
      rowData={quiet ? [] : plan.rows}
      columnDefs={plan.columns}
      defaultColDef={DEFAULT_COL_DEF}
      onGridReady={({ api }) => onReady(api)}
      onRowClicked={open ? (e: RowClickedEvent) => e.data && open(e.data as never) : undefined}
      rowClass={open ? 'cursor-pointer' : undefined}
      rowHeight={OMS_GRID_ROW_HEIGHT}
      headerHeight={OMS_GRID_HEADER_HEIGHT}
      tooltipShowDelay={400}
      animateRows={false}
      suppressColumnVirtualisation
      loading={loading}
      noRowsOverlayComponent={NoRows}
      suppressNoRowsOverlay={quiet}
    />
  )
}

function NoRows() {
  const { t } = useTranslation('serial-refusals')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
