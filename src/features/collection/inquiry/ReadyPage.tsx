import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Columns3, Filter } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { ApiError, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import ScreenGate from '@/core/ui/ScreenGate'
import { collectionAccessQuery } from '@/core/collection/api'
import { READY_GRID_KEY, assignmentOptionsQuery, canOpenReady, collectionApi } from './api'
import { GRID_LIMIT, GRID_PAGE_SIZE, isCapReached } from './cap'
import { AttentionBanner, CapBanner, EmptyState, ListShimmer, ToggleChip } from './GridStates'
import { buildReadyColumns, buildReadyDefaultColDef } from './ready-columns'
import {
  buildReadyParams,
  hidesReceipts,
  isLandingQuery,
  landingCriteria,
  readyParamsFor,
  sameQuery,
  type ReadyCriteria,
} from './ready-criteria'
import { readyRowId } from './ready-projection'
import ReadyToolbar from './ReadyToolbar'
import type { AssignmentOptions } from './served-by'
import SlipDrawer from './SlipDrawer'
import { useSlipView } from './use-slips'

/**
 * Ready for collection (`/collection/ready`, ticket 317) — every closed day the
 * collector has not taken and every settlement receipt a branch prepared and
 * nobody has collected yet, oldest first (BackOffice 1994).
 *
 * The siblings' template — same gate, same criteria draft, same client paging at
 * 50, same cap banner, same More-columns toggle and filter row — ⚠️ **copied, not
 * extracted** (244 §1).
 *
 * 🚩 **It lands blank** (spec 2423, ticket 424 — Cash Collections' 423 seam,
 * copied). Served by keeps its "mine" default and **nothing is requested until
 * Search**: the applied criteria start as `null` and the query is enabled on them.
 *
 * 🚩 **Read-only, with no act and no Z viewer.** No row action, no selection, no
 * total: a collector supervisor (BackOffice 1995) lands here and reaches nothing
 * that changes anything. A day leaves the list the moment it is collected or
 * declared collected outside the system; that happens elsewhere.
 */
export default function ReadyPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      query={collectionAccessQuery()}
      can={canOpenReady}
      ns="collection"
      title={t('ready.title')}
      subtitle={t('ready.subtitle')}
    >
      {/* A child component: its queries must not run for a session the gate refuses. */}
      <ReadyScope />
    </ScreenGate>
  )
}

/**
 * **Default-to-mine** (BackOffice 1165), as on Cash Collections: the body is not
 * mounted until the roster answer has settled, so the landing scope is the INITIAL
 * query rather than a second one after an estate-wide flash. A failed or empty
 * answer lands on the estate — the scope is a finding aid, never a permission.
 */
function ReadyScope() {
  const { t } = useTranslation('collection')
  const options = useQuery(assignmentOptionsQuery())
  if (options.isPending) return <ListShimmer label={t('ready.loading')} />
  return <ReadyBody options={options.data} />
}

