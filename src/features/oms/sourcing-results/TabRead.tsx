import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { TD, TH } from '@/core/ui/sheet-table'
import Fig from './Fig'
import { percentText } from './text'
import Ltr from '@/core/ui/Ltr'

/** The sheet cells, wrapping (the house strings hold `whitespace-nowrap`). */
export const TH_WRAP = TH.replace('whitespace-nowrap', 'whitespace-normal')
export const TD_WRAP = TD.replace('whitespace-nowrap', 'whitespace-normal')
export const TH_NUM = `${TH} text-end`
export const TD_NUM = `${TD} text-end tabular-nums`

/**
 * A reading tab's door, read when the tab opens (ticket 972): its loading line, its failure in the envelope's words
 * (`api-envelope`), and the reply handed to the panel. A re-read under new filters dims the reply it replaces.
 */
export default function TabRead<T>({ read, children }: { read: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  const { t } = useTranslation('sourcing-results')
  if (read.isError) return <ErrorBanner title={t('reading.failedTitle')} message={apiErrorMessage(read.error, t('reading.failed'))} />
  if (!read.data)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('reading.loading')}
      </p>
    )
  return (
    <div className={read.isFetching ? 'opacity-60' : ''} aria-busy={read.isFetching}>
      {children(read.data)}
    </div>
  )
}

/** A share as sent, isolated; a dash where there is none. */
export function Pct({ value }: { value: number | null | undefined }) {
  const { t } = useTranslation('sourcing-results')
  return value == null ? <span className="text-muted-foreground">{t('dash')}</span> : <Ltr>{percentText(value)}</Ltr>
}

/** Minutes against what happened, in words; + = the advisor's plan earlier. */
export function Minutes({ value }: { value: number | null | undefined }) {
  const { t } = useTranslation('sourcing-results')
  if (value == null) return <span className="text-muted-foreground">{t('dash')}</span>
  if (value === 0) return <>{t('reading.minutes.same')}</>
  return <Trans t={t} i18nKey={value > 0 ? 'reading.minutes.earlier' : 'reading.minutes.later'} components={{ m: <Fig value={String(Math.abs(value))} /> }} />
}
