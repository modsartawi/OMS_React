import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, IRowNode, RowClassRules } from 'ag-grid-community'
import { AlertTriangle, Plus, RotateCcw, Search, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { deliverectAccessQuery, deliverectAccountsQuery } from '@/core/deliverect/api'
import { canManageStores } from '@/core/deliverect/access'
import type { DeliverectLinkedFilter, DeliverectStoreRow, DeliverectStoresQuery } from '@/core/models/deliverect'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { STORES_KEY, storesApi } from './api'
import { storeColumns } from './columns'
import { MoveDialog, OnboardDialog, RemoveDialog, SyncActiveDialog } from './StoreDialogs'
import { LINKED_FILTERS, accountChoices, onboardWarning, optionalColumns, storesFromParams, storesToParams } from './store-state'
import { syncHealth, syncHighlight } from './sync-health'
import SyncLogsDrawer from './SyncLogsDrawer'
import MaterialHistoryDrawer from './MaterialHistoryDrawer'
import { PushHoursDialog, StatusActionDialog } from './StatusDialogs'
import StatusHistoryDrawer from './StatusHistoryDrawer'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

/**
 * Deliverect stores (ticket 477, BackOffice spec 2615): every store onboarded on a Deliverect
 * account, whether Deliverect has linked it yet, and the three writes — onboard, move, remove —
 * each with a reason. Ticket 480 adds each store's stock sync: its columns, a failing or overdue
 * row highlighted, pause / resume with a reason, and the logs drawer. Ticket 481 adds each store's
 * status: open / busy / closed with since and reason, busy / close / reopen with a reason, push
 * hours now (the week that was sent), and the status history drawer.
 *
 * Behind `canManageStores` on the ONE Deliverect probe, the same predicate the menu leaf reads.
 * Its doors are BackOffice 2616 (sync fields 2624, status fields 2625).
 */
export default function StoresPage() {
  const { t } = useTranslation('deliverect-stores')
  return (
    <ScreenGate query={deliverectAccessQuery()} can={canManageStores} ns="deliverect-stores" title={t('title')} subtitle={t('subtitle')}>
      <Stores />
    </ScreenGate>
  )
}

type Row = DeliverectStoreRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}


const LINKED_KEY: Record<DeliverectLinkedFilter, string> = { any: 'filters.linkedAny', yes: 'filters.linkedYes', no: 'filters.linkedNo' }

type Dialog =
  | { kind: 'onboard' }
  | { kind: 'move'; row: Row }
  | { kind: 'remove'; row: Row }
  | { kind: 'syncActive'; row: Row }
  | { kind: 'logs'; row: Row }
  | { kind: 'material'; row: Row }
  | { kind: 'status'; row: Row }
  | { kind: 'hours'; row: Row }
  | { kind: 'history'; row: Row }
  | null

/** A failed store's row is red and an overdue store's amber (ticket 480; HungerStation spec 1872). */
const ROW_FAILED = '[--ag-data-background-color:var(--danger-050)]'
const ROW_OVERDUE = '[--ag-data-background-color:var(--attention-050)]'

/** A row's highlight at a moment — `null` when it has none (no sync block, ok, paused, not run). */
function highlightAt(row: Row, at: Date) {
  const reading = syncHealth(row, at)
  return reading ? syncHighlight(reading.health) : null
}

/** How often the page re-reads the clock, so a store turns overdue while the screen is open. */
const CLOCK_TICK_MS = 60_000

