import type { AnalyticsMeasure, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { CALCULATION_SHAPE, CALCULATION_UNIT, type AnalyticsCalculationKind, type AnalyticsColumnCalculation } from '@/core/models/analytics-calculations'
import { saysIn } from '@/core/rules/sentence'
import { measureOf } from './wire'

/**
 * Calculated columns on a panel (BackOffice spec 3519, ticket 861) — pure. SIS.Api computes a share of total, a
 * ratio, a running share or a change and returns each as a measure column (`calculation` set, shape `rate`, unit
 * `percent`). The web draws them wherever it draws measures:
 *
 * - {@link measureKeysOf} — the measures a panel reads: the query's own, then the calculated columns the result
 *   holds, in the order of `query.calculations`. Every table, series, combo, export and figure reads it.
 * - {@link calculatedModel} — the model plus one measure per calculated column, labelled in the viewer's
 *   language, so `viewMeasureOf` names, formats and shapes a calculated key like any measure.
 * - {@link untilNote} — the running-share cut that ran out of rows before its `until` (decision 26).
 *
 * The wire types are in `@/core/models/analytics-calculations`. 862's editor names a calculation the same way:
 * {@link calculationLabel}.
 */

/** A calculation's default label per kind (decision 24), from the locale (`boards:calculation.label.*`). */
export type CalculationWords = Record<AnalyticsCalculationKind, (names: { measure: string; of: string }) => string>

const calculatedColumns = (result: AnalyticsQueryResult) => result.columns.filter((c) => c.role === 'measure' && !!c.calculation)

/**
 * The measure keys a panel reads. A definition without calculations, or a result without calculated columns,
 * reads exactly what it read before 861. A calculation the result did not return is not drawn.
 */
export function measureKeysOf(definition: AnalyticsViewDefinition, result: AnalyticsQueryResult): string[] {
  const own = definition.query.measures.length ? definition.query.measures : result.columns.filter((c) => c.role === 'measure' && !c.calculation).map((c) => c.key)
  const calculated = calculatedColumns(result).map((c) => c.key)
  if (calculated.length === 0) return definition.query.measures.length ? definition.query.measures : result.columns.filter((c) => c.role === 'measure').map((c) => c.key)
  const asked = (definition.query.calculations ?? []).map((c) => c.key)
  const ordered = [...asked.filter((k) => calculated.includes(k)), ...calculated.filter((k) => !asked.includes(k))]
  return [...own.filter((k) => !ordered.includes(k)), ...ordered]
}

/**
 * A calculated column's label in `lang`: the calculation's own `label` when the query gives one, else the kind's
 * default over the model's labels of `measure` and `of` (a measure the model lacks is named by its key).
 */
export function calculationLabel(
  calculation: AnalyticsColumnCalculation,
  own: { en: string; ar: string } | null | undefined,
  model: Pick<AnalyticsModel, 'measures'>,
  lang: string,
  words: CalculationWords,
): string {
  const explicit = saysIn(own ?? undefined, lang)
  if (explicit) return explicit
  const name = (key: string | null | undefined) => (key ? saysIn(measureOf(model, key)?.label, lang) || key : '')
  return words[calculation.kind]({ measure: name(calculation.measure), of: name(calculation.of) })
}

/**
 * `model` plus one measure per calculated column of `result`, labelled in `lang`. The same object when the result
 * has none, so a panel without calculations renders exactly as before.
 */
export function calculatedModel(
  model: AnalyticsModel,
  definition: AnalyticsViewDefinition,
  result: AnalyticsQueryResult | undefined,
  lang: string,
  words: CalculationWords,
): AnalyticsModel {
  const columns = result ? calculatedColumns(result) : []
  if (columns.length === 0) return model
  const own = new Map((definition.query.calculations ?? []).map((c) => [c.key, c.label]))
  const source = (key: string) => measureOf(model, key)
  const added: AnalyticsMeasure[] = columns
    .filter((c) => !measureOf(model, c.key))
    .map((c) => {
      const label = calculationLabel(c.calculation!, own.get(c.key), model, lang, words)
      const base = source(c.calculation!.measure)
      return {
        key: c.key,
        area: base?.area ?? '',
        shape: CALCULATION_SHAPE,
        unit: CALCULATION_UNIT,
        // The label as the viewer reads it, in either language: it was derived in `lang` already.
        label: { en: label, ar: label },
        description: { en: '', ar: '' },
        dimensions: base?.dimensions ?? [],
      }
    })
  return added.length ? { ...model, measures: [...model.measures, ...added] } : model
}

/**
 * Decision 26: `{ until }` when the result says a running-share cut ran out of rows (`untilReached: false`),
 * else `null`. The `until` is the query's running share's (80 when it names none).
 */
export function untilNote(definition: AnalyticsViewDefinition, result: AnalyticsQueryResult | undefined): { until: number } | null {
  if (result?.untilReached !== false) return null
  const cut = (definition.query.calculations ?? []).find((c) => c.kind === 'cumulativeShare' && typeof c.until === 'number')
  return { until: cut?.until ?? 80 }
}
