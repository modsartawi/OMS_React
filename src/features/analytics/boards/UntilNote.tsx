import { Trans, useTranslation } from 'react-i18next'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import { fsi, formatParts } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { untilNote } from './calculations'
import { valueLabel } from './wire'

/**
 * 861 (spec 3519 decision 26): "The list was cut before 80 %; raise the limit or add a filter." — when a running-share
 * cut ran out of rows (`untilReached: false`). Nothing otherwise.
 *
 * 863 (spec 3543 decision 3): a running share within a parent names the parents whose rows ran out ("In Riyadh and
 * Makkah, the list was cut before 80 % …"). A parent reads by its values' names (a fixed dimension's label, else the
 * code), several within dimensions as one `·` line; each parent isolated whole.
 */
export default function UntilNote({
  definition,
  result,
  model,
  lang,
}: {
  definition: AnalyticsViewDefinition
  result: AnalyticsQueryResult | undefined
  model?: Pick<AnalyticsModel, 'dimensions'>
  lang?: string
}) {
  const { t, i18n } = useTranslation('boards')
  const note = untilNote(definition, result)
  if (!note) return null
  const shown = lang ?? i18n.language
  const nameOf = (parent: Record<string, string>) =>
    formatParts(Object.entries(parent).map(([dim, value]) => valueLabel(model, dim, value, shown)))
  const parents = note.parents?.length ? listText(note.parents.map((p) => fsi(nameOf(p))), shown) : null
  return (
    <p className="text-xs text-attention-800" role="note" data-panel-until-not-reached={note.until} data-panel-until-parents={note.parents?.length}>
      <Trans
        t={t}
        i18nKey={parents ? 'calculation.untilNotReachedIn' : 'calculation.untilNotReached'}
        values={{ until: note.until, ...(parents ? { parents } : {}) }}
        components={{ n: <Ltr /> }}
      />
    </p>
  )
}
