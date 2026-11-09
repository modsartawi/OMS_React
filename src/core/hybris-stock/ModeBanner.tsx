import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, Radio } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import type { Severity } from '@/core/ui/severity'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { hybrisStockStatusQuery } from './api'
import { modeBanner } from './mode'

const TONE: Record<Severity, string> = {
  ok: 'border-border bg-card-2 text-foreground',
  go: 'border-border bg-card-2 text-foreground',
  warn: 'border-attention-border bg-attention-050 text-attention-800',
  bad: 'border-danger-border bg-danger-050 text-danger-800',
  mute: 'border-border bg-muted text-muted-foreground',
}

/**
 * The rail's mode, above every Hybris stock page (spec 3447 story 48; ticket 847): off, **shadow**
 * (files written to a path Hybris does not import) or live (files delivered to Hybris's hot folder),
 * with the delta interval, and each standing alert under it. Speaks `hybris-stock-stores`, the area's
 * first namespace.
 */
export default function ModeBanner() {
  const { t } = useTranslation('hybris-stock-stores')
  const status = useQuery(hybrisStockStatusQuery())
  const view = modeBanner(status.isSuccess ? status.data : null)
  const alerts = status.isSuccess ? (status.data.alerts ?? []) : []
  return (
    <div className="flex flex-col gap-1.5" data-mode-banner={view.reading}>
      <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs ${TONE[view.sev]}`}>
        <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-semibold" data-mode-title="">
          {t(view.titleKey)}
        </span>
        <span data-mode-body="">{t(view.bodyKey)}</span>
        {status.isSuccess && (view.reading === 'shadow' || view.reading === 'live') && (
          <span className="ms-auto flex flex-wrap gap-x-3 text-muted-foreground">
            {status.data.targetPath && (
              <span className="font-mono" data-mode-path="">
                <Trans t={t} i18nKey="mode.path" values={{ path: status.data.targetPath }} components={{ p: <Ltr /> }} />
              </span>
            )}
            {/* Always sent: the contract's Status reads `deltaMinutes` from settings at start. */}
            <span data-mode-interval="">
              <Trans t={t} i18nKey="mode.interval" values={{ n: formatFigure(status.data.deltaMinutes) }} components={{ n: <Ltr /> }} />
            </span>
          </span>
        )}
      </div>
      {alerts.map((a) => (
        <div key={a.kind} role="alert" className={`flex items-start gap-2 rounded-md border px-3 py-1.5 text-xs ${TONE.bad}`} data-mode-alert={a.kind}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <bdi>{a.title}</bdi>
          {a.raisedAt && (
            <span className="ms-auto whitespace-nowrap">
              <Trans t={t} i18nKey="mode.alertSince" values={{ at: formatDateTime(a.raisedAt) }} components={{ at: <Ltr /> }} />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
