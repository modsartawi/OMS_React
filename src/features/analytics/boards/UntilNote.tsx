import { Trans, useTranslation } from 'react-i18next'
import type { AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import { untilNote } from './calculations'

/**
 * 861 (spec 3519 decision 26): "The list was cut before 80 %; raise the limit or add a filter." — when a running-share
 * cut ran out of rows (`untilReached: false`). Nothing otherwise.
 */
export default function UntilNote({ definition, result }: { definition: AnalyticsViewDefinition; result: AnalyticsQueryResult | undefined }) {
  const { t } = useTranslation('boards')
  const note = untilNote(definition, result)
  if (!note) return null
  return (
    <p className="text-xs text-attention-800" role="note" data-panel-until-not-reached={note.until}>
      <Trans t={t} i18nKey="calculation.untilNotReached" values={{ until: note.until }} components={{ n: <Ltr /> }} />
    </p>
  )
}
