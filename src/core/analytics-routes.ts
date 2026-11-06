/**
 * The analytics area's routes as strings (spec 766 §F): one place every caller builds an item's link from —
 * the analytics screens themselves, and the copilot, which links a view it made by route string only and never
 * imports the analytics feature (`.claude/rules/feature-structure.md`).
 */

export type AnalyticsItemKind = 'view' | 'board' | 'report'

/** An item's page: `/analytics/view/:id` or `/analytics/board/:id`, its id escaped. */
export const itemHref = (kind: AnalyticsItemKind, id: string): string => `/analytics/${kind}/${encodeURIComponent(id)}`

/** A board's editor (777): `/analytics/board/:id/edit`. */
export const boardEditHref = (id: string): string => `${itemHref('board', id)}/edit`

/** A query string (with or without its `?`) to append; nothing when empty. */
const withSearch = (search = ''): string => {
  const s = search.startsWith('?') ? search.slice(1) : search
  return s ? `?${s}` : ''
}

/**
 * A report (827, spec 819 §E): the runner's page, and its print page (A4, saves as PDF), each taking the
 * parameter values in its query string (the permalink's keys) — so a print carries the values on screen.
 */
export const reportHref = (id: string, search?: string): string => `${itemHref('report', id)}${withSearch(search)}`
export const reportPrintHref = (id: string, search?: string): string => `/analytics/print/report/${encodeURIComponent(id)}${withSearch(search)}`

/** 833: a report's kept runs, `/analytics/report/:id/runs` — the owner's, curators' and each run's own recipients'. */
export const reportRunsHref = (id: string): string => `${itemHref('report', id)}/runs`

/** The view editor, empty (775); a seed rides in route state (`newViewLink` in the boards feature). */
export const NEW_VIEW_PATH = '/analytics/new?kind=view'

/** The board editor on a new board (777). */
export const NEW_BOARD_PATH = '/analytics/new?kind=board'
