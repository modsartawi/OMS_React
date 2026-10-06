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
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { buildAcrsColumns, buildAcrsDefaultColDef } from './acr-columns'
import {
  acrsParamsFor,
  buildAcrsParams,
  isLandingQuery,
  landingCriteria,
  sameQuery,
  type AcrsCriteria,
} from './acr-criteria'
import AcrsToolbar from './AcrsToolbar'
import ScreenGate from '@/core/ui/ScreenGate'
import { collectionAccessQuery } from '@/core/collection/api'
import { assignmentOptionsQuery, canOpenAcrs, canOpenCollections, collectionApi } from './api'
import type { AssignmentOptions } from './served-by'
import { GRID_LIMIT, GRID_PAGE_SIZE, isCapReached } from './cap'
import { useXlsxExport } from './use-xlsx-export'
import { CapBanner, EmptyState, ExportButton, ListShimmer, ToggleChip } from './GridStates'
import { buildAcrActionsColumn } from './RowActions'

/**
 * ACRs (`/collection/acrs`) — the accumulated collection receipts list (ticket
 * 255).
 *
 * A **variation on the template 254 settled**: the same access gate, the same
 * criteria draft that only Search/Reset promote, the same client paging at 50,
 * the same cap banner, the same More-columns toggle and the same floating filter
 * row on by default.
 *
 * 🚩 **It lands blank** (spec 2423, ticket 425 — Cash Collections' 423 seam,
 * copied). The 2026-09-27 today collection-date landing is gone, Served by keeps
 * its default, and **nothing is requested until Search**: the applied criteria
 * start as `null` and the query is enabled on them.
 *
 * ⚠️ **Copied, not extracted.** There is no shared inquiry shell in `core/` and
 * this Page does not import `CashCollectionsPage` — the abstraction would be
 * designed before the four screens exist to prove it, and a feature may not
 * import a feature (244 §1). Literal duplication of a *shape* is the ruling here.
 *
 * Two things are this screen's own:
 *
 * 1. **The segmented Status control**, replacing the WPF's `""`/`OPEN`/`CLOSED`
 *    radio group — and `All` sends nothing rather than the literal `"All"`.
 * 2. **No currency anywhere.** `AcrInquiryRow` carries no `currencyKey`, so the
 *    money headers state no code. See `acr-columns.ts`.
 *
 * Ticket 257 added the row's two ways out: `Form ▸` opens the printable ACR in a
 * **new tab**, `Collections ▸` walks to Cash Collections scoped to that ACR in the
 * **same** tab. Both are addresses rather than overlays — see `RowActions.tsx`.
 */
export default function AcrsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      query={collectionAccessQuery()}
      can={canOpenAcrs}
      ns="collection"
      title={t('acrs.title')}
      subtitle={t('acrs.subtitle')}
    >
      {/* A child component, not inlined markup: its query must not run for a
          session the gate is about to refuse, and an element that is never
          rendered is never mounted. */}
      <AcrsScope />
    </ScreenGate>
  )
}

/**
 * **Default-to-mine** (BackOffice 1165, reaching this screen with 1167): a collector
 * or a supervisor opens the ACRs list already scoped to the rounds they and their
 * team collected. An **accountant** opens it on the estate — they never collect, so
 * there is nothing here their own scope could hold.
 *
 * 🚩 **The body is not mounted until the roster answer has settled**, for 1165's
 * reason: the landing scope is the *initial state* of the draft. Since spec 2423 no
 * query fires on landing, but mounting first would still open the Served-by box on
 * "Everyone" and leave it there, so the first Search would ask for every collector's
 * ACRs on a screen that is supposed to open on the user's own.
 *
 * A failed or empty answer lands **unscoped** — the scope is a finding aid, never a
 * permission, and an unreachable roster must not lock anybody out of a screen they
 * are allowed to open.
 */
function AcrsScope() {
  const { t } = useTranslation('collection')
  const options = useQuery(assignmentOptionsQuery())

  // The picker in the toolbar reads this same cache entry, so the pair costs one
  // request rather than one each.
  if (options.isPending) return <ListShimmer label={t('acrs.loading')} />

  return <AcrsBody options={options.data} />
}

