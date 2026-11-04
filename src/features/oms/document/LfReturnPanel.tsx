import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { LfReturnDetailModel } from '@/core/models/lf-return'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { HEADING } from './facts-heading'
import { attentionKey, lfReturnRows, outcomeChip, type Quantity } from './lf-return'

/**
 * **The LF return panel** — the warehouse watch on a local fulfillment return delivery (spec 759 F4,
 * ticket 762; BackOffice 3369, read 3376). The page draws it only where `showsLfReturnPanel` admits:
 * a return delivery, a 03 holder, and a read that answered a watch.
 *
 * Top to bottom: the attention banner (unanswered · nothing received · short), the outcome chip with
 * its meaning, booked / collected / confirmed in local wall-clock, who forced it and why (a `forced`
 * return only), then one row per line — item · SKU · asked · confirmed · refunded · restocked ·
 * reason, an unconfirmed quantity reading *Pending*, never `0`.
 *
 * Read-only. `actions` is the header's slot for what acts on the watch — Force refund is ticket 763's
 * and hangs there; this ticket passes nothing.
 */
export default function LfReturnPanel({
  detail,
  error,
  actions,
}: {
  /** The watch, or `null` while `error` stands in for it. */
  detail: LfReturnDetailModel | null
  /** The read failed: said in place, nothing else drawn. */
  error?: string | null
  actions?: ReactNode
}) {
  const { t } = useTranslation('document')
  return (
    <section
      aria-labelledby="doc-lf-return-heading"
      className="min-w-0 rounded-lg border border-border bg-card p-3 text-[0.8125rem]"
      data-lf-return-panel=""
      data-lf-outcome={detail?.outcome ?? ''}
    >
      <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h3 id="doc-lf-return-heading" className={`${HEADING} text-muted-foreground`}>
          {t('lfReturn.heading')}
        </h3>
        <span className="text-xs text-muted-foreground">{t('lfReturn.subheading')}</span>
        {actions && <div className="ms-auto flex items-center gap-2" data-lf-return-actions="">{actions}</div>}
      </div>
      {error ? (
        <ErrorBanner message={error} className="px-3 py-2" />
      ) : (
        detail && <Watch detail={detail} />
      )}
    </section>
  )
}

function Watch({ detail }: { detail: LfReturnDetailModel }) {
  const { t } = useTranslation('document')
  const chip = outcomeChip(detail.outcome)
  const banner = attentionKey(detail.outcome)
  const rows = lfReturnRows(detail)
  const forced = (detail.outcome ?? '').trim() === 'forced'
  const dates: [string, string | null | undefined][] = [
    ['booked', detail.bookedAt],
    ['collected', detail.collectedAt],
    ['confirmed', detail.confirmedAt],
  ]

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {banner && (
        <div
          role="alert"
          className="flex gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-attention-800"
          data-lf-attention={detail.outcome.trim()}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="font-semibold">{t('lfReturn.attention.title')}</div>
            <p data-lf-attention-text="">{t(banner)}</p>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5" data-lf-outcome-row="">
        <span className="text-muted-foreground">{t('lfReturn.outcomeLabel')}</span>
        <span data-lf-chip={chip.known ? detail.outcome.trim() : 'unknown'}>
          <StatusBadge sev={chip.sev}>{t(chip.labelKey)}</StatusBadge>
        </span>
        {!chip.known && (detail.outcome ?? '').trim() && (
          <span className="font-mono text-muted-foreground" data-lf-outcome-code="">
            <Ltr>{detail.outcome.trim()}</Ltr>
          </span>
        )}
        <span className="text-muted-foreground" data-lf-meaning="">
          {t(chip.meaningKey)}
        </span>
      </div>

      <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
        {dates.map(([key, value]) => {
          const shown = formatDateTime(value)
          return (
            <div key={key} className="contents" data-lf-date={key}>
              <dt className="text-muted-foreground">{t(`lfReturn.dates.${key}`)}</dt>
              <dd className="min-w-0">{shown ? <Ltr>{shown}</Ltr> : <span className="text-muted-foreground">{t('lfReturn.dates.notYet')}</span>}</dd>
            </div>
          )
        })}
      </dl>

      {forced && (
        <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" data-lf-forced="">
          <dt className="text-muted-foreground">{t('lfReturn.forced.by')}</dt>
          <dd className="min-w-0" data-lf-forced-by="">
            <bdi>{(detail.forcedBy ?? '').trim()}</bdi>
          </dd>
          <dt className="text-muted-foreground">{t('lfReturn.forced.reason')}</dt>
          <dd className="min-w-0 whitespace-pre-wrap" data-lf-forced-reason="">
            <bdi>{(detail.forcedReason ?? '').trim()}</bdi>
          </dd>
        </dl>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground" data-lf-lines-empty="">
          {t('lfReturn.lines.empty')}
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse" aria-label={t('lfReturn.lines.label')} data-lf-lines="">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-1 pe-3 text-start font-medium">{t('lfReturn.lines.item')}</th>
                <th scope="col" className="py-1 pe-3 text-start font-medium">{t('lfReturn.lines.sku')}</th>
                <th scope="col" className="py-1 pe-3 text-end font-medium">{t('lfReturn.lines.asked')}</th>
                <th scope="col" className="py-1 pe-3 text-end font-medium">{t('lfReturn.lines.confirmed')}</th>
                <th scope="col" className="py-1 pe-3 text-end font-medium">{t('lfReturn.lines.refunded')}</th>
                <th scope="col" className="py-1 pe-3 text-end font-medium">{t('lfReturn.lines.restocked')}</th>
                <th scope="col" className="py-1 text-start font-medium">{t('lfReturn.lines.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.itemNumber}-${i}`} className="border-b border-border last:border-b-0" data-lf-line={row.itemNumber}>
                  <td className="py-1 pe-3 font-mono">
                    <Ltr>{row.itemNumber}</Ltr>
                  </td>
                  <td className="py-1 pe-3 font-mono" data-lf-cell="sku">
                    <Ltr>{row.sku}</Ltr>
                  </td>
                  <QuantityCell q={row.asked} cell="asked" />
                  <QuantityCell q={row.confirmed} cell="confirmed" />
                  <QuantityCell q={row.refunded} cell="refunded" />
                  <QuantityCell q={row.restocked} cell="restocked" />
                  <td className="py-1" data-lf-cell="reason">
                    <bdi>{row.reasonName}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function QuantityCell({ q, cell }: { q: Quantity; cell: string }) {
  const { t } = useTranslation('document')
  return (
    <td className="py-1 pe-3 text-end tabular-nums" data-lf-cell={cell} data-lf-pending={q.pending ? '' : undefined}>
      {q.pending ? <span className="text-muted-foreground italic">{t('lfReturn.lines.pending')}</span> : <Ltr>{q.value}</Ltr>}
    </td>
  )
}
