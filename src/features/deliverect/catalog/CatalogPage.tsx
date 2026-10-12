import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ChevronLeft, ChevronRight, RotateCcw, Search, Send, Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { deliverectAccessQuery } from '@/core/deliverect/api'
import { canManageCatalog } from '@/core/deliverect/access'
import type { DeliverectWhitelistImportResult, DeliverectWhitelistQuery, DeliverectWhitelistRow } from '@/core/models/deliverect'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange } from '@/core/util/bidi'
import { WHITELIST_KEY, catalogApi } from './api'
import { ExclusionsDialog, ImportDialog, ImportResultDialog, PushDialog, RowActionDialog } from './CatalogDialogs'
import { whitelistColumns } from './columns'
import { WHITELIST_STATES, figure, whitelistFromParams, whitelistToParams, type WhitelistAction } from './whitelist-state'

/**
 * The Deliverect catalog (ticket 479, BackOffice spec 2615): the ONE whitelist of materials pushed
 * to every Deliverect account, paged at 500 and filtered by state and text (the search lives in the
 * URL). A category manager imports material numbers (pasted or from a one-column `.xlsx`), disables,
 * deletes or restores a material, edits its **platform exclusions**, and pushes the catalog to a
 * Deliverect account now — every write but the push with a reason.
 *
 * Behind `canManageCatalog` on the ONE Deliverect probe, the same predicate the menu leaf reads. Its
 * doors are BackOffice 2623.
 */
export default function CatalogPage() {
  const { t } = useTranslation('deliverect-catalog')
  return (
    <ScreenGate query={deliverectAccessQuery()} can={canManageCatalog} ns="deliverect-catalog" title={t('title')} subtitle={t('subtitle')}>
      <Catalog />
    </ScreenGate>
  )
}

type Row = DeliverectWhitelistRow

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
const CHIP =
  'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors aria-pressed:border-primary aria-pressed:bg-primary-050 aria-pressed:text-primary-800'

/** The row write open, if any. */
type Acting = { row: Row; action: WhitelistAction } | null

