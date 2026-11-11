import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type {
  RowDataUpdatedEvent,
  RowSelectionOptions,
  SelectionChangedEvent,
} from 'ag-grid-community'
import { Columns3, Filter } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { DepositInquiryRow } from '@/core/models/collection'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import ScreenGate from '@/core/ui/ScreenGate'
import { collectionAccessQuery } from '@/core/collection/api'
import { assignmentOptionsQuery, canOpenDeposits, collectionApi } from './api'
import type { AssignmentOptions } from './served-by'
import { GRID_LIMIT, GRID_PAGE_SIZE, isCapReached } from './cap'
import CollectorBalances from './CollectorBalances'
import { buildDepositsColumns, buildDepositsDefaultColDef } from './deposit-columns'
import {
  buildDepositsParams,
  depositsParamsFor,
  isLandingQuery,
  landingCriteria,
  sameQuery,
  type DepositsCriteria,
} from './deposit-criteria'
import DepositDetail from './DepositDetail'
import DepositsToolbar from './DepositsToolbar'
import { useXlsxExport } from './use-xlsx-export'
import { CapBanner, EmptyState, ExportButton, ListShimmer, ToggleChip } from './GridStates'

/**
 * Deposits (`/collection/deposits`) — the accountant's screen, and **the one in
 * the suite that is not a flat list** (ticket 256).
 *
 * It keeps 254's skeleton whole: the same access gate, the same criteria draft
 * that only Search promotes, the same open-blank landing as Cash Collections and
 * ACRs (spec 2423's ruling, reaching this screen later), the same client paging at 50, the same cap banner, the same More-columns toggle and the
 * same floating filter row on by default.
 *
 * ⚠️ **Copied, not extracted.** There is no shared inquiry shell in `core/` and
 * this Page does not import `CashCollectionsPage` — the abstraction would be
 * designed before the four screens exist to prove it, and a feature may not
 * import a feature (244 §1). Literal duplication of a *shape* is the ruling here.
 *
 * What is this screen's own is everything **below** the grid:
 *
 * 1. **The response is not a bare list.** `{ rows, balances }`, each row carrying
 *    its own `lines` and `attachments`. 🚩 Everything arrives in the one response,
 *    so no region costs a fetch — and there is deliberately no second call for
 *    the detail.
 * 2. **A detail region stacked in place**, following the selected row: its
 *    claimed-ACR lines with drift flagged, its slips as links. ⚠️ A modal was
 *    considered and rejected — drift a click away is drift taken on faith.
 * 3. **The per-collector balances**, in a collapsible panel labelled *POSTED
 *    only*.
 *
 * ⚠️ **No row action, and none is coming**: Deposit Inquiry has no printable
 * document — the WPF `DepositInquiry` folder has no form/printer pair — so
 * [257](../../../../.issues/257-a-row-opens-its-document.md) lands on the other
 * two screens and not on this one.
 */
export default function DepositsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      query={collectionAccessQuery()}
      can={canOpenDeposits}
      ns="collection"
      title={t('deposits.title')}
      subtitle={t('deposits.subtitle')}
    >
      {/* A child component, not inlined markup: its query must not run for a
          session the gate is about to refuse, and an element that is never
          rendered is never mounted. */}
      <DepositsScope />
    </ScreenGate>
  )
}

/**
 * **Default-to-mine** (BackOffice 1165, reaching this screen with 1168): a collector
 * or a supervisor opens Deposits already scoped to what they and their team banked.
 * An **accountant** opens it on the estate — they never collect and never bank, so
 * there is nothing here their own scope could hold.
 *
 * 🚩 **The body is not mounted until the roster answer has settled**, for 1165's
 * reason: the landing scope is the *initial state* of the draft. No query fires on
 * landing, but mounting first would still open the Served-by box on "Everyone" and
 * leave it there, so the first Search would ask for every collector's deposits on a
 * screen that is supposed to open on the user's own.
 *
 * A failed or empty answer lands **unscoped** — the scope is a finding aid, never a
 * permission, and an unreachable roster must not lock anybody out of a screen they
 * are allowed to open.
 */
