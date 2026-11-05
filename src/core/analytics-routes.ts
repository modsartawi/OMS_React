/**
 * The analytics area's routes as strings (spec 766 §F): one place every caller builds an item's link from —
 * the analytics screens themselves, and the copilot, which links a view it made by route string only and never
 * imports the analytics feature (`.claude/rules/feature-structure.md`).
 */

export type AnalyticsItemKind = 'view' | 'board'

/** An item's page: `/analytics/view/:id` or `/analytics/board/:id`, its id escaped. */
export const itemHref = (kind: AnalyticsItemKind, id: string): string => `/analytics/${kind}/${encodeURIComponent(id)}`

/** A board's editor (777): `/analytics/board/:id/edit`. */
export const boardEditHref = (id: string): string => `${itemHref('board', id)}/edit`

/** A copilot report (CTO demo): its page, and its print page that saves as PDF. */
export const reportHref = (id: string): string => `/analytics/report/${encodeURIComponent(id)}`
export const reportPrintHref = (id: string): string => `/analytics/print/report/${encodeURIComponent(id)}`

/** The view editor, empty (775); a seed rides in route state (`newViewLink` in the boards feature). */
export const NEW_VIEW_PATH = '/analytics/new?kind=view'

/** The board editor on a new board (777). */
export const NEW_BOARD_PATH = '/analytics/new?kind=board'