function Catalog() {
  const { t } = useTranslation('deliverect-catalog')
  const [params, setParams] = useSearchParams()
  // 🔑 The URL is the query: read from it every render, every change written back (replace, so Back
  // leaves the screen rather than stepping through each filter tweak).
  const query = useMemo(() => whitelistFromParams(params), [params])
  const [text, setText] = useState(query.q ?? '')
  useEffect(() => setText(query.q ?? ''), [query.q])

  // A filter change takes the text box as it reads, and starts again at the first page.
  const update = (change: Partial<DeliverectWhitelistQuery>) =>
    setParams(whitelistToParams({ ...query, q: text.trim() || null, skip: 0, ...change }), { replace: true })

  const list = useQuery({
    queryKey: [...WHITELIST_KEY, whitelistToParams(query).toString()],
    queryFn: () => catalogApi.list(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  // Rows only from an answer to THIS query: never after a failed read, or while the previous page
  // stands in for the next one (its rows would not match `skip`).
  const current = !list.isError && !list.isPlaceholderData
  const rows = useMemo(() => (current ? (list.data?.rows ?? []) : []), [list.data, current])
  const total = current ? (list.data?.total ?? 0) : 0

  // Paging moves through the search as it was submitted — never one typed and not yet searched.
  const page = (skip: number) => setParams(whitelistToParams({ ...query, skip }), { replace: true })

  // A page past the end (the last row of the last page was disabled or deleted away, or a pasted URL)
  // goes back to the last page that holds rows, rather than drawing "501–500 of 500".
  const pastEnd = current && !list.isFetching && rows.length === 0 && query.skip > 0
  useEffect(() => {
    if (pastEnd) setParams(whitelistToParams({ ...query, skip: total > 0 ? Math.floor((total - 1) / query.take) * query.take : 0 }), { replace: true })
  }, [pastEnd, query, total, setParams])

  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<DeliverectWhitelistImportResult | null>(null)
  const [pushing, setPushing] = useState(false)
  const [exclusions, setExclusions] = useState<Row | null>(null)
  const [acting, setActing] = useState<Acting>(null)

  const columns = useMemo(
    () => whitelistColumns(t, { onExclusions: setExclusions, onAction: (row, action) => setActing({ row, action }) }),
    [t],
  )

  const loading = list.isFetching && (!list.data || list.isPlaceholderData)
  const pageEnd = query.skip + rows.length

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const same = (text.trim() || null) === query.q && query.skip === 0
          if (same) void list.refetch()
          else update({})
        }}
        data-catalog-filters=""
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${FIELD} min-w-[18rem] flex-1`}>
            {t('filters.q')}
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('filters.qPlaceholder')}
              className={INPUT}
              data-filter-q=""
            />
          </label>
          <Button type="submit" className="h-9" disabled={list.isFetching} data-catalog-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button
            variant="outlined"
            className="h-9"
            onClick={() => {
              setText('')
              setParams(new URLSearchParams(), { replace: true })
            }}
            data-catalog-clear=""
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </Button>
          <span className="ms-auto flex items-end gap-2">
            <Button variant="outlined" className="h-9" onClick={() => setPushing(true)} data-catalog-push="">
              <Send className="h-3.5 w-3.5" aria-hidden />
              {t('push.button')}
            </Button>
            <Button className="h-9" onClick={() => setImporting(true)} data-catalog-import="">
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {t('import.button')}
            </Button>
          </span>
        </div>
        <div role="group" aria-label={t('filters.state')} className="flex flex-wrap items-center gap-1.5" data-filter-states="">
          <span className="text-xs font-medium text-muted-foreground">{t('filters.state')}</span>
          {WHITELIST_STATES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={query.state === s}
              onClick={() => update({ state: s })}
              className={CHIP + ' border-border/60 text-foreground'}
              data-filter-state={s}
            >
              {t(`states.${s}`)}
            </button>
          ))}
        </div>
      </form>

      {list.isError && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(list.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-22rem)] min-h-96" data-catalog-grid="">
          <AgGridReact<Row>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.materialNumber}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Ten columns: render every one, so a cell off to the side is in the DOM for find-in-page
            // and for the drive.
            suppressColumnVirtualisation
            loading={loading}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={list.isError}
          />
        </div>
        <div
          className="flex h-8 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {loading ? (
            <span>{t('results.loading')}</span>
          ) : total > rows.length ? (
            <span data-status-count="">
              <Trans
                t={t}
                i18nKey="results.page"
                count={total}
                values={{ range: formatRange(figure(query.skip + 1), figure(pageEnd)), total: figure(total) }}
                components={{ range: <Ltr />, total: <Ltr /> }}
              />
            </span>
          ) : (
            <span data-status-count="">
              <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
            </span>
          )}
          {total > rows.length && (
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                disabled={query.skip === 0 || list.isFetching}
                onClick={() => page(Math.max(0, query.skip - query.take))}
                data-catalog-previous=""
              >
                {/* The arrow points back along the reading direction. */}
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                {t('results.previous')}
              </Button>
              <Button
                variant="ghost"
                disabled={pageEnd >= total || list.isFetching}
                onClick={() => page(query.skip + query.take)}
                data-catalog-next=""
              >
                {t('results.next')}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            </span>
          )}
        </div>
      </div>

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onDone={(result) => {
            setImporting(false)
            setImported(result)
          }}
        />
      )}
      {imported && <ImportResultDialog result={imported} onClose={() => setImported(null)} />}
      {pushing && <PushDialog onClose={() => setPushing(false)} />}
      {exclusions && <ExclusionsDialog row={exclusions} onClose={() => setExclusions(null)} />}
      {acting && <RowActionDialog row={acting.row} action={acting.action} onClose={() => setActing(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('deliverect-catalog')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
