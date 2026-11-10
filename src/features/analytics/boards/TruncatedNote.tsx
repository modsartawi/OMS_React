import { useTranslation } from 'react-i18next'
import type { AnalyticsQueryResult } from '@/core/models/analytics'

/**
 * The note under a cut answer: "Only the first rows are shown…" when the server cut the result at its row cap. The view
 * panel's (`./ViewChart`) and the copilot answer table's (ticket 868 review: a cut table is never presented as every
 * row). Nothing when the answer is whole or not in yet.
 */
export default function TruncatedNote({ result }: { result: AnalyticsQueryResult | null | undefined }) {
  const { t } = useTranslation('boards')
  if (!result?.truncated) return null
  return (
    <p className="text-xs text-muted-foreground" data-analytics-truncated-note>
      {t('view.truncated')}
    </p>
  )
}
