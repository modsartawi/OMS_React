import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link2, Printer } from 'lucide-react'
import { reportPrintHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsModel, AnalyticsReport } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import ScreenGate from '@/core/ui/ScreenGate'
import { copyText } from '@/core/util/copy-text'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsReportKey } from './api'
import AudienceChip from './AudienceChip'
import FilterStrip from './FilterStrip'
import { defaultsOf, type ParamValues } from './params'
import { readParamLink, writeParamValues } from './permalink'
import Refused from './Refused'
import ReportDocument from './ReportDocument'
import TierBadge from './TierBadge'
import { useReportRun } from './use-report-run'

/**
 * A report at `/analytics/report/:id` — the runner's page (spec 819 §E, ticket 827; 798 item 6): the title, its
 * tier and audience, the parameter strip with Reset (its values are the URL's, so a copied link carries them),
 * then the sections — panels in v1's panel frame, text with live figures, the summary or "summary unavailable" —
 * with the model's caveats and "may still rise" marks. Copy link and Print (A4, with these values) in the header.
 *
 * No edit control, no cross-filter and no TV mode on a report. It replaces the CTO demo's frozen report page: an
 * id that is not a report's is not found (`analyticsApi.report`).
 */
export default function AnalyticsReportPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('report.title')} subtitle={t('report.subtitle')}>
      <ReportBody />
    </ScreenGate>
  )
}

/** A report and the model, for the runner's page and the print page alike. */
export function useReportAndModel(id: string) {
  const report = useQuery({ queryKey: analyticsReportKey(id), queryFn: () => analyticsApi.report(id), retry: false })
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })
  return { report, model, failure: report.error ?? model.error }
}

function ReportBody() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const { report, model, failure } = useReportAndModel(id)
  if (failure) return <Refused err={failure} fallbackKey="report.loadFailed" what="report" />
  if (!report.data || !model.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('report.loading')}
      </div>
    )
  }
  return <ReportView report={report.data} model={model.data} />
}

function ReportView({ report, model }: { report: AnalyticsReport; model: AnalyticsModel }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const declared = report.definition.params
  const [params, setParams] = useSearchParams()
  const link = useMemo(() => readParamLink(params, declared), [params, declared])
  const values = link.values
  const setValues = useCallback((next: ParamValues) => setParams((prev) => writeParamValues(prev, declared, next), { replace: true }), [setParams, declared])
  const reset = useCallback(() => setValues(defaultsOf(declared)), [setValues, declared])
  const run = useReportRun(report, values, link.fellBack)

  const copyLink = async () => {
    const outcome = await copyText(window.location.href)
    if (outcome === 'copied') toast.success(t('report.linkCopied'))
    else toast.error(t('report.linkFailed'))
  }
  const title = saysIn(report.title, lang)
  return (
    <div className="flex flex-col gap-3" data-analytics-report={report.id}>
      <div className="flex flex-wrap items-center gap-3" data-analytics-report-header>
        {title && (
          <h2 className="text-base font-semibold tracking-tight" data-analytics-report-title>
            <bdi>{title}</bdi>
          </h2>
        )}
        <TierBadge tier={report.tier} />
        {/* 826: who a Shared report is shared with. */}
        <AudienceChip item={report} />
        <div className="ms-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => void copyLink()} data-report-copy-link>
            <Link2 className="size-3.5" aria-hidden />
            {t('report.copyLink')}
          </Button>
          <a href={reportPrintHref(report.id, params.toString())} target="_blank" rel="noreferrer" className={buttonClass('secondary')} data-report-print>
            <Printer className="size-3.5" aria-hidden />
            {t('report.print')}
          </a>
        </div>
      </div>
      <FilterStrip params={declared} values={values} onChange={setValues} onReset={reset} fellBack={run.fellBack} invalid={run.invalid} model={model} lang={lang} wave={run.wave} />
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
    </div>
  )
}
