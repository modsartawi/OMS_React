import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Columns3, Filter } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { canOpenCollections, collectionApi } from './api'
import { GRID_PAGE_SIZE, isCapReached } from './cap'
import { buildCollectionsColumns, buildCollectionsDefaultColDef } from './collections-columns'
import {
  COLLECTIONS_LIMIT,
  buildCollectionsParams,
  isLandingQuery,
  landingCriteria,
  type CollectionsCriteria,
} from './collections-criteria'
import CollectionsToolbar from './CollectionsToolbar'
// These two were declared at the foot of this file at 254 and moved to their own
// module at 255, when they acquired a second and third caller (see `GridStates`).
import { CapBanner, EmptyState, ListShimmer, ToggleChip } from './GridStates'
import ScreenGate from './ScreenGate'

/**
 * Cash Collections (`/collection/collections`) — the first real screen of the
 * Collections area, and **the template 255 and 256 copy** (ticket 254).
 *
 * Templated on `features/pricing/bonus-buy-inquiry`: access gate → toolbar
 * producing a **criteria draft** that only Search/Reset promote to a query → AG
 * Grid → (later) row action and export. ⚠️ **Copied, not extracted** — there is no
 * shared inquiry shell in `core/`, because the abstraction would be designed
 * before four screens exist to prove it and a feature may not import a feature
 * (244 §1).
 *
 * Three things it does that BBY does not, each argued rather than inherited:
 *
 * 1. **It lands loaded.** From/To default to today and the query fires on mount,
 *    so "what has come in today" is answered before anyone touches a control
 *    (244 §4).
 * 2. **It pages in the browser at 50** over the whole matched result, so sort,
 *    per-column filter and 258's export all see every row (244 §3).
 * 3. **Its floating filter row is ON by default**, deliberately inverting BBY's
 *    default (244 §6).
 */
export default function CashCollectionsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      can={canOpenCollections}
      title={t('collections.title')}
      subtitle={t('collections.subtitle')}
    >
      {/* A child component, not inlined markup: its query must not run for a
          session the gate is about to refuse, and an element that is never
          rendered is never mounted. */}
      <CollectionsBody />
    </ScreenGate>
  )
}

function CollectionsBody() {
  const { t } = useTranslation('collection')

  // Today, read at mount and again on Reset — never on render. A screen left open
  // across midnight must not silently re-scope itself under a supervisor
  // mid-reconciliation, so Reset is the deliberate act that re-reads the clock.
  //
  // 🚩 It is STATE rather than a frozen ref because the "Filtered" chip is
  // measured against it: a `today` that stayed on yesterday would leave the chip
  // permanently lit after midnight, and its ✕ — which is Reset — unable to clear
  // it. The two have to move together.
  const [today, setToday] = useState(() => new Date())

  // `criteria` is the live toolbar draft; `appliedParams` is the query that has
  // actually been issued. Only Search/Reset promote one to the other — which is
  // what makes a half-typed store code unable to fire a request.
  const [criteria, setCriteria] = useState<CollectionsCriteria>(() => landingCriteria(today))
  const [appliedParams, setAppliedParams] = useState<Record<string, unknown>>(() =>
    buildCollectionsParams(landingCriteria(today)),
  )

  // The landing query IS the mount query — no `enabled`, no "click Load".
  const list = useQuery({
    queryKey: ['collection', 'collections', appliedParams],
    queryFn: () => collectionApi.collections(appliedParams),
  })

  const onChange = useCallback(
    (patch: Partial<CollectionsCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  const onSearch = useCallback(() => setAppliedParams(buildCollectionsParams(criteria)), [criteria])
  const onReset = useCallback(() => {
    // Reset re-reads the clock: a screen left open overnight resets to the day
    // the supervisor is actually looking at, not the day they opened it.
    const now = new Date()
    const landing = landingCriteria(now)
    setToday(now)
    setCriteria(landing)
    setAppliedParams(buildCollectionsParams(landing))
  }, [])

  // The per-column filter row (the WPF's `ShowAutoFilterRow`) — ON by default.
  const [showFilters, setShowFilters] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const defaultColDef = useMemo(() => buildCollectionsDefaultColDef(showFilters), [showFilters])

  const rows = useMemo(() => list.data ?? [], [list.data])
  const columns = useMemo(() => buildCollectionsColumns(t, rows, showMore), [t, rows, showMore])

  // "Filtered" is about the ISSUED query, not the draft: the chip's job is to say
  // that the grid is no longer showing today, and the grid shows the result of the
  // last Search. Reset is its ✕.
  const isFiltered = !isLandingQuery(appliedParams, today)
  const capReached = isCapReached(rows.length, COLLECTIONS_LIMIT)

  return (
    <>
      <CollectionsToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToggleChip
          icon={<Columns3 className="h-3.5 w-3.5" aria-hidden />}
          label={t('collections.toolbar.moreColumns')}
          pressed={showMore}
          onToggle={() => setShowMore((v) => !v)}
        />
        <ToggleChip
          icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
          label={t('collections.toolbar.filterRow')}
          pressed={showFilters}
          onToggle={() => setShowFilters((v) => !v)}
        />
      </div>

      {/* ⚠️ The one case where rows really ARE missing, said out loud. It fires on
          a result that REACHED the cap, never on one that is merely large. */}
      {/* Grouped — `2,000`, not `2000`. i18next interpolates a raw number as
          digits, and an ungrouped figure on the one screen whose whole point is
          grouped money reads as a different kind of number. */}
      {capReached && (
        <CapBanner
          message={t('collections.capReached', {
            limit: COLLECTIONS_LIMIT.toLocaleString('en-US'),
          })}
        />
      )}

      {list.isError && (
        <ErrorBanner
          message={apiErrorMessage(list.error, t('collections.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {list.isPending ? (
        <ListShimmer label={t('collections.loading')} />
      ) : rows.length === 0 && !list.isError ? (
        <EmptyState title={t('collections.empty.title')} hint={t('collections.empty.hint')} />
      ) : rows.length > 0 ? (
        <div className="min-h-[24rem] flex-1">
          <AgGridReact<(typeof rows)[number]>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            // Client-side paging over the WHOLE matched result. Community's own,
            // not a bespoke pager: sort and the per-column filter row apply to the
            // result set and the pager follows them, which is the entire reason
            // server paging was rejected.
            pagination
            paginationPageSize={GRID_PAGE_SIZE}
            paginationPageSizeSelector={false}
            {...omsGridDirection}
          />
        </div>
      ) : null}
    </>
  )
}
