/**
 * An ended session as the Ended tab draws it (ticket 547; BackOffice 3015 + 3014). Pure: no React,
 * no `t`. Codes are `CodeWord`s from `@/core/prescription-session/words` (the end reason's words are
 * core because 548's write-off dialog says them too); the after-close lines are 544's
 * `afterCloseLine`, so an event reads exactly as it reads on Document Details.
 */
import type { PrescriptionSessionHqEndedRow } from '@/core/models/prescription-session'
import type { Severity } from '@/core/ui/severity'
import { afterCloseLine, stateSeverity, type AfterCloseLine } from '@/core/prescription-session/lines'
import { endReasonWord, routeWord, sourceWord, stateWord, type CodeWord } from '@/core/prescription-session/words'

export interface EndedRowView {
  state: CodeWord
  stateSev: Severity
  source: CodeWord
  route: CodeWord
  /** The end reason in words; `null` when the session ended without one (a plain close). */
  endReason: CodeWord | null
  /** Free text as written (trimmed); `null` when blank. */
  endNote: string | null
  /** Its business day ended dispensed and not invoiced — said even when it was invoiced later. */
  wasOwed: boolean
  /** Its sales in server order (its own, then any re-sale). */
  sales: string[]
  /** No sale at all: a write-off or an abandon. Read from the sales, the one fact `wasInvoiced` is made of. */
  neverInvoiced: boolean
  afterClose: AfterCloseLine[]
}

export function endedRow(r: PrescriptionSessionHqEndedRow): EndedRowView {
  const sales = (r.saleNos ?? []).filter((s) => !!s)
  const note = (r.endNote ?? '').trim()
  return {
    state: stateWord(r.state),
    stateSev: stateSeverity(r.state),
    source: sourceWord(r.sourceKind),
    route: routeWord(r.route),
    endReason: endReasonWord(r.state, r.endReason),
    endNote: note || null,
    wasOwed: !!r.invoiceOwedAt,
    sales,
    neverInvoiced: sales.length === 0,
    afterClose: (r.afterClose ?? []).map(afterCloseLine),
  }
}
