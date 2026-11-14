import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { HeldImpactReport } from '@/core/models/held-stock-report'
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
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay, toIsoDate } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { formatFigure } from '@/core/util/number-format'
import { canOpenHeldStockReport, heldStockReportAccessQuery } from './access'
import { heldStockReportApi } from './api'
import {
  HELD_DEFAULTS,
  HELD_TABS,
  HELD_TILES,
  heldFiltersFromParams,
  heldFiltersToParams,
  heldQuery,
  pairsShown,
  type HeldFilters,
  type HeldTab,
  type HeldTile,
} from './held'
import { HELD_TEXT_COLUMNS, pairColumns, repairColumns, sourceColumns } from './held-columns'
import { normalizeStores } from './shared'

/**
 * Held stock impact (BackOffice ticket 3873, spec 3849): what held would take off the channels' figure (Stock Visibility's
 * ATP), fleet-wide, before held is served. Per store and material — with the held units per picking source type, DRS's on a
 * line of their own — then per source type over the fleet, and last the check on held's repairs per day.
 *
 * Behind `canOpenHeldStockReport` on `HeldStockReport/Access` (`BackOfficeScreen[HeldStockReport, 03]`), the predicate the
 * menu leaves read, failing closed.
 *
 * 🚩 Read live from Stock Visibility on every request, and a failed stock read fails the whole report (a partial impact
 * figure would mislead): the error banner is the answer then, never a smaller grid.
 */