function DepositsScope() {
  const { t } = useTranslation('collection')
  const options = useQuery(assignmentOptionsQuery())

  // The picker in the toolbar reads this same cache entry, so the pair costs one
  // request rather than one each.
  if (options.isPending) return <ListShimmer label={t('deposits.loading')} />

  return <DepositsBody options={options.data} />
}

/**
 * Single-row click selection, no checkbox column — the detail region below is
 * what the selection drives, so the row itself is the control.
 */
const DEPOSIT_ROW_SELECTION: RowSelectionOptions<DepositInquiryRow> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}

function DepositsBody({ options }: { options?: AssignmentOptions }) {
  const { t } = useTranslation('collection')

  // `criteria` is the live toolbar draft; `appliedCriteria` is what has actually
  // been searched. Only Search promotes one to the other.
  const [criteria, setCriteria] = useState<DepositsCriteria>(() => landingCriteria(options))
  // 🚩 **`null` until the first Search**: the open-blank landing. No criteria applied
  // is no query, and `depositsParamsFor` answers `null` for it.
  const [appliedCriteria, setAppliedCriteria] = useState<DepositsCriteria | null>(null)
  const appliedParams = useMemo(() => depositsParamsFor(appliedCriteria), [appliedCriteria])

  // Enabled on a query existing: the landing issues no request until Search. ONE
  // query for the whole screen: the grid, the detail region and the balances panel
  // all read this single result.
  const list = useQuery({
    queryKey: ['collection', 'deposits', appliedParams],
    // Non-null by construction: `enabled` below is the same condition.
    queryFn: () => collectionApi.deposits(appliedParams!),
    enabled: appliedParams !== null,
  })

  const onChange = useCallback(
    (patch: Partial<DepositsCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  // 🚩 Search on an UNCHANGED draft re-asks the door. The open-blank landing made
  // Search the only way to load, so pressing it again to see what has come in since
  // must not be swallowed by an identical query key (Cash Collections' 423 rule).
  const { refetch } = list
  const onSearch = useCallback(() => {
    if (appliedParams !== null && sameQuery(buildDepositsParams(criteria), appliedParams)) {
      void refetch()
      return
    }
    setAppliedCriteria(criteria)
  }, [criteria, appliedParams, refetch])
  const onReset = useCallback(() => {
    // ⚠️ Reset returns to the UN-SEARCHED landing: the empty draft with the LANDING
    // scope, not "no scope", and nothing applied — so the grid goes back to "press
    // Search" and no request is issued. The chip's ✕ is this button.
    setCriteria(landingCriteria(options))
    setAppliedCriteria(null)
  }, [options])

  // The per-column filter row (the WPF's `ShowAutoFilterRow`) — ON by default.
  const [showFilters, setShowFilters] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const defaultColDef = useMemo(() => buildDepositsDefaultColDef(showFilters), [showFilters])

  const rows = useMemo(() => list.data?.rows ?? [], [list.data])
  const balances = useMemo(() => list.data?.balances ?? [], [list.data])
  const columns = useMemo(() => buildDepositsColumns(t, showMore), [t, showMore])

  /**
   * Which deposit the detail region is following.
   *
   * 🚩 Held as the row's **ULID**, not as the row object: a re-query hands back
   * new object identities, and a stale object would leave the region showing a
   * deposit that is no longer in the result. Resolving by id each render means a
   * selection that survives a refetch survives it *correctly*, and one whose
   * deposit fell out of the new result resolves to nothing rather than to a ghost.
   *
   * ⚠️ It follows the grid's **actual** selection and never invents one. An
   * earlier shape defaulted the region to `rows[0]` without selecting that row,
   * which left the highlighted row and the detail region saying different things
   * the moment anyone sorted. The first row is *really* selected instead — see
   * `onRowDataUpdated`.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(
    () => rows.find((row) => row.depositId === selectedId) ?? null,
    [rows, selectedId],
  )

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<DepositInquiryRow>) => {
    // ⚠️ No fetch here, and none anywhere below the grid. `lines` and
    // `attachments` are already on the row — that is the whole point of the
    // `{ rows, balances }` shape, and a request on selection would undo it.
    //
    // A CTRL-click deselects, and that is honoured rather than swallowed: the
    // region then says "select a deposit", which is true. Pinning it to the last
    // selection would leave it describing a row the grid shows as unselected.
    const [row] = event.api.getSelectedRows()
    setSelectedId(row?.depositId ?? null)
  }, [])

  /**
   * Land on the first deposit **selected**, not merely described.
   *
   * The stacked region exists so that drift is visible without a click (244 §9),
   * so an empty panel on arrival would reintroduce exactly the click a modal was
   * rejected for. `onRowDataUpdated` rather than `onFirstDataRendered` because it
   * fires on every re-query too, so Search and Reset also land on a real row
   * instead of on the sentence.
   */
  const onRowDataUpdated = useCallback((event: RowDataUpdatedEvent<DepositInquiryRow>) => {
    if (event.api.getSelectedNodes().length > 0) return
    event.api.getDisplayedRowAtIndex(0)?.setSelected(true)
  }, [])

  // "Filtered" is about the ISSUED query, not the draft: the chip's job is to say
  // that the grid is showing more than the empty landing's Search, and the grid
  // shows the result of the last Search. Before the first Search nothing was
  // issued, so there is no chip. Reset is its ✕.
  const isFiltered = appliedParams !== null && !isLandingQuery(appliedParams, options)
  const capReached = isCapReached(rows.length, GRID_LIMIT)

  // ---- the export (ticket 258; a workbook since 336) ----
  // The button's whole plumbing, shared by the four grids. This Page still
  // says WHICH screen it is; the file is its grid, as shown.
  const xlsxExport = useXlsxExport<(typeof rows)[number]>('deposits')

  return (
    <>
      <DepositsToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToggleChip
          icon={<Columns3 className="h-3.5 w-3.5" aria-hidden />}
          label={t('deposits.toolbar.moreColumns')}
          pressed={showMore}
          onToggle={() => setShowMore((v) => !v)}
        />
        <ToggleChip
          icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
          label={t('deposits.toolbar.filterRow')}
          pressed={showFilters}
          onToggle={() => setShowFilters((v) => !v)}
        />
        <ExportButton {...xlsxExport.buttonProps} />
      </div>

      {/* ⚠️ The one case where rows really ARE missing, said out loud. It fires on
          a result that REACHED the cap, never on one that is merely large. */}
      {capReached && (
        <CapBanner
          message={t('deposits.capReached', { limit: GRID_LIMIT.toLocaleString('en-US') })}
        />
      )}

      {list.isError && (
        <ErrorBanner
          message={apiErrorMessage(list.error, t('deposits.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {appliedParams === null ? (
        // Not an empty result: nothing has been asked yet. A disabled query is still
        // `isPending`, so this state is tested first or the shimmer would never end.
        <EmptyState title={t('deposits.landing.title')} hint={t('deposits.landing.hint')} />
      ) : list.isPending ? (
        <ListShimmer label={t('deposits.loading')} />
      ) : rows.length === 0 && !list.isError ? (
        <EmptyState title={t('deposits.empty.title')} hint={t('deposits.empty.hint')} />
      ) : rows.length > 0 ? (
        <>
          <div className="min-h-[20rem] flex-1">
            <AgGridReact<DepositInquiryRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={defaultColDef}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              rowSelection={DEPOSIT_ROW_SELECTION}
              onSelectionChanged={onSelectionChanged}
              onRowDataUpdated={onRowDataUpdated}
              {...xlsxExport.gridProps}
              // Client-side paging over the WHOLE matched result. Community's own,
              // so sort and the per-column filter row apply to the result set and
              // the pager follows them.
              pagination
              paginationPageSize={GRID_PAGE_SIZE}
              paginationPageSizeSelector={false}
            />
          </div>

          {/* The two stacked regions, in the WPF's own order: the selected
              deposit's lines and slips, then the balances. Both out of the SAME
              response the grid is drawn from. */}
          <DepositDetail deposit={selected} />
          <CollectorBalances balances={balances} />
        </>
      ) : null}
    </>
  )
}
