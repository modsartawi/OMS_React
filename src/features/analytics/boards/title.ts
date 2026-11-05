import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { labelIn } from './view-model'

/**
 * The title an untitled view is shown by (spec 766 §B and story 13, 755 item 5; ticket 775): its
 * measures by its breakdowns, over its period — "Orders by Channel, last 30 days" — from the MODEL's
 * labels in the asked language, with every word around them a `boards` key.
 *
 * Pure. `t` is the `boards` translator for `lang` (the editor passes `i18n.getFixedT(lang, 'boards')`,
 * so the Arabic title is built even while the app reads English). `wrap` isolates each label for a
 * string-only sink (`fsi`, `.claude/rules/bidi.md`); the default leaves it bare.
 */
export type BoardsT = (key: string, options?: Record<string, unknown>) => string

export function generatedTitle(
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  t: BoardsT,
  wrap: (s: string) => string = (s) => s,
): string {
  const { measures, dimensions, period } = definition.query
  if (measures.length === 0) return ''
  const list = (items: string[]) => new Intl.ListFormat(lang, { type: 'conjunction' }).format(items)
  const measureLabels = measures.map((k) => wrap(labelIn(model.measures.find((m) => m.key === k)?.label, lang) || k))
  const dimensionLabels = dimensions.map((k) => wrap(labelIn(model.dimensions.find((d) => d.key === k)?.label, lang) || k))

  const what = dimensionLabels.length
    ? t('title.byDimensions', { measures: list(measureLabels), dimensions: list(dimensionLabels) })
    : list(measureLabels)
  const when = period ? t(`editor.period.${period}`, { defaultValue: '' }) : ''
  return when ? t('title.overPeriod', { title: what, period: when }) : what
}
