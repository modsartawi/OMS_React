import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { RefreshCw, RotateCcw } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorMessage } from '@/core/api'
import { formatCount } from '@/core/util/bidi'
import { fromListState } from '@/core/oms/open-intent'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenFailedTransfers, omsGrants } from '@/core/oms/access'
import { failedDonorTransfersApi } from './api'
import { failedLine, type FailedLine } from './failed-line'
import { EMPTY_FILTER, isFiltering, isReversed, keepsLine, type LineFilter } from './filter'
import { lineColumns } from './columns'

/**
 * Failed donor transfers (ticket 434, spec 430 D5/D12): HQ inventory's work queue on the web — the
 * DRTR jobs that failed or are still retrying, and the cancelled requests whose transfer posted all
 * the same. Each line says what it asks of HQ; its request opens on Donor requests, its delivery in
 * Document Details. It loads on open (D16) and the filters narrow the loaded lines.
 *
 * Behind `canOpenFailedTransfers` on the ONE shared OMS probe, the same predicate the menu leaf
 * reads. The re-run (`canReRunFailedTransfer`) is computed per line here and drawn by 435.
 * 🚩 Its door (`SdDocumentWeb/FailedDonorTransfers`, BackOffice ask BO-4) is not built yet.
 */
export default function FailedDonorTransfersPage() {
  const { t } = useTranslation('failed-donor-transfers')
  return (
    <ScreenGate query={omsAccessQuery()} can={canOpenFailedTransfers} ns="failed-donor-transfers" title={t('title')} subtitle={t('subtitle')}>
      <FailedTransferQueue />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef<FailedLine> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** A count, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function FailedTransferQueue() {
  const { t } = useTranslation('failed-donor-transfers')
  const navigate = useNavigate()
  const [filter, setFilter] = useState<LineFilter>(EMPTY_FILTER)

  // The gate above has already read this entry; it is the same cache entry, not a second call.
  const access = useQuery(omsAccessQuery())
  const canReRun = omsGrants(access.data).canReRunFailedTransfer
  const list = useQuery({
    queryKey: ['failed-donor-transfers', 'list'],
    queryFn: () => failedDonorTransfersApi.list(),
    retry: false,
  })

  const openRequest = useCallback(
    (requestNo: string) => void navigate(`/oms/donor-requests?request=${encodeURIComponent(requestNo)}`),
    [navigate],
  )
  const openDelivery = useCallback(
    (deliveryNo: string) => void navigate(`/oms/delivery/${encodeURIComponent(deliveryNo)}`, { state: fromListState() }),
    [navigate],
  )
  const columns = useMemo(() => lineColumns(t, { openRequest, openDelivery }), [t, openRequest, openDelivery])

  // A failed reload keeps the last good list under its banner; only a first load that failed is empty.
  const lines = useMemo(() => (list.data ?? []).map((r) => failedLine(r, canReRun)), [list.data, canReRun])
  const shown = useMemo(() => lines.filter((l) => keepsLine(l, filter)), [lines, filter])

  const patch = (p: Partial<LineFilter>) => setFilter((f) => ({ ...f, ...p }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3" data-line-filters="">
        <label className={FIELD}>
          {t('filters.donorStore')}
          <input
            type="text"
            value={filter.donorStore}
            onChange={(e) => patch({ donorStore: e.target.value })}
            placeholder={t('filters.anyStore')}
            className={`${INPUT} w-28`}
            data-line-filter="donorStore"
          />
        </label>
        <label className={FIELD}>
          {t('filters.orderStore')}
          <input
            type="text"
            value={filter.orderStore}
            onChange={(e) => patch({ orderStore: e.target.value })}
            placeholder={t('filters.anyStore')}
            className={`${INPUT} w-28`}
            data-line-filter="orderStore"
          />
        </label>
        <label className={FIELD}>
          {t('filters.from')}
          <input type="date" value={filter.from} onChange={(e) => patch({ from: e.target.value })} className={`${INPUT} w-40`} data-line-filter="from" />
        </label>
        <label className={FIELD}>
          {t('filters.to')}
          <input type="date" value={filter.to} onChange={(e) => patch({ to: e.target.value })} className={`${INPUT} w-40`} data-line-filter="to" />
        </label>
        <div className="flex items-center gap-2">
          <Button variant="outlined" disabled={!isFiltering(filter)} onClick={() => setFilter(EMPTY_FILTER)} data-line-clear="">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </Button>
          <Button onClick={() => void list.refetch()} disabled={list.isFetching} data-line-reload="">
            <RefreshCw className={`h-3.5 w-3.5 ${list.isFetching ? 'animate-spin' : ''}`} aria-hidden />
            {t('reload')}
          </Button>
        </div>
        <p className="basis-full text-[11.5px] text-muted-foreground">{t('filters.hint')}</p>
        {isReversed(filter) && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-line-problem="reversed">
            {t('filters.reversed')}
          </p>
        )}
      </div>

      {list.isError && (
        <ErrorBanner
          className="p-2.5"
          title={list.data ? t('list.reloadFailedTitle') : t('list.failedTitle')}
          message={apiErrorMessage(list.error, t('list.failed'))}
        />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-20rem)] min-h-96" data-line-list="">
          <AgGridReact<FailedLine>
            theme={omsGridTheme}
            rowData={shown}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Thirteen columns: render every one, so a cell off to the side is in the DOM for
            // find-in-page and for the drive.
            suppressColumnVirtualisation
            loading={list.isFetching && !list.data}
            // The empty state is drawn below, not by AG Grid: its overlay keeps the params it was
            // shown with, so "no line matches" would outlive the filters that caused it.
            suppressNoRowsOverlay
          />
          {/* A first load that failed is the banner's to say: "the queue is clear" would contradict it. */}
          {list.data && shown.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-8" data-line-empty="">
              <span className="text-sm text-muted-foreground">{lines.length > 0 ? t('list.noneMatch') : t('list.empty')}</span>
            </div>
          )}
        </div>
        {list.data && <StatusBar shown={shown.length} total={lines.length} filtering={isFiltering(filter)} loading={list.isFetching} />}
      </div>
    </div>
  )
}

/** The count under the grid, and how many the filters hide when they hide any. */
function StatusBar({ shown, total, filtering, loading }: { shown: number; total: number; filtering: boolean; loading: boolean }) {
  const { t } = useTranslation('failed-donor-transfers')
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
      data-status-bar=""
    >
      {loading ? (
        <span>{t('statusBar.loading')}</span>
      ) : (
        <span data-status-count="">
          {filtering ? (
            <Trans
              t={t}
              i18nKey="statusBar.filtered"
              count={total}
              values={{ n: formatCount(figure(shown), figure(total)) }}
              components={{ n: <Ltr /> }}
            />
          ) : (
            <Trans t={t} i18nKey="statusBar.lines" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
          )}
        </span>
      )}
    </div>
  )
}
