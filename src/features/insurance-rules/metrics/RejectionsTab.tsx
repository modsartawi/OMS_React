import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import StatusBadge from '@/core/ui/StatusBadge'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure, formatMoney } from '@/core/util/number-format'
import { rejectionsQuery } from './api'
import { rankRejections, type RejectionRow } from './model'
import { NUM, TD } from './parts'
import type { MetricsQuery } from './query'
import { DeniedCard, Loading, TH } from '@/core/insurance-rules/parts'


/**
 * The payers' rejections over the window by code (or the payer's words), payer and same kind, ranked by SAR,
 * each marked where a live guard already covers that kind (ticket 615; `GET InsuranceRules/Rejections`). The
 * payer list comes from the window's unfiltered report, so picking one never empties the choice.
 */
export default function RejectionsTab({ query, onPayer }: { query: MetricsQuery; onPayer: (payer: string) => void }) {
  const { t } = useTranslation('insurance-metrics')
  const all = useQuery(rejectionsQuery({ ...query, payer: '' }))
  const picked = useQuery({ ...rejectionsQuery(query), enabled: query.payer !== '' })
  const read = query.payer ? picked : all
  const payers = useMemo(() => [...new Set([...(all.data ?? []).map((r) => r.payer), ...(query.payer ? [query.payer] : [])])].sort(), [all.data, query.payer])
  const ranked = useMemo(() => rankRejections(read.data ?? []), [read.data])

  if (read.isError && isBareDenial(read.error)) return <DeniedCard ns="insurance-metrics" hook="rejections-denied" />
  return (
    <div className="flex flex-col gap-3" data-rejections-tab="">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('rejections.lede')}</p>
        <Field label={t('rejections.payer')}>
          <Select value={query.payer} onChange={(e) => onPayer(e.target.value)} data-payer="">
            <option value="">{t('rejections.allPayers')}</option>
            {payers.map((p) => (
              <option key={p} value={p}>
                {fsi(p)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {read.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(read.error, t('rejections.failed'))} />
      ) : !read.data ? (
        <Loading text={t('rejections.loading')} />
      ) : ranked.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-rejections-empty="">
          {t('rejections.empty')}
        </p>
      ) : (
        <>
          <p className="text-sm" data-rejection-totals="">
            <Trans
              t={t}
              i18nKey="rejections.totals"
              values={{ n: formatFigure(ranked.totals.count), sar: formatMoney(ranked.totals.sar), unguardedSar: formatMoney(ranked.totals.unguardedSar), unguardedRows: ranked.totals.unguardedRows }}
              components={{ v: <Ltr />, b: <strong className="font-semibold text-danger-800" /> }}
            />
          </p>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-rejections-table="">
              <thead className="bg-grid-head text-grid-head-foreground">
                <tr>
                  <th className={`${TH} text-end`}>{t('rejections.columns.rank')}</th>
                  <th className={TH}>{t('rejections.columns.code')}</th>
                  <th className={TH}>{t('rejections.columns.payer')}</th>
                  <th className={TH}>{t('rejections.columns.sameKind')}</th>
                  <th className={`${TH} text-end`}>{t('rejections.columns.count')}</th>
                  <th className={`${TH} w-[24%]`}>{t('rejections.columns.sar')}</th>
                  <th className={TH}>{t('rejections.columns.liveGuard')}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ rank, row, share }) => (
                  <tr key={`${row.code ?? row.words}|${row.payer}|${row.sameKind}`} className="border-t border-border/60" data-rejection-row={rank} data-live-guard={String(row.liveGuard)}>
                    <td className={NUM}>
                      <Ltr>{rank}</Ltr>
                    </td>
                    <td className={TD} data-col="code">
                      <CodeOrWords row={row} />
                    </td>
                    <td className={TD} data-col="payer">
                      <Ltr>{row.payer}</Ltr>
                    </td>
                    <td className={TD} data-col="sameKind">
                      <code className="font-mono text-[12px]">
                        <Ltr>{row.sameKind}</Ltr>
                      </code>
                    </td>
                    <td className={NUM} data-col="count">
                      <Ltr>{formatFigure(row.count)}</Ltr>
                    </td>
                    <td className={TD} data-col="sar">
                      <span className="flex items-center gap-2">
                        <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted" aria-hidden>
                          <span className={`h-full ${row.liveGuard ? 'bg-primary' : 'bg-danger'}`} style={{ inlineSize: `${share * 100}%` }} data-sar-bar={share.toFixed(2)} />
                        </span>
                        <span className="w-20 text-end tabular-nums">
                          <Ltr>{formatMoney(row.sar)}</Ltr>
                        </span>
                      </span>
                    </td>
                    <td className={TD} data-col="liveGuard">
                      <StatusBadge sev={row.liveGuard ? 'ok' : 'bad'}>{t(row.liveGuard ? 'rejections.liveGuard' : 'rejections.noGuard')}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/** A code is a machine value (`Ltr`); the payer's words, sent when it gave no code, are free text (`<bdi>`). */
function CodeOrWords({ row }: { row: RejectionRow }) {
  if (row.code)
    return (
      <code className="font-mono text-[12px]" data-code="">
        <Ltr>{row.code}</Ltr>
      </code>
    )
  return <bdi data-words="">{row.words}</bdi>
}
