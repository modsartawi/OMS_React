import { useId, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { CorrectionRegisterEntry, PayerMonthRow } from '@/core/models/insurance-payer-month'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import StatusBadge from '@/core/ui/StatusBadge'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { localizedName } from '@/core/util/localized-name'
import { formatMoney } from '@/core/util/number-format'
import { auditKey, correctionsKey, payerMonthApi } from './api'
import { historyLines, periodText } from './payer-month-rules'

/**
 * One payer-month's **history** (every close and reopen, oldest first) and its **corrections register** (oms 896;
 * BackOffice 1628, 1639) — the review the closer reads before pressing close. Two reads, each by payer and period.
 */
export default function PayerSheet({ row, onClose }: { row: PayerMonthRow; onClose: () => void }) {
  const { t, i18n } = useTranslation('insurance-payer-month')
  const titleId = useId()
  const { customerId, year, month } = row

  const audit = useQuery({
    queryKey: auditKey(customerId, year, month),
    queryFn: () => payerMonthApi.audit(customerId, year, month),
    retry: false,
  })
  const corrections = useQuery({
    queryKey: correctionsKey(customerId, year, month),
    queryFn: () => payerMonthApi.corrections(customerId, year, month),
    retry: false,
  })

  const lines = historyLines(audit.data ?? [])

  return (
    <SideSheet onClose={onClose} width="w-[44rem]" aria-labelledby={titleId} data-testid="payer-month-sheet">
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('sheet.eyebrow')}
        title={<Ltr>{formatPair(customerId, periodText(row))}</Ltr>}
        closeLabel={t('sheet.close')}
        onClose={onClose}
      />
      <div className={SHEET_BODY}>
        <section className="flex flex-col gap-2" data-testid="payer-month-history">
          <h3 className="text-sm font-semibold">{t('sheet.history')}</h3>
          {audit.isPending ? (
            <Reading label={t('sheet.reading')} />
          ) : audit.isError ? (
            <ErrorBanner title={t('sheet.historyFailed')} message={apiErrorMessage(audit.error, t('sheet.historyFailed'))} className="p-2" />
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sheet.historyEmpty')}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className={TH}>{t('col.lastAct')}</th>
                  <th className={TH}>{t('history.by')}</th>
                  <th className={TH}>{t('history.at')}</th>
                  <th className={TH}>{t('history.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-t border-border/60" data-testid="payer-month-history-line">
                    <td className={TD}>
                      <StatusBadge sev={line.key === 'history.action.close' ? 'ok' : 'warn'}>{t(line.key)}</StatusBadge>
                    </td>
                    <td className={TD}>
                      <Ltr>{line.actor}</Ltr>
                    </td>
                    <td className={TD}>
                      <Ltr>{line.at}</Ltr>
                    </td>
                    <td className={`${TD} whitespace-normal`}>
                      <bdi>{line.reason}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="flex flex-col gap-2" data-testid="payer-month-corrections">
          <h3 className="text-sm font-semibold">{t('sheet.corrections')}</h3>
          {corrections.isPending ? (
            <Reading label={t('sheet.reading')} />
          ) : corrections.isError ? (
            <ErrorBanner
              title={t('sheet.correctionsFailed')}
              message={apiErrorMessage(corrections.error, t('sheet.correctionsFailed'))}
              className="p-2"
            />
          ) : corrections.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sheet.correctionsEmpty')}</p>
          ) : (
            corrections.data.map((entry) => <Correction key={entry.linkGroupId} entry={entry} lang={i18n.language} />)
          )}
        </section>
      </div>
    </SideSheet>
  )
}

function Reading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {label}
    </p>
  )
}

/** One correction group, with its lines beneath, old beside new. */
function Correction({ entry, lang }: { entry: CorrectionRegisterEntry; lang: string }) {
  const { t } = useTranslation('insurance-payer-month')
  const reasonName = localizedName({ nameEn: entry.reasonNameEn, nameAr: entry.reasonNameAr }, lang)
  const directionKey = entry.direction === 'Collect' || entry.direction === 'Refund' ? `correction.direction.${entry.direction}` : null
  const tillDiffers = entry.tillStoreCode && entry.tillStoreCode !== entry.storeCode

  const facts: [string, ReactNode][] = [
    [t('correction.businessDay'), <Ltr>{formatDay(entry.businessDay)}</Ltr>],
    [t('correction.store'), <Ltr>{entry.storeCode}</Ltr>],
    ...(tillDiffers ? ([[t('correction.tillStore'), <Ltr>{entry.tillStoreCode}</Ltr>]] as [string, ReactNode][]) : []),
    [t('correction.invoice'), <Ltr>{entry.originalTrxNumber || entry.originalTransactionId}</Ltr>],
    [t('correction.netAmount'), <Ltr>{formatMoney(entry.netAmount)}</Ltr>],
    [t('correction.patientBefore'), <Ltr>{formatMoney(entry.patientAmountOld)}</Ltr>],
    [t('correction.patientAfter'), <Ltr>{formatMoney(entry.patientAmountNew)}</Ltr>],
    // A pair led by a machine value: the code and its name, isolated once.
    [t('correction.reason'), <Ltr>{reasonName ? formatPair(entry.reasonCode, reasonName) : entry.reasonCode}</Ltr>],
    ...(entry.reasonNote ? ([[t('correction.note'), <bdi>{entry.reasonNote}</bdi>]] as [string, ReactNode][]) : []),
    [t('correction.by'), <Ltr>{entry.actor}</Ltr>],
    [t('correction.at'), <Ltr>{formatDateTime(entry.createdAt)}</Ltr>],
  ]

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border/60 p-3" data-testid="payer-month-correction">
      <div className="flex flex-wrap items-center gap-2">
        {directionKey ? (
          <StatusBadge sev={entry.direction === 'Refund' ? 'warn' : 'go'}>{t(directionKey)}</StatusBadge>
        ) : (
          <StatusBadge sev="mute">
            <bdi>{entry.direction}</bdi>
          </StatusBadge>
        )}
        {/* Read off the row, never inferred from the direction (BackOffice 1639 D108). */}
        {entry.pincodeUsed && <StatusBadge sev="bad">{t('correction.pincode')}</StatusBadge>}
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {entry.lines.length > 0 && (
        <table className="w-full text-xs">
          <caption className="pb-1 text-start font-medium">{t('correction.lines')}</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th className={TH}>{t('correction.line.number')}</th>
              <th className={TH}>{t('correction.line.material')}</th>
              <th className={TH}>{t('correction.line.description')}</th>
              <th className={`${TH} text-end`}>{t('correction.line.before')}</th>
              <th className={`${TH} text-end`}>{t('correction.line.after')}</th>
              <th className={TH}>{t('correction.line.coverage')}</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.lineNumber} className="border-t border-border/60">
                <td className={TD}>
                  <Ltr>{line.lineNumber}</Ltr>
                </td>
                <td className={TD}>
                  <Ltr>{line.materialNumber}</Ltr>
                </td>
                <td className={`${TD} whitespace-normal`}>
                  <bdi>{line.description}</bdi>
                </td>
                <td className={`${TD} text-end`}>
                  <Ltr>{formatMoney(line.patientAmountOld)}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <Ltr>{formatMoney(line.patientAmountNew)}</Ltr>
                </td>
                <td className={TD}>
                  <span className="flex flex-wrap items-center gap-1">
                    {line.coverageGroup && <Ltr>{line.coverageGroup}</Ltr>}
                    {line.isRejected && <StatusBadge sev="bad">{t('correction.line.rejected')}</StatusBadge>}
                    {line.movedButUntouched && <StatusBadge sev="warn">{t('correction.line.moved')}</StatusBadge>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  )
}
