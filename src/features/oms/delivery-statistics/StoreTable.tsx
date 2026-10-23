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
import { PILL, PILL_GROUP, PILL_OFF, PILL_ON } from './controls'
import { readAverage, readFigure } from './figures'
import { compareFigures } from '@/core/util/compare-figures'
import {
  FLOW_FIGURES,
  HAND_OVER_FIGURE,
  storeRows,
  TABLE_TRACKS,
  TRACK_FIGURES,
  type StoreFigure,
  type StoreRow,
  type TableTrack,
} from './store-rows'

const DEFAULT_COL_DEF: ColDef<StoreRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
  // Up to fifteen columns share the width: a long caption wraps rather than reading "…ded over".
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

/** Each view's average header: the store-wide Avg hand-over, or the lane's own average (as its tile reads). */
const AVERAGE_HEADER: Record<TableTrack, string> = { all: 'table.avgHandOver', delivery: 'table.avgToDeliver', pickUp: 'table.avgToReady' }

/** A figure's header in a view: the band's own caption, so the table and the tiles name a figure alike. */
function header(t: TFunction, track: TableTrack, key: StoreFigure): string {
  if (key === 'trips') return t('table.trips')
  if (key === 'avgHandOverMinutes') return t(AVERAGE_HEADER[track])
  if (key === 'unspecified') return t('unspecified.caption')
  // In All, the halves of Handed over name their delivery type, so neither reads as a stage after Out
  // for delivery; in a track's view each is that lane's last stage, captioned as the lane captions it.
  if ((key === 'delivered' || key === 'pickedUp') && track === 'all') return t(`table.${key}`)
  return t((FLOW_FIGURES as readonly string[]).includes(key) ? `flow.${key}` : `misses.${key}`)
}

/**
 * The store column, then one column per figure of the view (`TRACK_FIGURES`). Every figure sorts as a
 * number with an absent one LAST either way (`compareFigures`), and shows the dash for it through its
 * `valueFormatter` — the base cell renders that formatted value, isolated. The view's hand-over column,
 * descending, is its default ranking.
 */
function storeColumns(t: TFunction, track: TableTrack, dash: string): ColDef<StoreRow>[] {
  const figure = (key: StoreFigure): ColDef<StoreRow> => ({
    field: key,
    headerName: header(t, track, key),
    minWidth: 88,
    flex: 1,
    type: 'numericColumn',
    cellClass: 'text-end tabular-nums',
    valueFormatter: ({ value }: ValueFormatterParams<StoreRow, number | null | undefined>) =>
      key === 'avgHandOverMinutes' ? readAverage(value, dash) : readFigure(value, dash),
    // `?? null`: a row is Partial by type, and an undefined cell must sort as absent, not as NaN.
    comparator: (a: number | null | undefined, b: number | null | undefined, _na, _nb, isDescending) =>
      compareFigures(a ?? null, b ?? null, isDescending),
    // `initialSort`, not `sort`: a rebuilt column set must not re-impose it over the user's pick.
    ...(key === HAND_OVER_FIGURE[track] ? { initialSort: 'desc' as const } : {}),
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
  onTrack,
}: {
  stores: readonly DeliveryStatisticsStore[]
  track: TableTrack
  onTrack: (track: TableTrack) => void
}) {
  const { t } = useTranslation('delivery-statistics')
  const dash = t('dash')
  const rows = useMemo(() => storeRows(stores, track), [stores, track])
  const columns = useMemo(() => storeColumns(t, track, dash), [t, track, dash])
  const fits = rows.length <= FIT_ROWS

  return (
    <section className="flex flex-col gap-2" data-statistics-band="stores">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('band.stores')}</h2>
        <div role="group" aria-label={t('table.track.label')} className={PILL_GROUP} data-statistics-track-switch="">
          {TABLE_TRACKS.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={track === view}
              onClick={() => onTrack(view)}
              className={`${PILL} ${track === view ? PILL_ON : PILL_OFF}`}
              data-statistics-track={view}
            >
              {t(TRACK_CAPTION[view])}
            </button>
          ))}
        </div>
      </div>
      <div className={fits ? undefined : 'h-[30rem]'} data-statistics-stores={track}>
        <AgGridReact<StoreRow>
          // A view is its own column set: a fresh grid per view starts on that view's hand-over ranking.
          key={track}
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
