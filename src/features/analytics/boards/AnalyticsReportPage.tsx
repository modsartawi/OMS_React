import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FileDown } from 'lucide-react'
import { reportPrintHref } from '@/core/analytics-routes'
import { buttonClass } from '@/core/ui/control-classes'
import ScreenGate from '@/core/ui/ScreenGate'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { analyticsApi } from './api'
import Refused from './Refused'
import ReportDocument from './ReportDocument'

/**
 * A copilot report at `/analytics/report/:id` (CTO demo): the document, and "Export PDF", which opens its print page
 * in a new tab (the browser's Save as PDF). The copilot revises it from the conversation; this page re-reads it.
 */
export default function AnalyticsReportPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('view.title')} subtitle={t('view.subtitle')}>
      <ReportBody />
    </ScreenGate>
  )
}

function ReportBody() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const report = useQuery({ queryKey: ['analytics', 'report', id], queryFn: () => analyticsApi.report(id), retry: false, refetchOnWindowFocus: true })
  if (report.error) return <Refused err={report.error} fallbackKey="view.loadFailed" />
  if (!report.data)
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('report.loading')}
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <a href={reportPrintHref(id)} target="_blank" rel="noreferrer" className={buttonClass('primary')} data-report-export>
          <FileDown className="size-3.5" aria-hidden />
          {t('report.export')}
        </a>
      </div>
      <div className="rounded-lg border border-border/60">
        <ReportDocument report={report.data} />
      </div>
    </div>
  )
}
