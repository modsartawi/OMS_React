import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { RowSelectionOptions } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import type { Severity } from '@/core/ui/severity'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { CONTROL_ACTIONS, type StoreRow } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import {
  canOpenSyncConsole,
  fleetStoresQuery,
  fleetSummaryQuery,
  syncConsoleAccessQuery,
} from './api'
import {
  DEFAULT_FLEET_FILTER,
  FLEET_PAGE_SIZE,
  FLEET_SORTS,
  FLEET_TILES,
  figure,
  stateBadge,
  tileOn,
  toggleTile,
  type FleetFilter,
  type FleetHostFilter,
  type FleetTile,
} from './helpers'
import { FLEET_DEFAULT_COL_DEF, buildFleetColumns } from './fleet-columns'
import { SELECTION_CAP } from './control-helpers'
import ConsoleNav from './ConsoleNav'
import ControlDialog, { CONTROL_VARIANT, type ControlOutcome, type ControlRequest } from './ControlDialog'
import ControlResults from './ControlResults'
import LastHourPanel from './LastHourPanel'
import RePushDialog from './RePushDialog'
import WorkerCard from './WorkerCard'
import { CHECKBOX_SELECTION, useCappedSelection } from './useCappedSelection'

/**
 * The store sync console's Fleet page (spec 444, ticket 445) — `/admin/sync`.
 *
 * The worker card, the state tiles, the last-hour totals and the paged store table,
 * top to bottom as the owner-accepted prototype lays them out. Every read refetches
 * every 30 s, and the "as of" stamp is `Fleet/Summary.asOf` — the server's clock,
 * not this browser's.
 *
 * With `canOperate` (447), the table grows a selection of up to 50 stores
 * (`selectionCap`), kept across pages and filters, and a bulk bar that sends Move,
 * Hand back, Pause or Resume (or, 448, a previewed Re-push) for the whole selection
 * in one call. Without the grant
 * neither the checkboxes nor the bar render.
 */
export default function FleetPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Fleet />
    </ScreenGate>
  )
}

/** A tile's accent: its state's severity as a top border, from the app tokens. */
const TILE_ACCENT: Record<Severity, string> = {
  ok: 'border-t-success',
  go: 'border-t-primary',
  warn: 'border-t-attention',
  bad: 'border-t-danger',
  mute: 'border-t-border',
}

/** The search box waits this long after the last keystroke before it asks the door. */
const SEARCH_DEBOUNCE_MS = 300

const FLEET_SELECTION = CHECKBOX_SELECTION as RowSelectionOptions<StoreRow>

const storeCode = (row: StoreRow) => row.code

