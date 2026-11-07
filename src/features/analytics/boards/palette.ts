import type { AnalyticsItem, AnalyticsLabel } from '@/core/models/analytics'
import { libraryItems, type LibraryFolder, type LibraryWho } from './library'

/**
 * The board editor's views palette (ticket 837 item 2) — pure: no React, no i18n. The views I can read, narrowed
 * by the library's who-chip and title search (`./library`), newest change first; a deleted view is never offered.
 */

/** The drag's data type: a view's id, dragged from the palette onto the editor's grid. */
export const VIEW_DRAG_TYPE = 'application/x-analytics-view'

export function paletteViews(
  items: readonly AnalyticsItem[],
  who: LibraryWho,
  search: string,
  me: string,
  today: string,
  fallbackTitle?: (i: AnalyticsItem) => AnalyticsLabel,
  folder: LibraryFolder = 'all',
): AnalyticsItem[] {
  return libraryItems(
    items.filter((i) => i.kind === 'view'),
    { who, kind: 'view', search, folder },
    me,
    today,
    fallbackTitle,
  )
}

/**
 * Whether a listed view came with its definition. `Analytics/Items` may list items without one (`readItems` then
 * reads an empty query); a view always has a measure, so an empty query means "fetch `Analytics/Item/{id}` first".
 */
export const definitionKnown = (item: AnalyticsItem): boolean => item.definition.query.measures.length > 0
