import { useTranslation } from 'react-i18next'
import type { ServingListRow } from '@/core/models/serving-list'

export interface HistoryTabProps {
  servingListId: string
  /** The list's row; undefined while it loads or when the id is unknown. */
  list: ServingListRow | undefined
}

/**
 * 🧩 SEAM for ticket 571 — the History tab (`GET ServingListWeb/Lists/{id}/Changes`). A placeholder until
 * 571 replaces this file; `ListTabs` mounts it only while `?tab=history` is open.
 */
export default function HistoryTab(_props: HistoryTabProps) {
  const { t } = useTranslation('serving-lists')
  return (
    <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-history-placeholder="">
      {t('history.placeholder')}
    </p>
  )
}
