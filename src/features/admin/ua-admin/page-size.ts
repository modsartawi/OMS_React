/**
 * Rows a page on the Ua Users grid. NOT configurable: `MaxSearchRows` clamps
 * `take` *downward* server-side, so the only selectable range would be 25/50 —
 * not worth a control (ticket 143). The export walk (ticket 150) walks with this
 * same step.
 *
 * The arithmetic that consumes it lives in `@/core/ui/pager` (ticket 232); this
 * screen's own size stays with this screen.
 */
export const PAGE_SIZE = 50
