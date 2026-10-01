import type { ICellRendererParams } from 'ag-grid-community'
import { FilePenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { hasChangeWaiting } from './entry-cells'

/**
 * **The entry number, and the *change waiting* mark beside it** (ticket 351, spec 342
 * W10) — one cell for every grid that draws a `Settlement/Ledger` row: the Ledger and
 * the open-settlement lanes (the entry tabs, Awaiting approval, Theft).
 *
 * 🔑 **On the handle, because the handle is what the request is about.** The mark rides
 * the number finance and the branch quote on the phone, so *"143 — the one with a
 * change waiting"* is one glance; a column of its own would be a column of blanks on
 * almost every row. The cell's value is still `entryNumber`, so the sort and the
 * number filter are untouched.
 *
 * ⚠️ **Only where the wire says so** — `hasChangeWaiting`, nothing re-decided here. The
 * cash-waiting tab's row is a receipt, not an entry, and carries no such field: it does
 * not use this cell.
 *
 * 🚩 **Not a button.** The row's own click already opens the entry's account, where the
 * pane says what is asked and by whom; a mark that also acted would need the
 * `data-row-action` escape and would be a second way into the same panel.
 */
export function EntryNumberCell(p: ICellRendererParams<{ entryNumber: number; openChangeRequestId?: string }>) {
  const { t } = useTranslation('settlement')
  if (!p.data) return null
  return (
    <span className="flex items-center gap-1.5">
      <span>{p.data.entryNumber}</span>
      {hasChangeWaiting(p.data) && (
        // The words are the mark's name for a screen reader and its tooltip for a
        // pointer — the icon alone would be a shape nobody was told the meaning of.
        <span
          role="img"
          aria-label={t('changeRequest.mark.label')}
          title={t('changeRequest.mark.title')}
          data-testid="change-waiting-mark"
          className="inline-flex text-primary"
        >
          <FilePenLine className="size-3.5" aria-hidden="true" />
        </span>
      )}
    </span>
  )
}
