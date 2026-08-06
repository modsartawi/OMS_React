import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, RotateCw } from 'lucide-react'

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
import { loyReportsApi, salesKey } from './api'
import { SALES_DEFAULT_COL_DEF, buildSalesColumns } from './sales-columns'
import { cappedVolume } from './tab-volume'

/**
 * The Sales tab (ticket 237) — "what did they buy", in the shell 236
 * established.
 *
 * A row is **one sales line** — one item on one receipt — so a five-item basket
 * is five rows sharing a receipt number. That is the source's grain and the tab
 * does not roll it up: a basket total is not a thing this report can compute,
 * because it selects no exchange rate.
 *
 * Everything about the three non-row states is the shell's and is deliberately
 * identical to Activities' — same lazy mount, same `staleTime: Infinity`, same
 * inline `ErrorBanner` with a Retry scoped to this tab and no toast. Only the
 * **sentences** differ, and they differ on purpose: "no sales lines" and "no
 * loyalty activity" are different facts and an agent needs to know which one
 * they are looking at.
 *
 * 🚩 **The Retry is here on this tab's own evidence.** The likeliest real
 * failure on this read is a SQL timeout on a heavy member, arriving as a raw 500
 * with no envelope — transient, and often fine on a second attempt. Activities
 * inherited the Retry; Sales is what earned it.
 */
export default function SalesTab({ loyId }: { loyId: string }) {
  const { t } = useTranslation('loy')

  const sales = useQuery({
    queryKey: salesKey(loyId),
    queryFn: () => loyReportsApi.sales(loyId),
    staleTime: Infinity,
  })

  const rows = useMemo(() => sales.data ?? [], [sales.data])
  // 🚩 The columns depend on the ROWS, not just on `t` — the Currency column
  // appears iff this window holds more than one distinct currency, which is a
  // fact about the fetched lines and not about the member.
  const columns = useMemo(() => buildSalesColumns(t, rows), [t, rows])
  const volume = cappedVolume('sales', rows.length)

  return (
    <div className="flex flex-col gap-2">
      {/* The ceiling always; the warning when the window came back full. 🚩 A
          bare row count is never here — on a capped tab a count reads as
          completeness. */}
      <p className="text-xs text-muted-foreground">
        {t(volume.captionKey, { cap: volume.cap })}
        {volume.warningKey && (
          <span className="ms-1.5 font-medium text-attention-800">{t(volume.warningKey)}</span>
        )}
      </p>

      {sales.isPending ? (
        <div
          className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('tabs.sales.loading')}
        </div>
      ) : sales.isError ? (
        // Two sentences, as on Activities and for the same reason: the title is
        // this tab's own — it names WHAT could not be read, which is the half
        // only the client knows — and the message is the server's through
        // `apiErrorMessage` (api-envelope). On the realistic failure here, a raw
        // 500 from a report that timed out, the server half is the generic
        // sentence, because a crash carries no envelope to say anything better.
        <ErrorBanner
          title={t('tabs.sales.failed')}
          message={apiErrorMessage(sales.error, t('common:errors.server'))}
          className="p-3"
        >
          <button
            type="button"
            onClick={() => sales.refetch()}
            disabled={sales.isFetching}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-danger-050 disabled:opacity-50"
          >
            <RotateCw className={'h-3 w-3 ' + (sales.isFetching ? 'animate-spin' : '')} aria-hidden />
            {t('tabs.retry')}
          </button>
        </ErrorBanner>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('tabs.sales.empty')}</p>
      ) : (
        <div className="h-[26rem]">
          <AgGridReact<(typeof rows)[number]>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={SALES_DEFAULT_COL_DEF}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            {...omsGridDirection}
          />
        </div>
      )}
    </div>
  )
}
