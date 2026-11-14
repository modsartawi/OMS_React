/**
 * The held report's filters (BackOffice ticket 3873). Pure, pinned by `held.test.ts`.
 *
 * The stores and the repairs' range are the door's (a change re-reads Stock Visibility); the falls-to-zero and source-type
 * filters only narrow the pairs already read. Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import type { HeldImpactPair, HeldImpactReportQuery } from '@/core/models/held-stock-report'
import { normalizeStores, realDay } from './shared'

/** The report's three sections, in its order: the repairs per day are its last line. */
export const HELD_TABS = ['pairs', 'sources', 'repairs'] as const
export type HeldTab = (typeof HELD_TABS)[number]

/** The screen's whole query, as its URL holds it. A blank repairs edge is the door's default (the last 7 days). */
export interface HeldFilters {
  tab: HeldTab
  stores: string
  repairsFrom: string
  repairsTo: string
  /** Only the pairs whose channels have stock today and would have none. */
  falling: boolean
  /** Only the pairs this picking source type holds on; `''` = every pair. */
  source: string
}

export const HELD_DEFAULTS: HeldFilters = { tab: 'pairs', stores: '', repairsFrom: '', repairsTo: '', falling: false, source: '' }

const dayParam = (params: URLSearchParams, key: string) => {
  const value = (params.get(key) ?? '').trim()
  return realDay(value) ? value : ''
}

/** The filters a URL describes; anything unknown reads as its default. */
export function heldFiltersFromParams(params: URLSearchParams): HeldFilters {
  const tab = params.get('tab') ?? ''
  return {
    tab: (HELD_TABS as readonly string[]).includes(tab) ? (tab as HeldTab) : 'pairs',
    stores: normalizeStores(params.get('stores') ?? ''),
    repairsFrom: dayParam(params, 'repairsFrom'),
    repairsTo: dayParam(params, 'repairsTo'),
    falling: params.get('falling') === '1',
    source: (params.get('source') ?? '').trim().toUpperCase(),
  }
}

/** The filters as their URL: `tab` (when not Pairs), then each non-default filter. */
export function heldFiltersToParams(filters: HeldFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'pairs') qs.set('tab', filters.tab)
  if (filters.stores) qs.set('stores', filters.stores)
  if (filters.repairsFrom) qs.set('repairsFrom', filters.repairsFrom)
  if (filters.repairsTo) qs.set('repairsTo', filters.repairsTo)
  if (filters.falling) qs.set('falling', '1')
  if (filters.source) qs.set('source', filters.source)
  return qs
}

/** What the report read sends: the stores (absent = the fleet) and the repairs' edges (absent = the door's default). */
export function heldQuery(filters: HeldFilters): HeldImpactReportQuery {
  return {
    ...(filters.stores ? { stores: filters.stores } : {}),
    ...(filters.repairsFrom ? { repairsFrom: filters.repairsFrom } : {}),
    ...(filters.repairsTo ? { repairsTo: filters.repairsTo } : {}),
  }
}

/** A pair's held units from one picking source type (the pick tables); a source holding nothing there is 0. */
export function unitsFrom(pair: Pick<HeldImpactPair, 'bySource'>, sourceType: string): number {
  return pair.bySource.filter((s) => s.sourceType === sourceType).reduce((n, s) => n + s.units, 0)
}

/** The pairs the Pairs tab shows, in the door's order: falls-to-zero, then the source type holding on it. */
export function pairsShown(pairs: readonly HeldImpactPair[], filters: HeldFilters): HeldImpactPair[] {
  return pairs.filter(
    (p) =>
      (!filters.falling || p.fallsToZero) &&
      (!filters.source || p.bySource.some((s) => s.sourceType === filters.source && s.units > 0)),
  )
}

/** The tiles, in the order they read: the fleet totals, then the check's repairs over the range. */
export const HELD_TILES = ['pairs', 'pairsFallingToZero', 'channelToday', 'held', 'takenOff', 'channelWithHeld', 'repairs'] as const
export type HeldTile = (typeof HELD_TILES)[number]
