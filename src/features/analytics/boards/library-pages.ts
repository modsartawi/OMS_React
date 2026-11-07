/**
 * The analytics library's pages (ticket 839, BackOffice spec 3437 §G) — pure: no React, no i18n.
 *
 * The Analytics menu has one leaf per page. Every page but Home and the Catalog is the library (`./library`)
 * narrowed by its route: the route FIXES who / kind / folder, and the other chips, the search and (on the "My"
 * pages) the folder rail still narrow inside it.
 */

import { choiceNarrows, DEFAULT_LIBRARY_CHOICE, libraryFromParams, libraryToParams, type LibraryChoice } from './library'

export type LibraryPage = 'home' | 'boards' | 'views' | 'reports' | 'shared' | 'certified' | 'catalog' | 'deleted'

export interface LibraryPageEntry {
  page: LibraryPage
  /** The route, `/analytics/…`. */
  path: string
  /** Its menu label and page title, in `boards`. */
  labelKey: string
}

/** The menu's order (3437 §G). */
export const LIBRARY_PAGES: readonly LibraryPageEntry[] = [
  { page: 'home', path: '/analytics', labelKey: 'boards:menu.home' },
  { page: 'boards', path: '/analytics/boards', labelKey: 'boards:menu.myBoards' },
  { page: 'views', path: '/analytics/views', labelKey: 'boards:menu.myViews' },
  { page: 'reports', path: '/analytics/reports', labelKey: 'boards:menu.myReports' },
  { page: 'shared', path: '/analytics/shared', labelKey: 'boards:menu.shared' },
  { page: 'certified', path: '/analytics/certified', labelKey: 'boards:menu.certified' },
  { page: 'catalog', path: '/analytics/catalog', labelKey: 'boards:menu.catalog' },
  { page: 'deleted', path: '/analytics/deleted', labelKey: 'boards:menu.deleted' },
]

export const libraryPagePath = (page: LibraryPage): string => LIBRARY_PAGES.find((p) => p.page === page)!.path

/**
 * What each route fixes. A "My" page: mine, of one kind (folders stay: one folder holds every kind). Shared with
 * me: shared and not mine. Certified: certified. Both list other people's items, so no folder (folders are mine).
 * Recently deleted: the deleted folder. Home and the Catalog fix nothing.
 */
const FIXED: Record<LibraryPage, Partial<Pick<LibraryChoice, 'who' | 'kind' | 'folder'>>> = {
  home: {},
  boards: { who: 'mine', kind: 'board' },
  views: { who: 'mine', kind: 'view' },
  reports: { who: 'mine', kind: 'report' },
  shared: { who: 'sharedWithMe', folder: 'all' },
  certified: { who: 'certified', folder: 'all' },
  catalog: {},
  deleted: { folder: 'deleted' },
}

/** The library choice on a page: its URL query read as before, then what the route fixes laid over it. */
export const pageChoice = (page: LibraryPage, params: URLSearchParams): LibraryChoice => ({ ...libraryFromParams(params), ...FIXED[page] })

/** The page's URL query: only what the route leaves open (the fixed fields are its path). */
export function pageToParams(page: LibraryPage, choice: LibraryChoice): URLSearchParams {
  return libraryToParams({ ...choice, ...openDefaults(page) })
}

/** The fixed fields at their defaults, so they neither count nor reach the query. */
const openDefaults = (page: LibraryPage): Partial<LibraryChoice> =>
  Object.fromEntries(Object.keys(FIXED[page]).map((k) => [k, DEFAULT_LIBRARY_CHOICE[k as keyof LibraryChoice]]))

/** Which chip groups and whether the folder rail a page shows: only what its route leaves open. */
export function pageShows(page: LibraryPage): { who: boolean; kind: boolean; rail: boolean } {
  const fixed = FIXED[page]
  return { who: !('who' in fixed), kind: !('kind' in fixed), rail: !('folder' in fixed) }
}

/** Whether the choice narrows anything the page leaves open (Clear shows; the empty words say "nothing matches"). */
export const pageNarrows = (page: LibraryPage, choice: LibraryChoice): boolean => choiceNarrows({ ...choice, ...openDefaults(page) })

/**
 * Each page's URL reading as a stable pair (`useUrlQuery` wants module-level functions): one per page, made once.
 */
const QUERIES = new Map<LibraryPage, { fromParams: (p: URLSearchParams) => LibraryChoice; toParams: (c: LibraryChoice) => URLSearchParams }>()
export function pageQuery(page: LibraryPage) {
  let q = QUERIES.get(page)
  if (!q) {
    q = { fromParams: (p) => pageChoice(page, p), toParams: (c) => pageToParams(page, c) }
    QUERIES.set(page, q)
  }
  return q
}

const MY_PAGE: Record<'board' | 'view' | 'report', LibraryPage> = { board: 'boards', view: 'views', report: 'reports' }
const isMyPage = (page: LibraryPage) => page === 'boards' || page === 'views' || page === 'reports'

/** The leaf a choice belongs on instead of `page`, or null when it belongs where it is. */
function leafFor(page: LibraryPage, c: LibraryChoice): LibraryPage | null {
  if (page !== 'home' && !isMyPage(page)) return null
  if (c.folder === 'deleted') return 'deleted'
  if (page !== 'home') return null
  if (c.who === 'sharedWithMe') return 'shared'
  if (c.who === 'certified') return 'certified'
  if (c.who === 'mine' && c.kind !== 'all') return MY_PAGE[c.kind]
  return null
}

/**
 * Where a library URL redirects (3437 story 14): an old `/analytics?who=…&kind=…` (and `folder=deleted`) to the
 * leaf that now holds that slice, carrying what the leaf leaves open; a My page's Recently deleted to its own
 * leaf. Null = stay. A choice no single leaf holds (`who=mine` of every kind, a kind alone) stays on Home.
 */
export function libraryRedirect(page: LibraryPage, params: URLSearchParams): string | null {
  const choice = pageChoice(page, params)
  const to = leafFor(page, choice)
  if (!to) return null
  const qs = pageToParams(to, choice).toString()
  return `${libraryPagePath(to)}${qs ? `?${qs}` : ''}`
}
