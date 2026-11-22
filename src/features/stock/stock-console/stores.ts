/**
 * The Stores list's tiles, search and sort (oms 940, BackOffice spec 4157) — pure. The list comes whole (under a
 * thousand rows), so all three run in the browser; the page draws what these return.
 */
import type { StockConsoleStoreRow } from '@/core/models/stock-console'
import { STAGES } from '@/core/models/store-stage'

/** The tiles, in the prototype's order. Each counts the stores it filters to. */
export const STORE_TILES = ['all', 'counted', 'oldHold', 'sapQuiet', 'belowZero'] as const
export type StoreTile = (typeof STORE_TILES)[number]

const hasFlag = (row: StockConsoleStoreRow, code: string, level?: string) =>
  row.flags.some((f) => f.code === code && (level === undefined || f.level === level))

/**
 * Over the below-zero limit (spec 4157 story 7: "over 500 items below zero"). The server raises BelowZero at Problem
 * two ways: over its `BelowZeroProblem` setting (limit = that setting, 500 by default), or any item below zero in a
 * Blocking store (limit 0). Only the first is this tile's, read off the limit the server sent, not a fixed 500.
 */
const overBelowZeroLimit = (row: StockConsoleStoreRow) =>
  row.flags.some((f) => f.code === 'BelowZero' && f.limit > 0 && f.value != null && f.value > f.limit)

/** Whether a store is one its tile counts. Counted = a store whose stage counts (Seeded or Blocking). */
const IN_TILE: Record<StoreTile, (row: StockConsoleStoreRow) => boolean> = {
  all: () => true,
  counted: (r) => r.stage === 'Seeded' || r.stage === 'Blocking',
  oldHold: (r) => hasFlag(r, 'OldHold'),
  sapQuiet: (r) => hasFlag(r, 'SapQuiet'),
  belowZero: overBelowZeroLimit,
}

export function tileCounts(rows: readonly StockConsoleStoreRow[]): Record<StoreTile, number> {
  const counts = Object.fromEntries(STORE_TILES.map((t) => [t, 0])) as Record<StoreTile, number>
  for (const r of rows) for (const t of STORE_TILES) if (IN_TILE[t](r)) counts[t] += 1
  return counts
}

export function tileFilter(rows: readonly StockConsoleStoreRow[], tile: StoreTile): StockConsoleStoreRow[] {
  return rows.filter(IN_TILE[tile])
}

/** The figures the list sorts by, in the toolbar's order. The store code is the default. */
export const STORE_SORTS = [
  'plant',
  'city',
  'stage',
  'status',
  'tillStock',
  'sapStock',
  'gap',
  'held',
  'reserved',
  'free',
  'belowZero',
  'lastUpdate',
] as const
export type StoreSort = (typeof STORE_SORTS)[number]

/** Trouble, least first: a descending sort puts Problem on top. An unknown status reads as Watch. */
const STATUS_ORDER: Record<string, number> = { Ok: 0, Watch: 1, Problem: 2 }

type Key = number | string | null

const rank = (order: readonly string[], value: string) => {
  const i = order.indexOf(value)
  return i < 0 ? order.length : i
}

/** The value a row sorts on; null sorts last both ways (a reserved never computed is not a zero). */
const SORT_KEY: Record<StoreSort, (r: StockConsoleStoreRow) => Key> = {
  plant: (r) => r.plant,
  city: (r) => r.city,
  // The stages in the order a store moves through them; a stage the list does not name sorts after them.
  stage: (r) => rank(STAGES, r.stage),
  status: (r) => STATUS_ORDER[r.status] ?? STATUS_ORDER.Watch,
  tillStock: (r) => r.tillStock,
  sapStock: (r) => r.sapStock,
  gap: (r) => r.gap,
  held: (r) => r.held,
  reserved: (r) => (r.reservedState === 'NeverComputed' ? null : r.reserved),
  free: (r) => r.free,
  belowZero: (r) => r.belowZero,
  // Local wall-clock strings of one format: they order as text.
  lastUpdate: (r) => r.lastUpdate || null,
}

const compareKeys = (a: Key, b: Key): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/** A sorted copy of the list by one figure; ties by the store code, ascending. */
export function sortStores(rows: readonly StockConsoleStoreRow[], by: StoreSort, desc: boolean): StockConsoleStoreRow[] {
  const key = SORT_KEY[by]
  return [...rows].sort((x, y) => {
    const a = key(x)
    const b = key(y)
    if (a === null || b === null) {
      if (a !== b) return a === null ? 1 : -1
    } else {
      const c = compareKeys(a, b)
      if (c !== 0) return desc ? -c : c
    }
    return by === 'plant' ? 0 : compareKeys(x.plant, y.plant)
  })
}

/** What the Stores list keeps in its address, so a shared link opens the same view. */
export interface StoresQuery {
  tile: StoreTile
  q: string
  sortBy: StoreSort
  desc: boolean
}

export const DEFAULT_STORES_QUERY: StoresQuery = { tile: 'all', q: '', sortBy: 'plant', desc: false }

const oneOf = <T extends string>(list: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (list as readonly string[]).includes(value) ? (value as T) : fallback

export function storesFromParams(params: URLSearchParams): StoresQuery {
  return {
    tile: oneOf(STORE_TILES, params.get('tile'), DEFAULT_STORES_QUERY.tile),
    q: (params.get('q') ?? '').trim(),
    sortBy: oneOf(STORE_SORTS, params.get('sortBy'), DEFAULT_STORES_QUERY.sortBy),
    desc: params.get('desc') === '1',
  }
}

/** The defaults stay out of the address. */
export function storesToParams(query: StoresQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (query.tile !== DEFAULT_STORES_QUERY.tile) p.set('tile', query.tile)
  if (query.q) p.set('q', query.q)
  if (query.sortBy !== DEFAULT_STORES_QUERY.sortBy) p.set('sortBy', query.sortBy)
  if (query.desc) p.set('desc', '1')
  return p
}

/** What the grid shows: the tile's stores, searched, then sorted. The tiles themselves count the whole list. */
export function visibleStores(rows: readonly StockConsoleStoreRow[], query: StoresQuery): StockConsoleStoreRow[] {
  return sortStores(searchStores(tileFilter(rows, query.tile), query.q), query.sortBy, query.desc)
}

/** Stores whose code or city holds the search text, trimmed and case-insensitive; an empty search keeps them all. */
export function searchStores(rows: readonly StockConsoleStoreRow[], q: string): StockConsoleStoreRow[] {
  const needle = q.trim().toLocaleLowerCase()
  if (needle === '') return [...rows]
  return rows.filter(
    (r) => (r.plant ?? '').toLocaleLowerCase().includes(needle) || (r.city ?? '').toLocaleLowerCase().includes(needle),
  )
}
