import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { BookmarkMinus, BookmarkPlus, History, PackageSearch, ScrollText } from 'lucide-react'
import type { HybrisStockStoreHealth, HybrisStockStoreRow } from '@/core/models/hybris-stock'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { storeHealth } from './health'

type Row = HybrisStockStoreRow

/** What a row's actions do — each opens its dialog or drawer (the page holds them). */
export interface StoreActions {
  /** `null` when the user may only view: Mark / Unmark is not drawn at all. */
  onMark: ((row: Row) => void) | null
  onHistory: (row: Row) => void
  /** The store's pushes in the push log (849). */
  onPushes: (row: Row) => void
  /** A material's history at the store, in the push log (849). */
  onMaterial: (row: Row) => void
}

/** `null` renders blank — an unmarked store has no health block. */
const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/** A health field, `null` on an unmarked store. */
const healthField =
  (field: keyof Pick<HybrisStockStoreHealth, 'lastDeltaAt' | 'lastFullAt' | 'nextFullDue'>) =>
  ({ data }: ValueGetterParams<Row>) =>
    (data?.marked ? data.health?.[field] : null) ?? null

/**
 * The Hybris stock stores grid (ticket 847): every store — its code and name, whether it is a
 * Hybris stock store, and for a marked one its health (`storeHealth`: unhealthy red, a failed last
 * push amber, the row highlighted the same way by the page), last delta, last full, next full due and
 * the last error — then who last marked or unmarked it, and the row's actions.
 *
 * Every plain cell is isolated by the core grid base; a column with its own renderer isolates its own
 * whole value.
 */
export function storeColumns(t: TFunction, act: StoreActions): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'storeCode', headerName: t('columns.store'), width: 100, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'storeName', headerName: t('columns.name'), width: 220, tooltipField: 'storeName' },
    {
      colId: 'marked',
      headerName: t('columns.marked'),
      width: 130,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(data.marked ? 'marked.yes' : 'marked.no') : ''),
      cellRenderer: ({ data, value }: ICellRendererParams<Row>) =>
        data ? (
          <span data-marked={String(data.marked)}>
            <StatusBadge sev={data.marked ? 'go' : 'mute'}>{value}</StatusBadge>
          </span>
        ) : null,
    },
    {
      colId: 'health',
      headerName: t('columns.health'),
      width: 170,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(`health.${storeHealth(data).reading}`) : ''),
      cellRenderer: ({ data, value }: ICellRendererParams<Row>) => {
        if (!data) return null
        const view = storeHealth(data)
        const hint = view.causes.map((c) => t(`health.cause.${c}`)).join(' ')
        return (
          <span data-health={view.reading} data-causes={view.causes.join(' ')} title={hint || undefined}>
            <StatusBadge sev={view.sev}>{value}</StatusBadge>
          </span>
        )
      },
    },
    {
      colId: 'causes',
      headerName: t('columns.causes'),
      width: 200,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? storeHealth(data).causes.map((c) => t(`health.causeShort.${c}`)).join(', ') : ''),
    },
    { colId: 'lastDeltaAt', headerName: t('columns.lastDelta'), width: 150, valueGetter: healthField('lastDeltaAt'), valueFormatter: time, cellRenderer: LtrCell },
    { colId: 'lastFullAt', headerName: t('columns.lastFull'), width: 150, valueGetter: healthField('lastFullAt'), valueFormatter: time, cellRenderer: LtrCell },
    { colId: 'nextFullDue', headerName: t('columns.nextFull'), width: 150, valueGetter: healthField('nextFullDue'), valueFormatter: time, cellRenderer: LtrCell },
    {
      colId: 'lastError',
      headerName: t('columns.lastError'),
      width: 260,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data?.marked ? (data.health?.lastError ?? null) : null),
      tooltipValueGetter: ({ data }) => (data?.marked ? (data.health?.lastError ?? null) : null),
    },
    { field: 'changedAt', headerName: t('columns.changedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'changedBy', headerName: t('columns.changedBy'), width: 120, cellClass: code, cellRenderer: LtrCell },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 480,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            {act.onMark && (
              <Button
                variant={data.marked ? 'danger-outlined' : 'ghost'}
                onClick={() => act.onMark?.(data)}
                data-store-mark={data.storeCode}
                data-to={data.marked ? 'unmark' : 'mark'}
              >
                {data.marked ? <BookmarkMinus className="h-3.5 w-3.5" aria-hidden /> : <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />}
                {t(data.marked ? 'unmark.button' : 'mark.button')}
              </Button>
            )}
            <Button variant="ghost" onClick={() => act.onHistory(data)} data-store-history={data.storeCode}>
              <History className="h-3.5 w-3.5" aria-hidden />
              {t('history.button')}
            </Button>
            <Button variant="ghost" onClick={() => act.onPushes(data)} data-store-pushes={data.storeCode}>
              <ScrollText className="h-3.5 w-3.5" aria-hidden />
              {t('pushes.button')}
            </Button>
            <Button variant="ghost" onClick={() => act.onMaterial(data)} data-store-material={data.storeCode}>
              <PackageSearch className="h-3.5 w-3.5" aria-hidden />
              {t('pushes.material')}
            </Button>
          </span>
        ) : null,
    },
  ]
}
