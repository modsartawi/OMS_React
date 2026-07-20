import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Filter, Loader2, PackageSearch } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import type { BbyInquiryRow } from '@/core/models/bonus-buy-inquiry'
import { bonusBuyInquiryApi } from './api'
import { buildListParams } from './list-params'
import { buildDefaultColDef, buildInquiryColumns } from './columns'

// The BBY Inquiry tracer (spec 061, ticket 062). Self-guards on Bby/Access (the
// issue-429 pattern, shared ['bonus-buy-inquiry','access'] key with the menu probe;
// FAIL-OPEN while the endpoint 404s — a read-only inquiry), then opens on the
// currently-active BBYs: GET Bby/List with buildListParams({}) ⇒ { activeOnly: true },
// rendered newest-first into a minimal four-column grid with a loading shimmer and a
// no-results empty state. Full grid (063), search toolbar (064), export (065) and the
// Details modal (066) build out from this frontier.
export default function BonusBuyInquiryPage() {
  const { t } = useTranslation('bonus-buy-inquiry')

  const access = useQuery({
    queryKey: ['bonus-buy-inquiry', 'access'],
    queryFn: () => bonusBuyInquiryApi.access(),
  })

  // Default view: currently-active BBYs, no criteria. The pure builder owns the
  // params shape; the server orders CreatedAt DESC so rows arrive newest-first.
  const params = useMemo(() => buildListParams({}), [])
  const list = useQuery({
    queryKey: ['bonus-buy-inquiry', 'list', params],
    queryFn: () => bonusBuyInquiryApi.list(params),
    enabled: access.data?.screenAllowed === true,
  })

  // The per-column filter row (WPF `ShowAutoFilterRow`) is off by default and toggled
  // from the toolbar — rebuilding defaultColDef flips `floatingFilter` across columns.
  const [showFilters, setShowFilters] = useState(false)
  const defaultColDef = useMemo(() => buildDefaultColDef(showFilters), [showFilters])

  // Details ▸ opens the SAP-style modal — wired in slice 066. Here it renders and is
  // clickable per row; the handler is the seam that slice hooks into.
  const onDetails = useCallback((_row: BbyInquiryRow) => {
    // Placeholder until 066: the modal opens off this callback.
  }, [])

  const columns = useMemo(() => buildInquiryColumns(t, onDetails), [t, onDetails])

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

  return (
    <section className="flex h-full w-full flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-pressed={showFilters}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            showFilters
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/60 text-muted-foreground hover:bg-muted'
          }`}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          {t('toolbar.filterRow')}
        </button>
      </header>

      {list.isError && <ErrorBanner message={apiErrorMessage(list.error, t('errors.loadFailed'))} />}

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
            enableRtl={document.documentElement.dir === 'rtl'}
          />
        </div>
      ) : null}
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
