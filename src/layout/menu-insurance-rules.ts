import { ChartColumn, FileSpreadsheet, ListChecks, ListTree, ShieldAlert, ShieldPlus } from 'lucide-react'
import { ClipboardCheck, ShieldCheck } from 'lucide-react' // 614
import { BadgeCheck } from 'lucide-react' // 611
import { LayoutTemplate } from 'lucide-react' // 609
import { FlaskConical } from 'lucide-react' // 612
import { Building2, Tags, Umbrella } from 'lucide-react' // 617
import { ListOrdered } from 'lucide-react' // 619
// 620 · icons
import { Store } from 'lucide-react' // 620
// 624 · icons
import { ListX } from 'lucide-react' // 624
import { SearchCheck } from 'lucide-react' // 625
// 626 · icons
import { History } from 'lucide-react' // 626
// 652 · icons
import { Layers } from 'lucide-react' // 652
// 710 · icons
import { FileSearch } from 'lucide-react' // 710
// 677 · icons
import { TestTubeDiagonal } from 'lucide-react' // 677
// 696 · icons
import { Inbox } from 'lucide-react' // 696
// 704 · icons
import { Replace } from 'lucide-react' // 704
// 706 · icons
import { Languages } from 'lucide-react' // 706
// 896 · icons
import { CalendarCheck } from 'lucide-react' // 896
// 896 · the payer-month screen's OWN probe (BackOffice 1628 D36: one grant for the screen, not the area's)
import { PAYER_MONTH_ACCESS_KEY, canManagePayerMonths, payerMonthAccessApi } from '@/features/insurance-rules/payer-month/access'
// Type-only: `menu-model` imports this module, so a value import would be a cycle.
import type { AccessProbe, ShellMenuItem } from './menu-model'
import {
  INSURANCE_RULES_ACCESS_KEY,
  canOpenInsuranceRules,
  insuranceRulesAccessApi,
  type InsuranceRulesFlag,
} from '@/core/insurance-rules/access'

/** Every leaf rides the area's ONE probe on ONE key and reads its own flag (oms 852, BackOffice 3459). */
const insuranceRulesProbe = (flag: InsuranceRulesFlag): AccessProbe => ({
  key: INSURANCE_RULES_ACCESS_KEY,
  run: () => insuranceRulesAccessApi.access(),
  visible: canOpenInsuranceRules(flag) as (data: unknown) => boolean,
})

