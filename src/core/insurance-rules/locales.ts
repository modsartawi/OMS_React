// The insurance-rules area's namespaces (BackOffice spec 3126; oms 607 registers the first two). `core/i18n.ts`
// spreads these three exports ONCE, so a later slice registers its namespace HERE and never edits `i18n.ts`.
//
// Namespace == feature name, prefixed with `insurance-` because a bare `guards` / `lists` / `metrics` is too
// generic for a global namespace (the `loy` precedent). `insurance-rules` is the AREA's own: the menu group and
// every leaf label (`menu.*`), and the words `core/insurance-rules` draws for every feature — states,
// severities, flags and the guard sentences (`sentence.*`). Each ships English and Arabic, mirrored.
//
// ⚠️ To keep parallel slices merge-clean: add your import and your entries under YOUR ticket's slot comment
// only (the blank lines between the slots keep the hunks apart). A slot with nothing under it is fine.
import insuranceRulesEn from '@/locales/en/insurance-rules.json'
import insuranceRulesAr from '@/locales/ar/insurance-rules.json'
// 607 · 608 · 609 · 611 · 612 — the Guards feature (`features/insurance-rules/guards`)
import insuranceGuardsEn from '@/locales/en/insurance-guards.json'
import insuranceGuardsAr from '@/locales/ar/insurance-guards.json'

// 609 · imports — the Templates gallery (`features/insurance-rules/templates`)
import insuranceTemplatesEn from '@/locales/en/insurance-templates.json'
import insuranceTemplatesAr from '@/locales/ar/insurance-templates.json'

// 610 · imports
import insuranceListsEn from '@/locales/en/insurance-lists.json'
import insuranceListsAr from '@/locales/ar/insurance-lists.json'
import insuranceFieldsEn from '@/locales/en/insurance-fields.json'
import insuranceFieldsAr from '@/locales/ar/insurance-fields.json'

// 611 · imports — the Approvals feature (`features/insurance-rules/approvals`: approval, shadow, versions)
import insuranceApprovalsEn from '@/locales/en/insurance-approvals.json'
import insuranceApprovalsAr from '@/locales/ar/insurance-approvals.json'

// 612 · imports — the Simulator feature (`features/insurance-rules/simulator`: simulate + back-test)
import insuranceSimulatorEn from '@/locales/en/insurance-simulator.json'
import insuranceSimulatorAr from '@/locales/ar/insurance-simulator.json'

// 613 · imports — the Editions feature (`features/insurance-rules/editions`)
import insuranceEditionsEn from '@/locales/en/insurance-editions.json'
import insuranceEditionsAr from '@/locales/ar/insurance-editions.json'

// 614 · imports — the Review feature (`features/insurance-rules/review`: review list + HQ exceptions)
import insuranceReviewEn from '@/locales/en/insurance-review.json'
import insuranceReviewAr from '@/locales/ar/insurance-review.json'

// 615 · imports
import insuranceMetricsEn from '@/locales/en/insurance-metrics.json'
import insuranceMetricsAr from '@/locales/ar/insurance-metrics.json'

// 616 · imports — the guard dialog on an OMS order (core, no feature folder: `core/insurance-rules/GuardDialog`)
import insuranceOrderGuardsEn from '@/locales/en/insurance-order-guards.json'
import insuranceOrderGuardsAr from '@/locales/ar/insurance-order-guards.json'

// 617 · imports — insurer settings, category and coverage rules (`features/insurance-rules/coverage`)
import insuranceCoverageEn from '@/locales/en/insurance-coverage.json'
import insuranceCoverageAr from '@/locales/ar/insurance-coverage.json'

// 619 · imports — the IDF priority screens (`features/insurance-rules/idf`, spec 3157). ONE namespace for 619–627:
// each leaf adds its keys under its own top-level object in `insurance-idf.json`, never a new namespace.
import insuranceIdfEn from '@/locales/en/insurance-idf.json'
import insuranceIdfAr from '@/locales/ar/insurance-idf.json'

// 677 · imports — the rule playground (`features/insurance-rules/playground`, spec 3243). ONE namespace for 677–690.
import insurancePlaygroundEn from '@/locales/en/insurance-playground.json'
import insurancePlaygroundAr from '@/locales/ar/insurance-playground.json'

// 710 · imports — the decision inspector (`features/insurance-rules/inspector`, spec 3271).
import insuranceInspectorEn from '@/locales/en/insurance-inspector.json'
import insuranceInspectorAr from '@/locales/ar/insurance-inspector.json'

