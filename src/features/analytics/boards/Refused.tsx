import { useTranslation } from 'react-i18next'
import { SearchX, ShieldAlert } from 'lucide-react'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { analyticsRefusal } from './wire'

/**
 * A refusal of an analytics item or query (767; shared by the view and board pages since 771):
 * `ANALYTICS-404` is the not-found state and `-401` the no-access state, titled for what was asked
 * (`what`); any other code is the server's own words.
 */
export default function Refused({ err, fallbackKey, what = 'view' }: { err: unknown; fallbackKey: string; what?: 'view' | 'board' }) {
  const { t } = useTranslation('boards')
  const refusal = analyticsRefusal(err, t(fallbackKey))
  const words = 'key' in refusal ? t(refusal.key) : refusal.message
  if (refusal.code === 'ANALYTICS-404' || refusal.code === 'ANALYTICS-401') {
    const notFound = refusal.code === 'ANALYTICS-404'
    const Icon = notFound ? SearchX : ShieldAlert
    return (
      <div
        className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
        data-analytics-state={notFound ? 'not-found' : 'no-access'}
      >
        <Icon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t(notFound ? `${what}.notFoundTitle` : `${what}.noAccessTitle`)}</div>
        <p className="mt-2 text-sm text-muted-foreground">{words}</p>
      </div>
    )
  }
  return <ErrorBanner title={t(fallbackKey)} message={words} />
}
