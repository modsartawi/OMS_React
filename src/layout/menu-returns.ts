import { PackageOpen, Undo2 } from 'lucide-react'
// 4224 · the Parked returns screen's OWN grant (BackOffice 4218's seed, `ParkedReturns:03`)
import { canViewParkedReturns } from '@/features/returns/parked-returns/access'
// Type-only: `menu-model` imports this module, so a value import would be a cycle.
import type { ShellMenuItem } from './menu-model'

/**
 * The Returns nav group (BackOffice spec 4212, ticket 4224): `/returns/*` is a new URL prefix and a new nav group, placed
 * once in `menu-model.ts`. Every label lives in `parked-returns` (the area's first feature holds the area's words,
 * `menu.*`).
 *
 * Each leaf is gated on its own predicate of the one permissions answer — 🚩 FAILS CLOSED, and the group drops when no
 * leaf is visible. Each page stands behind its own `ScreenGate` reading the same predicate.
 */
export const RETURNS_MENU: ShellMenuItem = {
  labelKey: 'parked-returns:menu.group',
  icon: Undo2,
  items: [
    // 4224 · Parked returns (`/returns/parked`)
    {
      labelKey: 'parked-returns:menu.parked',
      icon: PackageOpen,
      routerLink: '/returns/parked',
      requires: canViewParkedReturns,
    },
  ],
}
