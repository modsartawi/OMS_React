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
import { formatFigure, formatMoney3 } from '@/core/util/number-format'
import { idfReportApi, mastersQuery, swapReportQuery } from './api'
import { formatDurationMs } from './events'
import type { IdfEventsFilter } from './events-filter'
import { masterName } from './masters'
import { SWAP_REPORT_COUNTS, swapReportFileName, swapRowKey, swapRowMasterName, type IdfSwapReportRow } from './report'

/**
 * Insurance rules ▸ IDF events ▸ Swap report (BackOffice spec 3157, door 3169; oms ticket 627). The event log's
 * filter (window, store, insurer, master) grouped master × store × payer, as the door builds it: the events, each
 * outcome's count (reminders and, of those, the ones where every candidate was dearer; forced picks and alternatives
 * taken; cancelled picks, abandoned lines, exception skips, pre-auth refusals), the summed price difference on the
 * picks taken (per base unit; money at 3 decimals, a machine value) and the average time — then the door's `totals`.
 * An empty master is the general master. **Export** saves the server's `.xlsx` for the same filter through `api.blob`
 * — never a client-built file.
 */
export default function SwapReport({ filter }: { filter: IdfEventsFilter }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const report = useQuery(swapReportQuery(filter))
  const masters = useQuery(mastersQuery())
  const [exporting, setExporting] = useState(false)
  // The row names its master; the masters list is the fallback when it sends no name.
  const nameOf = (r: IdfSwapReportRow) => {
    const own = swapRowMasterName(r, i18n.language)
    if (own || !r.masterId) return own
    const m = masters.data?.find((x) => x.masterId === r.masterId)
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

  const rows = report.data?.rows ?? []
  let body: React.ReactNode
  if (report.isError && isBareDenial(report.error)) body = <DeniedCard ns="insurance-idf" hook="idf-report-denied" />
  else if (report.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(report.error, t('report.failed'))} />
  else if (!report.data) body = <Loading text={t('report.loading')} />
  else if (rows.length === 0)
    body = (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-report-empty="">
        {t('report.empty')}
      </p>
    )
  else {
    const totals = report.data.totals
    body = (
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-idf-report="">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('report.columns.master')}</th>
              <th className={TH}>{t('report.columns.store')}</th>
              <th className={TH}>{t('report.columns.payer')}</th>
              {SWAP_REPORT_COUNTS.map((c) => (
                <th key={c} className={`${TH} text-end`} data-count-col={c}>
                  {t(`report.columns.${c}`)}
                </th>
              ))}
              <th className={`${TH} text-end`}>{t('report.columns.priceDifference')}</th>
              <th className={`${TH} text-end`}>{t('report.columns.averageTime')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ReportRow key={swapRowKey(r)} r={r} masterName={nameOf(r)} />
            ))}
          </tbody>
          {totals && (
            <tfoot className="border-t-2 border-border font-semibold">
              <ReportRow r={totals} masterName={null} isTotal />
            </tfoot>
          )}
        </table>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-idf-report-tab="">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground" data-idf-report-total="">
          {report.data && <Trans t={t} i18nKey="report.total" values={{ total: formatFigure(rows.length) }} components={{ v: <Ltr /> }} />}
        </p>
        <Button variant="outlined" data-idf-report-export="" disabled={exporting || rows.length === 0} onClick={onExport}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
          {t('report.export')}
        </Button>
      </div>
      {body}
    </div>
  )
}

function ReportRow({ r, masterName: name, isTotal = false }: { r: IdfSwapReportRow; masterName: string | null; isTotal?: boolean }) {
  const { t } = useTranslation('insurance-idf')
  const avg = formatDurationMs(r.averageDurationMs)
  const money = formatMoney3(r.priceDifference)
  return (
    <tr className="border-t border-border/60" data-row={isTotal ? 'total' : swapRowKey(r)} data-master={r.masterId ?? ''}>
      <td className={TD} data-col="master">
        {isTotal ? (
          t('report.totalRow')
        ) : r.masterId ? (
          name ? <bdi>{name}</bdi> : <Ltr>{r.masterId}</Ltr>
        ) : (
          <span className="text-muted-foreground" data-general-master="">
            {t('report.general')}
          </span>
        )}
      </td>
      <td className={TD} data-col="store">
        {r.store && <Ltr>{r.store}</Ltr>}
      </td>
      <td className={TD} data-col="payer">
        {r.insurerCustomerId && <Ltr>{r.insurerCustomerId}</Ltr>}
      </td>
      {SWAP_REPORT_COUNTS.map((c) => (
        <td key={c} className={NUM} data-col={`count-${c}`}>
          <Ltr>{formatFigure(r[c] ?? 0)}</Ltr>
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
