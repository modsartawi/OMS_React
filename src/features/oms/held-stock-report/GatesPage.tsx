import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { StoreGateFigures } from '@/core/models/held-stock-report'
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
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay, toIsoDate } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { formatFigure } from '@/core/util/number-format'
import { canOpenHeldStockReport, heldStockReportAccessQuery } from './access'
import { heldStockReportApi } from './api'
import { GATE_TEXT_COLUMNS, gateColumns } from './gate-columns'
import {
  GATES_DEFAULTS,
  GATES_TILES,
  gateRow,
  gatesFiltersFromParams,
  gatesFiltersToParams,
  gatesQuery,
  gatesTile,
  storesShown,
  type GatesFilters,
} from './gates'
import { normalizeStores } from './shared'

/**
 * Till-side gate figures (BackOffice ticket 3900, spec 3849 A): per store over the last 14 days, the gates the till and OMS
 * own — 99% of takes answered at the till within 1 second and fewer than 1 in 100 unanswered at 2 seconds, no delivery sale
 * without its picking document (per day), and every till of the store heard on the hold seam. What a person confirms
 * before a store moves to Blocking (SIS.Stock 071).
 *
 * Behind `canOpenHeldStockReport` on `HeldStockReport/Access` (`BackOfficeScreen[HeldStockReport, 03]`), failing closed.
 */
export default function GatesPage() {
  const { t } = useTranslation('held-stock-report')
  return (
    <ScreenGate
      query={heldStockReportAccessQuery()}
      can={canOpenHeldStockReport}
      ns="held-stock-report"
      title={t('gates.title')}
      subtitle={t('gates.subtitle')}
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
  const { query: filters, update, changedFromOutside } = useUrlQuery(gatesFiltersFromParams, gatesFiltersToParams)
  const [storesDraft, setStoresDraft] = useState(filters.stores)
  useEffect(() => {
    if (changedFromOutside()) setStoresDraft(filters.stores)
  }, [filters, changedFromOutside])

  const [now] = useState(() => new Date())
  const query = useMemo(() => gatesQuery(filters), [filters])
  const read = useQuery({
    queryKey: ['oms', 'held-stock-report', 'gates', query],
    queryFn: () => heldStockReportApi.gateFigures(query),
    retry: false,
  })
  const data = read.data
  const to = formatDay(data?.to) || filters.to
  const rows = useMemo(() => storesShown(data?.stores ?? [], filters.failing).map(gateRow), [data, filters.failing])

  const patch = (p: Partial<GatesFilters>) => update((prev) => ({ ...prev, ...p }))
  const gridApi = useRef<GridApi | null>(null)
  const columns = useMemo(() => gateColumns(t) as ColDef[], [t])

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t('gates.title'), { asText: (colId) => GATE_TEXT_COLUMNS.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(`${t('gates.fileName')}-${toIsoDate(now)}`))
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
        <Field label={t('gates.to')}>
          <Input
            type="date"
            value={to}
            max={toIsoDate(now)}
            onChange={(e) => patch({ to: e.target.value })}
            className="w-40"
            data-hsr-filter="to"
          />
        </Field>
        <Button type="submit" variant="secondary" data-hsr-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoresDraft('')
            update(() => ({ ...GATES_DEFAULTS }))
          }}
          data-hsr-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('gates.reset')}
        </Button>
      </form>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('gates.failed'))} />
      )}

      <Tiles stores={data?.stores} loading={read.isFetching && !data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Chip on={filters.failing} onClick={() => patch({ failing: !filters.failing })} data-hsr-failing="">
            {t('gates.failingOnly')}
          </Chip>
          {data?.from && (
            <span className="text-xs text-muted-foreground" data-hsr-window="">
              <Trans
                t={t}
                i18nKey="gates.window"
                values={{ from: formatDay(data.from), to: formatDay(data.to) }}
                components={{ d: <Ltr /> }}
              />
            </span>
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

      <div className="relative h-[calc(100vh-27rem)] min-h-96" data-hsr-grid="gates">
        <AgGridReact
          theme={omsGridTheme}
          rowData={read.isError ? [] : rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          onGridReady={({ api }) => {
            gridApi.current = api
          }}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          tooltipShowDelay={400}
          animateRows={false}
          suppressColumnVirtualisation
          loading={read.isFetching && !data}
          noRowsOverlayComponent={NoRows}
          suppressNoRowsOverlay={read.isError}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-hsr-note="">
        {t('gates.note')}
      </p>
    </div>
  )
}

function Tiles({ stores, loading }: { stores: StoreGateFigures[] | undefined; loading: boolean }) {
  const { t } = useTranslation('held-stock-report')
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-hsr-tiles="">
      {GATES_TILES.map((key) => (
        <div
          key={key}
          className="rounded-lg border border-border/60 bg-card/40 px-3 py-2"
          data-hsr-tile={key}
          title={t(`gates.tileHint.${key}`)}
        >
          <dt className="text-xs text-muted-foreground">{t(`gates.tile.${key}`)}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Ltr>{loading || !stores ? t('dash') : formatFigure(gatesTile(stores, key))}</Ltr>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function NoRows() {
  const { t } = useTranslation('held-stock-report')
  return <span className="text-sm text-muted-foreground">{t('gates.empty')}</span>
}
