/**
 * The fleet "Link health" page's pure logic (spec 4288, BackOffice 4295). No React, no network: pinned by
 * `link-health-helpers.test.ts`.
 *
 * 🚩 **One hour, one colour, everywhere.** A store-hour is coloured by the till drill-in's own rule (`tillHourCell`,
 * 4292): offline > unstable > blips > online, and an hour with no row is **no data**, never healthy. The door's cell is
 * a `LinkHour` in shape, so the same function reads both and the fleet grid cannot disagree with a till's history.
 *
 * The page notifies nobody: it is a read for L1 and the network team.
 */
import type {
  LinkHealthCell,
  LinkHealthCounts,
  LinkHealthLink,
  LinkHealthPeriod,
  LinkHealthStore,
  LinkHealthView,
} from '@/core/models/sync-console'
import { TILL_HOUR_LEGEND, tillHourCell, tillHourFigures, type TillHourLegendEntry } from './tills-helpers'

/** The legend under the grid: the drill-in's, every cell in order. */
export const LINK_HEALTH_LEGEND = TILL_HOUR_LEGEND

/** One store-hour as a grid cell, by the drill-in's rule. */
export function linkHealthCell(cell: LinkHealthCell | null): TillHourLegendEntry {
  return tillHourCell(cell)
}

export type LinkHealthFigures = {
  failPct: number
  slowPct: number
  p95Ms: number
  unstableMinutes: number
  offlineMinutes: number
  tillsReporting: number
  tillsAffected: number
}

/** The store-hour's numbers for its tooltip (minutes as the drill-in rounds them); `null` for no data. */
export function linkHealthFigures(cell: LinkHealthCell | null): LinkHealthFigures | null {
  const f = tillHourFigures(cell)
  if (!cell || !f) return null
  return {
    failPct: cell.failPct,
    slowPct: cell.slowPct,
    p95Ms: f.p95Ms,
    unstableMinutes: f.unstableMinutes,
    offlineMinutes: f.offlineMinutes,
    tillsReporting: cell.tillsReporting,
    tillsAffected: cell.tillsAffected,
  }
}

/**
 * "One till or the whole store": how many of the tills that reported that hour were unstable or offline. `null` when
 * none was (or no data). `whole` only when there was more than one till to be hit — a lone till reads "1 of 1".
 */
export function tillsReach(
  cell: LinkHealthCell | null,
): { labelKey: 'links.reach.some' | 'links.reach.whole'; affected: number; reporting: number } | null {
  if (!cell || cell.tillsAffected <= 0) return null
  const whole = cell.tillsReporting > 1 && cell.tillsAffected >= cell.tillsReporting
  return { labelKey: whole ? 'links.reach.whole' : 'links.reach.some', affected: cell.tillsAffected, reporting: cell.tillsReporting }
}

/** The badge looks back this many hours… */
export const CHRONIC_WINDOW = 8
/** …and is earned by this many of them unstable or offline ("unstable 6 of the last 8 hours"). */
export const CHRONIC_MIN = 4

const troubled = (cell: LinkHealthCell | null) => {
  const c = linkHealthCell(cell).cell
  return c === 'unstable' || c === 'offline'
}

/**
 * The "chronic" badge: unstable or offline in at least {@link CHRONIC_MIN} of the last {@link CHRONIC_WINDOW} hours
 * (fewer early in the day: `of` is the hours there are). Blips and no data are not trouble. `null` when not earned.
 */
export function chronicBadge(cells: readonly (LinkHealthCell | null)[]): { troubled: number; of: number } | null {
  const last = cells.slice(-CHRONIC_WINDOW)
  const count = last.filter(troubled).length
  return count >= CHRONIC_MIN ? { troubled: count, of: last.length } : null
}

/**
 * Worst first, as the door orders: most troubled hours, then most minutes offline, then the healthy stores, then the
 * stores with no data — never above a healthy one — each group by code.
 */
