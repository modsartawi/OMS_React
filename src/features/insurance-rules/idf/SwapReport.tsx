import { useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { saveBlob } from '@/core/util/download-file'
import { formatFigure, formatMoney } from '@/core/util/number-format'
import { idfReportApi, mastersQuery, swapReportQuery } from './api'
import { formatTimeSpent, IDF_EVENT_FILTER_OUTCOMES } from './events'
import type { IdfEventsFilter } from './events-filter'
import { masterName } from './masters'
import { swapReportFileName, swapRowKey, type IdfSwapReportRow } from './report'

/**
 * Insurance rules ▸ IDF events ▸ Swap report (BackOffice spec 3157, door 3169; oms ticket 627). The event log's
 * filter (window, store, payer, master) grouped master × store × payer: a count per outcome, the summed price
 * difference on picks taken (money, a machine value) and the average time spent. **Export** saves the server's
 * `.xlsx` for the same filter through `api.blob` — never a client-built file.
 */
export default function SwapReport({ filter }: { filter: IdfEventsFilter }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const report = useQuery(swapReportQuery(filter))
  const masters = useQuery(mastersQuery())
  const [exporting, setExporting] = useState(false)
  const nameOf = (id: string) => {
    const m = masters.data?.find((x) => x.masterId === id)
    return m ? masterName(m, i18n.language) : null
  }

  const onExport = async () => {
    setExporting(true)
    try {
      const file = await idfReportApi.export(filter)
      saveBlob(file.filename ?? swapReportFileName(filter), file.blob)
    } catch (err) {
      notify.apiError(t('report.exportFailed'), err, t('report.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  let body: React.ReactNode
  if (report.isError && isBareDenial(report.error)) body = <DeniedCard ns="insurance-idf" hook="idf-report-denied" />
  else if (report.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(report.error, t('report.failed'))} />
  else if (!report.data) body = <Loading text={t('report.loading')} />
  else if (report.data.length === 0)
    body = (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-report-empty="">
        {t('report.empty')}
      </p>
    )
  else
    body = (
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-idf-report="">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('report.columns.master')}</th>
              <th className={TH}>{t('report.columns.store')}</th>
              <th className={TH}>{t('report.columns.payer')}</th>
              {IDF_EVENT_FILTER_OUTCOMES.map((o) => (
                <th key={o} className={`${TH} text-end`} data-outcome-col={o}>
                  {t(`events.outcome.${o}`)}
                </th>
              ))}
              <th className={`${TH} text-end`}>{t('report.columns.priceDifference')}</th>
              <th className={`${TH} text-end`}>{t('report.columns.averageTime')}</th>
            </tr>
          </thead>
          <tbody>
            {report.data.map((r) => (
              <ReportRow key={swapRowKey(r)} r={r} masterName={r.masterId ? nameOf(r.masterId) : null} />
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <div className="flex flex-col gap-2" data-idf-report-tab="">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground" data-idf-report-total="">
          {report.data && <Trans t={t} i18nKey="report.total" values={{ total: formatFigure(report.data.length) }} components={{ v: <Ltr /> }} />}
        </p>
        <Button variant="outlined" data-idf-report-export="" disabled={exporting || !report.data || report.data.length === 0} onClick={onExport}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
          {t('report.export')}
        </Button>
      </div>
      {body}
    </div>
  )
}

function ReportRow({ r, masterName: name }: { r: IdfSwapReportRow; masterName: string | null }) {
  const { t } = useTranslation('insurance-idf')
  const avg = formatTimeSpent(r.averageTimeSeconds)
  const money = formatMoney(r.priceDifference)
  return (
    <tr className="border-t border-border/60" data-row={swapRowKey(r)} data-master={r.masterId ?? ''}>
      <td className={TD} data-col="master">
        {r.masterId ? name ? <bdi>{name}</bdi> : <Ltr>{r.masterId}</Ltr> : <span className="text-xs text-muted-foreground">{t('events.unknownMaster')}</span>}
      </td>
      <td className={TD} data-col="store">
        <Ltr>{r.storeCode}</Ltr>
      </td>
      <td className={TD} data-col="payer">
        {r.payerCode && <Ltr>{r.payerCode}</Ltr>}
      </td>
      {IDF_EVENT_FILTER_OUTCOMES.map((o) => (
        <td key={o} className={NUM} data-col={`count-${o}`}>
          <Ltr>{formatFigure(r.counts[o] ?? 0)}</Ltr>
        </td>
      ))}
      <td className={NUM} data-col="priceDifference">
        {money && <Ltr>{money}</Ltr>}
      </td>
      <td className={NUM} data-col="averageTime">
        {avg && <Ltr>{avg}</Ltr>}
      </td>
    </tr>
  )
}