function AcrsBody({ options }: { options?: AssignmentOptions }) {
  const { t } = useTranslation('collection')

  // `criteria` is the live toolbar draft; `appliedCriteria` is what has actually
  // been searched. Only Search promotes one to the other.
  const [criteria, setCriteria] = useState<AcrsCriteria>(() => landingCriteria(options))
  // 🚩 **`null` until the first Search** (spec 2423): the open-blank landing. No
  // criteria applied is no query, and `acrsParamsFor` answers `null` for it.
  const [appliedCriteria, setAppliedCriteria] = useState<AcrsCriteria | null>(null)
  const appliedParams = useMemo(() => acrsParamsFor(appliedCriteria), [appliedCriteria])

  // Enabled on a query existing: the landing issues no request until Search.
  const list = useQuery({
    queryKey: ['collection', 'acrs', appliedParams],
    // Non-null by construction: `enabled` below is the same condition.
    queryFn: () => collectionApi.acrs(appliedParams!),
    enabled: appliedParams !== null,
  })

  // The SAME probe `ScreenGate` above already resolved — one key, ONE set of
  // options, one call, and react-query hands this second reader the cached
  // answer. It is here for the `Collections ▸` action only (257): this screen's
  // own admission is the gate's.
  const access = useQuery(collectionAccessQuery())

  const onChange = useCallback(
    (patch: Partial<AcrsCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  // 🚩 Search on an UNCHANGED draft re-asks the door. The open-blank landing made
  // Search the only way to load, so pressing it again to see what has come in since
  // must not be swallowed by an identical query key (Cash Collections' 423 rule).
  const { refetch } = list
  const onSearch = useCallback(() => {
    if (appliedParams !== null && sameQuery(buildAcrsParams(criteria), appliedParams)) {
      void refetch()
      return
    }
    setAppliedCriteria(criteria)
  }, [criteria, appliedParams, refetch])
  const onReset = useCallback(() => {
    // ⚠️ Reset returns to the UN-SEARCHED landing (spec 2423): the empty draft with
    // the LANDING scope, not "no scope", and nothing applied — so the grid goes back
    // to "press Search" and no request is issued. The chip's ✕ is this button.
    setCriteria(landingCriteria(options))
    setAppliedCriteria(null)
  }, [options])

  // The per-column filter row (the WPF's `ShowAutoFilterRow`) — ON by default.
  const [showFilters, setShowFilters] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const defaultColDef = useMemo(() => buildAcrsDefaultColDef(showFilters), [showFilters])

  const rows = useMemo(() => list.data ?? [], [list.data])
  // The two actions lead, composed here rather than folded into `buildAcrsColumns`:
  // an action is not a wire field, and the field lists carry a completeness proof
  // (see `RowActions`).
  //
  // ⚠️ `Collections ▸` is withheld from a session that cannot open Cash
  // Collections. The four grants are independent, so this is an ordinary ragged
  // session rather than a hypothesis — and it reads the SAME cached probe the gate
  // above already resolved, so it costs no second call.
  const columns = useMemo(
    () => [buildAcrActionsColumn(t, canOpenCollections(access.data)), ...buildAcrsColumns(t, showMore)],
    [t, access.data, showMore],
  )

  // "Filtered" is about the ISSUED query, not the draft: the chip's job is to say
  // that the grid is showing more than the empty landing's Search, and the grid
  // shows the result of the last Search. Before the first Search nothing was
  // issued, so there is no chip. Reset is its ✕.
  const isFiltered = appliedParams !== null && !isLandingQuery(appliedParams, options)
  const capReached = isCapReached(rows.length, GRID_LIMIT)

  // ---- the export (ticket 258; a workbook since 336) ----
  // The button's whole plumbing, shared by the four grids. This Page still
  // says WHICH screen it is; the file is its grid, as shown.
  const xlsxExport = useXlsxExport<(typeof rows)[number]>('acrs')

  return (
    <>
      <AcrsToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToggleChip
          icon={<Columns3 className="h-3.5 w-3.5" aria-hidden />}
          label={t('acrs.toolbar.moreColumns')}
          pressed={showMore}
          onToggle={() => setShowMore((v) => !v)}
        />
        <ToggleChip
          icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
          label={t('acrs.toolbar.filterRow')}
          pressed={showFilters}
          onToggle={() => setShowFilters((v) => !v)}
        />
        <ExportButton {...xlsxExport.buttonProps} />
      </div>

      {/* ⚠️ The one case where rows really ARE missing, said out loud. It fires on
          a result that REACHED the cap, never on one that is merely large. */}
      {capReached && (
        <CapBanner message={t('acrs.capReached', { limit: GRID_LIMIT.toLocaleString('en-US') })} />
      )}

      {list.isError && (
        <ErrorBanner
          message={apiErrorMessage(list.error, t('acrs.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {appliedParams === null ? (
        // Not an empty result: nothing has been asked yet. A disabled query is still
        // `isPending`, so this state is tested first or the shimmer would never end.
        <EmptyState title={t('acrs.landing.title')} hint={t('acrs.landing.hint')} />
      ) : list.isPending ? (
        <ListShimmer label={t('acrs.loading')} />
      ) : rows.length === 0 && !list.isError ? (
        <EmptyState title={t('acrs.empty.title')} hint={t('acrs.empty.hint')} />
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
            {...xlsxExport.gridProps}
            // Client-side paging over the WHOLE matched result. Community's own,
            // so sort and the per-column filter row apply to the result set and
            // the pager follows them.
            pagination
            paginationPageSize={GRID_PAGE_SIZE}
            paginationPageSizeSelector={false}
          />
        </div>
      ) : null}
    </>
  )
}