function Fleet() {
  const { t } = useTranslation('sync-console')
  const [filter, setFilter] = useState<FleetFilter>(DEFAULT_FLEET_FILTER)
  const [search, setSearch] = useState('')

  // The typed search reaches the filter once typing pauses, and starts again at page 1.
  // Compared trimmed, as it is sent: a trailing space is not a new search.
  useEffect(() => {
    const id = setTimeout(() => {
      const q = search.trim()
      setFilter((f) => (f.q === q ? f : { ...f, q, page: 1 }))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  const summary = useQuery(fleetSummaryQuery())
  const access = useQuery(syncConsoleAccessQuery())
  const canOperate = access.data?.canOperate === true
  const stores = useQuery({ ...fleetStoresQuery(filter), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildFleetColumns(t), [t])

  // 🚩 A failed read draws no rows: the kept previous answer belongs to the filter
  // BEFORE the one that failed, and fifty unfiltered stores under an Offline tile
  // would read as fifty offline stores.
  const shown = stores.isError ? undefined : stores.data
  const rows = shown?.items ?? []
  const total = shown?.total ?? 0

  // A refresh can shrink the result under the page being read (stores recover while
  // the Erroring tile is on): an emptied inner page falls back to the new last page.
  const settled = shown && !stores.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const page = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: FLEET_PAGE_SIZE,
    })
    if (page !== settled.page) setFilter((f) => (f.page === settled.page ? { ...f, page } : f))
  }, [settled])
  const asOf = summary.data?.asOf

  // ── The selection (447): codes, not rows, so it outlives a page, a filter and a refresh.
  const { selected, setSelected, gridProps } = useCappedSelection(storeCode)
  const [request, setRequest] = useState<ControlRequest | null>(null)
  const [rePush, setRePush] = useState<string[] | null>(null)
  const [outcome, setOutcome] = useState<ControlOutcome | null>(null)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConsoleNav />
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground" data-as-of="">
        {(summary.isFetching || stores.isFetching) && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('refreshing')}
          </span>
        )}
        {asOf && <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(asOf) }} components={{ at: <Ltr /> }} />}
      </div>

      <WorkerCard />

      <section aria-label={t('tiles.label')} data-tiles="">
        {summary.isError && (
          <ErrorBanner className="mb-2 p-3" message={apiErrorMessage(summary.error, t('tiles.failed'))} />
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
          {FLEET_TILES.map((tile) => (
            <Tile
              key={tile}
              tile={tile}
              count={summary.data?.counts[tile]}
              on={tileOn(filter, tile)}
              onClick={() => setFilter((f) => toggleTile(f, tile))}
            />
          ))}
        </div>
      </section>

      <LastHourPanel />

      <section className="flex min-w-0 flex-col gap-2" data-fleet-table="">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('table.search')}
            aria-label={t('table.search')}
            className="w-64"
            data-fleet-search=""
          />
          <Select
            value={filter.host ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, host: (e.target.value || null) as FleetHostFilter, page: 1 }))
            }
            aria-label={t('table.host')}
            data-fleet-host=""
          >
            <option value="">{t('table.hostAny')}</option>
            <option value="Worker">{t('hosts.Worker')}</option>
            <option value="Wpf">{t('hosts.Wpf')}</option>
          </Select>
          <Select
            value={filter.sort}
            onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as FleetFilter['sort'], page: 1 }))}
            aria-label={t('table.sort')}
            data-fleet-sort=""
          >
            {FLEET_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`table.sorts.${s}`)}
              </option>
            ))}
          </Select>
          {shown && (
            <span className="text-xs text-muted-foreground" data-fleet-count="">
              <Trans t={t} i18nKey="table.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
            </span>
          )}
        </div>

        {stores.isError && (
          <ErrorBanner className="p-3" message={apiErrorMessage(stores.error, t('table.failed'))} />
        )}

        {stores.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('table.loading')}
          </div>
        ) : (
          shown && (
            <div className="overflow-hidden rounded-md border border-border/60">
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground" data-fleet-empty="">
                  {t(filter.page > 1 ? 'table.emptyPage' : 'table.empty')}
                </p>
              ) : (
                <div className="h-[32rem]">
                  <AgGridReact<StoreRow>
                    theme={omsGridTheme}
                    rowData={rows}
                    columnDefs={columns}
                    defaultColDef={FLEET_DEFAULT_COL_DEF}
                    getRowId={({ data }) => data.code}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    animateRows={false}
                    suppressColumnVirtualisation
                    rowSelection={canOperate ? FLEET_SELECTION : undefined}
                    {...gridProps}
                  />
                </div>
              )}
              {/* Drawn beside an empty inner page too: it is the only way back from one. */}
              {(showsPager(total, FLEET_PAGE_SIZE) || filter.page > 1) && (
                <GridPager
                  page={filter.page}
                  pageSize={FLEET_PAGE_SIZE}
                  totalMatches={total}
                  // Inert while the NEXT page is in flight, not during the 30 s poll.
                  busy={stores.isPlaceholderData}
                  onPage={(page) => setFilter((f) => ({ ...f, page }))}
                />
              )}
            </div>
          )
        )}

        {canOperate && (
          <div className="flex flex-col gap-2" data-bulk-bar="">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('controls.label')}>
              <span className="text-xs text-muted-foreground" data-selection-count={selected.length}>
                {selected.length === 0 ? (
                  t('selection.hint', { cap: fsi(figure(SELECTION_CAP)) })
                ) : (
                  <Trans
                    t={t}
                    i18nKey="selection.count"
                    count={selected.length}
                    values={{ n: figure(selected.length) }}
                    components={{ n: <Ltr /> }}
                  />
                )}
              </span>
              {CONTROL_ACTIONS.map((action) => (
                <Button
                  key={action}
                  variant={CONTROL_VARIANT[action]}
                  disabled={selected.length === 0}
                  onClick={() => setRequest({ action, codes: selected })}
                  data-bulk={action}
                >
                  {t(`controls.${action}`)}
                </Button>
              ))}
              {/* 448: the selection's re-push, through its own dialog (preview, then confirm). */}
              <Button
                variant="secondary"
                disabled={selected.length === 0}
                onClick={() => setRePush(selected)}
                data-bulk="RePush"
              >
                {t('controls.RePush')}
              </Button>
              {selected.length > 0 && (
                <Button variant="text" onClick={() => setSelected([])} data-selection-clear="">
                  {t('selection.clear')}
                </Button>
              )}
            </div>
            <ControlResults outcome={outcome} onDismiss={() => setOutcome(null)} />
          </div>
        )}
      </section>
      <ControlDialog
        request={request}
        onClose={() => setRequest(null)}
        onResult={(o) => {
          setOutcome(o)
          // The answered selection is spent; its refusals stay listed with their codes.
          setSelected([])
        }}
      />
      <RePushDialog
        codes={rePush}
        onClose={() => setRePush(null)}
        onResult={(o) => {
          setOutcome(o)
          setSelected([])
        }}
      />
    </div>
  )
}

function Tile({
  tile,
  count,
  on,
  onClick,
}: {
  tile: FleetTile
  count: number | undefined
  on: boolean
  onClick: () => void
}) {
  const { t } = useTranslation('sync-console')
  const accent = tile === 'all' ? TILE_ACCENT.mute : TILE_ACCENT[stateBadge(tile).sev]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-tile={tile}
      className={
        'flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border px-3 py-2 text-start transition-colors hover:bg-accent ' +
        accent +
        (on ? ' bg-muted ring-2 ring-primary/60' : ' bg-card')
      }
    >
      <span className="font-mono text-xl font-medium tabular-nums">
        <Ltr>{count === undefined ? '' : figure(count)}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground">{tile === 'all' ? t('tiles.all') : t(`states.${tile}`)}</span>
    </button>
  )
}