function Stores() {
  const { t } = useTranslation('deliverect-stores')
  const [params, setParams] = useSearchParams()
  // 🔑 The URL is the query: read from it every render, every change written back (replace, so
  // Back leaves the screen rather than stepping through each filter tweak).
  const query = useMemo(() => storesFromParams(params), [params])
  const [draft, setDraft] = useState(query.q ?? '')
  useEffect(() => setDraft(query.q ?? ''), [query.q])
  // A filter change takes the text box as it reads, so a typed but unsubmitted store is never
  // left showing over a list that ignored it.
  const update = (change: Partial<DeliverectStoresQuery>) =>
    setParams(storesToParams({ ...query, q: draft.trim() || null, ...change }), { replace: true })

  const stores = useQuery({
    queryKey: [...STORES_KEY, storesToParams(query).toString()],
    queryFn: () => storesApi.list(query),
    retry: false,
  })
  const rows = useMemo(() => stores.data ?? [], [stores.data])

  // The account list rides `canManageTerms` (contract gap, HITL-477): without it, the filter and the
  // write dialogs offer the accounts seen on the rows, remembered across filters so that filtering
  // by one account never shrinks the choice to that account.
  const accounts = useQuery(deliverectAccountsQuery())
  const [seen, setSeen] = useState<string[]>([])
  useEffect(() => {
    setSeen((prev) => {
      const next = accountChoices(undefined, [...prev, ...rows.map((r) => r.accountKey)])
      return next.length === prev.length ? prev : next
    })
  }, [rows])
  const filterAccounts = accountChoices(accounts.isSuccess ? accounts.data : undefined, seen, [query.account])

  const [dialog, setDialog] = useState<Dialog>(null)
  const [warning, setWarning] = useState<{ storeCode: string; message: string | null } | null>(null)

  /** A move or remove landed: close it, and drop a warning about the store it changed. */
  const written = (row: Row) => {
    setDialog(null)
    setWarning((w) => (w?.storeCode === row.storeCode ? null : w))
  }

  // The sync health is read against the clock (`syncHealth`): the cells and the row highlight read
  // it through a ref, and each tick refreshes them, so an overdue store shows without a refetch.
  const grid = useRef<GridApi<Row> | null>(null)
  const now = useRef(new Date())
  useEffect(() => {
    const id = window.setInterval(() => {
      const api = grid.current
      const before = now.current
      now.current = new Date()
      if (!api) return
      // The health cells re-read the clock. Row classes are only re-applied on a redraw, so the
      // rows whose highlight changed with the clock — and only those — are redrawn.
      const changed: IRowNode<Row>[] = []
      api.forEachNode((node) => {
        if (node.data && highlightAt(node.data, before) !== highlightAt(node.data, now.current)) changed.push(node)
      })
      api.refreshCells({ columns: ['syncHealth'], force: true })
      if (changed.length) api.redrawRows({ rowNodes: changed })
    }, CLOCK_TICK_MS)
    return () => window.clearInterval(id)
  }, [])
  const rowClassRules = useMemo<RowClassRules<Row>>(() => {
    const highlight = (data: Row | undefined) => (data ? highlightAt(data, now.current) : null)
    // The row's ground is painted by its `::after` from `--ag-data-background-color` (global.css,
    // the selected-row note), so a highlight sets that variable on the row — a plain `bg-*` on the
    // row would sit under it, unseen.
    return {
      [ROW_FAILED]: ({ data }) => highlight(data) === 'bad',
      [ROW_OVERDUE]: ({ data }) => highlight(data) === 'warn',
    }
  }, [])

  const shown = optionalColumns(rows)
  const columns = useMemo(
    () =>
      storeColumns(
        t,
        shown,
        {
          onMove: (row) => setDialog({ kind: 'move', row }),
          onRemove: (row) => setDialog({ kind: 'remove', row }),
          onSyncActive: (row) => setDialog({ kind: 'syncActive', row }),
          onLogs: (row) => setDialog({ kind: 'logs', row }),
          onMaterial: (row) => setDialog({ kind: 'material', row }),
          onStatus: (row) => setDialog({ kind: 'status', row }),
          onHours: (row) => setDialog({ kind: 'hours', row }),
          onHistory: (row) => setDialog({ kind: 'history', row }),
        },
        () => now.current,
      ),
    // `shown` is two booleans: listed one by one so the columns rebuild only when one flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, shown.sync, shown.status],
  )

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const q = draft.trim()
          if ((q || null) === query.q) void stores.refetch()
          else update({})
        }}
        data-stores-filters=""
      >
        <Field label={t('filters.account')}>
          <Select
            value={query.account ?? ''}
            onChange={(e) => update({ account: e.target.value || null })}
            data-filter-account=""
          >
            <option value="">{t('filters.anyAccount')}</option>
            {filterAccounts.map((k) => (
              <option key={k} value={k}>
                {fsi(k)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.linked')}>
          <Select
            value={query.linked}
            onChange={(e) => update({ linked: e.target.value as DeliverectLinkedFilter })}
            data-filter-linked=""
          >
            {LINKED_FILTERS.map((l) => (
              <option key={l} value={l}>
                {t(LINKED_KEY[l])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.q')} className="min-w-[16rem] flex-1">
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('filters.qPlaceholder')}
            data-filter-q=""
          />
        </Field>
        <Button type="submit" disabled={stores.isFetching} data-stores-search="">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('filters.search')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setDraft('')
            setParams(new URLSearchParams(), { replace: true })
          }}
          data-stores-clear=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.clear')}
        </Button>
        <Button className="ms-auto h-9" onClick={() => setDialog({ kind: 'onboard' })} data-stores-onboard="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('onboard.button')}
        </Button>
      </form>

      {/* The direct-HungerStation answer: a WARNING — the store is onboarded, nothing failed. */}
      {warning && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-[0.8125rem] text-attention-800"
          data-onboard-warning={warning.storeCode}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">
              <Trans t={t} i18nKey="onboard.warningTitle" values={{ store: warning.storeCode }} components={{ store: <Ltr /> }} />
            </p>
            <p data-onboard-warning-message="">
              {warning.message ? <bdi>{warning.message}</bdi> : t('onboard.warningHint')}
            </p>
          </div>
          <Button variant="ghost" onClick={() => setWarning(null)} aria-label={t('onboard.dismiss')} data-onboard-warning-dismiss="">
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      )}

      {stores.isError && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(stores.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-22rem)] min-h-96" data-stores-grid="">
          <AgGridReact<Row>
            onGridReady={({ api }) => (grid.current = api)}
            theme={omsGridTheme}
            rowData={stores.isError ? [] : rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.storeCode}
            rowClassRules={rowClassRules}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // A dozen columns: render every one, so a cell off to the side is in the DOM for
            // find-in-page and for the drive.
            suppressColumnVirtualisation
            loading={stores.isFetching && !stores.data}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={stores.isError}
          />
        </div>
        {!stores.isError && (
          <div
            className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-status-bar=""
          >
            {stores.isFetching && !stores.data ? (
              <span>{t('results.loading')}</span>
            ) : (
              <span data-status-count="">
                <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
              </span>
            )}
          </div>
        )}
      </div>

      {dialog?.kind === 'onboard' && (
        <OnboardDialog
          rowKeys={seen}
          onClose={() => setDialog(null)}
          onDone={(row, message) => {
            setDialog(null)
            setWarning(onboardWarning(row, message))
          }}
        />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog row={dialog.row} rowKeys={seen} onClose={() => setDialog(null)} onDone={() => written(dialog.row)} />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveDialog row={dialog.row} onClose={() => setDialog(null)} onDone={() => written(dialog.row)} />
      )}
      {dialog?.kind === 'syncActive' && (
        <SyncActiveDialog row={dialog.row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
      {dialog?.kind === 'logs' && <SyncLogsDrawer row={dialog.row} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'material' && <MaterialHistoryDrawer row={dialog.row} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'status' && (
        <StatusActionDialog row={dialog.row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
      {dialog?.kind === 'hours' && <PushHoursDialog row={dialog.row} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'history' && <StatusHistoryDrawer row={dialog.row} onClose={() => setDialog(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('deliverect-stores')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
