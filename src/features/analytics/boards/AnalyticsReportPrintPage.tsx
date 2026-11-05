import { useEffect } from 'react'
import { useIsFetching, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { reportHref } from '@/core/analytics-routes'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import { analyticsApi } from './api'
import Refused from './Refused'
import ReportDocument, { PAPER_PX } from './ReportDocument'

/**
 * A copilot report's print page at `/analytics/print/report/:id` (CTO demo) — outside the shell, so the paper is
 * the report alone. Once every chart has its data it opens the browser's print dialog (Save as PDF); the toolbar,
 * hidden on paper, prints again or goes back.
 */
export default function AnalyticsReportPrintPage() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const report = useQuery({ queryKey: ['analytics', 'report', id], queryFn: () => analyticsApi.report(id), retry: false })
  const fetching = useIsFetching()

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@page { size: A4; margin: 14mm; } @media print { html, body { background: var(--card) !important; } }'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  // Print once the report and every chart's answer have landed (and the charts had a moment to draw).
  const ready = !!report.data && fetching === 0
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => window.print(), 1200)
    return () => window.clearTimeout(timer)
  }, [ready])

  if (report.error) return <Refused err={report.error} fallbackKey="view.loadFailed" />
  if (!report.data)
    return (
      <div className="p-8 text-sm text-muted-foreground" role="status">
        {t('report.loading')}
      </div>
    )
  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-card print:py-0">
      <div className="mx-auto mb-4 flex justify-end gap-2 print:hidden" style={{ width: PAPER_PX }}>
        <Link to={reportHref(id)} className={buttonClass('secondary')}>
          {t('report.back')}
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          {t('report.print')}
        </Button>
      </div>
      {/* A4 at 14 mm margins is ~688 CSS px wide. The browser does not re-measure charts when it lays out for print,
          so the report is EXACTLY that wide on screen too, and nothing about its width changes in print. */}
      <div className="mx-auto bg-card ring-8 ring-card print:ring-0" style={{ width: PAPER_PX }}>
        <ReportDocument report={report.data} paper />
      </div>
    </div>
  )
}
