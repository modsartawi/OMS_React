import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { useCopilotPanel } from '@/core/copilot-panel'
import type { AnalyticsSqlItem } from '@/core/models/analytics-sql'
import Button from '@/core/ui/Button'
import { analyticsAccessQuery, canEditSql } from './access'
import { changeByAsking } from './sql-editor'

/**
 * "Change by asking" (BackOffice spec 3632 Q46, 3678) on a SQL item's page and in its editor: opens the copilot panel in
 * SQL mode on this item, through `@/core/copilot-panel` (the copilot is never imported here). The copilot sends the
 * item with the reader's first question; nothing is saved until the reader saves through the item's own editor (PUT).
 * Shown only when the item's actions include `edit`, the copilot is there and the reader holds the SQL grant.
 */
export default function ChangeByAsking({ item }: { item: AnalyticsSqlItem }) {
  const { t } = useTranslation('boards')
  const copilot = useCopilotPanel((s) => s.available)
  const openSqlItem = useCopilotPanel((s) => s.openSqlItem)
  const canSql = canEditSql(useQuery(analyticsAccessQuery()).data)
  if (!changeByAsking(item, { copilot, canSql })) return null
  return (
    <Button
      variant="outlined"
      title={t('sqlEditor.changeByAskingHint')}
      onClick={() => openSqlItem({ itemId: item.id, revision: item.revision })}
      data-analytics-sql-change-by-asking={item.id}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {t('sqlEditor.changeByAsking')}
    </Button>
  )
}
