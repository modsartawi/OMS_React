import { fromIsoDate, toIsoDate } from '@/core/util/date-format'
import { BLANK_QUERY, type QueryCriteria } from './query-model'

/**
 * The Deliveries list's URL entry (ticket 774, the prefactor for spec 766's drill to detail) — pure.
 * Another screen opens the list already filtered by linking to
 * `/oms/deliveries?store=<code>&from=<yyyy-MM-dd>&to=<yyyy-MM-dd>`. The page reads these once on
 * entry, runs that search, and clears them from the URL.
 *
 * The URL carries only what a saved view's bundle already holds (ruling 774): `store` is the bar's
 * Store code and `from`/`to` its Custom Date, so the search it opens is an ordinary `QueryCriteria`
 * that Save current view captures unchanged. No city: the list has no city criterion.
 */

export const URL_ENTRY_PARAMS = ['store', 'from', 'to'] as const

/** A real calendar day written `yyyy-MM-dd` (2026-02-30 is not one). */
const dayOf = (raw: string | null): string | null => {
  const day = raw?.trim() ?? ''
  const date = fromIsoDate(day)
  return date && toIsoDate(date) === day ? day : null
}

/** The search the URL asks for, or `null` when it asks for none. */
export function urlEntryQuery(params: URLSearchParams): QueryCriteria | null {
  const store = params.get('store')?.trim() || null
  const from = dayOf(params.get('from'))
  const to = dayOf(params.get('to'))
  const date = from && to && from <= to ? { preset: 'custom' as const, from, to } : null
  if (!store && !date) return null
  return { ...BLANK_QUERY, storeCode: store, date }
}
