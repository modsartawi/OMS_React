import {
  HUNGERSTATION_MATERIALS_TAKE,
  type HungerStationMaterialRow,
  type HungerStationMaterialState,
  type HungerStationMaterialsPage,
  type HungerStationMaterialsQuery,
} from '@/core/models/hungerstation'

// The HungerStation materials page's search (spec 3028, ticket 555): the URL ⇄ query ⇄ door
// mapping and the server page's arithmetic. Pure: no React, no `t`.

/** One server page: the door's default `take` (1 to 500). */
export const MATERIALS_PAGE_SIZE: number = HUNGERSTATION_MATERIALS_TAKE.default

/** The door's `state` values, in the order the filter offers them — `active` is the default. */
export const MATERIAL_STATES: readonly HungerStationMaterialState[] = ['active', 'disabled', 'deleted', 'any']

/**
 * The page's query, read from its URL. A `state` the door does not know reads as `active` (sending
 * it would be a 400 `HungerStationFilterUnknown`); `skip` is a whole number ≥ 0, else 0.
 */
export function materialsFromParams(params: URLSearchParams): HungerStationMaterialsQuery {
  const state = params.get('state')
  const q = params.get('q')?.trim()
  const skip = Number(params.get('skip'))
  return {
    q: q ? q : null,
    state: MATERIAL_STATES.includes(state as HungerStationMaterialState) ? (state as HungerStationMaterialState) : 'active',
    skip: Number.isInteger(skip) && skip > 0 ? skip : 0,
    take: MATERIALS_PAGE_SIZE,
  }
}

/** The query as URL params: each default left out, `take` never (the page's constant). */
export function materialsToParams(query: HungerStationMaterialsQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.state !== 'active') out.set('state', query.state)
  if (query.q) out.set('q', query.q)
  if (query.skip > 0) out.set('skip', String(query.skip))
  return out
}

/** What the door is sent: `state`, `skip` and `take` always; `q` dropped by `buildQuery` when null. */
export function materialsDoorParams(query: HungerStationMaterialsQuery) {
  return { q: query.q, state: query.state, skip: query.skip, take: query.take }
}

/** Where a server page sits: its 1-based first and last row, and the `skip` of its neighbours. */
export interface MaterialsPage {
  first: number
  last: number
  total: number
  /** The previous page's `skip`, or `null` on the first page. */
  previous: number | null
  /** The next page's `skip`, or `null` on the last. */
  next: number | null
}

/**
 * The page an answer is. A page past the end (the list shrank under the user) shows nothing and
 * offers the last page there is, not the empty one before it.
 */
export function materialsPage(query: HungerStationMaterialsQuery, total: number, rowCount: number): MaterialsPage {
  const lastStart = total > 0 ? Math.floor((total - 1) / query.take) * query.take : 0
  return {
    first: rowCount > 0 ? query.skip + 1 : 0,
    last: rowCount > 0 ? query.skip + rowCount : 0,
    total,
    previous: query.skip > 0 ? Math.min(Math.max(0, query.skip - query.take), lastStart) : null,
    next: query.skip + rowCount < total && rowCount > 0 ? query.skip + query.take : null,
  }
}

/**
 * A server page with one material swapped for the row the change door returned, at its place —
 * the total untouched (a changed material stays on the page it is on until the next read). A page
 * that does not hold it is handed back as it was, so a cache update leaves it alone.
 */
export function withRow(page: HungerStationMaterialsPage | undefined, row: HungerStationMaterialRow): HungerStationMaterialsPage | undefined {
  if (!page || !page.rows.some((r) => r.materialNumber === row.materialNumber)) return page
  return { ...page, rows: page.rows.map((r) => (r.materialNumber === row.materialNumber ? row : r)) }
}
