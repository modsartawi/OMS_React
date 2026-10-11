import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { AlertTriangle, ChevronDown, Loader2, Search, X } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { FLEET_SORTS, RAILS, STATE_CODES, type FleetStoreRow, type Label, type Rail } from '@/core/models/sap-export'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { canOpenSapExport, sapExportAccessQuery } from './access'
import { fleetStoresQuery, fleetSummaryQuery } from './api'
import { FLEET_DEFAULT_COL_DEF, buildFleetColumns } from './fleet-columns'
import { STALE_AFTER_MINUTES, fleetErrorKey, fleetTiles, type FleetTile } from './fleet-helpers'
import {
  DEFAULT_FLEET_QUERY,
  FLEET_PAGE_SIZE,
  fleetQueryFromParams,
  fleetQueryToParams,
  isFilteredFleet,
  toggleFleetLabel,
  toggleFleetState,
  withFleetFilter,
  withFleetPage,
  type FleetQuery,
} from './fleet-query'
import { LABEL_TOKEN_CLASS, WORST_FIRST, labelToken, type LabelToken } from './label-helpers'
import { figure, storeHref } from './storeday-helpers'

/**
 * The SAP export console's fleet page — `/reports/sap-export` (BackOffice spec 2579, ticket 463).
 *
 * Top to bottom: the rollup's "as of" stamp (warning when it is older than 30 minutes), the
 * fleet tiles, then every store's export health — paged at 50 by the door, worst first by default.
 * The three store tiles drive the list's `label` filter; the double-send tiles open the
 * double-send list (465). The tiles and the list refetch every minute.
 *
 * 🚩 **Read-only.** Nothing on this page acts on SAP data; resets are out of scope (spec 2579).
 */
export default function SapExportPage() {
  const { t } = useTranslation('sap-export-console')
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      <Fleet />
    </ScreenGate>
  )
}

/** A tile's accent: its token as a top border, from the app tokens. */
const TILE_ACCENT: Record<LabelToken, string> = {
  danger: 'border-t-danger',
  warningStrong: 'border-t-attention',
  info: 'border-t-primary',
  neutral: 'border-t-border',
  success: 'border-t-success',
  muted: 'border-t-border',
}

/** The search box waits this long after the last keystroke before it asks the door. */
const SEARCH_DEBOUNCE_MS = 300

/** How often the stale warning re-reads the clock. */
const STALE_TICK_MS = 60_000

