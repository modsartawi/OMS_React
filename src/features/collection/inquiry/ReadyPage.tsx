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
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import ScreenGate from '@/core/ui/ScreenGate'
import { collectionAccessQuery } from '@/core/collection/api'
import { assignmentOptionsQuery, canOpenReady, collectionApi } from './api'
import { GRID_LIMIT, GRID_PAGE_SIZE, isCapReached } from './cap'
import { AttentionBanner, CapBanner, EmptyState, ListShimmer, ToggleChip } from './GridStates'
import { buildReadyColumns, buildReadyDefaultColDef } from './ready-columns'
import {
  buildReadyParams,
  hidesReceipts,
  isLandingQuery,
  landingCriteria,
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

  // `criteria` is the live toolbar draft; `appliedParams` is the query that has
  // actually been issued. Only Search/Reset promote one to the other.
  const [criteria, setCriteria] = useState<ReadyCriteria>(() => landingCriteria(options))
  const [appliedParams, setAppliedParams] = useState<Record<string, unknown>>(() =>
    buildReadyParams(landingCriteria(options)),
  )

  // The landing query IS the mount query — no `enabled`, no "click Load".
  const list = useQuery({
    queryKey: ['collection', 'ready', appliedParams],
    queryFn: () => collectionApi.ready(appliedParams),
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

  const onSearch = useCallback(() => setAppliedParams(buildReadyParams(criteria)), [criteria])
  const onReset = useCallback(() => {
    // Back to the LANDING scope (the caller's own branches), not to "no scope".
    const landing = landingCriteria(options)
    setCriteria(landing)
    setAppliedParams(buildReadyParams(landing))
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

  const isFiltered = !isLandingQuery(appliedParams, options)
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
          {hidesReceipts(appliedParams) ? t('ready.search.receiptsHidden') : ''}
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

      {list.isPending ? (
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
            {...omsGridDirection}
          />
        </div>
      ) : null}

      {/* A count's store day (ticket 321). Over the grid, never a route of its own. */}
      <SlipDrawer day={slips.drawerDay} onClose={slips.closeSlips} />
    </>
  )
}
