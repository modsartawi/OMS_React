import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/core/api'
import { formatStamp } from '@/core/nphies/format'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { approvalReleaseApi, releaseHistoryKey } from './api'

/**
 * An authorization's release log (spec 3342 story 11): when, who, before, after and the note,
 * newest first as the server orders it. Before and after are two columns rather than one
 * "before → after" string, so each machine value is isolated whole on its own.
 *
 * Read once per bundle Id and again after a release (the page invalidates the key). No
 * `refetchInterval`: a log changes only when someone releases.
 */
export default function ReleaseHistory({ authId }: { authId: string }) {
  const { t } = useTranslation('approval-release')
  const history = useQuery({
    queryKey: releaseHistoryKey(authId),
    queryFn: () => approvalReleaseApi.history(authId),
    // A refusal is an answer, as on the authorization read beside it.
    retry: false,
  })

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-testid="release-history">
      <h2 className="text-sm font-semibold tracking-tight">{t('history.title')}</h2>

      {history.isPending && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('history.loading')}
        </p>
      )}

      {history.isError && (
        <ErrorBanner message={apiErrorMessage(history.error, t('history.failed'))} className="p-2" />
      )}

      {history.data && history.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
      )}

      {history.data && history.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="py-1.5 pe-4 text-start font-medium">{t('history.releasedAt')}</th>
                <th className="py-1.5 pe-4 text-start font-medium">{t('history.user')}</th>
                <th className="py-1.5 pe-4 text-start font-medium">{t('history.before')}</th>
                <th className="py-1.5 pe-4 text-start font-medium">{t('history.after')}</th>
                <th className="py-1.5 text-start font-medium">{t('history.note')}</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((r) => (
                <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
                  <td className="py-1.5 pe-4 whitespace-nowrap">
                    <Ltr>{formatStamp(r.releasedAt)}</Ltr>
                  </td>
                  <td className="py-1.5 pe-4">
                    <bdi>{r.userName || r.userId}</bdi>
                  </td>
                  <td className="py-1.5 pe-4 font-mono">
                    <Ltr>{r.preAuthRefBefore}</Ltr>
                  </td>
                  <td className="py-1.5 pe-4 font-mono">
                    <Ltr>{r.preAuthRefAfter}</Ltr>
                  </td>
                  <td className="py-1.5 whitespace-pre-wrap">
                    <bdi>{r.note}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
