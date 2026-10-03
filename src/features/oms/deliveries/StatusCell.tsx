import type { ICellRendererParams } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { rowTimelineNow } from '@/core/oms/timeline'
import { BdiCell } from '@/core/theme/grid-base'
import { STATUS_TONE } from './status-tone'

/**
 * The Status column's cell: a dot and the column's word. The word is the column's value (its
 * `valueGetter`), so sort, filter, Ctrl+C and the export read the same word, and it isolates
 * through the core base renderer.
 */
export function StatusCell(params: ICellRendererParams<DeliveryDocumentModel>) {
  if (!params.data) return null
  const key = rowTimelineNow(params.data)
  const tone = STATUS_TONE[key]
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone.ink}`} data-status={key}>
      <span aria-hidden className={`inline-block size-[7px] shrink-0 rounded-full ${tone.dot}`} />
      <BdiCell {...params} />
    </span>
  )
}
