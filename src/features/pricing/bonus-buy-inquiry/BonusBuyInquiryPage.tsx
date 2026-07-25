import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { GridApi, GridReadyEvent } from 'ag-grid-community'
import { Download, Filter, Loader2, PackageSearch, TriangleAlert } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import type { BbyInquiryRow } from '@/core/models/bonus-buy-inquiry'
import DetailModal from '@/core/bonus-buy/DetailModal'
import { bonusBuyAccessApi } from '@/core/bonus-buy/api'
import { bonusBuyInquiryApi } from './api'
import { buildListParams, type BbyListCriteria } from './list-params'
import { buildDefaultColDef, buildInquiryColumns } from './columns'
import SearchToolbar from './SearchToolbar'
import { exportBbyToCsv } from './export'

// The BBY Inquiry screen (spec 061). Self-guards on Bby/Access (issue-429 pattern,
// shared ['bonus-buy-inquiry','access'] key with the menu probe; FAIL-OPEN while the
// endpoint 404s — a read-only inquiry), then opens on the currently-active BBYs.
//
// Search (064) reaches beyond that default: the toolbar produces criteria, the pure
// `buildListParams` maps them to the Bby/List query (any number-or-date search clears
// Active-only), and re-querying shows the "filtered" chip. Reset restores the default.
// The cap-reached amber banner warns when the 1,000-row cap truncated the result, and
// date errors surface the server's message+code via `apiErrorMessage` (never "unexpected").
// Export CSV (065) writes the current filtered/sorted set — all 28 raw fields.
const EMPTY_CRITERIA: BbyListCriteria = {
  bbyNumber: '',
  validFrom: '',
  validTo: '',
  activeOnly: true,
}

// The active-only default query — the builder owns its exact shape, so "filtered" is
// simply "the applied query is not this" (rather than re-hardcoding `{activeOnly:true}`).
const DEFAULT_PARAMS = buildListParams({})

// The two malformed/reversed-date business codes Bby/List returns (contract 057); their
// server message is passed through, and the code drives a distinct "check the dates" title.
const DATE_ERROR_CODES = new Set(['INVALID_DATE_FORMAT', 'INVALID_DATE_RANGE'])

export default function BonusBuyInquiryPage() {
  const { t } = useTranslation('bonus-buy-inquiry')

  const access = useQuery({
    queryKey: ['bonus-buy-inquiry', 'access'],
    queryFn: () => bonusBuyAccessApi.access(),
  })

  // `criteria` is the live toolbar draft; `appliedParams` is the query that has actually
  // been issued (only Search/Reset promote the draft). Splitting them means typing in the
  // toolbar doesn't refetch on every keystroke — the operator commits with Search.
  const [criteria, setCriteria] = useState<BbyListCriteria>(EMPTY_CRITERIA)
  const [appliedParams, setAppliedParams] = useState<Record<string, unknown>>(() =>
    buildListParams({}),
  )

  const list = useQuery({
    queryKey: ['bonus-buy-inquiry', 'list', appliedParams],
    queryFn: () => bonusBuyInquiryApi.list(appliedParams),
    enabled: access.data?.screenAllowed === true,
  })

  const onChange = useCallback(
    (patch: Partial<BbyListCriteria>) => setCriteria((c) => ({ ...c, ...patch })),
    [],
  )
  const onSearch = useCallback(() => setAppliedParams(buildListParams(criteria)), [criteria])
  const onReset = useCallback(() => {
    setCriteria(EMPTY_CRITERIA)
    setAppliedParams(buildListParams({}))
  }, [])

  // "Filtered" = the applied query is anything other than the active-only default.
  const isFiltered = JSON.stringify(appliedParams) !== JSON.stringify(DEFAULT_PARAMS)

  // The per-column filter row (WPF `ShowAutoFilterRow`) is off by default and toggled
  // from the toolbar — rebuilding defaultColDef flips `floatingFilter` across columns.
  const [showFilters, setShowFilters] = useState(false)
  const defaultColDef = useMemo(() => buildDefaultColDef(showFilters), [showFilters])

  // Details ▸ opens the SAP-style modal (066). The selected BBY number drives a
  // Bby/Detail query inside DetailModal; `null` keeps it closed. Closing (✕ / Escape /
  // backdrop) clears the selection, landing back on the grid with its state intact —
  // the Page never unmounts the grid, so scroll/sort/filters survive (story 47).
  const [detailNumber, setDetailNumber] = useState<string | null>(null)
  const onDetails = useCallback((row: BbyInquiryRow) => setDetailNumber(row.bbyNumber), [])
  const onCloseDetail = useCallback(() => setDetailNumber(null), [])

  const columns = useMemo(() => buildInquiryColumns(t, onDetails), [t, onDetails])

  // Grid API captured on ready — the Export CSV button (065) walks it after filter+sort.
  const gridApiRef = useRef<GridApi<BbyInquiryRow> | null>(null)
  const onGridReady = useCallback((e: GridReadyEvent<BbyInquiryRow>) => {
    gridApiRef.current = e.api
  }, [])
  const onExport = useCallback(() => {
    if (gridApiRef.current) exportBbyToCsv(gridApiRef.current, t('export.filename'))
  }, [t])

  // --- access gate (spinner → denied → content) ---
  if (access.isPending) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (access.data?.screenAllowed !== true) {
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  const rows = list.data?.rows ?? []
  const capReached = list.data?.capReached === true

  return (
    <section className="flex h-full w-full flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              showFilters
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
            {t('toolbar.filterRow')}
          </button>
        </div>
      </header>

      <SearchToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        isFiltered={isFiltered}
      />

      {capReached && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('capReached')}</span>
        </div>
      )}

      {list.isError && (
        <ErrorBanner
          title={DATE_ERROR_CODES.has(apiErrorCode(list.error) ?? '') ? t('errors.dateTitle') : undefined}
          message={apiErrorMessage(list.error, t('errors.loadFailed'))}
          className="p-3"
        />
      )}

      {list.isPending ? (
        <ListShimmer label={t('loading')} />
      ) : rows.length === 0 && !list.isError ? (
        <EmptyState title={t('empty.title')} hint={t('empty.hint')} />
      ) : rows.length > 0 ? (
        <div className="min-h-[24rem] flex-1">
          <AgGridReact<(typeof rows)[number]>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            groupHeaderHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            {...omsGridDirection}
            onGridReady={onGridReady}
          />
        </div>
      ) : null}

      <DetailModal bbyNumber={detailNumber} onClose={onCloseDetail} />
    </section>
  )
}

/** Busy shimmer: a few pulsing placeholder rows so the screen reads as loading, not
 *  broken (story 26). */
function ListShimmer({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

/** No-results state — distinct from loading (story 25). */
function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
      <PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{title}</div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}
