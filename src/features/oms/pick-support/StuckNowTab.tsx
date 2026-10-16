import { useEffect, useMemo, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AgGridReact } from 'ag-grid-react'
import '@/core/ag-grid-setup'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { RefreshCw } from 'lucide-react'
import { PICK_SUPPORT_SHAPES, type PickSupportCensus, type PickSupportCensusRow } from '@/core/models/pick-support'
import { PickSupportFailureBanner } from '@/core/pick-support/bits'
import { readStamp } from '@/core/pick-support/diagnosis'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { censusQuery, compareSince, sortSince, type CensusFilter } from './census-view'

const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

const DEFAULT_COL_DEF: ColDef<PickSupportCensusRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true }

interface GridContext {
  onOpen: (deliveryNo: string) => void
}

/** The row's one action: open that delivery's diagnosis. Cases are worked one at a time. */
function OpenCell({ data, context }: ICellRendererParams<PickSupportCensusRow, unknown, GridContext>) {
  const { t } = useTranslation('pick-support')
  if (!data) return null
  return (
    <Button variant="outlined" onClick={() => context.onOpen(data.deliveryNo)} data-ps-census-open={data.deliveryNo}>
      {t('list.open')}
    </Button>
  )
}

/** Nothing stuck — or, with a filter set, nothing stuck at that store or in that shape. */
function NoRows({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation('pick-support')
  return <span className="text-sm text-muted-foreground">{filtered ? t('stuck.emptyFiltered') : t('stuck.empty')}</span>
}

function censusColumns(t: TFunction): ColDef<PickSupportCensusRow>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'deliveryNo', headerName: t('list.delivery'), width: 140, cellClass: code },
    { field: 'orderNo', headerName: t('list.order'), width: 140, cellClass: code },
    { field: 'currentStore', headerName: t('list.currentStore'), width: 130, cellClass: code },
    // The shape AS its code: support quotes it; its meaning is the diagnosis's explanation.
    { field: 'shape', headerName: t('stuck.shape'), width: 260, cellClass: code },
    {
      field: 'since',
      headerName: t('stuck.since'),
      width: 170,
      cellClass: code,
      // As sent, never converted (rule 6); never written reads as the dash and sorts last.
      valueFormatter: ({ value }) => readStamp(value) ?? t('dash'),
      comparator: (a, b, _na, _nb, isDescending) => compareSince(a, b, isDescending),
    },
    { colId: 'open', headerName: '', width: 150, sortable: false, resizable: false, cellRenderer: OpenCell },
  ]
}

/**
 * **Stuck now** (ticket 498, brief 2691 "the census"): every delivery stuck now, read afresh from
 * `StuckNow` with the URL's store and shape filters. The badge (on the tab, drawn by the page) is
 * the server's `total`; the rows are one per delivery per shape, in the server's order. A row opens
 * its diagnosis on the Search tab, through the shared panel and its fix dialog.
 */
export default function StuckNowTab({
  filter,
  census,
  onFilter,
  onOpen,
}: {
  filter: CensusFilter
  census: UseQueryResult<PickSupportCensus>
  onFilter: (change: Partial<CensusFilter>) => void
  onOpen: (deliveryNo: string) => void
}) {
  const { t } = useTranslation('pick-support')
  const [store, setStore] = useState(filter.store)
  // A store arriving from outside (a pasted link, Back) — or a store this tab wrote — replaces the draft.
  useEffect(() => setStore(filter.store), [filter.store])

  const columns = useMemo(() => censusColumns(t), [t])
  const rows = useMemo(() => (census.data && !census.isError ? sortSince(census.data.rows ?? []) : []), [census.data, census.isError])
  const context = useMemo<GridContext>(() => ({ onOpen }), [onOpen])
  // A shape typed into the URL that is not one of the three still shows what is being asked for.
  const shapes: string[] = [...PICK_SUPPORT_SHAPES]
  if (filter.shape && !shapes.includes(filter.shape)) shapes.push(filter.shape)

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onFilter({ store: store.trim() })
        }}
        data-ps-census-filters=""
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('stuck.store')}
          <input
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder={t('stuck.storePlaceholder')}
            className={`${INPUT} w-40`}
            data-ps-census-store=""
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('stuck.shape')}
          <select
            value={filter.shape}
            onChange={(e) => onFilter({ shape: e.target.value })}
            className={`${INPUT} w-72 font-mono`}
            data-ps-census-shape=""
          >
            <option value="">{t('stuck.allShapes')}</option>
            {shapes.map((s) => (
              <option key={s} value={s}>
                {fsi(s)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" data-ps-census-apply="">
          {t('stuck.apply')}
        </Button>
        <Button
          type="button"
          variant="outlined"
          disabled={census.isFetching}
          onClick={() => void census.refetch()}
          data-ps-census-refresh=""
        >
          <RefreshCw className={'h-3.5 w-3.5' + (census.isFetching ? ' animate-spin' : '')} aria-hidden />
          {t('stuck.refresh')}
        </Button>
      </form>

      {census.isError && <PickSupportFailureBanner error={census.error} title={t('stuck.failedTitle')} fallback={t('stuck.failed')} />}

      <div className="relative h-[calc(100vh-20rem)] min-h-80" data-ps-census="">
        <AgGridReact<PickSupportCensusRow>
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          context={context}
          // A delivery in two shapes is two rows.
          getRowId={({ data }) => `${data.deliveryNo}|${data.shape}`}
          onRowDoubleClicked={({ data }) => data && onOpen(data.deliveryNo)}
          // Taller than the base row: each row carries an Open diagnosis button.
          rowHeight={OMS_GRID_ROW_HEIGHT + 6}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          loading={census.isPending}
          noRowsOverlayComponent={NoRows}
          noRowsOverlayComponentParams={{ filtered: Object.keys(censusQuery(filter)).length > 0 }}
          // A failed read is the banner's to say; "Nothing is stuck" beside it would contradict it.
          suppressNoRowsOverlay={census.isError}
        />
      </div>
    </div>
  )
}
