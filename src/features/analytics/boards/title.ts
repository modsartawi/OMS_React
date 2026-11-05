import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { fsi, formatRange } from '@/core/util/bidi'
import { periodPhraseKey } from './periods'
import { dimensionOf, measureOf } from './wire'

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
  // A member the model no longer holds is named as retired, never by its raw key (766 §B).
  const measureLabels = measures.map((k) => wrap(saysIn(measureOf(model, k)?.label, lang) || t('title.retiredMeasure')))
  const dimensionLabels = dimensions.map((k) => wrap(saysIn(dimensionOf(model, k)?.label, lang) || t('title.retiredDimension')))

  const what = dimensionLabels.length
    ? t('title.byDimensions', { measures: list(measureLabels), dimensions: list(dimensionLabels) })
    : list(measureLabels)
  // A custom range (`from..to`) reads as its two days, isolated whole: it is a machine value inside a sentence.
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(period ?? '')
  const when = range ? fsi(formatRange(range[1], range[2])) : period ? t(periodPhraseKey(period), { defaultValue: '' }) : ''
  return when ? t('title.overPeriod', { title: what, period: when }) : what
}
