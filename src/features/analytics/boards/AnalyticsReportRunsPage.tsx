import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Mail } from 'lucide-react'
import { reportHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsModel, AnalyticsReport, AnalyticsReportRun, AnalyticsRunOutcome } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import type { Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { analyticsApi, analyticsRunsKey } from './api'
import { useReportAndModel } from './AnalyticsReportPage'
import Refused from './Refused'
import { isGone } from './schedule'
import { FilterChips } from './TvMode'

const OUTCOME_SEV: Record<AnalyticsRunOutcome, Severity> = { sent: 'ok', chartsUnavailable: 'warn', stopped: 'bad', skipped: 'mute', failed: 'bad' }

/**
 * A report's kept runs at `/analytics/report/:id/runs` (spec 819 §C/§E, ticket 833): each sent run's date, trigger,
 * values, recipients and outcome, with its email (HTML) and PDF while they are kept — 90 days; after that the record
 * stays and says "no longer kept" (the artefact doors answer `410`). The server lists only the runs the caller may
 * open: the owner's and curators' all, a recipient's own.
 */
export default function AnalyticsReportRunsPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('runs.title')} subtitle={t('runs.subtitle')}>
      <RunsBody />
    </ScreenGate>
  )
}

function RunsBody() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const { report, model, failure } = useReportAndModel(id)
  const runs = useQuery({ queryKey: analyticsRunsKey(id), queryFn: () => analyticsApi.runs(id), retry: false })
  const err = failure ?? runs.error
  if (err) return <Refused err={err} fallbackKey="runs.loadFailed" what="report" />
  if (!report.data || !model.data || !runs.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('runs.loading')}
      </div>
    )
  }
  return <RunsList report={report.data} model={model.data} runs={runs.data} />
}

function RunsList({ report, model, runs }: { report: AnalyticsReport; model: AnalyticsModel; runs: AnalyticsReportRun[] }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  // Artefacts the server answered `410` for since the list was read: shown as no longer kept from then on.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  const title = saysIn(report.title, lang)

  const openArtefact = async (run: AnalyticsReportRun, kind: 'Html' | 'Pdf') => {
    // Opened before the wait, so the browser treats it as the click's own window.
    const win = window.open('', '_blank')
    try {
      const file = await analyticsApi.runArtefact(run.id, kind)
      const url = URL.createObjectURL(file.blob)
      if (win) win.location.href = url
      else window.open(url, '_blank')
    } catch (err) {
      win?.close()
      if (isGone(err)) {
        setGone((s) => new Set(s).add(run.id))
        toast.info(t('runs.expiredToast'))
      } else toast.error(t('runs.openFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-3" data-analytics-runs={report.id}>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={reportHref(report.id)} className={buttonClass('text')} data-runs-back>
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t('runs.back')}
        </Link>
        <h2 className="text-base font-semibold tracking-tight">{title ? t('runs.heading', { title: fsi(title) }) : t('runs.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('runs.intro')}</p>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-runs-none>
          {t('runs.none')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {(['date', 'trigger', 'values', 'recipients', 'outcome', 'artefacts'] as const).map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-start font-medium">
                    {t(`runs.col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const kept = run.artefactsKept && !gone.has(run.id)
                return (
                  <tr key={run.id} className="border-t border-border/60 align-top" data-run={run.id} data-run-kept={kept}>
                    <td className="px-3 py-2">
                      <Ltr>{formatDateTime(run.ranAt)}</Ltr>
                      <div className="text-xs text-muted-foreground">
                        {t('runs.revision', { revision: fsi(String(run.revision)) })}
                        {run.dataAsOf && <div>{t('runs.dataAsOf', { asOf: fsi(formatDateTime(run.dataAsOf)) })}</div>}
                      </div>
                    </td>
                    <td className="px-3 py-2" data-run-trigger={run.trigger}>
                      {t(`runs.trigger.${run.trigger}`)}
                    </td>
                    <td className="px-3 py-2" data-run-values>
                      <FilterChips params={report.definition.params} values={run.values} model={model} lang={lang} />
                    </td>
                    <td className="px-3 py-2" data-run-recipients>
                      <ul className="flex flex-col gap-0.5">
                        {run.recipients.map((u) => (
                          <li key={u.id} data-run-recipient={u.id}>
                            {u.name ? <bdi>{u.name}</bdi> : <Ltr>{u.id}</Ltr>}
                          </li>
                        ))}
                      </ul>
                      {run.dropped.length > 0 && (
                        <p className="mt-1 text-xs text-attention-800" data-run-dropped>
                          {t('runs.dropped', { names: fsi(run.dropped.map((u) => u.name || u.id).join(t('schedule.daysJoin'))) })}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2" data-run-outcome={run.outcome}>
                      <StatusBadge sev={OUTCOME_SEV[run.outcome]}>{t(`runs.outcome.${run.outcome}`)}</StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      {kept ? (
                        <div className="flex flex-wrap gap-1">
                          <Button variant="secondary" onClick={() => void openArtefact(run, 'Html')} data-run-html>
                            <Mail className="size-3.5" aria-hidden />
                            {t('runs.html')}
                          </Button>
                          {run.hasPdf && (
                            <Button variant="secondary" onClick={() => void openArtefact(run, 'Pdf')} data-run-pdf>
                              <FileText className="size-3.5" aria-hidden />
                              {t('runs.pdf')}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground" data-run-expired>
                          {t('runs.expired')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
