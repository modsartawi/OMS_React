import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { CellKeyDownEvent, ColDef, ICellRendererParams, RowClickedEvent } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import type { PromotionEngine, StoreEngineRow } from '@/core/models/rule-campaign'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { storeEnginesQuery } from './api'
import FlipDialog from './FlipDialog'
import HistoryPane from './HistoryPane'
import { ENGINES, engineOf, filterStores, flipTarget, switchQueryFromParams, switchQueryToParams } from './helpers'

/**
 * Admin ▸ Store engine switch (ticket 517, BackOffice spec 2737 / 2745, ADR 0093): every store with
 * the promotion engine it runs — `BonusBuy` or `Rule`, a store HQ holds no row for reading BonusBuy —
 * and its last flip. Flip asks a reason and takes effect at the store's next shift open; a flip back
 * to bonus buys first shows what is in flight, never blocking. A row opens the store's history.
 *
 * No access probe on the leaf yet (BackOffice 2745 seeds the Ua permission): the doors fail closed
 * on the server, and their refusal shows here through `apiErrorMessage`. Ticket 520 adds the probe.
 */
export default function EngineSwitchPage() {
  const { t } = useTranslation('engine-switch')
  const { query, update, changedFromOutside } = useUrlQuery(switchQueryFromParams, switchQueryToParams)
  // The search box is a draft beside the address, so typing never waits on a navigation; a change
  // from outside (Back, a pasted link) resets it.
  const [search, setSearch] = useState(query.search)
  useEffect(() => {
    if (changedFromOutside()) setSearch(query.search)
  }, [query.search, changedFromOutside])
  const stores = useQuery(storeEnginesQuery())
  const all = stores.data ?? NO_ROWS
  const rows = useMemo(() => filterStores(all, query), [all, query])
  const opened = all.find((r) => r.storeCode === query.store) ?? null

  const [flipping, setFlipping] = useState<StoreEngineRow | null>(null)
  const context = useMemo<GridContext>(() => ({ onFlip: setFlipping }), [])
  const columns = useMemo(() => engineColumns(t), [t])
  const openHistory = (e: RowClickedEvent<StoreEngineRow>) => {
    // The Flip button has its own job.
    if ((e.event?.target as Element | null)?.closest?.('button')) return
    if (e.data) update((q) => ({ ...q, store: e.data!.storeCode }))
  }
  // The keyboard's way in: Enter on a row's cell opens its history.
  const keyHistory = (e: CellKeyDownEvent<StoreEngineRow>) => {
    const key = (e.event as KeyboardEvent | null | undefined)?.key
    if (key === 'Enter' && e.data && e.column.getColId() !== 'flip') update((q) => ({ ...q, store: e.data!.storeCode }))
  }
  const ids = { search: useId(), engine: useId() }

  return (
    <section className="flex h-full w-full flex-col gap-4" data-engine-switch="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
        {/* The prototype's banner, without its example permission name (2745 seeds the real one). */}
        <p className="mt-2 rounded-md border border-border/60 bg-muted px-3 py-2 text-sm" data-engine-newpos="">
          {t('newPos')}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3" data-engine-filter="">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.search} className="text-xs font-medium text-muted-foreground">
            {t('filter.search')}
          </label>
          <input
            id={ids.search}
            type="search"
            className={`${RULE_INPUT} w-64`}
            value={search}
            onChange={(e) => {
              const value = e.target.value
              setSearch(value)
              update((q) => ({ ...q, search: value }))
            }}
            data-engine-field="search"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.engine} className="text-xs font-medium text-muted-foreground">
            {t('filter.engine')}
          </label>
          <select
            id={ids.engine}
            className={RULE_INPUT}
            value={query.engine ?? ''}
            onChange={(e) => update((q) => ({ ...q, engine: (e.target.value || null) as PromotionEngine | null }))}
            data-engine-field="engine"
          >
            <option value="">{t('filter.allEngines')}</option>
            {ENGINES.map((e) => (
              <option key={e} value={e}>
                {t(`engine.${e}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {stores.isError && <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(stores.error, t('results.failed'))} />}

      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="relative h-[calc(100vh-20rem)] min-h-96" data-engine-grid="">
            <AgGridReact<StoreEngineRow>
              theme={omsGridTheme}
              rowData={stores.isError ? [] : rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => data.storeCode}
              onRowClicked={openHistory}
              onCellKeyDown={keyHistory}
              context={context}
              rowClass="cursor-pointer"
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              loading={stores.isPending}
              noRowsOverlayComponent={NoRows}
              suppressNoRowsOverlay={stores.isError}
            />
          </div>
          {!stores.isError && (
            <div
              className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
              data-status-bar=""
            >
              {stores.isPending ? (
                <span>{t('results.loading')}</span>
              ) : (
                <span data-status-count="">
                  <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: rows.length }} components={{ n: <Ltr /> }} />
                </span>
              )}
            </div>
          )}
        </div>
        {opened && <HistoryPane key={opened.storeCode} row={opened} onClose={() => update((q) => ({ ...q, store: '' }))} />}
      </div>

      {flipping && (
        <FlipDialog
          row={flipping}
          target={flipTarget(engineOf(flipping))}
          onClose={() => setFlipping(null)}
          onFlipped={(row) => {
            setFlipping(null)
            update((q) => ({ ...q, store: row.storeCode }))
          }}
        />
      )}
    </section>
  )
}

const NO_ROWS: StoreEngineRow[] = []

interface GridContext {
  onFlip: (row: StoreEngineRow) => void
}

const DEFAULT_COL_DEF: ColDef<StoreEngineRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

function EngineCell({ data }: ICellRendererParams<StoreEngineRow>) {
  const { t } = useTranslation('engine-switch')
  if (!data) return null
  const engine = engineOf(data)
  return (
    <span data-engine={engine}>
      <StatusBadge sev={engine === 'Rule' ? 'ok' : 'mute'}>{t(`engine.${engine}`)}</StatusBadge>
    </span>
  )
}

function FlipCell({ data, context }: ICellRendererParams<StoreEngineRow, unknown, GridContext>) {
  const { t } = useTranslation('engine-switch')
  if (!data) return null
  const target = flipTarget(engineOf(data))
  return (
    <Button variant="outlined" className="h-6 px-2.5 text-xs" onClick={() => context.onFlip(data)} data-flip-open={data.storeCode}>
      {t(`flip.open.${target}`)}
    </Button>
  )
}

/** The stores grid: plain cells are isolated by the core grid base; the renderers isolate their own. */
function engineColumns(t: (key: string) => string): ColDef<StoreEngineRow>[] {
  return [
    {
      colId: 'store',
      headerName: t('columns.store'),
      valueGetter: ({ data }) => (data ? formatPair(data.storeCode, data.storeName) : ''),
      sort: 'asc',
      minWidth: 180,
      flex: 1,
    },
    {
      colId: 'engine',
      headerName: t('columns.engine'),
      valueGetter: ({ data }) => (data ? engineOf(data) : ''),
      cellRenderer: EngineCell,
      width: 130,
    },
    { colId: 'changedBy', field: 'changedBy', headerName: t('columns.changedBy'), valueFormatter: ({ value }) => value || t('none'), width: 140 },
    {
      colId: 'changedAt',
      field: 'changedAt',
      headerName: t('columns.changedAt'),
      valueFormatter: ({ value }) => formatDateTime(value as string | null) || t('none'),
      width: 150,
    },
    { colId: 'reason', field: 'reason', headerName: t('columns.reason'), valueFormatter: ({ value }) => value || t('none'), minWidth: 140, flex: 1 },
    { colId: 'flip', headerName: '', cellRenderer: FlipCell, sortable: false, width: 190 },
  ]
}

/** No store matches the search — not a failure. */
function NoRows() {
  const { t } = useTranslation('engine-switch')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
