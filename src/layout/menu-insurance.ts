import { Route, Waypoints } from 'lucide-react'
// 924 · icons
import { FileClock, SlidersHorizontal } from 'lucide-react'
// 922 · the pattern screens' OWN grants (BackOffice 4053, guessed keys; the feature's `access` module is the one reading)
import { canOpenPatternCases } from '@/features/insurance/patterns/access'
// 924 · the manager's grant (BackOffice 4055, guessed key): the settings and the reveal log
import { canManagePatterns } from '@/features/insurance/patterns/access'
// Type-only: `menu-model` imports this module, so a value import would be a cycle.
import type { ShellMenuItem } from './menu-model'

/**
 * The Insurance nav group (oms 922, BackOffice spec 4050): `/insurance/*` is a new URL prefix and a new nav group, placed
 * once in `menu-model.ts` beside Insurance rules. Every label lives in `insurance-patterns` (the area's one feature holds
 * the area's words, `menu.*`).
 *
 * Each leaf is gated on its own predicate of the one permissions answer (oms 914) — 🚩 FAILS CLOSED, and the group drops
 * when no leaf is visible. Each page stands behind its own `ScreenGate` reading the same predicate.
 *
 * ⚠️ To keep parallel slices merge-clean: add your leaf under YOUR ticket's slot comment only.
 */
export const INSURANCE_MENU: ShellMenuItem = {
  labelKey: 'insurance-patterns:menu.group',
  icon: Waypoints,
  items: [
    // 922 · Pattern cases (`menu.cases`, `/insurance/patterns`; a case's screen `/insurance/patterns/:caseId` lights it)
    {
      labelKey: 'insurance-patterns:menu.cases',
      icon: Route,
      routerLink: '/insurance/patterns',
      requires: canOpenPatternCases,
    },

    // 924 · Pattern settings (`menu.settings`, `/insurance/patterns/settings`, `requires: canManagePatterns`). A static
    // leaf under `/insurance/patterns` is matched more specifically than the cases leaf, so it lights on its own.
    {
      labelKey: 'insurance-patterns:menu.settings',
      icon: SlidersHorizontal,
      routerLink: '/insurance/patterns/settings',
      requires: canManagePatterns,
    },

    // 924 · Reveal log (`menu.reveals`, `/insurance/patterns/reveals`, `requires: canManagePatterns`)
    {
      labelKey: 'insurance-patterns:menu.reveals',
      icon: FileClock,
      routerLink: '/insurance/patterns/reveals',
      requires: canManagePatterns,
    },
  ],
}
