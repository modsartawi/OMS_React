/**
 * The fleet list's query as it lives in the URL (BackOffice spec 2579, ticket 463). Pure, pinned
 * by `fleet-query.test.ts`.
 *
 * 🔑 **The URL is the single source of truth**, as on the Material search: a fleet view is a
 * shareable link. The page reads its query from the address with `fleetQueryFromParams` and writes
 * every change back with `fleetQueryToParams`.
 *
 * The URL's names ARE the door's (`GET SapExport/Fleet?label=&rail=&state=&q=&sort=&page=`), and
 * a list travels as a REPEATED key, never a joined one. Defaults (`sort=worst`, `page=1`, no rail,
 * a blank search) are left off the address. A value the door would refuse with `BAD_FILTER` is
 * dropped on the way in, so a hand-edited link never provokes it.
 */
import { FLEET_SORTS, RAILS, STATE_CODES, type FleetSort, type Label, type Rail, type StateCode } from '@/core/models/sap-export'
import { WORST_FIRST } from './label-helpers'

/** The door pages; the console asks for 50 a page (the contract's default). */
export const FLEET_PAGE_SIZE = 50

export interface FleetQuery {
  /** A REPEATED `label` (a store matches when it has ≥ 1 transaction with any of them). Worst first. */
  labels: Label[]
  /** A REPEATED `state`, in the contract's order. */
  states: StateCode[]
  /** `null` = either rail. */
  rail: Rail | null
  /** Contains-match on code or description; trimmed, `''` = none. */
  q: string
  sort: FleetSort
  page: number
}

export const DEFAULT_FLEET_QUERY: FleetQuery = { labels: [], states: [], rail: null, q: '', sort: 'worst', page: 1 }

/** The known values among `values`, each once, in `order`. */
const canonical = <T extends string>(order: readonly T[], values: readonly string[]): T[] => order.filter((v) => values.includes(v))

const PAGE = /^\d+$/

/** The query a URL describes. Anything unknown or malformed reads as its default. */
export function fleetQueryFromParams(params: URLSearchParams): FleetQuery {
  const rail = params.get('rail')
  const sort = params.get('sort')
  const page = params.get('page') ?? ''
  return {
    labels: canonical(WORST_FIRST, params.getAll('label')),
    states: canonical(STATE_CODES, params.getAll('state')),
    rail: (RAILS as readonly string[]).includes(rail ?? '') ? (rail as Rail) : null,
    q: (params.get('q') ?? '').trim(),
    sort: (FLEET_SORTS as readonly string[]).includes(sort ?? '') ? (sort as FleetSort) : 'worst',
    page: PAGE.test(page) && Number(page) >= 1 ? Number(page) : 1,
  }
}

/** The query as its URL, in the door's order: `label`, `rail`, `state`, `q`, `sort`, `page`; defaults absent. */
export function fleetQueryToParams(query: FleetQuery): URLSearchParams {
  const qs = new URLSearchParams()
  for (const label of canonical(WORST_FIRST, query.labels)) qs.append('label', label)
  if (query.rail) qs.set('rail', query.rail)
  for (const state of canonical(STATE_CODES, query.states)) qs.append('state', state)
  const q = query.q.trim()
  if (q) qs.set('q', q)
  if (query.sort !== 'worst') qs.set('sort', query.sort)
  if (query.page > 1) qs.set('page', String(query.page))
  return qs
}

/**
 * The `GET SapExport/Fleet` parameters. The lists are arrays, which `@/core/api`'s query builder
 * sends as repeated keys; a `null` rail and a blank search it drops. `sort` is always sent.
 */
export function fleetDoorParams(query: FleetQuery): Record<string, unknown> {
  return {
    label: query.labels,
    state: query.states,
    rail: query.rail,
    q: query.q.trim(),
    sort: query.sort,
    page: Math.max(1, query.page),
    pageSize: FLEET_PAGE_SIZE,
  }
}

/**
 * A rail, search or sort change, back on page 1. No change returns the SAME query, so a debounced
 * search that settles on what is already asked never moves the reader off their page.
 */
export function withFleetFilter(query: FleetQuery, change: Partial<Pick<FleetQuery, 'rail' | 'q' | 'sort'>>): FleetQuery {
  const next = { ...query, ...change }
  if (next.rail === query.rail && next.q.trim() === query.q.trim() && next.sort === query.sort) return query
  return { ...next, q: next.q.trim(), page: 1 }
}

/** A label in or out (a chip or a store tile), worst first, back on page 1. An unknown value changes nothing. */
export function toggleFleetLabel(query: FleetQuery, label: string): FleetQuery {
  if (!(WORST_FIRST as readonly string[]).includes(label)) return query
  const on = (query.labels as string[]).includes(label)
  return { ...query, labels: WORST_FIRST.filter((l) => (l === label ? !on : query.labels.includes(l))), page: 1 }
}

/** A state in or out (the picker), in the contract's order, back on page 1. An unknown value changes nothing. */
export function toggleFleetState(query: FleetQuery, state: string): FleetQuery {
  if (!(STATE_CODES as readonly string[]).includes(state)) return query
  const on = (query.states as string[]).includes(state)
  return { ...query, states: STATE_CODES.filter((s) => (s === state ? !on : query.states.includes(s))), page: 1 }
}

/** Whether any filter narrows the list (the sort and the page do not). */
export function isFilteredFleet(query: FleetQuery): boolean {
  return query.labels.length > 0 || query.states.length > 0 || query.rail !== null || query.q.trim() !== ''
}

/** Another page of the same query. */
export function withFleetPage(query: FleetQuery, page: number): FleetQuery {
  return { ...query, page: Math.max(1, page) }
}
