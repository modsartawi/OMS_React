import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowClickedEvent } from 'ag-grid-community'
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, RotateCcw, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { TakeRefusalGroup, TakeRefusalReport } from '@/core/models/held-stock-report'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatParts, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay, toIsoDate } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { formatFigure } from '@/core/util/number-format'
import { canOpenHeldStockReport, heldStockReportAccessQuery } from './access'
import { heldStockReportApi } from './api'
import {
  REFUSAL_TEXT_COLUMNS,
  groupColumns,
  lastResortColumns,
  multiBatchColumns,
  rowColumns,
} from './refusal-columns'
import {
  REFUSAL_DEFAULTS,
  REFUSAL_KINDS,
  REFUSAL_TABS,
  REFUSAL_TILES,
  drillIntoGroup,
  groupsShown,
  refusalFiltersFromParams,
  refusalFiltersToParams,
  refusalQuery,
  refusalTotals,
  rowsShown,
  type RefusalDrill,
  type RefusalFilters,
  type RefusalKind,
  type RefusalTab,
  type RefusalTotals,
} from './refusals'
import { canStepForward, normalizeStores, stepDay } from './shared'

/**
 * Take refusals (BackOffice ticket 3873, spec 3849): HQ's refusal report, read before a switch is moved. One day of the take
 * door's refusals and a shadow store's would-be refusals by store, material and batch, with the SAP and POS feed ages on
 * each; the lines of the day that span more than one batch; and each take of last-resort stock. A group opens its log rows.
 *
 * Behind `canOpenHeldStockReport` on `HeldStockReport/Access` (`BackOfficeScreen[HeldStockReport, 03]`), the predicate the
 * menu leaves read, failing closed.
 *
 * 🚩 A store Stock Visibility did not answer is named above the grids: its refusals are missing, not zero.
 */
