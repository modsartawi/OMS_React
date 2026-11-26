import { toIsoDate } from '@/core/util/date-format'
import { buildDeliveryQuery } from './filter'
import { toFilterCriteria, type QueryCriteria } from './query-model'

/**
 * Export month… on the Delivery list (BackOffice spec 4314, ticket 4324): what the screen's last search sends the
 * export job. Pure — the toolbar only hands it to the shared split button.
 *
 * - `filters`: the APPLIED search (the last one that ran, not the draft), spelt as the grid's query string
 *   (`buildDeliveryQuery`), without `Limit` and without `FromDate`/`ToDate` — the job's range replaces them, one day of
 *   the delivery's entry time at a time. A document, order or delivery number stays a filter; the job still reads only
 *   the days of its range (the grid drops its dates for a number).
 * - `range`: the search's own dates (a relative one resolved against `now`, as the search did) pre-fill the dialog;
 *   `''` when the search had no date.
 *
 * The lens and the grid's column filters are not sent: they narrow the rows already in the browser, not the server's
 * read.
 */
export function deliveryExportMonth(
  query: QueryCriteria | null,
  now: Date,
): { filters: Record<string, unknown>; range: { from: string; to: string } } {
  if (!query) return { filters: {}, range: { from: '', to: '' } }
  const criteria = toFilterCriteria(query, now)
  const { Limit: _limit, FromDate: _from, ToDate: _to, ...filters } = buildDeliveryQuery(criteria)
  return {
    filters,
    range: {
      from: criteria.fromDate ? toIsoDate(criteria.fromDate) : '',
      to: criteria.toDate ? toIsoDate(criteria.toDate) : '',
    },
  }
}
