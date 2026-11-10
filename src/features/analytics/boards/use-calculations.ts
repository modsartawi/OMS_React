import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { calculatedModel, type CalculationWords } from './calculations'

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
