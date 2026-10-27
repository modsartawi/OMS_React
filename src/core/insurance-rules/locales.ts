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

// 610 · imports

// 613 · imports

// 614 · imports — the Review feature (`features/insurance-rules/review`: review list + HQ exceptions)
import insuranceReviewEn from '@/locales/en/insurance-review.json'
import insuranceReviewAr from '@/locales/ar/insurance-review.json'

// 615 · imports
import insuranceMetricsEn from '@/locales/en/insurance-metrics.json'
import insuranceMetricsAr from '@/locales/ar/insurance-metrics.json'

// 616 · imports — the guard dialog on an OMS order (core, no feature folder: `core/insurance-rules/GuardDialog`)
import insuranceOrderGuardsEn from '@/locales/en/insurance-order-guards.json'
import insuranceOrderGuardsAr from '@/locales/ar/insurance-order-guards.json'

// 617 · imports

export const INSURANCE_RULES_NS = [
  'insurance-rules',
  'insurance-guards',

  // 610 · ns

  // 613 · ns

  // 614 · ns
  'insurance-review',

  // 615 · ns
  'insurance-metrics',

  // 616 · ns
  'insurance-order-guards',

  // 617 · ns
]

export const INSURANCE_RULES_EN = {
  'insurance-rules': insuranceRulesEn,
  'insurance-guards': insuranceGuardsEn,

  // 610 · en

  // 613 · en

  // 614 · en
  'insurance-review': insuranceReviewEn,

  // 615 · en
  'insurance-metrics': insuranceMetricsEn,

  // 616 · en
  'insurance-order-guards': insuranceOrderGuardsEn,

  // 617 · en
}

export const INSURANCE_RULES_AR = {
  'insurance-rules': insuranceRulesAr,
  'insurance-guards': insuranceGuardsAr,

  // 610 · ar

  // 613 · ar

  // 614 · ar
  'insurance-review': insuranceReviewAr,

  // 615 · ar
  'insurance-metrics': insuranceMetricsAr,

  // 616 · ar
  'insurance-order-guards': insuranceOrderGuardsAr,

  // 617 · ar
}
