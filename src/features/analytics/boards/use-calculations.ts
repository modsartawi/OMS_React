import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import type { AnalyticsCalculation, AnalyticsVariant } from '@/core/models/analytics-calculations'
import { saysIn } from '@/core/rules/sentence'
import { calculatedModel, calculationLabel, type CalculationWords } from './calculations'
import { addCalculation, removeCalculation, updateCalculation, type CalculationDraft, type DroppedCalculation } from './calculations-edit'
import { listOf, variantModel, type VariantWord } from './variants'
import { dimensionOf, measureOf } from './wire'

/** 861: the calculation labels' default words (decision 24) in the screen's language. */
export function useCalculationWords(): CalculationWords {
  const { t } = useTranslation('boards')
  return useMemo(
    () => ({
      shareOfTotal: (v) => t('calculation.label.shareOfTotal', v),
      ratio: (v) => t('calculation.label.ratio', v),
      cumulativeShare: (v) => t('calculation.label.cumulativeShare', v),
      change: (v) => t('calculation.label.change', v),
      shareOfTotalWithin: (v) => t('calculation.label.shareOfTotalWithin', v),
      cumulativeShareWithin: (v) => t('calculation.label.cumulativeShareWithin', v),
    }),
    [t],
  )
}

/**
 * 861: the model a panel draws with — its own, plus one labelled measure per calculated column of `result`
 * (`./calculations`). The same model when the result has none.
 */
export function useCalculatedModel(model: AnalyticsModel, definition: AnalyticsViewDefinition, result: AnalyticsQueryResult | undefined, lang: string): AnalyticsModel {
  const words = useCalculationWords()
  const variantWord = useVariantWord()
  return useMemo(() => calculatedModel(model, definition, result, lang, words, variantWord), [model, definition, result, lang, words, variantWord])
}

/** 863: a variant's default label ("{measure} ({filter values})", `boards:variant.label`) in the screen's language. */
export function useVariantWord(): VariantWord {
  const { t } = useTranslation('boards')
  return useMemo(() => (v) => t('variant.label', v), [t])
}

/**
 * 863: the model the query builder offers from — its own, plus one measure per variant of the draft (`./variants`), so
 * every measure picker (calculations, sort, chart) sees a variant like a measure. The same model with none.
 */
export function useVariantModel(model: AnalyticsModel, variants: readonly AnalyticsVariant[] | null | undefined, lang: string): AnalyticsModel {
  const word = useVariantWord()
  return useMemo(() => variantModel(model, variants, lang, word), [model, variants, lang, word])
}

/**
 * 862: the query builder's calculation wiring, shared by the view editor and the report panel editor — each
 * calculation's name (its label, else the derived default), a measure-or-calculation key's name for the chart
 * fields, the note of calculations an edit took out, and `<CalculationFields>`'s handlers over `edit` (the editor's
 * own way to change its definition).
 */
export function useCalculationEditing(model: AnalyticsModel, lang: string, calculations: readonly AnalyticsCalculation[]) {
  const words = useCalculationWords()
  const [dropped, setDropped] = useState<DroppedCalculation[]>([])
  const nameOf = (c: AnalyticsCalculation) => calculationLabel(c, c.label, model, lang, words)
  const measureName = (k: string) => {
    const c = calculations.find((x) => x.key === k)
    return c ? nameOf(c) : saysIn(measureOf(model, k)?.label, lang) || k
  }
  const fields = (edit: (f: (d: AnalyticsViewDefinition) => AnalyticsViewDefinition) => void) => ({
    onAdd: (draft: CalculationDraft) => edit((d) => addCalculation(d, draft, model)),
    onUpdate: (key: string, draft: CalculationDraft) => edit((d) => updateCalculation(d, key, draft, model)),
    onRemove: (key: string) => edit((d) => removeCalculation(d, key, model)),
    dropped,
    onDismissDropped: () => setDropped([]),
    nameOf,
  })
  // 863: a running share within a parent cuts its top N per parent — the parents' names, for the top N field.
  const running = calculations.find((c) => c.kind === 'cumulativeShare' && c.within?.length)
  const perParent = running ? listOf(running.within!.map((k) => saysIn(dimensionOf(model, k)?.label, lang) || k), lang) : null
  return { nameOf, measureName, setDropped, fields, perParent }
}
