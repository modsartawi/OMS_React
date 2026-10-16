// The Stuck now tab's URL state, its door params and its `since` ordering (ticket 498, brief 2691
// "GET PickSupport/StuckNow"). Pure: no React, no `t`.

import type { PickSupportCensusParams, PickSupportCensusRow } from '@/core/models/pick-support'
import { readStamp } from '@/core/pick-support/diagnosis'
import { searchFromParams, searchToParams, type SearchQuery } from './resolve-view'

/** The census's two filters as held in the URL: the store the delivery sits at now, and a shape. */
export interface CensusFilter {
  store: string
  shape: string
}

/** The shape filter's "All" — never written to the URL, and dropped from the call. */
const ALL = 'ALL'

const shapeOf = (shape: string) => {
  const v = shape.trim()
  return v.toUpperCase() === ALL ? '' : v
}

export function censusFromParams(params: URLSearchParams): CensusFilter {
  return { store: (params.get('store') ?? '').trim(), shape: shapeOf(params.get('shape') ?? '') }
}

/**
 * The URL state → the door's params: a blank filter is dropped and "All" drops the shape. A shape
 * the client does not know is still sent — the server refuses it `PICK-00003`, with its code.
 */
export function censusQuery(filter: CensusFilter): PickSupportCensusParams {
  const store = filter.store.trim()
  const shape = shapeOf(filter.shape)
  return { ...(store ? { store } : {}), ...(shape ? { shape } : {}) }
}

export type PickSupportTab = 'search' | 'stuck'

/**
 * The whole page's URL state: the tab (`?tab=stuck`; Search is the default and writes nothing),
 * the Search tab's `?key=` / `?delivery=`, and the census's `?store=` / `?shape=`. One reading for
 * the page, so a write from one tab never drops the other's state.
 */
export interface PageQuery extends SearchQuery, CensusFilter {
  tab: PickSupportTab
}

export function pageFromParams(params: URLSearchParams): PageQuery {
  return {
    tab: params.get('tab') === 'stuck' ? 'stuck' : 'search',
    ...searchFromParams(params),
    ...censusFromParams(params),
  }
}

export function pageToParams(q: PageQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.tab === 'stuck') out.set('tab', 'stuck')
  for (const [k, v] of searchToParams(q)) out.set(k, v)
  for (const [k, v] of Object.entries(censusQuery(q))) out.set(k, v)
  return out
}

/** A `since` never written — `null`, blank, or the floor — reads as the dash (rule 6). */
const unwritten = (since: string | null | undefined) => readStamp(since) === null

/**
 * The census rows as shown: the server's order (oldest `since`, then delivery, then shape), with a
 * `since` that reads as the dash moved last. Stable on both sides; the list given is not changed.
 */
export function sortSince(rows: readonly PickSupportCensusRow[]): PickSupportCensusRow[] {
  return [...rows.filter((r) => !unwritten(r.since)), ...rows.filter((r) => unwritten(r.since))]
}

/**
 * The since column's header sort (AG Grid's `comparator`): written stamps compared as sent — local
 * wall-clock text, never parsed — and an unwritten one last in either direction. AG Grid reverses
 * the answer when descending, so "last" answers with the opposite sign there.
 */
export function compareSince(a: string | null | undefined, b: string | null | undefined, isDescending: boolean): number {
  const [na, nb] = [unwritten(a), unwritten(b)]
  if (na || nb) {
    if (na === nb) return 0
    const last = na ? 1 : -1
    return isDescending ? -last : last
  }
  const [va, vb] = [readStamp(a)!, readStamp(b)!]
  return va < vb ? -1 : va > vb ? 1 : 0
}
