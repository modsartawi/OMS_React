import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { pinStart } from '@/core/theme/direction'
import type { DeliveryStatisticsStore } from '@/core/models/delivery-statistics'
import { readAverage, readFigure } from './figures'
import { compareFigures, FLOW_FIGURES, STORE_FIGURES, storeRows, type StoreFigure, type StoreRow } from './store-rows'

const DEFAULT_COL_DEF: ColDef<StoreRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
  // Fourteen columns share the width: a long caption wraps rather than reading "…ded over".
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

/** A figure's header: the band's own caption, so the table and the tiles name a figure alike. */
function header(t: TFunction, key: StoreFigure): string {
  if (key === 'trips') return t('table.trips')
  if (key === 'avgHandOverMinutes') return t('table.avgHandOver')
  // The halves of Handed over name their delivery type, so neither reads as a stage after Out for delivery.
  if (key === 'delivered' || key === 'pickedUp') return t(`table.${key}`)
  return t((FLOW_FIGURES as readonly string[]).includes(key) ? `flow.${key}` : `misses.${key}`)
}

/**
 * The store column, then one column per figure in the bands' order. Every figure sorts as a
 * number with an absent one LAST either way (`compareFigures`), and shows the dash for it through
 * its `valueFormatter` — the base cell renders that formatted value, isolated. Handed over,
 * descending, is the default ranking.
 */
function storeColumns(t: TFunction, dash: string): ColDef<StoreRow>[] {
  const figure = (key: StoreFigure): ColDef<StoreRow> => ({
    field: key,
    headerName: header(t, key),
    minWidth: 88,
    flex: 1,
    type: 'numericColumn',
    cellClass: 'text-end tabular-nums',
    valueFormatter: ({ value }: ValueFormatterParams<StoreRow, number | null>) =>
      key === 'avgHandOverMinutes' ? readAverage(value, dash) : readFigure(value, dash),
    comparator: (a: number | null, b: number | null, _na, _nb, isDescending) => compareFigures(a, b, isDescending),
    // `initialSort`, not `sort`: a rebuilt column set must not re-impose it over the user's pick.
    ...(key === 'handedOver' ? { initialSort: 'desc' as const } : {}),
  })
  return [
    // Pinned to the reading start (AG Grid pins to a physical side `enableRtl` does not flip), so
    // a store stays beside its figures when a narrow window scrolls the table sideways.
    { field: 'storeCode', headerName: t('table.store'), width: 100, pinned: pinStart, cellClass: 'font-mono text-[12px]' },
    ...STORE_FIGURES.map(figure),
  ]
}

/**
 * Up to this many stores the table grows to fit them (so one chosen store is one line); past it,
 * every store at once, it keeps a fixed height and scrolls.
 */
const FIT_ROWS = 15

/**
 * The per-store table (ticket 487): `Stores[]` as the door sent it, to rank branches by any
 * figure. Read-only — no figure drills into its deliveries. With one store chosen (485) it stays,
 * showing that store's single row.
 */
export default function StoreTable({ stores }: { stores: readonly DeliveryStatisticsStore[] }) {
  const { t } = useTranslation('delivery-statistics')
  const dash = t('dash')
  const rows = useMemo(() => storeRows(stores), [stores])
  const columns = useMemo(() => storeColumns(t, dash), [t, dash])
  const fits = rows.length <= FIT_ROWS

  return (
    <section className="flex flex-col gap-2" data-statistics-band="stores">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('band.stores')}</h2>
      <div className={fits ? undefined : 'h-[30rem]'} data-statistics-stores="">
        <AgGridReact<StoreRow>
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={({ data }) => data.storeCode}
          domLayout={fits ? 'autoHeight' : 'normal'}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          // Fourteen columns: render every one, so a cell off to the side is in the DOM for
          // find-in-page and for the drive.
          suppressColumnVirtualisation
          noRowsOverlayComponent={NoStores}
        />
      </div>
    </section>
  )
}

function NoStores() {
  const { t } = useTranslation('delivery-statistics')
  return <span className="text-sm text-muted-foreground">{t('table.empty')}</span>
}
