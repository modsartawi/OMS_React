import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Download, Loader2 } from 'lucide-react'

import type { InvoiceCandidate } from '@/core/models/retail-invoice'

import { invoiceRowKey } from './invoice-key'

/**
 * The row action that puts the invoice PDF on the user's disk — the point of the
 * whole effort (ticket 265).
 *
 * 🚩 **Its own module and its own column, deliberately**, following
 * `collection/inquiry/RowActions.tsx`. `invoice-columns.ts` carries a
 * completeness proof — every wire field appears in exactly one of three named
 * groups — and an action is not a field. Folding it in would weaken the
 * assertion that catches a dropped field, for no gain. ⚠️ Copied, not imported:
 * a feature may not import a feature.
 *
 * ⚠️ **Never disabled, on any row.** The search returns cash clearances,
 * training receipts and suspended sales unfiltered and unflagged (owner ruling,
 * 988) and the sanctioned mitigation is a **confirm**, not a prevention — the
 * predicate that decides is `needsDownloadConfirm`, and it lives beside the
 * columns rather than here because it is a fact about the row, not about the
 * button. The only thing that disables this button is a download already running
 * for its own row.
 */

/** The key of the row currently rendering, or null when nothing is running. */
export interface DownloadActionState {
  pendingKey: string | null
  onDownload: (row: InvoiceCandidate) => void
}

/**
 * The action column. Never sortable, filterable or resizable: it holds no value,
 * only a way to get the receipt out of the row.
 */
export function buildDownloadActionColumn(
  t: TFunction,
  state: DownloadActionState,
): ColDef<InvoiceCandidate> {
  return {
    headerName: t('invoice.download.header'),
    colId: 'download',
    width: 150,
    sortable: false,
    filter: false,
    resizable: false,
    // 🚩 Pinned, and it is not decoration: the row is 13 columns wide and AG Grid
    // virtualises the ones off screen, so an unpinned action would be scrolled
    // out of existence on the only column anyone came for. `'right'` is AG Grid's
    // own axis and it mirrors with `enableRtl` (the same reason
    // `bonus-buy-inquiry` pins its identity column `'left'`), so this is the END
    // of the row in both directions — the logical-utility rule's intent, in the
    // vocabulary the widget offers.
    pinned: 'right',
    cellRenderer: (p: ICellRendererParams<InvoiceCandidate>) =>
      p.data ? <DownloadCell row={p.data} state={state} t={t} /> : null,
  }
}

function DownloadCell({
  row,
  state,
  t,
}: {
  row: InvoiceCandidate
  state: DownloadActionState
  t: TFunction
}) {
  // 🚩 Pending is per ROW, not per screen: a render takes 1.5–3 s warm and more
  // after a host recycle, and the rest of the screen stays usable throughout.
  const pending = state.pendingKey === invoiceRowKey(row)

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => state.onDownload(row)}
      // `ms/me` and never `ml/mr`: the app renders RTL and a physical utility is
      // silently wrong in Arabic while looking perfect in English.
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
      aria-label={t('invoice.download.actionAria', { trxNumber: row.trxNumber })}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Download className="h-3.5 w-3.5" aria-hidden />
      )}
      {pending ? t('invoice.download.pending') : t('invoice.download.action')}
    </button>
  )
}
