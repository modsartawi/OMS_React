import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, RowClassRules } from 'ag-grid-community'
import { RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { canViewHybrisStock } from '@/core/hybris-stock/access'
import { hybrisStockAccessQuery } from '@/core/hybris-stock/api'
import ModeBanner from '@/core/hybris-stock/ModeBanner'
import type { HybrisStockPushRow, HybrisStockPushStatus, HybrisStockPushType, HybrisStockPushesQuery } from '@/core/models/hybris-stock'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { PUSHES_KEY, pushesApi } from './api'
import { pushColumns } from './columns'
import MaterialHistoryDrawer from './MaterialHistoryDrawer'
import PushLinesDrawer from './PushLinesDrawer'
import { PUSH_STATUSES, PUSH_TYPES, statusLabel, typeLabel } from './push-labels'
import { PUSHES_STEP, drawerFromParams, mayHoldMore, moreTake, pushesFilterKey, pushesFromParams, pushesToParams, withDate, withDrawer, type Drawer } from './pushes-query'

/**
 * The Hybris stock push log (ticket 849, BackOffice spec 3447 stories 43–48): every push across stores
 * — delta, full, push now — filtered by store, type, status and date, each with its start and end,
 * rows, target (shadow / live), files and error. A push opens its lines; a line (or `?history=<store>`,
 * the stores page's link) opens a material's history at a store. Status reads "Delivered to hot
 * folder", never "live on the website". The door answers the newest N (no skip, no total): the log
 * shows the newest 50 and Show more asks 50 more, up to the door's 500.
 *
 * Behind `canViewHybrisStock`. Its doors are BackOffice 3455.
 */
export default function PushesPage() {
  const { t } = useTranslation('hybris-stock-pushes')
  return (
    <ScreenGate query={hybrisStockAccessQuery()} can={canViewHybrisStock} ns="hybris-stock-pushes" title={t('title')} subtitle={t('subtitle')}>
      <Pushes />
    </ScreenGate>
  )
}

type Row = HybrisStockPushRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const ROW_FAILED = '[--ag-data-background-color:var(--danger-050)]'

function Pushes() {
  const { t, i18n } = useTranslation('hybris-stock-pushes')
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => pushesFromParams(params), [params])
  const [store, setStore] = useState(query.store ?? '')
  useEffect(() => setStore(query.store ?? ''), [query.store])
  // A filter change keeps the open drawer and starts again from the newest 50.
  const update = (change: Partial<HybrisStockPushesQuery>) => setQuery({ ...query, store: store.trim() || null, take: PUSHES_STEP, ...change })
  const setQuery = (next: HybrisStockPushesQuery) => setParams(withDrawer(pushesToParams(next), drawerFromParams(params)), { replace: true })
  // A date past the other end of the range moves that end with it, so the range never turns over.
  const setDate = (end: 'from' | 'to', value: string) => setQuery(withDate({ ...query, store: store.trim() || null, take: PUSHES_STEP }, end, value || null))

  const filterKey = pushesFilterKey(query)
  const pushes = useQuery({
    queryKey: [...PUSHES_KEY, filterKey, query.take],
    queryFn: () => pushesApi.list(query),
    // Show more keeps the rows on screen while the longer read lands (they are its first rows); a
    // filter change does not — the old filter's rows are not the new one's, so the grid shows loading.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[PUSHES_KEY.length] === filterKey ? prev : undefined),
    retry: false,
  })
  const current = !pushes.isError && !pushes.isPlaceholderData
  const rows = useMemo(() => (pushes.isError ? [] : (pushes.data ?? [])), [pushes.data, pushes.isError])
  const loading = pushes.isFetching && !pushes.data
  const full = current && mayHoldMore(rows.length, query.take)
  const next = moreTake(query.take)

  const drawer = drawerFromParams(params)
  const openDrawer = useCallback((next: Drawer) => setParams((prev) => withDrawer(prev, next), { replace: true }), [setParams])
  const openRef = useRef(openDrawer)
  useEffect(() => {
    openRef.current = openDrawer
  }, [openDrawer])

  const columns = useMemo(() => pushColumns(t, i18n.language, (row) => openRef.current({ kind: 'lines', pushId: row.pushId })), [t, i18n.language])
  const rowClassRules = useMemo<RowClassRules<Row>>(() => ({ [ROW_FAILED]: ({ data }) => data?.status === 'failed' }), [])

  return (
    <div className="flex flex-col gap-3">
      <ModeBanner />

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if ((store.trim() || null) === query.store && query.take === PUSHES_STEP) void pushes.refetch()
          else update({})
        }}
        data-pushes-filters=""
      >
        <Field label={t('filters.store')}>
          <Input value={store} dir="ltr" onChange={(e) => setStore(e.target.value)} placeholder={t('filters.storePlaceholder')} data-filter-store="" />
        </Field>
        <Field label={t('filters.type')}>
          <Select value={query.type ?? ''} onChange={(e) => update({ type: (e.target.value || null) as HybrisStockPushType | null })} data-filter-type="">
            <option value="">{t('filters.anyType')}</option>
            {PUSH_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(typeLabel(x))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.status')}>
          <Select value={query.status ?? ''} onChange={(e) => update({ status: (e.target.value || null) as HybrisStockPushStatus | null })} data-filter-status="">
            <option value="">{t('filters.anyStatus')}</option>
            {PUSH_STATUSES.map((x) => (
              <option key={x} value={x}>
                {t(statusLabel(x).key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.from')}>
          <Input type="date" value={query.from ?? ''} onChange={(e) => setDate('from', e.target.value)} data-filter-from="" />
        </Field>
        <Field label={t('filters.to')}>
          <Input type="date" value={query.to ?? ''} onChange={(e) => setDate('to', e.target.value)} data-filter-to="" />
        </Field>
        <Button type="submit" disabled={pushes.isFetching} data-pushes-search="">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('filters.search')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStore('')
            // The filters go; an open drawer stays.
            setParams(withDrawer(new URLSearchParams(), drawerFromParams(params)), { replace: true })
          }}
          data-pushes-clear=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.clear')}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground" data-pushes-note="">
        {t('note')}
      </p>

      {pushes.isError && <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(pushes.error, t('results.failed'))} />}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-26rem)] min-h-96" data-pushes-grid="">
          <AgGridReact<Row>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.pushId}
            rowClassRules={rowClassRules}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            suppressColumnVirtualisation
            loading={loading}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={pushes.isError}
          />
        </div>
        {!pushes.isError && (
          <div
            className="flex h-8 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-status-bar=""
          >
            {loading ? (
              <span>{t('results.loading')}</span>
            ) : (
              <span data-status-count="">
                <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
              </span>
            )}
            {full && next !== null && (
              <Button className="ms-auto" variant="text" disabled={pushes.isFetching} onClick={() => update({ store: query.store, take: next })} data-pushes-more="">
                {t('results.more')}
              </Button>
            )}
            {full && next === null && (
              <span className="ms-auto" data-pushes-capped="">
                {t('results.capped', { n: fsi(figure(query.take)) })}
              </span>
            )}
          </div>
        )}
      </div>

      {drawer?.kind === 'lines' && (
        <PushLinesDrawer
          key={drawer.pushId}
          pushId={drawer.pushId}
          // The contract has no one-push read and the lines answer carries no header: the drawer's header
          // is the log row while the grid holds it; without one, the lines answer says whether it was swept.
          push={rows.find((r) => r.pushId === drawer.pushId) ?? null}
          onMaterial={(storeCode, materialNumber) => openDrawer({ kind: 'material', storeCode, materialNumber })}
          onClose={() => openDrawer(null)}
        />
      )}
      {drawer?.kind === 'material' && (
        <MaterialHistoryDrawer
          key={drawer.storeCode}
          storeCode={drawer.storeCode}
          materialNumber={drawer.materialNumber}
          onPick={(materialNumber) => openDrawer({ kind: 'material', storeCode: drawer.storeCode, materialNumber })}
          onPush={(pushId) => openDrawer({ kind: 'lines', pushId })}
          onClose={() => openDrawer(null)}
        />
      )}
    </div>
  )
}

function NoRows() {
  const { t } = useTranslation('hybris-stock-pushes')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
