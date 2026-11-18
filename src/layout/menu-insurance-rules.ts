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
import { UserX } from 'lucide-react' // BackOffice 3982
import { FileClock } from 'lucide-react' // BackOffice 3981
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
// 896 · the payer-month screen's OWN grant (BackOffice 1628 D36: one grant for the screen, not the area's)
import { canManagePayerMonths } from '@/features/insurance-rules/payer-month/access'
// Type-only: `menu-model` imports this module, so a value import would be a cycle.
import type { ShellMenuItem } from './menu-model'
// oms 909: every leaf reads its own key off the ONE permissions answer through the area's named predicate.
import { canOpenInsuranceRules } from '@/core/insurance-rules/access'

/**
 * The Insurance rules nav group (BackOffice spec 3126, oms 607): `/insurance-rules/*` is a new URL prefix and a
 * new nav group, LAST after HungerStation. `menu-model.ts` places it once; a later slice adds its leaf HERE.
 * Every leaf label lives in `insurance-rules` (the area's namespace, `menu.*`).
 *
 * Each leaf is gated on its own key of the one permissions answer (oms 852; oms 909) — 🚩 FAILS CLOSED,
 * and the group drops when no leaf is visible. Each page still names its doors' bare 403 itself for a deep link.
 * A new leaf takes a new flag in `INSURANCE_RULES_FLAGS` (`can` + its `menu.*` key) and a `requires: canOpenInsuranceRules(flag)`.
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
      requires: canOpenInsuranceRules('canGuards'),
    },

    // 609 · Templates
    {
      // 609 — the template gallery: phase-1 templates and team templates; a template's blanks make a draft rule.
      labelKey: 'insurance-rules:menu.templates',
      icon: LayoutTemplate,
      routerLink: '/insurance-rules/templates',
      requires: canOpenInsuranceRules('canTemplates'),
    },

    // 610 · Lists, Fields
    {
      // 610 — item lists (from registry fields), patient and policy lists; `?tab=` keeps the leaf lit.
      labelKey: 'insurance-rules:menu.lists',
      icon: ListChecks,
      routerLink: '/insurance-rules/lists',
      requires: canOpenInsuranceRules('canLists'),
    },
    {
      // BackOffice 3982 — the patient lists (BR-7's blocked patients, BR-4's patient) under the insurance managers'
      // own grant: a rule author never sees a national id, and a manager without the author's grant still reaches them.
      labelKey: 'insurance-rules:menu.patientLists',
      icon: UserX,
      routerLink: '/insurance-rules/patient-lists',
      requires: canOpenInsuranceRules('canPatientLists'),
    },
    {
      // 610 — the Fields registry: add a field from a source, retire one (never delete).
      labelKey: 'insurance-rules:menu.fields',
      icon: ListTree,
      routerLink: '/insurance-rules/fields',
      requires: canOpenInsuranceRules('canFields'),
    },

    // 611 · Approvals
    {
      // 611 — the guard draft's approval by role, shadow promotion, versions.
      labelKey: 'insurance-rules:menu.approvals',
      icon: BadgeCheck,
      routerLink: '/insurance-rules/approvals',
      requires: canOpenInsuranceRules('canApprovals'),
    },

    // 612 · Simulator
    {
      // 612 — simulate a request on a patient, and back-test the draft (`?tab=backtest&id=` keeps the leaf lit).
      labelKey: 'insurance-rules:menu.simulator',
      icon: FlaskConical,
      routerLink: '/insurance-rules/simulator',
      requires: canOpenInsuranceRules('canSimulator'),
    },

    // 613 · Editions
    {
      // 613 — the SFDA list and CHI formulary editions; an edition's page (`/insurance-rules/editions/:list/:id`) lights it too.
      labelKey: 'insurance-rules:menu.editions',
      icon: FileSpreadsheet,
      routerLink: '/insurance-rules/editions',
      requires: canOpenInsuranceRules('canEditions'),
    },

    // 614 · Review, Exceptions
    {
      labelKey: 'insurance-rules:menu.review',
      icon: ClipboardCheck,
      routerLink: '/insurance-rules/review',
      requires: canOpenInsuranceRules('canReview'),
    },
    {
      labelKey: 'insurance-rules:menu.exceptions',
      icon: ShieldCheck,
      routerLink: '/insurance-rules/exceptions',
      requires: canOpenInsuranceRules('canExceptions'),
    },

    // 615 · Metrics
    {
      // 615 — metrics per rule / store / pharmacist / day, the flags, and the payers' rejections (`?tab=`).
      labelKey: 'insurance-rules:menu.metrics',
      icon: ChartColumn,
      routerLink: '/insurance-rules/metrics',
      requires: canOpenInsuranceRules('canMetrics'),
    },

    // BackOffice 3981 · Rule hits (`menu.ruleHits`, `/insurance-rules/rule-hits`)
    {
      // BackOffice 3981 — the month's rule hits (every fire, its patient, payer and outcome) and their Excel. Its own
      // grant (`InsuranceRuleHits`, Display): the rows carry national ids, so no rules grant lights it.
      labelKey: 'insurance-rules:menu.ruleHits',
      icon: FileClock,
      routerLink: '/insurance-rules/rule-hits',
      requires: canOpenInsuranceRules('canRuleHits'),
    },

    // 617 · Insurers, Categories, Coverage
    {
      // 617 — each insurer's settings and their change log (`?payer=`).
      labelKey: 'insurance-rules:menu.insurers',
      icon: Building2,
      routerLink: '/insurance-rules/insurers',
      requires: canOpenInsuranceRules('canInsurers'),
    },
    {
      // 617 — the insurance category rules, first match sets Generic / Brand / NonMed (`?rule=`).
      labelKey: 'insurance-rules:menu.categories',
      icon: Tags,
      routerLink: '/insurance-rules/categories',
      requires: canOpenInsuranceRules('canCategories'),
    },
    {
      // 617 — the coverage rules, each value marked filled or overriding the payer (`?rule=`).
      labelKey: 'insurance-rules:menu.coverage',
      icon: Umbrella,
      routerLink: '/insurance-rules/coverage',
      requires: canOpenInsuranceRules('canCoverage'),
    },

    // 677 · Playground (`menu.playground`, `/insurance-rules/playground`)
    {
      // 677 — try a scratch rule on made-up data and see what the engine saw. Ungated like the group (607 ruling); 691 gates it.
      labelKey: 'insurance-rules:menu.playground',
      icon: TestTubeDiagonal,
      routerLink: '/insurance-rules/playground',
      requires: canOpenInsuranceRules('canPlayground'),
    },

    // 710 · Decision inspector (`menu.inspector`, `/insurance-rules/decisions`)
    {
      // 710 — any decision by its id; a decision's page (`/insurance-rules/decisions/:decisionId`) lights it too.
      labelKey: 'insurance-rules:menu.inspector',
      icon: FileSearch,
      routerLink: '/insurance-rules/decisions',
      requires: canOpenInsuranceRules('canInspector'),
    },

    // 696 · Field proposals (`menu.fieldProposals`, `/insurance-rules/field-proposals`)
    {
      // 696 — proposed FHIR fields, approved or rejected by someone other than the author.
      labelKey: 'insurance-rules:menu.fieldProposals',
      icon: Inbox,
      routerLink: '/insurance-rules/field-proposals',
      requires: canOpenInsuranceRules('canFieldProposals'),
    },

    // 704 · Aliases (`menu.aliases`, `/insurance-rules/aliases`)
    {
      // 704 — (payer, wrong URL → canonical URL), proposed and approved by a second person.
      labelKey: 'insurance-rules:menu.aliases',
      icon: Replace,
      routerLink: '/insurance-rules/aliases',
      requires: canOpenInsuranceRules('canAliases'),
    },

    // 706 · Code labels (`menu.codeLabels`, `/insurance-rules/code-labels`)
    {
      // 706 — upload a Nphies workbook, read its label diff and change log; 707 adds overrides and the worklist.
      labelKey: 'insurance-rules:menu.codeLabels',
      icon: Languages,
      routerLink: '/insurance-rules/code-labels',
      requires: canOpenInsuranceRules('canCodeLabels'),
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
      requires: canOpenInsuranceRules('canIdfMasters'),
    },

    // 620 · IDF store lists (`menu.idfStoreLists`, `/insurance-rules/idf/store-lists`)
    {
      // 620 — the named store lists (operation pharmacies, the pilot list) and their stores.
      labelKey: 'insurance-rules:menu.idfStoreLists',
      icon: Store,
      routerLink: '/insurance-rules/idf/store-lists',
      requires: canOpenInsuranceRules('canIdfStoreLists'),
    },

    // 624 · IDF exceptions (`menu.idfExceptions`, `/insurance-rules/idf/exceptions`)
    {
      // 624 — IDF exceptions by document type / sub-document type / Nphies claim type (not 614's guard exceptions).
      labelKey: 'insurance-rules:menu.idfExceptions',
      icon: ListX,
      routerLink: '/insurance-rules/idf/exceptions',
      requires: canOpenInsuranceRules('canIdfExceptions'),
    },

    // 625 · IDF lookup (`menu.idfLookup`, `/insurance-rules/idf/lookup`)
    {
      // 625 — "why this priority" for an item, store and payer; the search rides the URL (`?item=&store=&payer=`).
      labelKey: 'insurance-rules:menu.idfLookup',
      icon: SearchCheck,
      routerLink: '/insurance-rules/idf/lookup',
      requires: canOpenInsuranceRules('canIdfLookup'),
    },

    // 626 · IDF events (`menu.idfEvents`, `/insurance-rules/idf/events`; 627's swap report is its tab)
    {
      // 626 — the IDF event log, filtered by window, store, payer, master and outcome; 627's swap report is its tab.
      labelKey: 'insurance-rules:menu.idfEvents',
      icon: History,
      routerLink: '/insurance-rules/idf/events',
      requires: canOpenInsuranceRules('canIdfEvents'),
    },

    // 652 · IDF groups (`menu.idfGroups`, `/insurance-rules/idf/groups`)
    {
      // 652 — the IDF groups (number, description, dosage form, item count); 653's import is on its page.
      labelKey: 'insurance-rules:menu.idfGroups',
      icon: Layers,
      routerLink: '/insurance-rules/idf/groups',
      requires: canOpenInsuranceRules('canIdfGroups'),
    },

    // 896 · Payer months (`menu.payerMonths`, `/insurance-rules/payer-months`; BackOffice spec 1623)
    {
      // 896 — the insurance team closes, reopens and audits a payer's month. 🚩 Its OWN key, not the area's:
      // `InsurancePayerMonth:03` is the screen's one grant (`INSURANCE_TEAM`), and fails closed.
      labelKey: 'insurance-rules:menu.payerMonths',
      icon: CalendarCheck,
      routerLink: '/insurance-rules/payer-months',
      requires: canManagePayerMonths,
    },
  ],
}
