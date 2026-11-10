import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import type { AnalyticsCalculation } from '@/core/models/analytics-calculations'
import { saysIn } from '@/core/rules/sentence'
import { calculatedModel, calculationLabel, type CalculationWords } from './calculations'
import { addCalculation, removeCalculation, updateCalculation, type CalculationDraft, type DroppedCalculation } from './calculations-edit'
import { measureOf } from './wire'

/** 861: the calculation labels' default words (decision 24) in the screen's language. */
export function useCalculationWords(): CalculationWords {
  const { t } = useTranslation('boards')
  return useMemo(
    () => ({
      shareOfTotal: (v) => t('calculation.label.shareOfTotal', v),
      ratio: (v) => t('calculation.label.ratio', v),
      cumulativeShare: (v) => t('calculation.label.cumulativeShare', v),
      change: (v) => t('calculation.label.change', v),
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
  return useMemo(() => calculatedModel(model, definition, result, lang, words), [model, definition, result, lang, words])
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
  return { nameOf, measureName, setDropped, fields }
}
