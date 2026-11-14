import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowClickedEvent } from 'ag-grid-community'
import { AlertTriangle, FileSpreadsheet, RotateCcw, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { HOLD_DAILY_LIST_KINDS, type HoldDailyListRow } from '@/core/models/hold-daily-list'
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
import { formatDateTime } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { formatFigure } from '@/core/util/number-format'
import { canOpenHoldDailyList, holdDailyListAccessQuery } from './access'
import { holdDailyListApi } from './api'
import { TEXT_COLUMNS, rowColumns, storeColumns } from './columns'
import {
  DEFAULT_FILTERS,
  LIST_TABS,
  causesOf,
  filtersFromParams,
  filtersToParams,
  isStale,
  kindTotals,
  listQuery,
  normalizeStores,
  rowsShown,
  storeMatrix,
  withKind,
  type KindTotal,
  type ListFilters,
  type ListTab,
  type StoreLine,
} from './list'

/**
 * HQ's daily list of holds that should have ended (BackOffice ticket 3872, spec 3849): sold holds over 24 hours (also the
 * sales that did not reach HQ), donor holds waiting for the goods issue, holds waiting for a movement over an hour, Return
 * POs over 30 days, deliveries out over 3 days and delivered with no sale. Each held unit is traced to its document, unit
 * and take, so a support agent can explain why a pack is held.
 *
 * Behind `canOpenHoldDailyList` on its own probe (`HoldDailyList/Access`, `BackOfficeScreen[HoldDailyList, 03]`), the same
 * predicate the menu leaf reads, failing closed.
 *
 * 🚩 The list is the daily fill's (`PickHoldDailyList`), never computed on the request. A failed fill leaves yesterday's list
 * standing, so a list older than a day says so above the tiles rather than passing for today's.
 */
export default function HoldDailyListPage() {
  const { t } = useTranslation('hold-daily-list')
  return (
    <ScreenGate
      query={holdDailyListAccessQuery()}
      can={canOpenHoldDailyList}
      ns="hold-daily-list"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <List />
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

function List() {
  const { t } = useTranslation('hold-daily-list')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)
  // The stores box is a draft, applied on Enter or Apply: typed into the URL on every key, each key would read.
  const [storesDraft, setStoresDraft] = useState(filters.stores)
  useEffect(() => {
    if (changedFromOutside()) setStoresDraft(filters.stores)
  }, [filters, changedFromOutside])

  const query = useMemo(() => listQuery(filters), [filters])
  const read = useQuery({
    queryKey: ['oms', 'hold-daily-list', 'list', query],
    queryFn: () => holdDailyListApi.list(query),
    retry: false,
  })
  const data = read.data

  const patch = (p: Partial<ListFilters>) => update((prev) => ({ ...prev, ...p }))
  const openStore = useCallback(
    (line: StoreLine) => update((prev) => ({ ...prev, tab: 'rows', store: line.storeCode })),
    [update],
  )
  const onRows = filters.tab === 'rows'
  const causes = causesOf(filters.kind)
  const rows = useMemo(() => rowsShown(data?.rows ?? [], filters), [data, filters])
  // The Stores tab reads the door's counts, narrowed to the open kind like the held units are.
  const stores = useMemo(
    () => storeMatrix((data?.counts ?? []).filter((c) => !filters.kind || c.kind === filters.kind)),
    [data, filters.kind],
  )
  const totals = useMemo(() => (data ? kindTotals(data.counts) : null), [data])
  const stale = !!data && isStale(data.filledAt, data.asOf)
  const gridApi = useRef<GridApi | null>(null)

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t(`tabs.${filters.tab}`), { asText: (colId) => TEXT_COLUMNS.has(colId) })
      const kind = filters.kind ? `-${filters.kind.toLowerCase()}` : ''
      await writeWorkbook([sheet], xlsxFileName(`${t('export.fileName')}${kind}`))
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
          const normalized = normalizeStores(storesDraft)
          setStoresDraft(normalized)
          patch({ stores: normalized, store: '' })
        }}
        data-hdl-filters=""
      >
        <Field label={t('filters.kind')}>
          <Select
            value={filters.kind}
            onChange={(e) => update((prev) => withKind(prev, e.target.value))}
            className="w-72"
            data-hdl-filter="kind"
          >
            <option value="">{t('filters.anyKind')}</option>
            {HOLD_DAILY_LIST_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kindShort.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        {causes.length > 0 && (
          <Field label={t('filters.cause')}>
            <Select
              value={filters.cause}
              onChange={(e) => patch({ cause: e.target.value })}
              className="w-64"
              data-hdl-filter="cause"
            >
              <option value="">{t('filters.anyCause')}</option>
              {causes.map((c) => (
                <option key={c} value={c}>
                  {t(`causeShort.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t('filters.stores')}>
          <Input
            type="text"
            value={storesDraft}
            onChange={(e) => setStoresDraft(e.target.value)}
            placeholder={t('filters.storesPlaceholder')}
            className="w-56"
            data-hdl-filter="stores"
          />
        </Field>
        <Button type="submit" variant="secondary" data-hdl-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoresDraft('')
            update(() => DEFAULT_FILTERS)
          }}
          data-hdl-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.reset')}
        </Button>
        {data && (
          <p className="basis-full text-xs text-muted-foreground" data-hdl-filled={data.filledAt ?? ''}>
            {data.filledAt ? (
              <Trans t={t} i18nKey="filledAt" values={{ at: formatDateTime(data.filledAt) }} components={{ at: <Ltr /> }} />
            ) : (
              <span className="text-attention-800" data-hdl-not-filled="">
                {t('notFilled')}
              </span>
            )}
          </p>
        )}
      </form>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('list.failed'))} />
      )}
      {stale && data?.filledAt && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-attention-800 bg-attention-050 p-2.5 text-[0.8125rem] text-attention-800"
          data-hdl-stale=""
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('stale')}</span>
        </div>
      )}

      <Tiles totals={totals} loading={read.isFetching && !data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1">
          {LIST_TABS.map((tab: ListTab) => (
            <Chip key={tab} variant="tab" on={filters.tab === tab} onClick={() => patch({ tab })} data-hdl-tab={tab}>
              {t(`tabs.${tab}`)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {data?.asOf && (
            <span className="text-xs text-muted-foreground" data-hdl-as-of={data.asOf}>
              <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(data.asOf) }} components={{ at: <Ltr /> }} />
            </span>
          )}
          <Button variant="outlined" disabled={!read.isSuccess} onClick={() => void exportXlsx()} data-hdl-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {onRows && filters.store && (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-hdl-drill="">
          <span className="text-muted-foreground">{t('drill.label')}</span>
          <span className="rounded-full border border-border bg-card px-2 py-0.5">
            <Ltr>{filters.store}</Ltr>
          </span>
          <Button variant="text" onClick={() => patch({ store: '' })} data-hdl-drill-clear="">
            <X className="h-3 w-3" aria-hidden />
            {t('drill.clear')}
          </Button>
        </div>
      )}

      <div className="relative h-[calc(100vh-27rem)] min-h-96" data-hdl-grid={filters.tab}>
        <TabGrid
          tab={filters.tab}
          rows={rows}
          stores={stores}
          asOf={data?.asOf ?? ''}
          loading={read.isFetching && !data}
          quiet={read.isError}
          onReady={(api) => {
            gridApi.current = api
          }}
          onStore={openStore}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-hdl-note="">
        {t(onRows ? 'note.rows' : 'note.stores')}
      </p>
    </div>
  )
}

function Tiles({ totals, loading }: { totals: Record<string, KindTotal> | null; loading: boolean }) {
  const { t } = useTranslation('hold-daily-list')
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" data-hdl-tiles="">
      {HOLD_DAILY_LIST_KINDS.map((kind) => {
        const total = totals?.[kind]
        return (
          <div key={kind} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2" data-hdl-tile={kind} title={t(`kind.${kind}`)}>
            <dt className="text-xs text-muted-foreground">{t(`kindShort.${kind}`)}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              <Ltr>{loading || !total ? t('dash') : String(total.rows)}</Ltr>
            </dd>
            {!loading && total && (
              <dd className="text-xs text-muted-foreground">
                <Trans t={t} i18nKey="tileHeld" values={{ q: formatFigure(total.heldQuantity) }} components={{ q: <Ltr /> }} />
              </dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}

/** The open tab's grid. A store line opens that store's held units. */
function TabGrid({
  tab,
  rows,
  stores,
  asOf,
  loading,
  quiet,
  onReady,
  onStore,
}: {
  tab: ListTab
  rows: HoldDailyListRow[]
  stores: StoreLine[]
  asOf: string
  loading: boolean
  quiet: boolean
  onReady: (api: GridApi) => void
  onStore: (line: StoreLine) => void
}) {
  const { t } = useTranslation('hold-daily-list')
  const onStores = tab === 'stores'
  const columns = useMemo(
    () => (onStores ? (storeColumns(t) as ColDef[]) : (rowColumns(t, asOf) as ColDef[])),
    [onStores, t, asOf],
  )
  const data: unknown[] = onStores ? stores : rows
  return (
    <AgGridReact
      key={tab}
      theme={omsGridTheme}
      rowData={quiet ? [] : data}
      columnDefs={columns}
      defaultColDef={DEFAULT_COL_DEF}
      onGridReady={({ api }) => onReady(api)}
      onRowClicked={onStores ? (e: RowClickedEvent) => e.data && onStore(e.data as StoreLine) : undefined}
      rowClass={onStores ? 'cursor-pointer' : undefined}
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
  const { t } = useTranslation('hold-daily-list')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
