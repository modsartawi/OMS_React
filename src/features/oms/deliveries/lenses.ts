/**
 * Lenses (ticket 398, spec 380 L1, L2, L9; ruling 366): the built-in views of the Deliveries
 * list. A lens is a predicate over the rows ALREADY LOADED, so it never calls the server. The
 * counting and its honest wording ("—", "12", "200+") are `@/core/list/lens-count` (graduated at
 * ticket 786); this file binds the Deliveries predicates. A count is returned as its wording's key
 * (`deliveries:lens.count.<key>`) and number, for the caller to render and isolate once.
 */
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { lensKit, type LoadedResult as CoreLoadedResult } from '@/core/list/lens-count'

export { isCut, type CountWording, type RowPill } from '@/core/list/lens-count'

type Row = DeliveryDocumentModel

export type LensId = 'all' | 'attention' | 'cancelRequested' | 'dawaaNow' | 'rescheduled'

const PREDICATES: Record<LensId, (row: Row) => boolean> = {
  all: () => true,
  attention: (row) => (row.failedJobsCount ?? 0) > 0,
  // Close requested, which is final. A close (`C`, `X`) is not a request.
  cancelRequested: (row) => row.closeStatus === 'R',
  dawaaNow: (row) => row.isExpressDelivery === true,
  rescheduled: (row) => row.rescheduled === true,
}

/** The five lenses, in the views rail's order. */
export const LENS_IDS: readonly LensId[] = ['all', 'attention', 'cancelRequested', 'dawaaNow', 'rescheduled']

/** The rows the last search loaded, and the Limit it ran with. `null` = no search yet. */
export type LoadedResult = CoreLoadedResult<Row>

export const { lensMatches, lensCount, lensCounts, rowPill, lensIsEmpty } = lensKit(PREDICATES, LENS_IDS)
