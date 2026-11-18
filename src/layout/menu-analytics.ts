import { BadgeCheck, CalendarClock, ChartColumn, ChartColumnBig, FileText, Home, LayoutDashboard, Library, Trash2, Users, type LucideIcon } from 'lucide-react'
import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import { canViewAnalytics } from '@/core/analytics-access'
import { MY_SCHEDULES_OFFERED_KEY, mySchedulesOffered } from '@/features/analytics/boards/access'
import { LIBRARY_PAGES, type LibraryMenuPage } from '@/features/analytics/boards/library-pages'
import type { MenuOffer, ShellMenuItem } from './menu-model'

/**
 * The Analytics nav group (spec 766 §F, ticket 767): `/analytics/*` is a new URL prefix and a new nav group,
 * so a new area folder (`features/analytics/`). `menu-model.ts` places it once; a later slice adds its leaf
 * HERE. Every label lives in `boards` (the area's first namespace, `menu.*`).
 *
 * 🚩 FAILS CLOSED: every leaf reads `canViewAnalytics` (`Analytics:03`) off the one permissions answer (oms 914) — the
 * SAME predicate as the pages' own `ScreenGate` — so a pending, errored or malformed answer hides the group.
 */

/**
 * 886 (BackOffice spec 3631 S30): "My schedules" is offered to any reader with the view grant — but only while the
 * personal-schedules doors answer: `ANALYTICS-424` (the switch off) hides it, and so does any other failure.
 */
const mySchedulesOffer: MenuOffer = {
  queryKey: MY_SCHEDULES_OFFERED_KEY,
  queryFn: () => mySchedulesOffered(),
}

const PAGE_ICON: Record<LibraryMenuPage, LucideIcon> = {
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
 * 839 (BackOffice spec 3437 §G): one leaf per library page, all on the one view grant. Each leaf lights only its own
 * page; Home keeps the whole `/analytics` subtree as its prefix, so an item page (`/analytics/board/:id`, `new`…)
 * lights Home and keeps the group open — the longer leaves win on their own pages (`markedLeaf`).
 */
export const ANALYTICS_MENU: ShellMenuItem = {
  labelKey: 'boards:menu.analytics',
  icon: ChartColumnBig,
  items: [
    ...LIBRARY_PAGES.map(({ page, path, labelKey }) => ({
      labelKey,
      icon: PAGE_ICON[page],
      routerLink: path,
      ...(page === 'home' ? { activePrefix: '/analytics' } : {}),
      requires: canViewAnalytics,
    })),
    // 886: last, after the library's leaves — it lists schedules, not items. Shown only while `mySchedulesOffer` says yes.
    {
      labelKey: 'boards:menu.mySchedules',
      icon: CalendarClock,
      routerLink: MY_SCHEDULES_PATH,
      requires: canViewAnalytics,
      offered: mySchedulesOffer,
    },
  ],
}