/**
 * The Insurance rules nav group (BackOffice spec 3126, oms 607): `/insurance-rules/*` is a new URL prefix and a
 * new nav group, LAST after HungerStation. `menu-model.ts` places it once; a later slice adds its leaf HERE.
 * Every leaf label lives in `insurance-rules` (the area's namespace, `menu.*`).
 *
 * Each leaf is gated on its own flag of `GET InsuranceRules/Access` (oms 852, BackOffice 3459) — 🚩 FAILS CLOSED,
 * and the group drops when no leaf is visible. Each page still names its doors' bare 403 itself for a deep link.
 * A new leaf takes a new flag in `INSURANCE_RULES_FLAGS` (`can` + its `menu.*` key) and an `insuranceRulesProbe`.
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
      access: insuranceRulesProbe('canGuards'),
    },

    // 609 · Templates
    {
      // 609 — the template gallery: phase-1 templates and team templates; a template's blanks make a draft rule.
      labelKey: 'insurance-rules:menu.templates',
      icon: LayoutTemplate,
      routerLink: '/insurance-rules/templates',
      access: insuranceRulesProbe('canTemplates'),
    },

    // 610 · Lists, Fields
    {
      // 610 — item lists (from registry fields), patient and policy lists; `?tab=` keeps the leaf lit.
      labelKey: 'insurance-rules:menu.lists',
      icon: ListChecks,
      routerLink: '/insurance-rules/lists',
      access: insuranceRulesProbe('canLists'),
    },
    {
      // 610 — the Fields registry: add a field from a source, retire one (never delete).
      labelKey: 'insurance-rules:menu.fields',
      icon: ListTree,
      routerLink: '/insurance-rules/fields',
      access: insuranceRulesProbe('canFields'),
    },

    // 611 · Approvals
    {
      // 611 — the guard draft's approval by role, shadow promotion, versions.
      labelKey: 'insurance-rules:menu.approvals',
      icon: BadgeCheck,
      routerLink: '/insurance-rules/approvals',
      access: insuranceRulesProbe('canApprovals'),
    },

    // 612 · Simulator
    {
      // 612 — simulate a request on a patient, and back-test the draft (`?tab=backtest&id=` keeps the leaf lit).
      labelKey: 'insurance-rules:menu.simulator',
      icon: FlaskConical,
      routerLink: '/insurance-rules/simulator',
      access: insuranceRulesProbe('canSimulator'),
    },

    // 613 · Editions
    {
      // 613 — the SFDA list and CHI formulary editions; an edition's page (`/insurance-rules/editions/:list/:id`) lights it too.
      labelKey: 'insurance-rules:menu.editions',
      icon: FileSpreadsheet,
      routerLink: '/insurance-rules/editions',
      access: insuranceRulesProbe('canEditions'),
    },

    // 614 · Review, Exceptions
    {
      labelKey: 'insurance-rules:menu.review',
      icon: ClipboardCheck,
      routerLink: '/insurance-rules/review',
      access: insuranceRulesProbe('canReview'),
    },
    {
      labelKey: 'insurance-rules:menu.exceptions',
      icon: ShieldCheck,
      routerLink: '/insurance-rules/exceptions',
      access: insuranceRulesProbe('canExceptions'),
    },

    // 615 · Metrics
    {
      // 615 — metrics per rule / store / pharmacist / day, the flags, and the payers' rejections (`?tab=`).
      labelKey: 'insurance-rules:menu.metrics',
      icon: ChartColumn,
      routerLink: '/insurance-rules/metrics',
      access: insuranceRulesProbe('canMetrics'),
    },

    // 617 · Insurers, Categories, Coverage
    {
      // 617 — each insurer's settings and their change log (`?payer=`).
      labelKey: 'insurance-rules:menu.insurers',
      icon: Building2,
      routerLink: '/insurance-rules/insurers',
      access: insuranceRulesProbe('canInsurers'),
    },
    {
      // 617 — the insurance category rules, first match sets Generic / Brand / NonMed (`?rule=`).
      labelKey: 'insurance-rules:menu.categories',
      icon: Tags,
      routerLink: '/insurance-rules/categories',
      access: insuranceRulesProbe('canCategories'),
    },
    {
      // 617 — the coverage rules, each value marked filled or overriding the payer (`?rule=`).
      labelKey: 'insurance-rules:menu.coverage',
      icon: Umbrella,
      routerLink: '/insurance-rules/coverage',
      access: insuranceRulesProbe('canCoverage'),
    },

    // 677 · Playground (`menu.playground`, `/insurance-rules/playground`)
    {
      // 677 — try a scratch rule on made-up data and see what the engine saw. Ungated like the group (607 ruling); 691 gates it.
      labelKey: 'insurance-rules:menu.playground',
      icon: TestTubeDiagonal,
      routerLink: '/insurance-rules/playground',
      access: insuranceRulesProbe('canPlayground'),
    },

    // 710 · Decision inspector (`menu.inspector`, `/insurance-rules/decisions`)
    {
      // 710 — any decision by its id; a decision's page (`/insurance-rules/decisions/:decisionId`) lights it too.
      labelKey: 'insurance-rules:menu.inspector',
      icon: FileSearch,
      routerLink: '/insurance-rules/decisions',
      access: insuranceRulesProbe('canInspector'),
    },

    // 696 · Field proposals (`menu.fieldProposals`, `/insurance-rules/field-proposals`)
    {
      // 696 — proposed FHIR fields, approved or rejected by someone other than the author.
      labelKey: 'insurance-rules:menu.fieldProposals',
      icon: Inbox,
      routerLink: '/insurance-rules/field-proposals',
      access: insuranceRulesProbe('canFieldProposals'),
    },

    // 704 · Aliases (`menu.aliases`, `/insurance-rules/aliases`)
    {
      // 704 — (payer, wrong URL → canonical URL), proposed and approved by a second person.
      labelKey: 'insurance-rules:menu.aliases',
      icon: Replace,
      routerLink: '/insurance-rules/aliases',
      access: insuranceRulesProbe('canAliases'),
    },

    // 706 · Code labels (`menu.codeLabels`, `/insurance-rules/code-labels`)
    {
      // 706 — upload a Nphies workbook, read its label diff and change log; 707 adds overrides and the worklist.
      labelKey: 'insurance-rules:menu.codeLabels',
      icon: Languages,
      routerLink: '/insurance-rules/code-labels',
      access: insuranceRulesProbe('canCodeLabels'),
    },

    // ── IDF priority (BackOffice spec 3157; oms 619–627). Labels are pre-laid in `insurance-rules` (`menu.idf*`).

    // 619 · IDF masters
    {
      // 619 — the IDF priority masters; a master's page (`/insurance-rules/idf/masters/:masterId`, 622) lights it too,
      // and so does the general master's (`/insurance-rules/idf/general`, 647).
      labelKey: 'insurance-rules:menu.idfMasters',
      icon: ListOrdered,
      routerLink: '/insurance-rules/idf/masters',
      activePrefix: ['/insurance-rules/idf/masters', '/insurance-rules/idf/general'],
      access: insuranceRulesProbe('canIdfMasters'),
    },

    // 620 · IDF store lists (`menu.idfStoreLists`, `/insurance-rules/idf/store-lists`)
    {
      // 620 — the named store lists (operation pharmacies, the pilot list) and their stores.
      labelKey: 'insurance-rules:menu.idfStoreLists',
      icon: Store,
      routerLink: '/insurance-rules/idf/store-lists',
      access: insuranceRulesProbe('canIdfStoreLists'),
    },

    // 624 · IDF exceptions (`menu.idfExceptions`, `/insurance-rules/idf/exceptions`)
    {
      // 624 — IDF exceptions by document type / sub-document type / Nphies claim type (not 614's guard exceptions).
      labelKey: 'insurance-rules:menu.idfExceptions',
      icon: ListX,
      routerLink: '/insurance-rules/idf/exceptions',
      access: insuranceRulesProbe('canIdfExceptions'),
    },

    // 625 · IDF lookup (`menu.idfLookup`, `/insurance-rules/idf/lookup`)
    {
      // 625 — "why this priority" for an item, store and payer; the search rides the URL (`?item=&store=&payer=`).
      labelKey: 'insurance-rules:menu.idfLookup',
      icon: SearchCheck,
      routerLink: '/insurance-rules/idf/lookup',
      access: insuranceRulesProbe('canIdfLookup'),
    },

    // 626 · IDF events (`menu.idfEvents`, `/insurance-rules/idf/events`; 627's swap report is its tab)
    {
      // 626 — the IDF event log, filtered by window, store, payer, master and outcome; 627's swap report is its tab.
      labelKey: 'insurance-rules:menu.idfEvents',
      icon: History,
      routerLink: '/insurance-rules/idf/events',
      access: insuranceRulesProbe('canIdfEvents'),
    },

    // 652 · IDF groups (`menu.idfGroups`, `/insurance-rules/idf/groups`)
    {
      // 652 — the IDF groups (number, description, dosage form, item count); 653's import is on its page.
      labelKey: 'insurance-rules:menu.idfGroups',
      icon: Layers,
      routerLink: '/insurance-rules/idf/groups',
      access: insuranceRulesProbe('canIdfGroups'),
    },

    // 896 · Payer months (`menu.payerMonths`, `/insurance-rules/payer-months`; BackOffice spec 1623)
    {
      // 896 — the insurance team closes, reopens and audits a payer's month. 🚩 Its OWN probe, not the area's:
      // `InsurancePayerMonthWeb/Access` reports the screen's one grant (`INSURANCE_TEAM`), and fails closed.
      labelKey: 'insurance-rules:menu.payerMonths',
      icon: CalendarCheck,
      routerLink: '/insurance-rules/payer-months',
      access: {
        key: PAYER_MONTH_ACCESS_KEY,
        run: () => payerMonthAccessApi.access(),
        visible: canManagePayerMonths as (data: unknown) => boolean,
      },
    },
  ],
}
