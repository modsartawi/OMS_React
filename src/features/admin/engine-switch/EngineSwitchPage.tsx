import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { CellKeyDownEvent, ColDef, ICellRendererParams, RowClickedEvent } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { PromotionEngine } from '@/core/models/rule-campaign'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'
import { storeEnginesQuery } from './api'
import EngineBadge from './EngineBadge'
import FlipDialog from './FlipDialog'
import HistoryPane from './HistoryPane'
import { ENGINES, filterByEngine, flipTarget, STORES_CAP, storeRows, switchQueryFromParams, switchQueryToParams, type StoreEngineRow } from './helpers'

/**
 * Admin ▸ Store engine switch (ticket 517, re-pointed in 528; BackOffice 2745, ADR 0093): the stores
 * HQ's search answers (at most 50), each with the promotion engine it runs — `BonusBuy` or `Rule`, a
 * store HQ holds no row for reading BonusBuy. Flip asks a reason and takes effect at the store's next
 * shift open; a flip back to bonus buys answers what is still in flight, shown after it — it never
 * blocks. A row opens the store's history, with who flipped it last.
 *
 * The list is the builder's stores lookup (RuleAuthoring grant), not a switch door: there is none (BO
 * ask C). No access probe on the leaf yet (BO ask B, ticket 529): a missing grant is a bare 403.
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
  // HQ searches (code prefix or name); the engine filter narrows its answer here.
  const q = useDebounced(query.search.trim(), 250)
  const stores = useQuery(storeEnginesQuery(q))
  const all = useMemo(() => (stores.data ? storeRows(stores.data) : NO_ROWS), [stores.data])
  const rows = useMemo(() => filterByEngine(all, query.engine), [all, query.engine])
  const capped = (stores.data?.length ?? 0) >= STORES_CAP
  // A store opened from the address or by a flip stays open when the search no longer lists it.
  const openedName = all.find((r) => r.storeCode === query.store)?.storeName ?? null

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
        <Field id={ids.search} label={t('filter.search')}>
          <Input
            type="search"
            className="w-64"
            value={search}
            onChange={(e) => {
              const value = e.target.value
              setSearch(value)
              update((q) => ({ ...q, search: value }))
            }}
            data-engine-field="search"
          />
        </Field>
        <Field id={ids.engine} label={t('filter.engine')}>
          <Select
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
          </Select>
        </Field>
      </div>

      {stores.isError && (
        <ErrorBanner
          className="p-2.5"
          title={t('results.failedTitle')}
          message={isBareDenial(stores.error) ? t('results.denied') : apiErrorMessage(stores.error, t('results.failed'))}
        />
      )}

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
                <>
                  <span data-status-count="">
                    <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: rows.length }} components={{ n: <Ltr /> }} />
                  </span>
                  {capped && (
                    <span data-status-capped="">
                      <Trans t={t} i18nKey="results.capped" values={{ n: STORES_CAP }} components={{ n: <Ltr /> }} />
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {query.store && (
          <HistoryPane key={query.store} storeCode={query.store} storeName={openedName} onClose={() => update((q) => ({ ...q, store: '' }))} />
        )}
      </div>

      {flipping && (
        <FlipDialog
          row={flipping}
          target={flipTarget(flipping.engine)}
          onClose={() => setFlipping(null)}
          onFlipped={(storeCode) => {
            setFlipping(null)
            update((q) => ({ ...q, store: storeCode }))
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
  return data ? <EngineBadge engine={data.engine} /> : null
}

function FlipCell({ data, context }: ICellRendererParams<StoreEngineRow, unknown, GridContext>) {
  const { t } = useTranslation('engine-switch')
  if (!data) return null
  const target = flipTarget(data.engine)
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
      valueGetter: ({ data }) => data?.engine ?? '',
      cellRenderer: EngineCell,
      width: 130,
    },
    { colId: 'flip', headerName: '', cellRenderer: FlipCell, sortable: false, width: 190 },
  ]
}

/** No store matches the search — not a failure. */
function NoRows() {
  const { t } = useTranslation('engine-switch')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
