import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
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
import {
  ACR_SCOPE_PARAM,
  collectionsParamsFor,
  isAcrScoped,
  readAcrScope,
  withoutAcrScope,
} from './acr-scope'
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
import { buildReceiptActionColumn } from './RowActions'
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
  // 🚩 The APPLIED criteria, not the applied params: ticket 257 needs both branches
  // of the query built from one place (`collectionsParamsFor`), and a scope that
  // arrives has to leave the criteria it overrides untouched so that clearing it
  // restores them intact rather than re-deriving them.
  const [appliedCriteria, setAppliedCriteria] = useState<CollectionsCriteria>(() =>
    landingCriteria(today),
  )

  // ---- the `?acr=` drill-down (ticket 257) ----
  // 🚩 The URL is the scope's ONLY home — there is no `scopedAcr` state beside it.
  // That is what makes the view a shareable address: a reload, a paste into a
  // ticket and the Back button all reproduce it, and a copy could not drift from
  // it because there is no copy.
  const [searchParams, setSearchParams] = useSearchParams()
  const scopedAcrId = readAcrScope(searchParams)
  const scoped = isAcrScoped(scopedAcrId)

  // ⚠️ The scoped query carries `AcrId` and the cap and NOTHING else — the door
  // treats `AcrId` as an exclusive filter (see `acr-scope.ts`), which is why the
  // four inputs it overrides are disabled rather than merely ignored.
  const queryParams = useMemo(
    () => collectionsParamsFor(scopedAcrId, appliedCriteria),
    [scopedAcrId, appliedCriteria],
  )

  // The landing query IS the mount query — no `enabled`, no "click Load".
  const list = useQuery({
    queryKey: ['collection', 'collections', queryParams],
    queryFn: () => collectionApi.collections(queryParams),
  })

  const onChange = useCallback(
    (patch: Partial<CollectionsCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  const onSearch = useCallback(() => setAppliedCriteria(criteria), [criteria])
  const onReset = useCallback(() => {
    // Reset re-reads the clock: a screen left open overnight resets to the day
    // the supervisor is actually looking at, not the day they opened it.
    const now = new Date()
    const landing = landingCriteria(now)
    setToday(now)
    setCriteria(landing)
    setAppliedCriteria(landing)
    // ⚠️ Reset drops the ACR scope too, and `replace` keeps it out of the Back
    // stack. A Reset that left `?acr=` standing would restore criteria the door
    // still ignores — the toolbar saying today over a grid still showing one ACR.
    //
    // 🚩 Only when there is one to drop: an unscoped screen's Reset is a state
    // change, and issuing a navigation for it would put a history entry (and a
    // router re-render) behind a button that did not move the address.
    if (searchParams.has(ACR_SCOPE_PARAM))
      setSearchParams(withoutAcrScope(searchParams), { replace: true })
    // `searchParams` is read here rather than closed over stale: react-router hands
    // back a new instance on every navigation, so it belongs in the deps.
  }, [searchParams, setSearchParams])

  // The per-column filter row (the WPF's `ShowAutoFilterRow`) — ON by default.
  const [showFilters, setShowFilters] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const defaultColDef = useMemo(() => buildCollectionsDefaultColDef(showFilters), [showFilters])

  const rows = useMemo(() => list.data ?? [], [list.data])
  // The action column leads, and is composed here rather than folded into
  // `buildCollectionsColumns`: an action is not a wire field, and the field lists
  // carry a completeness proof that 258's export writes from (see `RowActions`).
  const columns = useMemo(
    () => [buildReceiptActionColumn(t), ...buildCollectionsColumns(t, rows, showMore)],
    [t, rows, showMore],
  )

  // "Filtered" is about the ISSUED query, not the draft: the chip's job is to say
  // that the grid is no longer showing today, and the grid shows the result of the
  // last Search. Reset is its ✕.
  const isFiltered = !isLandingQuery(buildCollectionsParams(appliedCriteria), today)
  const capReached = isCapReached(rows.length, COLLECTIONS_LIMIT)

  return (
    <>
      <CollectionsToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
        scopedAcrId={scopedAcrId}
        // The chip's ✕ is Reset: it drops the param AND restores today, so there
        // is one way back to the ordinary screen rather than two that differ.
        onClearScope={onReset}
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
          // ⚠️ …and under a scope it must not name the four controls the chip has
          // disabled. "Narrow the dates or the store" is advice a scoped screen
          // cannot take and the door would ignore anyway.
          message={t(scoped ? 'collections.capReachedScoped' : 'collections.capReached', {
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
        // ⚠️ A scoped view that comes back empty is an ACR with no collections
        // behind it, not an empty period — and the ordinary hint ("widen the
        // period, clear the store") names four controls the chip has disabled.
        <EmptyState
          title={scoped ? t('collections.empty.scopedTitle') : t('collections.empty.title')}
          hint={scoped ? t('collections.empty.scopedHint') : t('collections.empty.hint')}
        />
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