function ReadyBody({ options }: { options?: AssignmentOptions }) {
  const { t } = useTranslation('collection')

  // `criteria` is the live toolbar draft; `appliedCriteria` is what has actually
  // been searched. Only Search promotes one to the other.
  const [criteria, setCriteria] = useState<ReadyCriteria>(() => landingCriteria(options))
  // 🚩 **`null` until the first Search** (spec 2423): the open-blank landing. No
  // criteria applied is no query, and `readyParamsFor` answers `null` for it.
  const [appliedCriteria, setAppliedCriteria] = useState<ReadyCriteria | null>(null)
  const appliedParams = useMemo(() => readyParamsFor(appliedCriteria), [appliedCriteria])

  // Enabled on a query existing: the landing issues no request until Search.
  const list = useQuery({
    queryKey: [...READY_GRID_KEY, appliedParams],
    // Non-null by construction: `enabled` below is the same condition.
    queryFn: () => collectionApi.ready(appliedParams!),
    enabled: appliedParams !== null,
  })

  const onChange = useCallback(
    (patch: Partial<ReadyCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  // ---- the slips (ticket 320, BackOffice 2034) ----
  // The probe, the "No slip" filter and the unavailable banner (`useSlipView`).
  const rows = useMemo(() => list.data?.rows ?? [], [list.data])
  const slips = useSlipView(rows, list.data?.slipCountsUnavailable)
  const { clearNoSlip } = slips

  // 🚩 Search on an UNCHANGED draft re-asks the door. The open-blank landing made
  // Search the only way to load, so pressing it again to see what is waiting now
  // must not be swallowed by an identical query key (Cash Collections' 423 rule).
  const { refetch } = list
  const onSearch = useCallback(() => {
    if (appliedParams !== null && sameQuery(buildReadyParams(criteria), appliedParams)) {
      void refetch()
      return
    }
    setAppliedCriteria(criteria)
  }, [criteria, appliedParams, refetch])
  const onReset = useCallback(() => {
    // ⚠️ Reset returns to the UN-SEARCHED landing (spec 2423): the empty draft with
    // the LANDING scope (the caller's own branches), not "no scope", and nothing
    // applied — so the grid goes back to "press Search" and no request is issued.
    setCriteria(landingCriteria(options))
    setAppliedCriteria(null)
    // …and the client filter with it.
    clearNoSlip()
  }, [options, clearNoSlip])

  const [showFilters, setShowFilters] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const defaultColDef = useMemo(() => buildReadyDefaultColDef(showFilters), [showFilters])

  const columns = useMemo(
    () => buildReadyColumns(t, rows, showMore, slips.showSlips, slips.openSlips),
    [t, rows, showMore, slips.showSlips, slips.openSlips],
  )

  // Before the first Search nothing was issued, so there is no chip.
  const isFiltered = appliedParams !== null && !isLandingQuery(appliedParams, options)
  const capReached = isCapReached(rows.length, GRID_LIMIT)

  // 🚩 A bare 403 from the door is the grant filter speaking — the probe said yes
  // but the door says no (a grant revoked mid-session, say). Said as a refusal
  // rather than as "unexpected error (HTTP 403)".
  const refused = list.error instanceof ApiError && list.error.statusCode === 403
  const errorMessage = refused
    ? t('ready.errors.refused')
    : apiErrorMessage(list.error, t('ready.errors.loadFailed'))

  return (
    <>
      <ReadyToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
        noSlip={slips.noSlip}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* 🚩 A business-date bound hides every prepared receipt (they cover no
            sales day). Said out loud, because a missing receipt otherwise reads as
            one that was collected. Reads the ISSUED query, not the draft. */}
        <p className="text-xs text-muted-foreground">
          {appliedParams !== null && hidesReceipts(appliedParams) ? t('ready.search.receiptsHidden') : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip
            icon={<Columns3 className="h-3.5 w-3.5" aria-hidden />}
            label={t('ready.toolbar.moreColumns')}
            pressed={showMore}
            onToggle={() => setShowMore((v) => !v)}
          />
          <ToggleChip
            icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
            label={t('ready.toolbar.filterRow')}
            pressed={showFilters}
            onToggle={() => setShowFilters((v) => !v)}
          />
        </div>
      </div>

      {/* ⚠️ Fires on a result that REACHED the cap, never on one merely large. */}
      {capReached && <CapBanner message={t('ready.capReached', { limit: GRID_LIMIT.toLocaleString('en-US') })} />}

      {slips.unavailable && <AttentionBanner message={t('slips.unavailable')} />}

      {list.isError && <ErrorBanner message={errorMessage} className="p-3" />}

      {appliedParams === null ? (
        // Not an empty result: nothing has been asked yet. A disabled query is still
        // `isPending`, so this state is tested first or the shimmer would never end.
        <EmptyState title={t('ready.landing.title')} hint={t('ready.landing.hint')} />
      ) : list.isPending ? (
        <ListShimmer label={t('ready.loading')} />
      ) : rows.length === 0 && !list.isError ? (
        <EmptyState title={t('ready.empty.title')} hint={t('ready.empty.hint')} />
      ) : rows.length > 0 ? (
        <div className="min-h-[24rem] flex-1">
          <AgGridReact<(typeof rows)[number]>
            theme={omsGridTheme}
            rowData={slips.gridRows}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            getRowId={(p) => readyRowId(p.data)}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            // ⚠️ No `onRowClicked`, no action column, no `rowSelection`: read-only by design.
            // The one control in a row is the Slips count, which opens the drawer (321).
            pagination
            paginationPageSize={GRID_PAGE_SIZE}
            paginationPageSizeSelector={false}
          />
        </div>
      ) : null}

      {/* A count's store day (ticket 321). Over the grid, never a route of its own. */}
      <SlipDrawer day={slips.drawerDay} onClose={slips.closeSlips} />
    </>
  )
}
