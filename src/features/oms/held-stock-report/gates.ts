/**
 * The till-side gate figures' filters and grid rows (BackOffice ticket 3900, spec 3849 A). Pure, pinned by `gates.test.ts`.
 *
 * The stores and the last day are the door's (a change re-reads); "only stores not holding" narrows the stores already read.
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import type { GateFiguresQuery, StoreGateFigures } from '@/core/models/held-stock-report'
import { formatDay } from '@/core/util/date-format'
import { normalizeStores, realDay } from './shared'

/** The screen's whole query, as its URL holds it. A blank last day is the door's default (today). */
export interface GatesFilters {
  stores: string
  to: string
  /** Only the stores whose three gates do not all hold. */
  failing: boolean
}

export const GATES_DEFAULTS: GatesFilters = { stores: '', to: '', failing: false }

export function gatesFiltersFromParams(params: URLSearchParams): GatesFilters {
  const to = (params.get('to') ?? '').trim()
  return {
    stores: normalizeStores(params.get('stores') ?? ''),
    to: realDay(to) ? to : '',
    failing: params.get('failing') === '1',
  }
}

export function gatesFiltersToParams(filters: GatesFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.stores) qs.set('stores', filters.stores)
  if (filters.to) qs.set('to', filters.to)
  if (filters.failing) qs.set('failing', '1')
  return qs
}

/** What the read sends: the stores (absent = the fleet) and the last day (absent = today). */
export function gatesQuery(filters: GatesFilters): GateFiguresQuery {
  return {
    ...(filters.stores ? { stores: filters.stores } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }
}

/** One store as one grid row. */
export interface GateRow {
  store: string
  holds: boolean
  takesReported: number
  withinOneSecondPercent: number
  unansweredPercent: number
  takesHold: boolean
  deliveriesWithoutPick: number
  /** `yyyy-MM-dd: n` per day that had one, oldest first. */
  deliveryDays: string
  deliveriesHold: boolean
  tillsSeen: number
  /** The machine codes of the tills not heard on the hold seam. */
  tillsOnAnOldEngine: string
  tillsHold: boolean
}

export function gateRow(s: StoreGateFigures): GateRow {
  return {
    store: s.store,
    holds: s.holds,
    takesReported: s.takes.reported,
    withinOneSecondPercent: s.takes.withinOneSecondPercent,
    unansweredPercent: s.takes.unansweredPercent,
    takesHold: s.takes.holds,
    deliveriesWithoutPick: s.deliveriesWithoutPick.total,
    deliveryDays: s.deliveriesWithoutPick.days.map((d) => `${formatDay(d.day)}: ${d.count}`).join(', '),
    deliveriesHold: s.deliveriesWithoutPick.holds,
    tillsSeen: s.tills.seen.length,
    tillsOnAnOldEngine: s.tills.onAnOldEngine.join(', '),
    tillsHold: s.tills.holds,
  }
}

export function storesShown(stores: readonly StoreGateFigures[], failing: boolean): StoreGateFigures[] {
  return stores.filter((s) => !failing || !s.holds)
}

/** The tiles: the stores read, and how many of them hold all three gates. */
export const GATES_TILES = ['stores', 'holding', 'takesFailing', 'deliveriesFailing', 'tillsFailing'] as const
export type GatesTile = (typeof GATES_TILES)[number]

export function gatesTile(stores: readonly StoreGateFigures[], tile: GatesTile): number {
  switch (tile) {
    case 'stores':
      return stores.length
    case 'holding':
      return stores.filter((s) => s.holds).length
    case 'takesFailing':
      return stores.filter((s) => !s.takes.holds).length
    case 'deliveriesFailing':
      return stores.filter((s) => !s.deliveriesWithoutPick.holds).length
    case 'tillsFailing':
      return stores.filter((s) => !s.tills.holds).length
  }
}