// 704 · imports — Aliases (`features/insurance-rules/aliases`, spec 3271; 705 builds on its page)
import insuranceAliasesEn from '@/locales/en/insurance-aliases.json'
import insuranceAliasesAr from '@/locales/ar/insurance-aliases.json'

// 706 · imports — the Code labels screen (`features/insurance-rules/labels`, spec 3271). ONE namespace for 706–707.
import insuranceLabelsEn from '@/locales/en/insurance-labels.json'
import insuranceLabelsAr from '@/locales/ar/insurance-labels.json'

// 896 · imports — the payer-month closure screen (`features/insurance-rules/payer-month`, BackOffice spec 1623).
import insurancePayerMonthEn from '@/locales/en/insurance-payer-month.json'
import insurancePayerMonthAr from '@/locales/ar/insurance-payer-month.json'

export const INSURANCE_RULES_NS = [
  'insurance-rules',
  'insurance-guards',

  // 609 · ns
  'insurance-templates',

  // 610 · ns
  'insurance-lists',
  'insurance-fields',

  // 611 · ns
  'insurance-approvals',

  // 612 · ns
  'insurance-simulator',

  // 613 · ns
  'insurance-editions',

  // 614 · ns
  'insurance-review',

  // 615 · ns
  'insurance-metrics',

  // 616 · ns
  'insurance-order-guards',

  // 617 · ns
  'insurance-coverage',

  // 619 · ns
  'insurance-idf',

  // 677 · ns
  'insurance-playground',

  // 710 · ns
  'insurance-inspector',

  // 704 · ns
  'insurance-aliases',

  // 706 · ns
  'insurance-labels',

  // 896 · ns
  'insurance-payer-month',
]

export const INSURANCE_RULES_EN = {
  'insurance-rules': insuranceRulesEn,
  'insurance-guards': insuranceGuardsEn,

  // 609 · en
  'insurance-templates': insuranceTemplatesEn,

  // 610 · en
  'insurance-lists': insuranceListsEn,
  'insurance-fields': insuranceFieldsEn,

  // 611 · en
  'insurance-approvals': insuranceApprovalsEn,

  // 612 · en
  'insurance-simulator': insuranceSimulatorEn,

  // 613 · en
  'insurance-editions': insuranceEditionsEn,

  // 614 · en
  'insurance-review': insuranceReviewEn,

  // 615 · en
  'insurance-metrics': insuranceMetricsEn,

  // 616 · en
  'insurance-order-guards': insuranceOrderGuardsEn,

  // 617 · en
  'insurance-coverage': insuranceCoverageEn,

  // 619 · en
  'insurance-idf': insuranceIdfEn,

  // 677 · en
  'insurance-playground': insurancePlaygroundEn,

  // 710 · en
  'insurance-inspector': insuranceInspectorEn,

  // 704 · en
  'insurance-aliases': insuranceAliasesEn,

  // 706 · en
  'insurance-labels': insuranceLabelsEn,

  // 896 · en
  'insurance-payer-month': insurancePayerMonthEn,
}

export const INSURANCE_RULES_AR = {
  'insurance-rules': insuranceRulesAr,
  'insurance-guards': insuranceGuardsAr,

  // 609 · ar
  'insurance-templates': insuranceTemplatesAr,

  // 610 · ar
  'insurance-lists': insuranceListsAr,
  'insurance-fields': insuranceFieldsAr,

  // 611 · ar
  'insurance-approvals': insuranceApprovalsAr,

  // 612 · ar
  'insurance-simulator': insuranceSimulatorAr,

  // 613 · ar
  'insurance-editions': insuranceEditionsAr,

  // 614 · ar
  'insurance-review': insuranceReviewAr,

  // 615 · ar
  'insurance-metrics': insuranceMetricsAr,

  // 616 · ar
  'insurance-order-guards': insuranceOrderGuardsAr,

  // 617 · ar
  'insurance-coverage': insuranceCoverageAr,

  // 619 · ar
  'insurance-idf': insuranceIdfAr,

  // 677 · ar
  'insurance-playground': insurancePlaygroundAr,

  // 710 · ar
  'insurance-inspector': insuranceInspectorAr,

  // 704 · ar
  'insurance-aliases': insuranceAliasesAr,

  // 706 · ar
  'insurance-labels': insuranceLabelsAr,

  // 896 · ar
  'insurance-payer-month': insurancePayerMonthAr,
}
