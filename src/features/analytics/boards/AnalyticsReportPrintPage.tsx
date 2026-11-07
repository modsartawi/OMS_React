import { useEffect, useMemo, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { reportHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsModel, AnalyticsReport } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import { useReportAndModel } from './AnalyticsReportPage'
import { readParamLink } from './permalink'
import Refused from './Refused'
import ReportDocument, { PAPER_PX } from './ReportDocument'
import { FilterChips } from './TvMode'
import { useReportRun } from './use-report-run'
import { renderTicket, setRenderTicket, ticketOf } from './render-ticket'

/**
 * A report's print page at `/analytics/print/report/:id` (spec 819 §E, ticket 827) — outside the shell, so the paper
 * is the report alone. Its parameter values come from its query string (the permalink's keys, as the runner's page
 * writes them), shown as read-only chips under the title. Once the report, every panel's answer and the Words have
 * landed (and the charts had a moment to draw) it opens the browser's print dialog (Save as PDF); the toolbar,
 * hidden on paper, prints again or goes back to the runner's page with the same values.
 */
export default function AnalyticsReportPrintPage() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  // 835 (ADR 0125): under a render ticket the page is a scheduled run's PDF, printed by headless Chromium: the doors
  // are the ticket doors, set before the first read, and the run's language is the page's.
  const [search] = useSearchParams()
  const ticket = ticketOf(search)
  if (ticket && renderTicket()?.ticket !== ticket) setRenderTicket({ ticket, lang: search.get('lang') === 'ar' ? 'ar' : 'en' })
  const lang = renderTicket()?.lang
  useEffect(() => {
    if (lang && i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [lang])
  const { report, model, failure } = useReportAndModel(id)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@page { size: A4; margin: 14mm; } @media print { html, body { background: var(--card) !important; } }'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  if (failure) return <Refused err={failure} fallbackKey="report.loadFailed" what="report" />
  if (!report.data || !model.data)
    return (
      <div className="p-8 text-sm text-muted-foreground" role="status">
        {t('report.loading')}
      </div>
    )
  return <PrintView report={report.data} model={model.data} />
}

function PrintView({ report, model }: { report: AnalyticsReport; model: AnalyticsModel }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const [params] = useSearchParams()
  const declared = report.definition.params
  const link = useMemo(() => readParamLink(params, declared), [params, declared])
  const run = useReportRun(report, link.values, link.fellBack)

  // Print once every answer — the panels' and the Words — has landed, and the charts had a moment to draw. Under a
  // render ticket the renderer prints (ADR 0125): the page only says it is ready (`data-print-ready`), never opens
  // the print dialog.
  const fetching = useIsFetching()
  const ready = fetching === 0
  const ticketed = renderTicket() !== null
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => (ticketed ? setDrawn(true) : window.print()), 1200)
    return () => window.clearTimeout(timer)
  }, [ready, ticketed])

  const title = saysIn(report.title, lang)
  return (
    <div
      className="min-h-screen bg-muted/40 py-6 print:bg-card print:py-0"
      data-report-print-page={ready ? 'ready' : 'waiting'}
      {...(drawn && ready ? { 'data-print-ready': '' } : {})}
    >
      <div className="mx-auto mb-4 flex justify-end gap-2 print:hidden" style={{ width: PAPER_PX }}>
        <Link to={reportHref(report.id, params.toString())} className={buttonClass('secondary')} data-report-back>
          {t('report.back')}
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          {t('report.printAgain')}
        </Button>
      </div>
      {/* A4 at 14 mm margins is ~688 CSS px wide. The browser does not re-measure charts when it lays out for print,
          so the report is EXACTLY that wide on screen too, and nothing about its width changes in print. */}
      <article className="mx-auto flex flex-col gap-4 bg-card text-sm ring-8 ring-card print:ring-0" style={{ width: PAPER_PX }} data-analytics-report={report.id}>
        <header className="flex flex-col gap-2 border-b border-border pb-3">
          {title && (
            <h1 className="text-xl font-semibold tracking-tight" data-analytics-report-title>
              <bdi>{title}</bdi>
            </h1>
          )}
          <FilterChips params={declared} values={link.values} model={model} lang={lang} />
        </header>
        <ReportDocument
          report={report}
          model={model}
          lang={lang}
          context={run.context}
          role={run.role}
          words={{ data: run.words.data, failed: !!run.words.error }}
          onFetching={run.onFetching}
          onParamNotice={run.onParamNotice}
        />
      </article>
    </div>
  )
}
