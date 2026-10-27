import { ChartColumn, FileSpreadsheet, ListChecks, ListTree, ShieldAlert, ShieldPlus } from 'lucide-react'
import { ClipboardCheck, ShieldCheck } from 'lucide-react' // 614
import { BadgeCheck } from 'lucide-react' // 611
import { LayoutTemplate } from 'lucide-react' // 609
import { FlaskConical } from 'lucide-react' // 612
import { Building2, Tags, Umbrella } from 'lucide-react' // 617
import { ListOrdered } from 'lucide-react' // 619
// 620 · icons
// 624 · icons
import { ListX } from 'lucide-react' // 624
// 625 · icons
// 626 · icons
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
    {
      // 609 — the template gallery: phase-1 templates and team templates; a template's blanks make a draft rule.
      labelKey: 'insurance-rules:menu.templates',
      icon: LayoutTemplate,
      routerLink: '/insurance-rules/templates',
    },

    // 610 · Lists, Fields
    {
      // 610 — item lists (from registry fields), patient and policy lists; `?tab=` keeps the leaf lit.
      labelKey: 'insurance-rules:menu.lists',
      icon: ListChecks,
      routerLink: '/insurance-rules/lists',
    },
    {
      // 610 — the Fields registry: add a field from a source, retire one (never delete).
      labelKey: 'insurance-rules:menu.fields',
      icon: ListTree,
      routerLink: '/insurance-rules/fields',
    },

    // 611 · Approvals
    {
      // 611 — the guard draft's approval by role, shadow promotion, versions.
      labelKey: 'insurance-rules:menu.approvals',
      icon: BadgeCheck,
      routerLink: '/insurance-rules/approvals',
    },

    // 612 · Simulator
    {
      // 612 — simulate a request on a patient, and back-test the draft (`?tab=backtest&id=` keeps the leaf lit).
      labelKey: 'insurance-rules:menu.simulator',
      icon: FlaskConical,
      routerLink: '/insurance-rules/simulator',
    },

    // 613 · Editions
    {
      // 613 — the SFDA list and CHI formulary editions; an edition's page (`/insurance-rules/editions/:list/:id`) lights it too.
      labelKey: 'insurance-rules:menu.editions',
      icon: FileSpreadsheet,
      routerLink: '/insurance-rules/editions',
    },

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
    {
      // 617 — each insurer's settings and their change log (`?payer=`).
      labelKey: 'insurance-rules:menu.insurers',
      icon: Building2,
      routerLink: '/insurance-rules/insurers',
    },
    {
      // 617 — the insurance category rules, first match sets Generic / Brand / NonMed (`?rule=`).
      labelKey: 'insurance-rules:menu.categories',
      icon: Tags,
      routerLink: '/insurance-rules/categories',
    },
    {
      // 617 — the coverage rules, each value marked filled or overriding the payer (`?rule=`).
      labelKey: 'insurance-rules:menu.coverage',
      icon: Umbrella,
      routerLink: '/insurance-rules/coverage',
    },

    // ── IDF priority (BackOffice spec 3157; oms 619–627). Labels are pre-laid in `insurance-rules` (`menu.idf*`).

    // 619 · IDF masters
    {
      // 619 — the IDF priority masters; a master's page (`/insurance-rules/idf/masters/:masterId`, 622) lights it too.
      labelKey: 'insurance-rules:menu.idfMasters',
      icon: ListOrdered,
      routerLink: '/insurance-rules/idf/masters',
    },

    // 620 · IDF store lists (`menu.idfStoreLists`, `/insurance-rules/idf/store-lists`)

    // 624 · IDF exceptions (`menu.idfExceptions`, `/insurance-rules/idf/exceptions`)
    {
      // 624 — IDF exceptions by document type / sub-document type / Nphies claim type (not 614's guard exceptions).
      labelKey: 'insurance-rules:menu.idfExceptions',
      icon: ListX,
      routerLink: '/insurance-rules/idf/exceptions',
    },

    // 625 · IDF lookup (`menu.idfLookup`, `/insurance-rules/idf/lookup`)

    // 626 · IDF events (`menu.idfEvents`, `/insurance-rules/idf/events`; 627's swap report is its tab)
  ],
}