export function worstFirst(stores: readonly LinkHealthStore[]): LinkHealthStore[] {
  return [...stores].sort(
    (a, b) =>
      Number(a.noData) - Number(b.noData) ||
      b.troubledHours - a.troubledHours ||
      b.offlineMinutes - a.offlineMinutes ||
      (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
  )
}

export type HourSlot = { hour: string; cell: LinkHealthCell | null; future: boolean }
export type HourRow = { day: string; slots: HourSlot[] }

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The door's hours and one store's cells as day rows of 24 hours, oldest first: today is one row, 7 days is seven (a
 * day-by-hour strip, so a time-of-day pattern lines up). The hours not reached yet today are `future`: drawn empty,
 * never as no data. The door's hours start at local midnight.
 */
export function hourRows(hours: readonly string[], cells: readonly (LinkHealthCell | null)[]): HourRow[] {
  const rows: HourRow[] = []
  hours.forEach((hour, i) => {
    const day = hour.slice(0, 10)
    let row = rows[rows.length - 1]
    if (!row || row.day !== day) rows.push((row = { day, slots: [] }))
    row.slots.push({ hour, cell: cells[i] ?? null, future: false })
  })
  const last = rows[rows.length - 1]
  if (last)
    for (let h = last.slots.length; h < 24; h++) last.slots.push({ hour: `${last.day}T${pad(h)}:00:00`, cell: null, future: true })
  return rows
}

// ── BackOffice 4295, owner follow-up: find one store, or every store that needs attention ───────────────────────

/** Rows per page of the grid: the door pages, never the browser. */
export const LINK_HEALTH_PAGE_SIZE = 50

/** What the page asks the door for: the toggles, the search, the tile (view) and the page. */
export interface LinkHealthFilter {
  period: LinkHealthPeriod
  /**
   * Both links (the default: the fleet's "Link unstable" tile counts both, so the page it leads to does too), or one -
   * the telecom line and the store network read apart. A Both cell is the worse of the two links that store-hour: the
   * door keeps each hour's worst minutes, whichever link they were on.
   */
  link: LinkHealthLink
  q: string
  show: LinkHealthView
  page: number
}

export const DEFAULT_LINK_HEALTH_FILTER: LinkHealthFilter = { period: 'today', link: 'both', q: '', show: 'all', page: 1 }

/** The `GET ActionSync/Fleet/LinkHealth` parameters: search trimmed, page never below 1. */
export function linkHealthQuery(filter: LinkHealthFilter): Record<string, string | number> {
  return {
    period: filter.period,
    link: filter.link,
    q: filter.q.trim(),
    show: filter.show,
    page: Math.max(1, Math.floor(filter.page)),
    pageSize: LINK_HEALTH_PAGE_SIZE,
  }
}

/** A change to the filter: anything but the page itself goes back to page 1 (the old page may not exist any more). */
export function setLinkHealth(filter: LinkHealthFilter, patch: Partial<LinkHealthFilter>): LinkHealthFilter {
  if (Object.keys(patch).length === 1 && patch.page !== undefined) return { ...filter, page: patch.page }
  return { ...filter, ...patch, page: 1 }
}

/** A summary tile: picks its view; the chosen one again (or All) shows every store. Search is kept. */
export function toggleView(filter: LinkHealthFilter, view: LinkHealthView): LinkHealthFilter {
  return setLinkHealth(filter, { show: view === filter.show ? 'all' : view })
}

/** The door's reasons a store needs attention, as label keys with their count (0 where none is named). */
export function attentionReasons(
  store: Pick<LinkHealthStore, 'unstableTills' | 'chronic' | 'silentTills'>,
): { key: string; n: number }[] {
  const reasons: { key: string; n: number }[] = []
  if (store.unstableTills > 0) reasons.push({ key: 'links.reasons.unstableNow', n: store.unstableTills })
  if (store.chronic) reasons.push({ key: 'links.reasons.chronic', n: 0 })
  if (store.silentTills > 0) reasons.push({ key: 'links.reasons.silent', n: store.silentTills })
  return reasons
}

// ── Code review of spec 4288 ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Why the grid is empty, as its own sentence (finding 10): the search matched no store, the chosen view holds none, or
 * the fleet itself is empty. `counts.all` is the searched fleet (after `q`, before the view).
 */
export function linkHealthEmptyKey(
  filter: Pick<LinkHealthFilter, 'q' | 'show'>,
  counts: Pick<LinkHealthCounts, 'all'>,
): 'links.emptyText.search' | 'links.emptyText.view' | 'links.emptyText.fleet' {
  if (counts.all > 0) return 'links.emptyText.view'
  return filter.q.trim() ? 'links.emptyText.search' : 'links.emptyText.fleet'
}

/**
 * A page left past the end (the view shrank between two reads): the last page that exists, or `null` when the page is
 * fine. An empty view's only page is 1.
 */
export function clampLinkHealthPage(d: { page: number; pageSize: number; total: number }): number | null {
  const last = Math.max(1, Math.ceil(d.total / Math.max(1, d.pageSize)))
  return d.page > last ? last : null
}

/**
 * The label under a store's name (finding 9): no data; its troubled hours; "not reporting now" when a till has gone
 * silent or the current hour has no row yet although the store reported earlier; and "no trouble" only for a store that
 * is reporting and had none. The current hour is the last cell (the door's hours end at it).
 */
export function storeTotalsKey(
  store: Pick<LinkHealthStore, 'noData' | 'troubledHours' | 'silentTills' | 'cells'>,
): 'links.noData' | 'links.totals' | 'links.notReporting' | 'links.healthy' {
  if (store.noData) return 'links.noData'
  if (store.troubledHours > 0) return 'links.totals'
  const current = store.cells.length > 0 ? store.cells[store.cells.length - 1] : null
  if (store.silentTills > 0 || current == null) return 'links.notReporting'
  return 'links.healthy'
}