export default function RefusalsPage() {
  const { t } = useTranslation('held-stock-report')
  return (
    <ScreenGate
      query={heldStockReportAccessQuery()}
      can={canOpenHeldStockReport}
      ns="held-stock-report"
      title={t('refusals.title')}
      subtitle={t('refusals.subtitle')}
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

function Report() {
  const { t } = useTranslation('held-stock-report')
  const { query: filters, update, changedFromOutside } = useUrlQuery(refusalFiltersFromParams, refusalFiltersToParams)
  // The stores box is a draft, applied on Enter or Apply: typed into the URL on every key, each key would read.
  const [storesDraft, setStoresDraft] = useState(filters.stores)
  useEffect(() => {
    if (changedFromOutside()) setStoresDraft(filters.stores)
  }, [filters, changedFromOutside])

  // "Today" is read once per visit: the day box's default and the forward bound.
  const [now] = useState(() => new Date())
  const query = useMemo(() => refusalQuery(filters), [filters])
  const read = useQuery({
    queryKey: ['oms', 'held-stock-report', 'refusals', query],
    queryFn: () => heldStockReportApi.refusals(query),
    retry: false,
  })
  const data = read.data
  const shownDay = formatDay(data?.day) || filters.day || toIsoDate(now)

  const patch = (p: Partial<RefusalFilters>) => update((prev) => ({ ...prev, ...p }))
  const openGroup = useCallback((g: TakeRefusalGroup) => update((prev) => drillIntoGroup(prev, g)), [update])
  const totals = useMemo(() => (data ? refusalTotals(data) : null), [data])
  const gridApi = useRef<GridApi | null>(null)
  const onRows = filters.tab === 'rows'
  const withKind = filters.tab === 'groups' || onRows

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t(`refusals.tabs.${filters.tab}`), {
        asText: (colId) => REFUSAL_TEXT_COLUMNS.has(colId),
      })
      await writeWorkbook([sheet], xlsxFileName(`${t('refusals.fileName')}-${shownDay}`))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

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
        data-hsr-filters=""
      >
        <Field label={t('refusals.day.label')}>
          <div className="flex items-center gap-1">
            <Button
              variant="outlined"
              aria-label={t('refusals.day.previous')}
              title={t('refusals.day.previous')}
              onClick={() => patch({ day: stepDay(shownDay, -1) })}
              data-hsr-day="previous"
            >
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            </Button>
            <Input
              type="date"
              value={shownDay}
              max={toIsoDate(now)}
              onChange={(e) => patch({ day: e.target.value })}
              className="w-40"
              data-hsr-filter="day"
            />
            <Button
              variant="outlined"
              aria-label={t('refusals.day.next')}
              title={t('refusals.day.next')}
              disabled={!canStepForward(shownDay, now)}
              onClick={() => patch({ day: stepDay(shownDay, 1) })}
              data-hsr-day="next"
            >
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </Field>
        <Field label={t('filters.stores')}>
          <Input
            type="text"
            value={storesDraft}
            onChange={(e) => setStoresDraft(e.target.value)}
            placeholder={t('refusals.storesPlaceholder')}
            className="w-56"
            data-hsr-filter="stores"
          />
        </Field>
        {withKind && (
          <Field label={t('refusals.kindLabel')}>
            <Select
              value={filters.kind}
              onChange={(e) => patch({ kind: e.target.value as RefusalKind })}
              className="w-56"
              data-hsr-filter="kind"
            >
              {REFUSAL_KINDS.map((k) => (
                <option key={k || 'any'} value={k}>
                  {t(k ? `kind.${k}` : 'kind.any')}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Button type="submit" variant="secondary" data-hsr-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoresDraft('')
            update((prev) => ({ ...REFUSAL_DEFAULTS, tab: prev.tab }))
          }}
          data-hsr-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('refusals.reset')}
        </Button>
      </form>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('list.failed'))} />
      )}
      {data && data.storesUnreached.length > 0 && <Unreached stores={data.storesUnreached} />}

      <Tiles totals={totals} loading={read.isFetching && !data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('tabsLabel')} className="flex flex-wrap gap-1">
          {REFUSAL_TABS.map((tab: RefusalTab) => (
            <Chip key={tab} variant="tab" on={filters.tab === tab} onClick={() => patch({ tab })} data-hsr-tab={tab}>
              {t(`refusals.tabs.${tab}`)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {data?.asOf && (
            <span className="text-xs text-muted-foreground" data-hsr-as-of={data.asOf}>
              <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(data.asOf) }} components={{ at: <Ltr /> }} />
            </span>
          )}
          <Button variant="outlined" disabled={!read.isSuccess} onClick={() => void exportXlsx()} data-hsr-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {onRows && filters.drill && <DrillLine drill={filters.drill} onClear={() => patch({ drill: null })} />}

      <div className="relative h-[calc(100vh-27rem)] min-h-96" data-hsr-grid={filters.tab}>
        <TabGrid
          filters={filters}
          data={data}
          loading={read.isFetching && !data}
          quiet={read.isError}
          onReady={(api) => {
            gridApi.current = api
          }}
          onGroup={openGroup}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-hsr-note="">
        {t(`refusals.note.${filters.tab}`)}
      </p>
    </div>
  )
}

/** The stores whose log Stock Visibility did not answer: their rows are missing, not zero. */
function Unreached({ stores }: { stores: string[] }) {
  const { t } = useTranslation('held-stock-report')
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-attention-800 bg-attention-050 p-2.5 text-[0.8125rem] text-attention-800"
      data-hsr-unreached={stores.length}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t('refusals.unreached.title', { count: stores.length, n: fsi(formatFigure(stores.length)) })}</p>
        <p>
          {t('refusals.unreached.hint')}{' '}
          <span className="font-mono text-[12px]">
            <Ltr>{stores.join(',')}</Ltr>
          </span>
        </p>
      </div>
    </div>
  )
}