function Fleet() {
  const { t } = useTranslation('sap-export-console')
  // 🔑 The list's filters, sort and page are the URL's (`./fleet-query`): a fleet view is a link.
  const { query, update, awaitingEcho } = useUrlQuery(fleetQueryFromParams, fleetQueryToParams)

  // The box is a draft that reaches the URL once typing pauses (back on page 1). A change from
  // outside (Back, a link) resets it — never the echo of its own write, which would drop the
  // keys typed while that write was landing.
  const [draft, setDraft] = useState(query.q)
  useEffect(() => {
    if (!awaitingEcho()) setDraft((d) => (d.trim() === query.q ? d : query.q))
  }, [query.q, awaitingEcho])
  useEffect(() => {
    const id = setTimeout(() => update((q) => withFleetFilter(q, { q: draft })), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [draft, update])

  const summary = useQuery(fleetSummaryQuery())
  const stores = useQuery(fleetStoresQuery(query))
  const columns = useMemo(() => buildFleetColumns(t), [t])

  // The stale warning is judged against a clock that ticks every minute, so kept numbers age into
  // it even while the summary's refetch is failing.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), STALE_TICK_MS)
    return () => clearInterval(id)
  }, [])
  const head = useMemo(
    () => (summary.data ? fleetTiles(summary.data, new Date(Math.max(now, summary.dataUpdatedAt))) : null),
    [summary.data, summary.dataUpdatedAt, now],
  )

  // 🚩 A failed read draws no rows: the kept previous answer belongs to the query BEFORE the one
  // that failed, and fifty unfiltered stores under a Stuck tile would read as fifty stuck stores.
  const shown = stores.isError ? undefined : stores.data
  const rows = shown?.items ?? []
  const total = shown?.total ?? 0

  // A refresh can shrink the result under the page being read: an emptied inner page falls back.
  const settled = shown && !stores.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: FLEET_PAGE_SIZE,
    })
    if (last !== settled.page) update((q) => (q.page === settled.page ? withFleetPage(q, last) : q))
  }, [settled, update])

  const errorKey = stores.isError ? fleetErrorKey(apiErrorCode(stores.error)) : null
  const filtered = isFilteredFleet(query)
  const navigate = useNavigate()

  return (
    <div className="flex min-w-0 flex-col gap-4" data-fleet-page="">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(summary.isFetching || stores.isFetching) && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('fleet.refreshing')}
          </span>
        )}
        {head && (
          <span data-as-of={head.computedAt ?? ''}>
            {head.computedAt ? (
              <Trans t={t} i18nKey="fleet.asOf" values={{ at: formatDateTime(head.computedAt) }} components={{ at: <Ltr /> }} />
            ) : (
              t('fleet.neverComputed')
            )}
          </span>
        )}
      </div>

      {head?.stale && (
        <div
          className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
          role="status"
          data-stale=""
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('fleet.stale', { minutes: fsi(String(STALE_AFTER_MINUTES)) })}
        </div>
      )}

      <section aria-label={t('fleet.tiles.label')} data-tiles="">
        {summary.isError && <ErrorBanner className="mb-2 p-3" message={apiErrorMessage(summary.error, t('fleet.tiles.failed'))} />}
        {head && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
            {head.tiles.map((tile) => (
              <Tile key={tile.key} tile={tile} on={tile.action.kind === 'label' && query.labels.includes(tile.action.label)} onLabel={(l) => update((q) => toggleFleetLabel(q, l))} />
            ))}
          </div>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2" data-fleet-list="">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('fleet.search')}
              aria-label={t('fleet.search')}
              className="h-8 w-64 rounded-md border border-border/60 bg-background ps-8 pe-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              data-fleet-search=""
            />
          </label>
          <select
            value={query.rail ?? ''}
            onChange={(e) => update((q) => withFleetFilter(q, { rail: (e.target.value || null) as Rail | null }))}
            aria-label={t('fleet.rail')}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm"
            data-fleet-rail=""
          >
            <option value="">{t('fleet.railAny')}</option>
            {RAILS.map((r) => (
              <option key={r} value={r}>
                {t(`rails.${r}`)}
              </option>
            ))}
          </select>
          <StatePicker chosen={query.states} onToggle={(s) => update((q) => toggleFleetState(q, s))} />
          <select
            value={query.sort}
            onChange={(e) => update((q) => withFleetFilter(q, { sort: e.target.value as FleetQuery['sort'] }))}
            aria-label={t('fleet.sort')}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm"
            data-fleet-sort=""
          >
            {FLEET_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`fleet.sorts.${s}`)}
              </option>
            ))}
          </select>
          {shown && (
            <span className="text-xs text-muted-foreground" data-fleet-count={total}>
              <Trans t={t} i18nKey="fleet.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
            </span>
          )}
          {stores.isPlaceholderData && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" data-fleet-refreshing="">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('fleet.refreshing')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('fleet.labelsLabel')} data-label-chips="">
          {WORST_FIRST.map((label) => {
            const token = labelToken(label)
            const on = query.labels.includes(label)
            return (
              <button
                key={label}
                type="button"
                onClick={() => update((q) => toggleFleetLabel(q, label))}
                aria-pressed={on}
                data-label-chip={label}
                data-token={token.token}
                className={
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-shadow ' +
                  LABEL_TOKEN_CLASS[token.token] +
                  (on ? ' ring-2 ring-primary/70' : ' hover:ring-1 hover:ring-primary/40')
                }
              >
                {token.labelKey && t(token.labelKey)}
              </button>
            )
          })}
          {query.states.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => update((q) => toggleFleetState(q, code))}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary-050 px-2 py-1 text-xs text-primary-800"
              data-state-chosen={code}
            >
              <span className="font-mono font-medium">
                <Ltr>{code}</Ltr>
              </span>
              {t(`states.${code}`)}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setDraft('')
                update((q) => ({ ...DEFAULT_FLEET_QUERY, sort: q.sort }))
              }}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              data-clear-filters=""
            >
              {t('fleet.clear')}
            </button>
          )}
        </div>

        {stores.isError && (
          <ErrorBanner className="p-3" message={errorKey ? t(errorKey) : apiErrorMessage(stores.error, t('fleet.failed'))} />
        )}

        {stores.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('fleet.loading')}
          </div>
        ) : (
          shown && (
            <div className="overflow-hidden rounded-md border border-border/60">
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground" data-fleet-empty="">
                  {t(query.page > 1 ? 'fleet.emptyPage' : filtered ? 'fleet.emptyFiltered' : 'fleet.empty')}
                </p>
              ) : (
                <div data-fleet-grid="">
                  <AgGridReact<FleetStoreRow>
                    theme={omsGridTheme}
                    rowData={rows}
                    columnDefs={columns}
                    defaultColDef={FLEET_DEFAULT_COL_DEF}
                    getRowId={({ data }) => data.code}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    domLayout="autoHeight"
                    animateRows={false}
                    suppressColumnVirtualisation
                    // A row opens its store; the code cell is a real link that navigates itself.
                    onRowClicked={(e) => {
                      const onLink = e.event?.target instanceof Element && e.event.target.closest('a')
                      if (e.data && !onLink) navigate(storeHref(e.data.code))
                    }}
                    rowClass="cursor-pointer"
                  />
                </div>
              )}
            </div>
          )
        )}

        {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
        {((shown && showsPager(total, FLEET_PAGE_SIZE)) || query.page > 1) && (
          <div className="overflow-hidden rounded-md border border-border/60">
            <GridPager
              page={query.page}
              pageSize={FLEET_PAGE_SIZE}
              // A failed inner page has no total; read as the last page, Previous is the way back.
              totalMatches={shown ? total : query.page * FLEET_PAGE_SIZE}
              // Inert while the NEXT page is in flight, not during the minute's refetch.
              busy={stores.isPlaceholderData}
              onPage={(page) => update((q) => withFleetPage(q, page))}
            />
          </div>
        )}
      </section>
    </div>
  )
}

