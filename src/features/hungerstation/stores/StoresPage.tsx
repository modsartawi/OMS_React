import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, RowClassRules } from 'ag-grid-community'
import { Plus, RotateCcw, Search, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { hungerStationAccessQuery, hungerStationChainsQuery } from '@/core/hungerstation/api'
import { canManageStores } from '@/core/hungerstation/access'
import type {
  HungerStationHealthFilter,
  HungerStationStoreRow,
  HungerStationStoresQuery,
  HungerStationSyncFilter,
  HungerStationSyncLogRow,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { STORES_KEY, storesApi } from './api'
import { storeColumns } from './columns'
import { EditDialog, OnboardDialog, RemoveDialog, SyncActiveDialog, SyncNowDialog } from './StoreDialogs'
import { syncNowResult } from './sync'
import { HEALTH_FILTERS, SYNC_FILTERS, chainChoices, healthLabel, storesFromParams, storesToParams } from './store-state'

/**
 * HungerStation stores (ticket 551, BackOffice spec 3028): every store onboarded on the DIRECT
 * HungerStation rail, its chain and vendor id, who onboarded and last changed it, and its stock
 * sync — active or paused, the last full and delta runs, the newest push in 24 h, and its health
 * (failing red, silent amber). Onboard, edit and remove (552; onboarding the code again revives
 * it), pause / resume and sync now (553), each with a reason. 554 adds the logs drawer.
 *
 * Behind `canManageStores` on the ONE HungerStation probe, the same predicate the menu leaf reads.
 * Its doors are BackOffice 3030.
 */
export default function StoresPage() {
  const { t } = useTranslation('hungerstation-stores')
  return (
    <ScreenGate query={hungerStationAccessQuery()} can={canManageStores} ns="hungerstation-stores" title={t('title')} subtitle={t('subtitle')}>
      <Stores />
    </ScreenGate>
  )
}

type Row = HungerStationStoreRow

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

const SYNC_KEY: Record<HungerStationSyncFilter, string> = { any: 'filters.syncAny', active: 'filters.syncActive', paused: 'filters.syncPaused' }
const HEALTH_KEY: Record<HungerStationHealthFilter, string> = {
  any: 'filters.healthAny',
  ok: 'filters.healthOk',
  failing: 'filters.healthFailing',
  silent: 'filters.healthSilent',
}

/** A failing store's row is red and a silent store's amber (spec 1872). */
const ROW_FAILING = '[--ag-data-background-color:var(--danger-050)]'
const ROW_SILENT = '[--ag-data-background-color:var(--attention-050)]'

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

type Dialog =
  | { kind: 'onboard' }
  | { kind: 'edit'; row: Row }
  | { kind: 'remove'; row: Row }
  | { kind: 'syncActive'; row: Row }
  | { kind: 'syncNow'; row: Row }
  | null

function Stores() {
  const { t } = useTranslation('hungerstation-stores')
  const [params, setParams] = useSearchParams()
  // 🔑 The URL is the query: read from it every render, every change written back (replace, so
  // Back leaves the screen rather than stepping through each filter tweak).
  const query = useMemo(() => storesFromParams(params), [params])
  const [draft, setDraft] = useState(query.q ?? '')
  useEffect(() => setDraft(query.q ?? ''), [query.q])
  // A filter change takes the text box as it reads, so a typed but unsubmitted search is never
  // left showing over a list that ignored it.
  const update = (change: Partial<HungerStationStoresQuery>) =>
    setParams(storesToParams({ ...query, q: draft.trim() || null, ...change }), { replace: true })

  const stores = useQuery({
    queryKey: [...STORES_KEY, storesToParams(query).toString()],
    queryFn: () => storesApi.list(query),
    retry: false,
  })
  const rows = useMemo(() => stores.data ?? [], [stores.data])

  // The chain filter offers the `Chains` read; if it fails, the chains seen on the rows so far,
  // remembered across filters so filtering by one chain never shrinks the choice to that chain.
  const chains = useQuery(hungerStationChainsQuery())
  const [seen, setSeen] = useState<string[]>([])
  useEffect(() => {
    setSeen((prev) => {
      const next = chainChoices(undefined, [...prev, ...rows.map((r) => r.chainKey)])
      return next.length === prev.length ? prev : next
    })
  }, [rows])
  const filterChains = chainChoices(chains.isSuccess ? chains.data : undefined, seen, [query.chain])

  const [dialog, setDialog] = useState<Dialog>(null)
  // The last sync now's answer, shown above the grid until dismissed (553).
  const [pushed, setPushed] = useState<{ storeCode: string; log: HungerStationSyncLogRow } | null>(null)

  const rowClassRules = useMemo<RowClassRules<Row>>(
    () => ({
      // The row's ground is painted from `--ag-data-background-color` (global.css), so a highlight
      // sets that variable — a plain `bg-*` on the row would sit under it, unseen.
      [ROW_FAILING]: ({ data }) => !!data && healthLabel(data.sync).highlight === 'bad',
      [ROW_SILENT]: ({ data }) => !!data && healthLabel(data.sync).highlight === 'warn',
    }),
    [],
  )

  const columns = useMemo(
    () =>
      storeColumns(t, {
        onEdit: (row) => setDialog({ kind: 'edit', row }),
        onRemove: (row) => setDialog({ kind: 'remove', row }),
        onToggleSync: (row) => setDialog({ kind: 'syncActive', row }),
        onSyncNow: (row) => setDialog({ kind: 'syncNow', row }),
      }),
    [t],
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
          {t('filters.chain')}
          <select value={query.chain ?? ''} onChange={(e) => update({ chain: e.target.value || null })} className={INPUT} data-filter-chain="">
            <option value="">{t('filters.anyChain')}</option>
            {filterChains.map((k) => (
              <option key={k} value={k}>
                {fsi(k)}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {t('filters.sync')}
          <select
            value={query.sync}
            onChange={(e) => update({ sync: e.target.value as HungerStationSyncFilter })}
            className={INPUT}
            data-filter-sync=""
          >
            {SYNC_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(SYNC_KEY[s])}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {t('filters.health')}
          <select
            value={query.health}
            onChange={(e) => update({ health: e.target.value as HungerStationHealthFilter })}
            className={INPUT}
            data-filter-health=""
          >
            {HEALTH_FILTERS.map((h) => (
              <option key={h} value={h}>
                {t(HEALTH_KEY[h])}
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

      {pushed && <PushResult storeCode={pushed.storeCode} log={pushed.log} onDismiss={() => setPushed(null)} />}

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
            rowClassRules={rowClassRules}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Sixteen columns: render every one, so a cell off to the side is in the DOM for
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

      {dialog?.kind === 'onboard' && <OnboardDialog rowKeys={seen} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && (
        <EditDialog row={dialog.row} rowKeys={seen} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
      {dialog?.kind === 'remove' && <RemoveDialog row={dialog.row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog?.kind === 'syncActive' && <SyncActiveDialog row={dialog.row} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog?.kind === 'syncNow' && (
        <SyncNowDialog
          row={dialog.row}
          onClose={() => setDialog(null)}
          onDone={(log) => {
            setPushed({ storeCode: dialog.row.storeCode, log })
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

/** A sync now's result: the store, the materials sent and the push's status (553). */
function PushResult({ storeCode, log, onDismiss }: { storeCode: string; log: HungerStationSyncLogRow; onDismiss: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const line = syncNowResult(log)
  const ok = line.status === 'S'
  return (
    <div
      role="status"
      className={
        'flex items-center gap-3 rounded-md border px-3 py-2 text-xs ' +
        (ok ? 'border-border bg-card-2 text-foreground' : 'border-danger-border bg-danger-050 text-danger-800')
      }
      data-sync-now-result={storeCode}
      data-status={line.status}
    >
      <span className="font-semibold">
        <Trans t={t} i18nKey="syncNow.resultTitle" values={{ store: storeCode }} components={{ store: <Ltr /> }} />
      </span>
      <span data-sync-now-result-line="">
        <Trans t={t} i18nKey={line.key} values={{ rows: line.rows }} components={{ n: <Ltr /> }} />
      </span>
      <Button variant="text" className="ms-auto" onClick={onDismiss} aria-label={t('syncNow.dismiss')} data-sync-now-dismiss="">
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('hungerstation-stores')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