function Tiles({ totals, loading }: { totals: RefusalTotals | null; loading: boolean }) {
  const { t } = useTranslation('held-stock-report')
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-6" data-hsr-tiles="">
      {REFUSAL_TILES.map((key) => (
        <div
          key={key}
          className="rounded-lg border border-border/60 bg-card/40 px-3 py-2"
          data-hsr-tile={key}
          title={t(`refusals.tileHint.${key}`)}
        >
          <dt className="text-xs text-muted-foreground">{t(`refusals.tile.${key}`)}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Ltr>{loading || !totals ? t('dash') : formatFigure(totals[key])}</Ltr>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The group the Rows tab is narrowed to, with the way back to every row of the day. */
function DrillLine({ drill, onClear }: { drill: RefusalDrill; onClear: () => void }) {
  const { t } = useTranslation('held-stock-report')
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-hsr-drill="">
      <span className="text-muted-foreground">{t('refusals.drill.label')}</span>
      <span className="rounded-full border border-border bg-card px-2 py-0.5">
        <Ltr>{formatParts([drill.store, drill.material, drill.batch])}</Ltr>
        {!drill.batch && (
          <>
            {' · '}
            <span className="italic">{t('refusals.noBatch')}</span>
          </>
        )}
        {' · '}
        {t(drill.shadow ? 'kind.shadow' : 'kind.real')}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-primary hover:bg-muted"
        data-hsr-drill-clear=""
      >
        <X className="h-3 w-3" aria-hidden />
        {t('refusals.drill.clear')}
      </button>
    </div>
  )
}

/** The open tab's grid. A group row opens its log rows. */
function TabGrid({
  filters,
  data,
  loading,
  quiet,
  onReady,
  onGroup,
}: {
  filters: RefusalFilters
  data: TakeRefusalReport | undefined
  loading: boolean
  quiet: boolean
  onReady: (api: GridApi) => void
  onGroup: (g: TakeRefusalGroup) => void
}) {
  const { t } = useTranslation('held-stock-report')
  const { tab } = filters
  const columns = useMemo((): ColDef[] => {
    switch (tab) {
      case 'groups':
        return groupColumns(t) as ColDef[]
      case 'rows':
        return rowColumns(t) as ColDef[]
      case 'multiBatch':
        return multiBatchColumns(t) as ColDef[]
      case 'lastResort':
        return lastResortColumns(t) as ColDef[]
    }
  }, [tab, t])
  const rows = useMemo((): unknown[] => {
    if (!data) return []
    switch (tab) {
      case 'groups':
        return groupsShown(data.groups, filters)
      case 'rows':
        return rowsShown(data.rows, filters)
      case 'multiBatch':
        return data.multiBatchLines
      case 'lastResort':
        return data.lastResortTakes
    }
  }, [data, filters, tab])
  const onGroups = tab === 'groups'
  return (
    <AgGridReact
      key={tab}
      theme={omsGridTheme}
      rowData={quiet ? [] : rows}
      columnDefs={columns}
      defaultColDef={DEFAULT_COL_DEF}
      onGridReady={({ api }) => onReady(api)}
      onRowClicked={onGroups ? (e: RowClickedEvent) => e.data && onGroup(e.data as TakeRefusalGroup) : undefined}
      rowClass={onGroups ? 'cursor-pointer' : undefined}
      rowHeight={OMS_GRID_ROW_HEIGHT}
      headerHeight={OMS_GRID_HEADER_HEIGHT}
      tooltipShowDelay={400}
      animateRows={false}
      suppressColumnVirtualisation
      loading={loading}
      noRowsOverlayComponent={NoRows}
      noRowsOverlayComponentParams={{ tab }}
      suppressNoRowsOverlay={quiet}
    />
  )
}

function NoRows({ tab }: { tab: RefusalTab }) {
  const { t } = useTranslation('held-stock-report')
  return <span className="text-sm text-muted-foreground">{t(`refusals.empty.${tab}`)}</span>
}
