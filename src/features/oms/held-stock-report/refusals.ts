/**
 * The refusal report's day, filters and drill (BackOffice ticket 3873). Pure, pinned by `refusals.test.ts`.
 *
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import type {
  TakeRefusalGroup,
  TakeRefusalReport,
  TakeRefusalReportQuery,
  TakeRefusalRow,
} from '@/core/models/held-stock-report'
import { normalizeStores, realDay } from './shared'

export const REFUSAL_TABS = ['groups', 'rows', 'multiBatch', 'lastResort'] as const
export type RefusalTab = (typeof REFUSAL_TABS)[number]

/** Real refusals, a shadow store's would-be refusals, or `''` for both. */
export const REFUSAL_KINDS = ['', 'real', 'shadow'] as const
export type RefusalKind = (typeof REFUSAL_KINDS)[number]

/** The one group the Rows tab is narrowed to. A blank `batch` is the refusals that named none. */
export interface RefusalDrill {
  store: string
  material: string
  batch: string
  shadow: boolean
}

/** The screen's whole query, as its URL holds it. `day` is `''` for today (the door's default). */
export interface RefusalFilters {
  tab: RefusalTab
  day: string
  stores: string
  kind: RefusalKind
  drill: RefusalDrill | null
}

export const REFUSAL_DEFAULTS: RefusalFilters = { tab: 'groups', day: '', stores: '', kind: '', drill: null }

/**
 * The filters a URL describes; anything unknown reads as its default. The drill is on while `store` is present, so
 * `batch=` (blank) still names the group with no batch.
 */
export function refusalFiltersFromParams(params: URLSearchParams): RefusalFilters {
  const tab = params.get('tab') ?? ''
  const kind = (params.get('kind') ?? '').trim().toLowerCase()
  const day = (params.get('day') ?? '').trim()
  const store = (params.get('store') ?? '').trim().toUpperCase()
  return {
    tab: (REFUSAL_TABS as readonly string[]).includes(tab) ? (tab as RefusalTab) : 'groups',
    day: realDay(day) ? day : '',
    stores: normalizeStores(params.get('stores') ?? ''),
    kind: (REFUSAL_KINDS as readonly string[]).includes(kind) ? (kind as RefusalKind) : '',
    drill: store
      ? {
          store,
          material: (params.get('material') ?? '').trim(),
          batch: (params.get('batch') ?? '').trim(),
          shadow: params.get('shadow') === '1',
        }
      : null,
  }
}

/** The filters as their URL: `tab` (when not Groups), each non-blank filter, then the drill. */
export function refusalFiltersToParams(filters: RefusalFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'groups') qs.set('tab', filters.tab)
  if (filters.day) qs.set('day', filters.day)
  if (filters.stores) qs.set('stores', filters.stores)
  if (filters.kind) qs.set('kind', filters.kind)
  if (filters.drill) {
    qs.set('store', filters.drill.store)
    qs.set('material', filters.drill.material)
    qs.set('batch', filters.drill.batch)
    if (filters.drill.shadow) qs.set('shadow', '1')
  }
  return qs
}

/** What the report read sends: the day (absent = today) and the stores (absent = every open store). Kind, tab and drill are
 * the screen's own: they never re-read. */
export function refusalQuery(filters: RefusalFilters): TakeRefusalReportQuery {
  return {
    ...(filters.day ? { day: filters.day } : {}),
    ...(filters.stores ? { stores: filters.stores } : {}),
  }
}

const kindKeeps = (kind: RefusalKind, isShadow: boolean) => kind === '' || (kind === 'shadow') === isShadow

/** The groups the Groups tab shows, in the door's order: the kind filter only. */
export function groupsShown(groups: readonly TakeRefusalGroup[], filters: RefusalFilters): TakeRefusalGroup[] {
  return groups.filter((g) => kindKeeps(filters.kind, g.isShadow))
}

/** The filters after a group is opened: the Rows tab, narrowed to that store, material, batch and shadow. */
export function drillIntoGroup(
  filters: RefusalFilters,
  g: Pick<TakeRefusalGroup, 'store' | 'material' | 'batch' | 'isShadow'>,
): RefusalFilters {
  return { ...filters, tab: 'rows', drill: { store: g.store, material: g.material, batch: g.batch, shadow: g.isShadow } }
}

/**
 * The log rows the Rows tab shows, in the door's order: the drill's group (all four exact, so the group with no batch keeps
 * only the rows that named none), then the kind.
 */
export function rowsShown(rows: readonly TakeRefusalRow[], filters: RefusalFilters): TakeRefusalRow[] {
  const { drill, kind } = filters
  return rows.filter(
    (r) =>
      (!drill ||
        (r.store === drill.store && r.material === drill.material && r.batch === drill.batch && r.isShadow === drill.shadow)) &&
      kindKeeps(kind, r.isShadow),
  )
}

export interface RefusalTotals {
  /** Refusals at a live store. */
  refused: number
  /** A shadow store's would-be refusals: nothing was refused. */
  wouldRefuse: number
  groups: number
  multiBatchLines: number
  lastResortTakes: number
  storesUnreached: number
}

/** The tiles, in the order they read. */
export const REFUSAL_TILES: readonly (keyof RefusalTotals)[] = [
  'refused', 'wouldRefuse', 'groups', 'multiBatchLines', 'lastResortTakes', 'storesUnreached',
]

/** The day's tiles, from the door's groups and lists (never re-grouped here). */
export function refusalTotals(report: TakeRefusalReport): RefusalTotals {
  const sum = (shadow: boolean) => report.groups.filter((g) => g.isShadow === shadow).reduce((n, g) => n + g.count, 0)
  return {
    refused: sum(false),
    wouldRefuse: sum(true),
    groups: report.groups.length,
    multiBatchLines: report.multiBatchLines.reduce((n, l) => n + l.lines, 0),
    lastResortTakes: report.lastResortTakes.length,
    storesUnreached: report.storesUnreached.length,
  }
}
