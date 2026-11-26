import type { ExportMonthSource } from '@/core/inquiry-export/export-month'

/**
 * Cash Collections' **Export month…** request, read off the query the grid actually issued (BackOffice spec 4314,
 * ticket 4323). Pure, so the one rule that is this screen's own is tested rather than only observed:
 *
 * - The filters are the APPLIED params minus the grid's `Limit` and minus the collection-date pair: the job's range
 *   replaces that pair on the server, one collection day at a time. The pair pre-fills the dialog's range. Every other
 *   filter (business dates, store, Type, Amount, Stolen, Served by…) travels as the grid sent it.
 * - 🔑 **One ACR needs no range** (spec story 37). The `?acr=` drill-down sends `AcrId` and nothing else, and the server
 *   reads that whole ACR in one pass — as the grid does — so the dialog asks for no dates (`undated`).
 */
export function collectionsMonthFilters(
  params: Record<string, unknown> | null,
): Pick<ExportMonthSource, 'filters' | 'range' | 'undated'> {
  const { Limit: _limit, CollectionDateFrom, CollectionDateTo, ...filters } = params ?? {}
  const acr = typeof filters.AcrId === 'string' ? filters.AcrId.trim() : ''
  return {
    filters,
    range: { from: String(CollectionDateFrom ?? ''), to: String(CollectionDateTo ?? '') },
    undated: acr !== '',
  }
}
