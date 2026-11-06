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
import CellBar from '@/core/charts/CellBar'
import { readAverage, readFigure, readShare } from './figures'
import { compareFigures } from '@/core/util/compare-figures'
import {
  CELL_BAR_FIGURES,
  columnMaxima,
  defaultSort,
  FLOW_FIGURES,
  storeRows,
  TABLE_TRACKS,
  TRACK_FIGURES,
  type CellBarFigure,
  type StoreFigure,
  type StoreRow,
  type TableTrack,
} from './store-rows'
import Chip from '@/core/ui/Chip'

const DEFAULT_COL_DEF: ColDef<StoreRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
  // Up to fifteen columns share the width: a long caption wraps rather than reading "…ded over".
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

/**
 * The headers the table names itself (`table.*`): Trips, and the 816 columns — the slot keeping, Delivered
 * per trip, and Avg delivery time (the All view's store-wide one and the Delivery lane's). Pick-up keeps
 * its entry-to-Made-ready average, Avg time to ready.
 */
const TABLE_HEADER: Partial<Record<StoreFigure, string>> = {
  trips: 'table.trips',
  inSlotShare: 'table.inSlotShare',
  outOfSlotShare: 'table.outOfSlotShare',
  noSlot: 'table.noSlot',
  deliveredPerTrip: 'table.deliveredPerTrip',
  avgDeliveryMinutes: 'table.avgDeliveryTime',
  avgHandOverMinutes: 'table.avgToReady',
}

/** How a figure's cell reads: a share as a percent, a ratio or minutes to two places, a count whole. */
function readCell(key: StoreFigure, value: number | null | undefined, dash: string): string {
  if (key === 'inSlotShare' || key === 'outOfSlotShare') return readShare(value, dash)
  if (key === 'deliveredPerTrip' || key === 'avgDeliveryMinutes' || key === 'avgHandOverMinutes') return readAverage(value, dash)
  return readFigure(value, dash)
}

const isCellBar = (key: StoreFigure): key is CellBarFigure => (CELL_BAR_FIGURES as readonly string[]).includes(key)

/** A figure's header in a view: the band's own caption, so the table and the tiles name a figure alike. */
function header(t: TFunction, track: TableTrack, key: StoreFigure): string {
  const own = TABLE_HEADER[key]
  if (own) return t(own)
  if (key === 'unspecified') return t('unspecified.caption')
  // In All, the halves of Handed over name their delivery type, so neither reads as a stage after Out
  // for delivery; in a track's view each is that lane's last stage, captioned as the lane captions it.
  if ((key === 'delivered' || key === 'pickedUp') && track === 'all') return t(`table.${key}`)
  return t((FLOW_FIGURES as readonly string[]).includes(key) ? `flow.${key}` : `misses.${key}`)
}

/**
 * The store column, then one column per figure of the view (`TRACK_FIGURES`). Every figure sorts as a
 * number with an absent one LAST either way (`compareFigures`), and shows the dash for it through its
 * `valueFormatter` — the base cell renders that formatted value, isolated. The view's opening ranking
 * is `defaultSort` (816: Out of slot %, worst first, in Delivery under a courier; else its hand-over column).
 *
 * Out of slot %, Delivered per trip and Avg delivery time draw through `core/charts` `CellBar` (816): a bar
 * in proportion to the column's largest value as sent (`columnMaxima`), behind the formatted value, which
 * `CellBar` isolates whole. No `fsi` and nothing beside the value: Ctrl+C carries the cell as formatted.
 */
function storeColumns(t: TFunction, track: TableTrack, courier: string, dash: string, maxima: Record<CellBarFigure, number>): ColDef<StoreRow>[] {
  const opening = defaultSort(track, courier)
  const figure = (key: StoreFigure): ColDef<StoreRow> => ({
    field: key,
    headerName: header(t, track, key),
    minWidth: 88,
    flex: 1,
    type: 'numericColumn',
    cellClass: 'text-end tabular-nums',
    valueFormatter: ({ value }: ValueFormatterParams<StoreRow, number | null | undefined>) => readCell(key, value, dash),
    // `?? null`: a row is Partial by type, and an undefined cell must sort as absent, not as NaN.
    comparator: (a: number | null | undefined, b: number | null | undefined, _na, _nb, isDescending) =>
      compareFigures(a ?? null, b ?? null, isDescending),
    // `initialSort`, not `sort`: a rebuilt column set must not re-impose it over the user's pick.
    ...(key === opening.figure ? { initialSort: opening.direction } : {}),
    ...(isCellBar(key) ? { cellRenderer: CellBar, cellRendererParams: { max: maxima[key] } } : {}),
  })
  return [
    // Pinned to the reading start (AG Grid pins to a physical side `enableRtl` does not flip), so
    // a store stays beside its figures when a narrow window scrolls the table sideways.
    { field: 'storeCode', headerName: t('table.store'), width: 100, pinned: pinStart, cellClass: 'font-mono text-[12px]' },
    ...TRACK_FIGURES[track].map(figure),
  ]
}

/**
 * Up to this many stores the table grows to fit them (so one chosen store is one line); past it,
 * every store at once, it keeps a fixed height and scrolls.
 */
const FIT_ROWS = 15

/** A view's switch caption: All, or the track as its lane is captioned. */
const TRACK_CAPTION: Record<TableTrack, string> = { all: 'table.track.all', delivery: 'lane.delivery', pickUp: 'lane.pickUp' }

/**
 * The per-store table (ticket 487): `Stores[]` as the door sent it, to rank branches by any
 * figure. Read-only — no figure drills into its deliveries. With one store chosen (485) it stays,
 * showing that store's single row.
 *
 * One Delivery / Pick-up / All switch above it (491) picks the view; the page holds it in the URL
 * (`track`). A view's rows are each store's own figures for that track, never summed into the lanes.
 */
export default function StoreTable({
  stores,
  track,
  courier,
  views = TABLE_TRACKS,
  onTrack,
}: {
  stores: readonly DeliveryStatisticsStore[]
  track: TableTrack
  /** The courier scope (813; `''` = all couriers): it picks the view's opening sort (816). */
  courier: string
  /** The views offered (813: no Pick-up under a chosen courier); every view by default. */
  views?: readonly TableTrack[]
  onTrack: (track: TableTrack) => void
}) {
  const { t } = useTranslation('delivery-statistics')
  const dash = t('dash')
  const rows = useMemo(() => storeRows(stores, track), [stores, track])
  const maxima = useMemo(() => columnMaxima(rows), [rows])
  const columns = useMemo(() => storeColumns(t, track, courier, dash, maxima), [t, track, courier, dash, maxima])
  const opening = defaultSort(track, courier).figure
  const fits = rows.length <= FIT_ROWS

  return (
    <section className="flex flex-col gap-2" data-statistics-band="stores">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('band.stores')}</h2>
        <div role="group" aria-label={t('table.track.label')} className="inline-flex items-center gap-1" data-statistics-track-switch="">
          {views.map((view) => (
            <Chip key={view} on={track === view} onClick={() => onTrack(view)} data-statistics-track={view}>
              {t(TRACK_CAPTION[view])}
            </Chip>
          ))}
        </div>
      </div>
      <div className={fits ? undefined : 'h-[30rem]'} data-statistics-stores={track}>
        <AgGridReact<StoreRow>
          // A view is its own column set: a fresh grid per view (and per opening sort, 816) starts on that ranking.
          key={`${track}:${opening}`}
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={({ data }) => data.storeCode}
          domLayout={fits ? 'autoHeight' : 'normal'}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          // Up to fifteen columns: render every one, so a cell off to the side is in the DOM for
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
