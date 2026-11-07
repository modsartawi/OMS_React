import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, RowClassRules } from 'ag-grid-community'
import { RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { canManageHybrisStock, canViewHybrisStock } from '@/core/hybris-stock/access'
import { hybrisStockAccessQuery } from '@/core/hybris-stock/api'
import ModeBanner from '@/core/hybris-stock/ModeBanner'
import type { HybrisStockMarkedFilter, HybrisStockStoreRow, HybrisStockStoresQuery } from '@/core/models/hybris-stock'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { formatFigure as figure } from '@/core/util/number-format'
import { STORES_KEY, storesApi } from './api'
import { storeColumns } from './columns'
import { storeHealth } from './health'
import HistoryDrawer from './HistoryDrawer'
import { MarkDialog } from './StoreDialogs'
import { MARKED_FILTERS, storesFromParams, storesToParams } from './stores-query'

/**
 * Hybris stock stores (ticket 847, BackOffice spec 3447): every store with its Hybris stock flag,
 * search, and for a marked store its sync health — last delta, last full, next full due, last error,
 * an unhealthy store red. Mark / unmark with a reason (manage only), the row patched in place; a
 * history drawer (who, when, why) from a row or from `?history=<code>`. The rail's mode banner sits
 * above it all: off, **shadow** (files Hybris does not import) or live.
 *
 * Behind `canViewHybrisStock` on the ONE Hybris stock probe, the predicate the menu leaf reads; the
 * write actions behind `canManageHybrisStock` on the same answer. Its doors are BackOffice 3453.
 */
export default function StoresPage() {
  const { t } = useTranslation('hybris-stock-stores')
  return (
    <ScreenGate query={hybrisStockAccessQuery()} can={canViewHybrisStock} ns="hybris-stock-stores" title={t('title')} subtitle={t('subtitle')}>
      <Stores />
    </ScreenGate>
  )
}

type Row = HybrisStockStoreRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const MARKED_KEY: Record<HybrisStockMarkedFilter, string> = { any: 'filters.markedAny', marked: 'filters.markedOnly', unmarked: 'filters.unmarkedOnly' }

/** An unhealthy store's row is red and a store whose last push failed amber. */
const ROW_BAD = '[--ag-data-background-color:var(--danger-050)]'
const ROW_WARN = '[--ag-data-background-color:var(--attention-050)]'

function Stores() {
  const { t } = useTranslation('hybris-stock-stores')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const query = useMemo(() => storesFromParams(params), [params])
  const [draft, setDraft] = useState(query.q ?? '')
  useEffect(() => setDraft(query.q ?? ''), [query.q])
  // A filter change takes the text box as it reads, and keeps the open drawer.
  const update = (change: Partial<HybrisStockStoresQuery>) => {
    const next = storesToParams({ ...query, q: draft.trim() || null, ...change })
    const history = params.get('history')
    if (history) next.set('history', history)
    setParams(next, { replace: true })
  }

  const access = useQuery(hybrisStockAccessQuery())
  const canManage = canManageHybrisStock(access.data)

  const stores = useQuery({
    queryKey: [...STORES_KEY, storesToParams(query).toString()],
    queryFn: () => storesApi.list(query),
    retry: false,
  })
  const rows = useMemo(() => stores.data ?? [], [stores.data])
  const markedCount = rows.filter((r) => r.marked).length
  const unhealthyCount = rows.filter((r) => storeHealth(r).reading === 'unhealthy').length

  const [marking, setMarking] = useState<Row | null>(null)

  // The history drawer lives in the URL, so a link that knows only a store code opens it.
  const historyCode = params.get('history')
  const openHistory = useCallback(
    (code: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (code) next.set('history', code)
          else next.delete('history')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const openHistoryRef = useRef(openHistory)
  useEffect(() => {
    openHistoryRef.current = openHistory
  }, [openHistory])
  const historyName = historyCode ? (rows.find((r) => r.storeCode === historyCode)?.storeName ?? '') : ''

  const rowClassRules = useMemo<RowClassRules<Row>>(
    () => ({
      [ROW_BAD]: ({ data }) => !!data && storeHealth(data).highlight === 'bad',
      [ROW_WARN]: ({ data }) => !!data && storeHealth(data).highlight === 'warn',
    }),
    [],
  )

  const columns = useMemo(
    () =>
      storeColumns(t, {
        onMark: canManage ? (row) => setMarking(row) : null,
        onHistory: (row) => openHistoryRef.current(row.storeCode),
        // The push log owns the pushes and a material's history; a store links into it by code.
        onPushes: (row) => navigate(`/hybris-stock/pushes?${new URLSearchParams({ store: row.storeCode })}`),
        onMaterial: (row) => navigate(`/hybris-stock/pushes?${new URLSearchParams({ store: row.storeCode, history: row.storeCode })}`),
      }),
    [t, canManage, navigate],
  )

  return (
    <div className="flex flex-col gap-3">
      <ModeBanner />

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
        <Field label={t('filters.marked')}>
          <Select value={query.marked} onChange={(e) => update({ marked: e.target.value as HybrisStockMarkedFilter })} data-filter-marked="">
            {MARKED_FILTERS.map((m) => (
              <option key={m} value={m}>
                {t(MARKED_KEY[m])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.q')} className="min-w-[16rem] flex-1">
          <Input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('filters.qPlaceholder')} data-filter-q="" />
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
      </form>

      {stores.isError && <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(stores.error, t('results.failed'))} />}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-24rem)] min-h-96" data-stores-grid="">
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
              <>
                <span data-status-count="">
                  <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
                </span>
                <span data-status-marked="">
                  <Trans t={t} i18nKey="results.marked" count={markedCount} values={{ n: figure(markedCount) }} components={{ n: <Ltr /> }} />
                </span>
                {unhealthyCount > 0 && (
                  <span className="text-danger-800" data-status-unhealthy="">
                    <Trans t={t} i18nKey="results.unhealthy" count={unhealthyCount} values={{ n: figure(unhealthyCount) }} components={{ n: <Ltr /> }} />
                  </span>
                )}
                {!canManage && access.isSuccess && (
                  <span className="ms-auto" data-view-only="">
                    {t('results.viewOnly')}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {historyCode && <HistoryDrawer key={historyCode} storeCode={historyCode} storeName={historyName} onClose={() => openHistory(null)} />}
      {marking && canManage && <MarkDialog row={marking} onClose={() => setMarking(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('hybris-stock-stores')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
