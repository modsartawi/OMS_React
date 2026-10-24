import {
  HUNGERSTATION_ORDERS_MAX_DAYS,
  HUNGERSTATION_ORDERS_TAKE,
  type HungerStationOrdersQuery,
  type HungerStationOutcomeFilter,
  type LocalDate,
} from '@/core/models/hungerstation'
import { addDays, windowProblem, type WindowProblem } from '@/core/util/date-window'

// The HungerStation orders monitor's search (spec 3028, ticket 556): the URL ⇄ query mapping and
// the date window rule. Pure: no React, no `t`.

/** One page of the list: the contract's default `take`. */
export const ORDERS_PAGE_SIZE = HUNGERSTATION_ORDERS_TAKE.default

/** The earliest day the door accepts (contract § Orders monitor). */
export const ORDERS_EARLIEST_DAY = '2000-01-01'

/** The `outcome` values the door takes: the four outcomes, then the two facts beside them. */
export const ORDER_OUTCOME_FILTERS: readonly HungerStationOutcomeFilter[] = [
  'created',
  'cancelled',
  'failed',
  'pending',
  'replacedLines',
  'unmatched',
]

/**
 * The window rule, checked before any call: both dates real, `from` ≤ `to`, at most 31 days both
 * counted, `from` not before 2000-01-01 and `to` not after TOMORROW (local) — exactly the door's
 * own 400 `HungerStationWindowInvalid`, which stays authoritative and still shows inline.
 */
export function ordersWindowProblem(query: Pick<HungerStationOrdersQuery, 'from' | 'to'>, today: LocalDate): WindowProblem | null {
  return windowProblem(query.from, query.to, {
    maxDays: HUNGERSTATION_ORDERS_MAX_DAYS,
    earliest: ORDERS_EARLIEST_DAY,
    latest: addDays(today, 1),
  })
}

/**
 * The page's query, read from its URL.
 *
 * - `from` / `to`: kept AS WRITTEN when present — an over-long window stays in the URL and is
 *   refused on screen, never clipped, and a cleared date stays empty (refused as `invalid`). Only a
 *   MISSING key is `today`.
 * - `outcome` is a repeated key, de-duplicated; a value the contract does not name is dropped
 *   (sending it would be a 400 `HungerStationFilterUnknown`).
 * - `skip` is a whole number ≥ 0; anything else reads as 0.
 */
export function ordersFromParams(params: URLSearchParams, today: LocalDate): HungerStationOrdersQuery {
  const text = (key: string) => {
    const v = params.get(key)?.trim()
    return v ? v : null
  }
  const day = (key: string) => (params.has(key) ? (params.get(key) ?? '').trim() : today)
  const outcomes = [...new Set(params.getAll('outcome').map((v) => v.trim()))].filter((o): o is HungerStationOutcomeFilter =>
    ORDER_OUTCOME_FILTERS.includes(o as HungerStationOutcomeFilter),
  )
  const skip = Number(params.get('skip'))
  return {
    from: day('from'),
    to: day('to'),
    store: text('store'),
    chain: text('chain'),
    outcome: outcomes,
    q: text('q'),
    skip: Number.isInteger(skip) && skip > 0 ? skip : 0,
    take: ORDERS_PAGE_SIZE,
  }
}

/**
 * The query as URL params. `from` and `to` are ALWAYS written (the door requires both); `outcome`
 * as repeated keys; `skip` only past the first page; `take` never (the page's constant).
 */
export function ordersToParams(query: HungerStationOrdersQuery): URLSearchParams {
  const out = new URLSearchParams()
  out.set('from', query.from)
  out.set('to', query.to)
  if (query.store) out.set('store', query.store)
  if (query.chain) out.set('chain', query.chain)
  for (const o of query.outcome) out.append('outcome', o)
  if (query.q) out.set('q', query.q)
  if (query.skip > 0) out.set('skip', String(query.skip))
  return out
}
