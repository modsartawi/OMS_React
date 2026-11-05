import { ChartColumnBig, LayoutDashboard } from 'lucide-react'
import { ANALYTICS_ACCESS_KEY, analyticsAccessApi, canViewAnalytics } from '@/features/analytics/boards/access'
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

export const ANALYTICS_MENU: ShellMenuItem = {
  labelKey: 'boards:menu.analytics',
  icon: ChartColumnBig,
  items: [
    {
      // The home (767's empty state; 770's lists). The whole subtree, so a view or a board keeps it lit.
      labelKey: 'boards:menu.boards',
      icon: LayoutDashboard,
      routerLink: '/analytics',
      activePrefix: '/analytics',
      access: analyticsProbe,
    },
  ],
}
