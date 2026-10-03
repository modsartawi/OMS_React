import type { ICellRendererParams } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { rowTimelineNow, type TimelineStepKey } from '@/core/oms/timeline'
import { BdiCell } from '@/core/theme/grid-base'

/**
 * The dot and the word's ink per state (368 §3). *Cancellation requested* is 082's
 * `--fam-cancel-request` indigo, the Request cancellation command's own colour, because asking
 * is not doing; amber stays reserved for attention. *Cancelled* is danger red. Every word's ink
 * is one the contrast gate measures as text on `--card` (Delivered and Cancelled take the
 * `-800` inks for that); the dots are 3:1 graphics.
 */
const TONE: Record<TimelineStepKey, { ink: string; dot: string }> = {
  created: { ink: 'text-muted-foreground', dot: 'bg-ink-3' },
  ready: { ink: 'text-muted-foreground', dot: 'bg-ink-3' },
  out: { ink: 'text-primary', dot: 'bg-primary' },
  delivered: { ink: 'text-success-800', dot: 'bg-success' },
  requested: { ink: 'text-fam-cancel-request', dot: 'bg-fam-cancel-request' },
  cancelled: { ink: 'text-danger-800', dot: 'bg-danger' },
}

/**
 * The Status column's cell: a dot and the column's word. The word is the column's value (its
 * `valueGetter`), so sort, filter, Ctrl+C and the export read the same word, and it isolates
 * through the core base renderer.
 */
export function StatusCell(params: ICellRendererParams<DeliveryDocumentModel>) {
  if (!params.data) return null
  const key = rowTimelineNow(params.data)
  const tone = TONE[key]
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone.ink}`} data-status={key}>
      <span aria-hidden className={`inline-block size-[7px] shrink-0 rounded-full ${tone.dot}`} />
      <BdiCell {...params} />
    </span>
  )
}
