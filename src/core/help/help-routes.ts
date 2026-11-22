/**
 * The help center's routes as strings (oms 951, BackOffice spec 4182 §D): here, in core, so a page header, the Home
 * card and the copilot (952) link an article by route string and never import the help feature.
 *
 * An area's help sits under its own URL prefix — `/analytics/help` for the `analytics` area — so a later area reuses
 * the same feature at `/<area>/help`.
 */

/** The area's help center: `/analytics/help` (it opens `start`). */
export const helpPath = (area: string): string => `/${encodeURIComponent(area)}/help`

/** The article every help center opens on, and the drawer's fallback. */
export const HELP_START_SLUG = 'start'

/** One article, optionally at a heading: `/analytics/help/boards#share`. */
export const helpHref = (area: string, slug: string, anchor?: string): string =>
  `${helpPath(area)}/${encodeURIComponent(slug)}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`
