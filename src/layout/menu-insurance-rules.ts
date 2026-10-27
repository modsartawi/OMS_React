import { ChartColumn, ShieldAlert, ShieldPlus } from 'lucide-react'
import { ClipboardCheck, ShieldCheck } from 'lucide-react' // 614
import type { ShellMenuItem } from './menu-model'

/**
 * The Insurance rules nav group (BackOffice spec 3126, oms 607): `/insurance-rules/*` is a new URL prefix and a
 * new nav group, LAST after HungerStation. `menu-model.ts` places it once; a later slice adds its leaf HERE.
 * Every leaf label lives in `insurance-rules` (the area's namespace, `menu.*`).
 *
 * 🚩 UNGATED by ruling: no access door exists until 618, so the group shows for every user and each page
 * names a bare 403 itself ("You do not have access"). 618 adds the probes.
 *
 * ⚠️ To keep parallel slices merge-clean: add your leaf under YOUR ticket's slot comment only.
 */
export const INSURANCE_RULES_MENU: ShellMenuItem = {
  labelKey: 'insurance-rules:menu.group',
  icon: ShieldPlus,
  items: [
    {
      // 607 — the guard rules by folder; a rule's page (`/insurance-rules/guards/:ruleId`) lights it too.
      labelKey: 'insurance-rules:menu.guards',
      icon: ShieldAlert,
      routerLink: '/insurance-rules/guards',
    },

    // 609 · Templates

    // 610 · Lists, Fields

    // 611 · Approvals

    // 612 · Simulator

    // 613 · Editions

    // 614 · Review, Exceptions
    {
      labelKey: 'insurance-rules:menu.review',
      icon: ClipboardCheck,
      routerLink: '/insurance-rules/review',
    },
    {
      labelKey: 'insurance-rules:menu.exceptions',
      icon: ShieldCheck,
      routerLink: '/insurance-rules/exceptions',
    },

    // 615 · Metrics
    {
      // 615 — metrics per rule / store / pharmacist / day, the flags, and the payers' rejections (`?tab=`).
      labelKey: 'insurance-rules:menu.metrics',
      icon: ChartColumn,
      routerLink: '/insurance-rules/metrics',
    },

    // 617 · Insurers, Categories, Coverage
  ],
}
