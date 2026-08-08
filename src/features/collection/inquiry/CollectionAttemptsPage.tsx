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
import { canOpenAttempts, collectionApi } from './api'
import { buildAttemptsColumns, buildAttemptsDefaultColDef } from './attempts-columns'
import {
  buildAttemptsParams,
  isLandingQuery,
  landingCriteria,
  type AttemptsCriteria,
} from './attempts-criteria'
import AttemptsToolbar from './AttemptsToolbar'
import { GRID_LIMIT, GRID_PAGE_SIZE, isCapReached } from './cap'
import { ATTEMPTS_CSV_COLUMNS } from './csv'
import { useCsvExport } from './use-csv-export'
import { CapBanner, EmptyState, ExportButton, ListShimmer, ToggleChip } from './GridStates'
import ScreenGate from './ScreenGate'

/**
 * Collection Attempts (`/collection/attempts`) — the smallest screen in the suite
 * (ticket 255): one flat list of visits that collected nothing, and the reason
 * given.
 *
 * A **variation on the template 254 settled** — same gate, same criteria draft,
 * same today-defaulted landing, same client paging at 50, same cap banner, same
 * More-columns toggle, same floating filter row on by default. ⚠️ **Copied, not
 * extracted** (244 §1).
 *
 * ⚠️ **No row action at all, and this is deliberate rather than unfinished.** The
 * WPF withholds one on purpose: a collection attempt is **immutable evidence**,
 * not a voucher — there is no document to open and nothing to do to it (244 §8,
 * spec 249 story 39). One is **not** added here for symmetry with the other three
 * screens, and a later slice that adds one to those three (257) leaves this one
 * alone.
 *
 * 🚩 **No money column either**, which is why this Page never touches
 * `@/core/money.ts`: an attempt collected nothing, by definition.
 */
export default function CollectionAttemptsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      can={canOpenAttempts}
      title={t('attempts.title')}
      subtitle={t('attempts.subtitle')}
    >
      {/* A child component, not inlined markup: its query must not run for a
          session the gate is about to refuse. */}
      <AttemptsBody />
    </ScreenGate>
  )
}

function AttemptsBody() {
  const { t } = useTranslation('collection')

  // Today, read at mount and again on Reset — never on render. State rather than
  // a frozen ref, because the "Filtered" chip is measured against it.
  const [today, setToday] = useState(() => new Date())

  // `criteria` is the live toolbar draft; `appliedParams` is the query that has
  // actually been issued. Only Search/Reset promote one to the other.
  const [criteria, setCriteria] = useState<AttemptsCriteria>(() => landingCriteria(today))
  const [appliedParams, setAppliedParams] = useState<Record<string, unknown>>(() =>
    buildAttemptsParams(landingCriteria(today)),
  )

  // The landing query IS the mount query — no `enabled`, no "click Load".
  const list = useQuery({
    queryKey: ['collection', 'attempts', appliedParams],
    queryFn: () => collectionApi.attempts(appliedParams),
  })

  const onChange = useCallback(
    (patch: Partial<AttemptsCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  const onSearch = useCallback(() => setAppliedParams(buildAttemptsParams(criteria)), [criteria])
  const onReset = useCallback(() => {
    // Reset re-reads the clock, so a screen left open overnight resets to the day
    // the supervisor is actually looking at.
    const now = new Date()
    const landing = landingCriteria(now)
    setToday(now)
    setCriteria(landing)
    setAppliedParams(buildAttemptsParams(landing))
  }, [])

  // The per-column filter row (the WPF's `ShowAutoFilterRow`) — ON by default.
  const [showFilters, setShowFilters] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const defaultColDef = useMemo(() => buildAttemptsDefaultColDef(showFilters), [showFilters])

  const rows = useMemo(() => list.data ?? [], [list.data])
  const columns = useMemo(() => buildAttemptsColumns(t, showMore), [t, showMore])

  const isFiltered = !isLandingQuery(appliedParams, today)
  const capReached = isCapReached(rows.length, GRID_LIMIT)

  // ---- the export (ticket 258) ----
  // The button's whole plumbing, shared by the four grids. This Page still
  // says WHICH screen it is and which columns the file holds.
  const csvExport = useCsvExport('attempts', ATTEMPTS_CSV_COLUMNS)

  return (
    <>
      <AttemptsToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToggleChip
          icon={<Columns3 className="h-3.5 w-3.5" aria-hidden />}
          label={t('attempts.toolbar.moreColumns')}
          pressed={showMore}
          onToggle={() => setShowMore((v) => !v)}
        />
        <ToggleChip
          icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
          label={t('attempts.toolbar.filterRow')}
          pressed={showFilters}
          onToggle={() => setShowFilters((v) => !v)}
        />
        <ExportButton {...csvExport.buttonProps} />
      </div>

      {/* ⚠️ Fires on a result that REACHED the cap, never on one merely large. */}
      {capReached && (
        <CapBanner
          message={t('attempts.capReached', { limit: GRID_LIMIT.toLocaleString('en-US') })}
        />
      )}

      {list.isError && (
        <ErrorBanner
          message={apiErrorMessage(list.error, t('attempts.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {list.isPending ? (
        <ListShimmer label={t('attempts.loading')} />
      ) : rows.length === 0 && !list.isError ? (
        <EmptyState title={t('attempts.empty.title')} hint={t('attempts.empty.hint')} />
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
            {...csvExport.gridProps}
            // ⚠️ No `onRowClicked`, no action column, no `rowSelection`. The
            // absence is the design — see the note on the Page above.
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