function Tile({ tile, on, onLabel }: { tile: FleetTile; on: boolean; onLabel: (label: Label) => void }) {
  const { t } = useTranslation('sap-export-console')
  const accent = tile.quiet ? TILE_ACCENT.muted : TILE_ACCENT[tile.token]
  const body = (
    <>
      <span className="font-mono text-xl font-medium tabular-nums">
        <Ltr>{figure(tile.count)}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground">{t(tile.labelKey)}</span>
    </>
  )
  const shape = 'flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border/60 px-3 py-2 text-start ' + accent
  const action = tile.action
  if (action.kind === 'label')
    return (
      <button
        type="button"
        onClick={() => onLabel(action.label)}
        aria-pressed={on}
        data-tile={tile.key}
        data-tile-token={tile.quiet ? 'muted' : tile.token}
        className={shape + ' transition-colors hover:bg-accent' + (on ? ' bg-muted ring-2 ring-primary/60' : ' bg-card')}
      >
        {body}
      </button>
    )
  if (action.kind === 'link')
    return (
      <Link to={action.href} data-tile={tile.key} data-tile-token={tile.quiet ? 'muted' : tile.token} className={shape + ' bg-card transition-colors hover:bg-accent'}>
        {body}
      </Link>
    )
  return (
    <div data-tile={tile.key} data-tile-token={tile.quiet ? 'muted' : tile.token} className={shape + ' bg-card'}>
      {body}
    </div>
  )
}

/**
 * The state filter: every code the contract knows, with its meaning, in the ladder's order. A
 * native disclosure, so it opens and closes from the keyboard with no overlay code.
 */
function StatePicker({ chosen, onToggle }: { chosen: readonly string[]; onToggle: (state: string) => void }) {
  const { t } = useTranslation('sap-export-console')
  const ref = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)
  // Open, it closes on a click or a focus anywhere else and on Escape, so it never sits over the list.
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current) ref.current.open = false
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('focusin', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('focusin', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <details ref={ref} className="relative" onToggle={(e) => setOpen(e.currentTarget.open)} data-state-picker="">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-sm">
        {t('fleet.states')}
        {chosen.length > 0 && (
          <span className="rounded-full bg-primary-050 px-1.5 font-mono text-xs text-primary-800">
            <Ltr>{figure(chosen.length)}</Ltr>
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </summary>
      <div
        className="absolute start-0 z-20 mt-1 max-h-96 w-80 overflow-auto rounded-md border border-border/60 bg-card p-1 shadow-lg"
        role="group"
        aria-label={t('fleet.statesLabel')}
      >
        {STATE_CODES.map((code) => (
          <label key={code} className="flex cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
            <input type="checkbox" checked={chosen.includes(code)} onChange={() => onToggle(code)} data-state-option={code} />
            <span className="w-10 shrink-0 font-mono text-xs font-medium">
              <Ltr>{code}</Ltr>
            </span>
            <span>{t(`states.${code}`)}</span>
          </label>
        ))}
      </div>
    </details>
  )
}
