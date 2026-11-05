/**
 * The Order / ERX list's lenses (ticket 786, spec 3389): built-in views over the rows ALREADY
 * LOADED, so a lens never calls the server. The counting and its honest wording ("—", "12",
 * "500+") are `@/core/list/lens-count`; this file binds the order predicates. A count is returned
 * as its wording's key (`orders:lens.count.<key>`) and number, for the caller to render and
 * isolate once.
 */
import type { OrderDocumentRow } from '@/core/models/order-document'
import { lensKit, type LoadedResult as CoreLoadedResult } from '@/core/list/lens-count'

export { isCut, type CountWording, type RowPill } from '@/core/list/lens-count'

type Row = OrderDocumentRow

export type LensId = 'all' | 'bupaCareConnect' | 'noDelivery' | 'channel' | 'engine'

const PREDICATES: Record<LensId, (row: Row) => boolean> = {
  all: () => true,
  // Bupa Care Connect: the BUPA document type arriving from the ERX channel — both, not either.
  bupaCareConnect: (row) => row.documentType?.trim() === 'BUPA' && row.documentSource?.trim() === 'ERX',
  noDelivery: (row) => !row.deliveryNo?.trim(),
  // Whose money stands. Only an insurance order has one; the row's `moneySource` is null otherwise.
  channel: (row) => row.moneySource === 'CHANNEL',
  engine: (row) => row.moneySource === 'ENGINE',
}

/** The five lenses, in the views rail's order. */
export const LENS_IDS: readonly LensId[] = ['all', 'bupaCareConnect', 'noDelivery', 'channel', 'engine']

/** The rows the last search loaded, and the Limit it ran with. `null` = no search yet. */
export type LoadedResult = CoreLoadedResult<Row>

export const { lensMatches, lensCount, lensCounts, rowPill, lensIsEmpty } = lensKit(PREDICATES, LENS_IDS)
