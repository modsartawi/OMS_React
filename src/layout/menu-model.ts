import type { LucideIcon } from 'lucide-react'
import { Box, FileText, ShieldCheck, UserCog } from 'lucide-react'

// Data-driven menu: adding a module = appending here, no layout code changes.
// labelKey is an i18n key (zero-literal rule).
export interface ShellMenuItem {
  labelKey: string
  icon?: LucideIcon
  routerLink?: string
  /** Keeps the leaf highlighted + group expanded while a drill-down under this prefix is open. */
  activePrefix?: string
  items?: ShellMenuItem[]
}

export const MENU: ShellMenuItem[] = [
  {
    labelKey: 'deliveries:menu.oms',
    icon: Box,
    items: [
      {
        labelKey: 'deliveries:menu.deliveries',
        icon: FileText,
        routerLink: '/oms/deliveries',
        activePrefix: '/oms',
      },
    ],
  },
  {
    labelKey: 'ua-admin:menu.admin',
    icon: ShieldCheck,
    items: [
      {
        labelKey: 'ua-admin:menu.users',
        icon: UserCog,
        routerLink: '/admin/ua-users',
        activePrefix: '/admin',
      },
    ],
  },
]

/** URL match: exact, or startsWith(prefix + '/'); query/hash already stripped by caller. */
export function isActive(item: ShellMenuItem, pathname: string): boolean {
  const target = item.activePrefix ?? item.routerLink
  if (!target) return false
  return pathname === target || pathname.startsWith(target + '/')
}
