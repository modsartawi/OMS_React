import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { HistoryQuery } from './change-log-api'
import ChangeEntry from './ChangeEntry'

/**
 * A History tab (BackOffice spec 3148 story 51, ticket 3152): one thing's change-log rows — its own and its child
 * rows — newest first, each with who, when, why, `CopiedFrom` on a copy, and its field-level diff. Read-only; reads
 * need the existing OMS access only.
 *
 * 🔑 Generic: the rows come from `query` (`documentTypeHistoryQuery(code)` here), so a delivery type, a category or a
 * source (3154–3156) mounts this same tab by passing its own door's factory.
 */
export default function HistoryTab({ query }: { query: HistoryQuery }) {
  const { t } = useTranslation('doc-type-config')
  const history = useQuery(query)

  if (history.isError)
    return (
      <ErrorBanner
        className="p-3"
        message={isBareDenial(history.error) ? t('history.denied') : apiErrorMessage(history.error, t('history.failed'))}
      />
    )
  if (!history.data)
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('history.loading')}
      </div>
    )
  if (history.data.length === 0)
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-history-empty="">
        {t('history.empty')}
      </p>
    )

  return (
    <div className="flex min-w-0 flex-col gap-2" data-history-tab="" data-history-count={history.data.length}>
      <p className="text-xs text-muted-foreground">{t('history.newestFirst')}</p>
      {history.data.map((row) => (
        <ChangeEntry key={row.changeId} row={row} />
      ))}
    </div>
  )
}