export default function HeldPage() {
  const { t } = useTranslation('held-stock-report')
  return (
    <ScreenGate
      query={heldStockReportAccessQuery()}
      can={canOpenHeldStockReport}
      ns="held-stock-report"
      title={t('held.title')}
      subtitle={t('held.subtitle')}
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
  const { query: filters, update, changedFromOutside } = useUrlQuery(heldFiltersFromParams, heldFiltersToParams)
  const [storesDraft, setStoresDraft] = useState(filters.stores)
  useEffect(() => {
    if (changedFromOutside()) setStoresDraft(filters.stores)
  }, [filters, changedFromOutside])

  const [now] = useState(() => new Date())
  const query = useMemo(() => heldQuery(filters), [filters])
  const read = useQuery({
    queryKey: ['oms', 'held-stock-report', 'held', query],
    queryFn: () => heldStockReportApi.held(query),
    retry: false,
  })
  const data = read.data
  // The range shown: the door's answer (it resolves the default 7 days), else the edges asked for.
  const repairsFrom = formatDay(data?.repairsFrom) || filters.repairsFrom
  const repairsTo = formatDay(data?.repairsTo) || filters.repairsTo
  const sourceTypes = useMemo(() => (data?.sources ?? []).map((s) => s.sourceType), [data])

  const patch = (p: Partial<HeldFilters>) => update((prev) => ({ ...prev, ...p }))
  const onPairs = filters.tab === 'pairs'
  const gridApi = useRef<GridApi | null>(null)

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t(`held.tabs.${filters.tab}`), {
        asText: (colId) => HELD_TEXT_COLUMNS.has(colId),
      })
      await writeWorkbook([sheet], xlsxFileName(`${t('held.fileName')}-${toIsoDate(now)}`))
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
        <Field label={t('filters.stores')}>
          <Input
            type="text"
            value={storesDraft}
            onChange={(e) => setStoresDraft(e.target.value)}
            placeholder={t('held.storesPlaceholder')}
            className="w-56"
            data-hsr-filter="stores"
          />
        </Field>
        <Field label={t('held.repairsFrom')}>
          <Input
            type="date"
            value={repairsFrom}
            max={repairsTo || toIsoDate(now)}
            onChange={(e) => patch({ repairsFrom: e.target.value })}
            className="w-40"
            data-hsr-filter="repairsFrom"
          />
        </Field>
        <Field label={t('held.repairsTo')}>
          <Input
            type="date"
            value={repairsTo}
            min={repairsFrom || undefined}
            max={toIsoDate(now)}
            onChange={(e) => patch({ repairsTo: e.target.value })}
            className="w-40"
            data-hsr-filter="repairsTo"
          />
        </Field>
        {onPairs && (
          <Field label={t('held.sourceLabel')}>
            <Select
              value={filters.source}
              onChange={(e) => patch({ source: e.target.value })}
              className="w-40"
              data-hsr-filter="source"
            >
              <option value="">{t('held.anySource')}</option>
              {sourceTypes.map((s) => (
                <option key={s} value={s}>
                  {fsi(s)}
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
            update((prev) => ({ ...HELD_DEFAULTS, tab: prev.tab }))
          }}
          data-hsr-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('held.reset')}
        </Button>
      </form>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('held.failed'))} />
      )}

      <Tiles report={data} loading={read.isFetching && !data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label={t('tabsLabel')} className="flex flex-wrap gap-1">
            {HELD_TABS.map((tab: HeldTab) => (
              <Chip key={tab} variant="tab" on={filters.tab === tab} onClick={() => patch({ tab })} data-hsr-tab={tab}>
                {t(`held.tabs.${tab}`)}
              </Chip>
            ))}
          </div>
          {onPairs && (
            <Chip on={filters.falling} onClick={() => patch({ falling: !filters.falling })} data-hsr-falling="">
              {t('held.fallingOnly')}
            </Chip>
          )}
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

      <div className="relative h-[calc(100vh-27rem)] min-h-96" data-hsr-grid={filters.tab}>
        <TabGrid
          filters={filters}
          data={data}
          sourceTypes={sourceTypes}
          loading={read.isFetching && !data}
          quiet={read.isError}
          onReady={(api) => {
            gridApi.current = api
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-hsr-note="">
        {t(`held.note.${filters.tab}`)}
      </p>
    </div>
  )
}

function tileValue(report: HeldImpactReport, key: HeldTile): number {
  return key === 'repairs' ? report.repairs : report.totals[key]
}

function Tiles({ report, loading }: { report: HeldImpactReport | undefined; loading: boolean }) {
  const { t } = useTranslation('held-stock-report')
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-7" data-hsr-tiles="">
      {HELD_TILES.map((key) => (
        <div
          key={key}
          className="rounded-lg border border-border/60 bg-card/40 px-3 py-2"
          data-hsr-tile={key}
          title={t(`held.tileHint.${key}`)}
        >
          <dt className="text-xs text-muted-foreground">{t(`held.tile.${key}`)}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Ltr>{loading || !report ? t('dash') : formatFigure(tileValue(report, key))}</Ltr>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The open section's grid. */
function TabGrid({
  filters,
  data,
  sourceTypes,
  loading,
  quiet,
  onReady,
}: {
  filters: HeldFilters
  data: HeldImpactReport | undefined
  sourceTypes: string[]
  loading: boolean
  quiet: boolean
  onReady: (api: GridApi) => void
}) {
  const { t } = useTranslation('held-stock-report')
  const { tab } = filters
  const columns = useMemo((): ColDef[] => {
    switch (tab) {
      case 'pairs':
        return pairColumns(t, sourceTypes) as ColDef[]
      case 'sources':
        return sourceColumns(t) as ColDef[]
      case 'repairs':
        return repairColumns(t) as ColDef[]
    }
  }, [tab, t, sourceTypes])
  const rows = useMemo((): unknown[] => {
    if (!data) return []
    switch (tab) {
      case 'pairs':
        return pairsShown(data.pairs, filters)
      case 'sources':
        return data.sources
      case 'repairs':
        return data.repairsPerDay
    }
  }, [data, filters, tab])
  return (
    <AgGridReact
      key={tab}
      theme={omsGridTheme}
      rowData={quiet ? [] : rows}
      columnDefs={columns}
      defaultColDef={DEFAULT_COL_DEF}
      onGridReady={({ api }) => onReady(api)}
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

function NoRows({ tab }: { tab: HeldTab }) {
  const { t } = useTranslation('held-stock-report')
  return <span className="text-sm text-muted-foreground">{t(`held.empty.${tab}`)}</span>
}
