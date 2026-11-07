import { BadgeCheck, ChartColumn, ChartColumnBig, FileText, Home, LayoutDashboard, Library, Trash2, Users, type LucideIcon } from 'lucide-react'
import { ANALYTICS_ACCESS_KEY, analyticsAccessApi, canViewAnalytics } from '@/features/analytics/boards/access'
import { LIBRARY_PAGES, type LibraryPage } from '@/features/analytics/boards/library-pages'
import type { AccessProbe, ShellMenuItem } from './menu-model'

/**
 * The Analytics nav group (spec 766 §F, ticket 767): `/analytics/*` is a new URL prefix and a new nav group,
 * so a new area folder (`features/analytics/`). `menu-model.ts` places it once; a later slice adds its leaf
 * HERE. Every label lives in `boards` (the area's first namespace, `menu.*`).
 *
 * 🚩 FAILS CLOSED: every leaf reads `canView` off `GET Analytics/Access` — the SAME key, call and predicate
 * as the pages' own `ScreenGate` — so a pending, errored, absent or malformed probe hides the group.
 */
// Spelled as `accessProbe(...)` builds it, without importing that VALUE back from `./menu-model` (which imports
// this file): a type-only import keeps the two modules free of an evaluation cycle.
const analyticsProbe: AccessProbe = {
  key: ANALYTICS_ACCESS_KEY,
  run: () => analyticsAccessApi.access(),
  visible: (data) => canViewAnalytics(data as Parameters<typeof canViewAnalytics>[0]),
}

const PAGE_ICON: Record<LibraryPage, LucideIcon> = {
  home: Home,
  boards: LayoutDashboard,
  views: ChartColumn,
  reports: FileText,
  shared: Users,
  certified: BadgeCheck,
  catalog: Library,
  deleted: Trash2,
}

/**
 * 839 (BackOffice spec 3437 §G): one leaf per library page, all on the one probe. Each leaf lights only its own
 * page; Home keeps the whole `/analytics` subtree as its prefix, so an item page (`/analytics/board/:id`, `new`…)
 * lights Home and keeps the group open — the longer leaves win on their own pages (`markedLeaf`).
 */
export const ANALYTICS_MENU: ShellMenuItem = {
  labelKey: 'boards:menu.analytics',
  icon: ChartColumnBig,
  items: LIBRARY_PAGES.map(({ page, path, labelKey }) => ({
    labelKey,
    icon: PAGE_ICON[page],
    routerLink: path,
    ...(page === 'home' ? { activePrefix: '/analytics' } : {}),
    access: analyticsProbe,
  })),
}
