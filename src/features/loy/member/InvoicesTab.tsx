import { useMemo, useState } from 'react'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { Loader2, MailPlus, RotateCw } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { LoyInvoiceRow } from '@/core/models/loy'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { invoicesKey, loyReportsApi, memberCommandKey } from './api'
import { INVOICES_DEFAULT_COL_DEF, buildInvoiceColumns } from './invoice-columns'
import { resendOffered } from './invoice-resend'
import ResendInvoiceDialog from './ResendInvoiceDialog'

/**
 * What the Resend cell reads off the grid's `context`. 🚩 AG Grid reads `context` once,
 * at mount (`@initial`), so it carries only what cannot change under a mounted grid:
 * the member (the tab shell remounts per member) and a stable setter. The edit grant
 * is NOT here — it decides whether the column exists at all, which the grid follows.
 */
interface InvoicesGridContext {
  loyId: string
  onResend: (row: LoyInvoiceRow) => void
}

/**
 * The Invoices tab (ticket 428, spec 2443) — one row per **receipt** in the last 90
 * days, saying what happened to its invoice email and where it would go now, with a
 * **Resend** for a call-centre agent who holds the member edit grant.
 *
 * The three non-row states are the shell's, exactly as on Sales: lazy mount (only the
 * open tab is mounted), `staleTime: Infinity`, an inline `ErrorBanner` with a Retry
 * scoped to this tab, and a sentence of its own for the empty window.
 *
 * 🚩 **A look-only session sees every status and no action column at all** — the
 * column is absent, not a column of dead buttons (spec 2443 stories 20–21).
 */
export default function InvoicesTab({ loyId, mayEdit }: { loyId: string; mayEdit: boolean }) {
  const { t } = useTranslation('loy')
  const [resending, setResending] = useState<LoyInvoiceRow | null>(null)

  const invoices = useQuery({
    queryKey: invoicesKey(loyId),
    queryFn: () => loyReportsApi.invoices(loyId),
    staleTime: Infinity,
  })

  const rows = useMemo(() => invoices.data ?? [], [invoices.data])
  const columns = useMemo(
    () => buildInvoiceColumns(t, { actionCell: mayEdit ? ResendCell : null }),
    [t, mayEdit],
  )
  const context = useMemo<InvoicesGridContext>(() => ({ loyId, onResend: setResending }), [loyId])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('tabs.invoices.caption')}</p>

      {invoices.isPending ? (
        <div
          className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('tabs.invoices.loading')}
        </div>
      ) : invoices.isError ? (
        <ErrorBanner
          title={t('tabs.invoices.failed')}
          message={apiErrorMessage(invoices.error, t('common:errors.server'))}
          className="p-3"
        >
          <button
            type="button"
            onClick={() => invoices.refetch()}
            disabled={invoices.isFetching}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-danger-050 disabled:opacity-50"
          >
            <RotateCw className={'h-3 w-3 ' + (invoices.isFetching ? 'animate-spin' : '')} aria-hidden />
            {t('tabs.retry')}
          </button>
        </ErrorBanner>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('tabs.invoices.empty')}</p>
      ) : (
        <div className="h-[26rem]">
          <AgGridReact<LoyInvoiceRow>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={INVOICES_DEFAULT_COL_DEF}
            context={context}
            // The document type too: a sale and its return may share a receipt number,
            // and a duplicate id would silently drop one of them from the grid.
            getRowId={(p) => `${p.data.storeCode}|${p.data.trxNumber}|${p.data.documentType}`}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
          />
        </div>
      )}

      {resending && (
        <ResendInvoiceDialog loyId={loyId} receipt={resending} onClose={() => setResending(null)} />
      )}
    </div>
  )
}

/**
 * The Resend cell: a button on a receipt that offers it (`resendOffered`), nothing on
 * one that does not — the status and the Will go to cell (`notResendableText`) say why.
 *
 * 🚩 It reads the in-flight fact from the MUTATION CACHE (`useIsMutating`), as every
 * member command does, so a requeue in flight disarms every Resend on the tab, not
 * just the dialog that started it.
 */
function ResendCell(p: ICellRendererParams<LoyInvoiceRow>) {
  const { t } = useTranslation('loy')
  const ctx = p.context as InvoicesGridContext
  const busy = useIsMutating({ mutationKey: memberCommandKey(ctx.loyId, 'requeue-invoice') }) > 0
  // The column exists only for a session holding the edit grant (`buildInvoiceColumns`),
  // so this cell is never drawn for one that does not.
  if (!p.data || !resendOffered(p.data, true)) return null
  const row = p.data
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => ctx.onResend(row)}
      data-testid="loy-invoice-resend"
      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <MailPlus className="h-3.5 w-3.5" aria-hidden />
      {t('tabs.invoices.resend.action')}
    </button>
  )
}
