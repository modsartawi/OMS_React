import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
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
import { STORES_KEY, storesApi } from './api'
import { storeColumns } from './columns'
import { MoveDialog, OnboardDialog, RemoveDialog } from './StoreDialogs'
import { LINKED_FILTERS, accountChoices, onboardWarning, optionalColumns, storesFromParams, storesToParams } from './store-state'

/**
 * Deliverect stores (ticket 477, BackOffice spec 2615): every store onboarded on a Deliverect
 * account, whether Deliverect has linked it yet, and the three writes — onboard, move, remove —
 * each with a reason.
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

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

const LINKED_KEY: Record<DeliverectLinkedFilter, string> = { any: 'filters.linkedAny', yes: 'filters.linkedYes', no: 'filters.linkedNo' }

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

type Dialog = { kind: 'onboard' } | { kind: 'move'; row: Row } | { kind: 'remove'; row: Row } | null

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

  const shown = optionalColumns(rows)
  const columns = useMemo(
    () =>
      storeColumns(t, shown, {
        onMove: (row) => setDialog({ kind: 'move', row }),
        onRemove: (row) => setDialog({ kind: 'remove', row }),
      }),
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
        <label className={FIELD}>
          {t('filters.account')}
          <select
            value={query.account ?? ''}
            onChange={(e) => update({ account: e.target.value || null })}
            className={INPUT}
            data-filter-account=""
          >
            <option value="">{t('filters.anyAccount')}</option>
            {filterAccounts.map((k) => (
              <option key={k} value={k}>
                {fsi(k)}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {t('filters.linked')}
          <select
            value={query.linked}
            onChange={(e) => update({ linked: e.target.value as DeliverectLinkedFilter })}
            className={INPUT}
            data-filter-linked=""
          >
            {LINKED_FILTERS.map((l) => (
              <option key={l} value={l}>
                {t(LINKED_KEY[l])}
              </option>
            ))}
          </select>
        </label>
        <label className={`${FIELD} min-w-[16rem] flex-1`}>
          {t('filters.q')}
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('filters.qPlaceholder')}
            className={INPUT}
            data-filter-q=""
          />
        </label>
        <Button type="submit" className="h-9" disabled={stores.isFetching} data-stores-search="">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('filters.search')}
        </Button>
        <Button
          variant="outlined"
          className="h-9"
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
            theme={omsGridTheme}
            rowData={stores.isError ? [] : rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.storeCode}
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
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('deliverect-stores')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
