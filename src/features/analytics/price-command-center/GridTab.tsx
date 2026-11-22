import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { PRICE_GRID_SORTS, type PriceGridCompetitor, type PriceGridRow, type PriceGridSort, type PriceWatchCoverage } from '@/core/models/price-watch'
import { OMS_GRID_HEADER_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import DrillDownLink from './DrillDownLink' // 936
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { priceGridApi, priceWatchSharedApi } from './api'
import { CompetitorCell, OursCell } from './GridCells'
import { DEFAULT_GRID_FILTER, GRID_PAGE_SIZE, gridRequest, type GridFilter } from './grid'

const NS = 'price-command-center'
/** Three short lines a cell (price · seller · observed) plus a mark. */
const ROW_HEIGHT = 96

const DEFAULT_COL_DEF: ColDef<PriceGridRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  // The server sorts (units / widest gap) and pages: a client column sort would only reorder one page.
  sortable: false,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

/**
 * The Grid tab (oms 935, BackOffice spec 4127 decisions 6 and 8): one row per watched material, our price first, then
 * one column per competitor in the server's column order. Filters, sort and paging are the server's.
 *
 * Reads `GET PriceWatch/Grid` (BO 4129, reconciled to BO pricing2 d099aac36).
 * A row's material number opens its drill-down (936, `DrillDownLink`).
 */
export default function GridTab() {
  const { t } = useTranslation(NS)
  const [filter, setFilter] = useState<GridFilter>(DEFAULT_GRID_FILTER)
  const [page, setPage] = useState(1)
  const query = gridRequest(filter, page)

  const competitors = useQuery({ queryKey: ['price-watch', 'coverage'], queryFn: () => priceWatchSharedApi.coverage(), retry: false })
  const grid = useQuery({
    queryKey: ['price-watch', 'grid', query],
    queryFn: () => priceGridApi.page(query),
    retry: false,
    placeholderData: keepPreviousData,
  })
  // A refetch can shrink the total under the open page (no pager left to step back with): fall back to the new last page.
  const landed =
    grid.data && !grid.isPlaceholderData
      ? clampToLastPageWhenCurrentPageEmpties({ page, rowCount: grid.data.rows.length, totalMatches: grid.data.total, pageSize: GRID_PAGE_SIZE })
      : page
  useEffect(() => {
    if (landed !== page) setPage(landed)
  }, [landed, page])
  const columns = useMemo(() => gridColumns(grid.data?.competitors ?? [], t), [grid.data?.competitors, t])
  const apply = (next: GridFilter) => {
    setFilter(next)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-3" data-price-grid="">
      <GridFilters filter={filter} competitors={competitors.data ?? []} onChange={apply} />
      {grid.isError ? (
        <ErrorBanner className="p-3" title={t('grid.failed')} message={apiErrorMessage(grid.error, t('grid.failedHint'))} />
      ) : grid.isPending ? (
        <p className="text-sm text-muted-foreground">{t('grid.loading')}</p>
      ) : grid.data.rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground" data-grid-empty="">
          {t('grid.empty')}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-grid-total={grid.data.total}>
            {t('grid.count', { n: fsi(formatFigure(grid.data.total)) })}
          </p>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <AgGridReact<PriceGridRow>
              theme={omsGridTheme}
              rowData={grid.data.rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => data.materialNumber}
              rowHeight={ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              domLayout="autoHeight"
              animateRows={false}
              suppressCellFocus
              loading={grid.isFetching}
            />
            {showsPager(grid.data.total, GRID_PAGE_SIZE) && (
              <GridPager page={page} pageSize={GRID_PAGE_SIZE} totalMatches={grid.data.total} busy={grid.isFetching} onPage={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Material, our price, our units, then one column per competitor (header names are string sinks → `fsi`). */
function gridColumns(competitors: readonly PriceGridCompetitor[], t: TFunction): ColDef<PriceGridRow>[] {
  return [
    { colId: 'material', headerName: t('grid.columns.material'), width: 240, cellRenderer: MaterialCell },
    { colId: 'ours', headerName: t('grid.columns.ours'), width: 150, cellRenderer: ({ data }: ICellRendererParams<PriceGridRow>) => (data ? <OursCell row={data} /> : null) },
    {
      colId: 'units',
      headerName: t('grid.columns.units'),
      width: 110,
      valueGetter: ({ data }) => data?.units30 ?? null,
      valueFormatter: ({ value }) => (value == null ? '' : formatFigure(value as number)),
    },
    ...competitors.map(
      (c): ColDef<PriceGridRow> => ({
        colId: `competitor-${c.competitorCode}`,
        headerName: fsi(c.competitorName || c.competitorCode),
        headerTooltip: fsi(c.competitorCode),
        width: 170,
        cellRenderer: ({ data }: ICellRendererParams<PriceGridRow>) => {
          const cell = data?.cells.find((x) => x.competitorCode === c.competitorCode)
          return data && cell ? <CompetitorCell cell={cell} competitor={c} currency={data.currency} /> : null
        },
      }),
    ),
  ]
}

/** The material: number (machine value; the link to its drill-down, 936), title and brand (free text), A-level · B-level. */
function MaterialCell({ data }: ICellRendererParams<PriceGridRow>) {
  if (!data) return null
  const levels = [data.aLevel, data.bLevel].filter(Boolean)
  return (
    <div className="flex flex-col py-1 leading-tight" data-grid-material={data.materialNumber}>
      <DrillDownLink material={data.materialNumber} className="text-xs" />
      {data.title && (
        <span className="truncate text-sm">
          <bdi>{data.title}</bdi>
        </span>
      )}
      {data.brand && (
        <span className="truncate text-xs text-muted-foreground">
          <bdi>{data.brand}</bdi>
        </span>
      )}
      {levels.length > 0 && (
        <span className="text-xs text-muted-foreground">
          <Ltr>{levels.length === 2 ? formatPair(levels[0], levels[1]) : levels[0]}</Ltr>
        </span>
      )}
    </div>
  )
}

/** A-level, B-level, brand, competitor, "a competitor is cheaper than us", and the sort. */
export function GridFilters({
  filter,
  competitors,
  onChange,
}: {
  filter: GridFilter
  competitors: readonly PriceWatchCoverage[]
  onChange: (next: GridFilter) => void
}) {
  const { t } = useTranslation(NS)
  const [text, setText] = useState({ aLevel: filter.aLevel, bLevel: filter.bLevel, brand: filter.brand })
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onChange({ ...filter, ...text })
      }}
      data-grid-filters=""
    >
      <Field label={t('grid.filters.aLevel')} hint={t('grid.filters.codeHint')} className="w-32">
        <Input value={text.aLevel} onChange={(e) => setText({ ...text, aLevel: e.target.value })} dir="ltr" data-grid-a-level="" />
      </Field>
      <Field label={t('grid.filters.bLevel')} hint={t('grid.filters.codeHint')} className="w-32">
        <Input value={text.bLevel} onChange={(e) => setText({ ...text, bLevel: e.target.value })} dir="ltr" data-grid-b-level="" />
      </Field>
      <Field label={t('grid.filters.brand')} className="w-40">
        <Input value={text.brand} onChange={(e) => setText({ ...text, brand: e.target.value })} data-grid-brand="" />
      </Field>
      <Field label={t('grid.filters.competitor')} className="w-48">
        <Select value={filter.competitor} onChange={(e) => onChange({ ...filter, ...text, competitor: e.target.value })} data-grid-competitor="">
          <option value="">{t('grid.filters.anyCompetitor')}</option>
          {competitors.map((c) => (
            <option key={c.competitorCode} value={c.competitorCode}>
              {fsi(formatPair(c.competitorCode, c.competitorName))}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('grid.filters.sort')} className="w-48">
        <Select value={filter.sort} onChange={(e) => onChange({ ...filter, ...text, sort: e.target.value as PriceGridSort })} data-grid-sort="">
          {PRICE_GRID_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`grid.sort.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Chip on={filter.competitorCheaper} onClick={() => onChange({ ...filter, ...text, competitorCheaper: !filter.competitorCheaper })} data-grid-cheaper="">
        {t('grid.filters.competitorCheaper')}
      </Chip>
      <Button type="submit" variant="outlined">
        {t('grid.filters.apply')}
      </Button>
    </form>
  )
}
