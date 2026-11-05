import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatParts } from '@/core/util/bidi'
import { HEADING } from './facts-heading'
import InsuranceCell from './InsuranceCell'
import { moneyCell, moneySourceBadge, moneyTable } from './insurance-section'

/**
 * The Insurance section's **Money** part (ticket 787; spec 3389 user stories 36–38) — the verdict:
 * whose money stands (the `CHANNEL` / `ENGINE` badge and its one line), then the channel ("Received"),
 * current and engine money side by side per figure, a gap between current and engine flagged ⚠, and
 * the order's amount due / on account / paid. Unpriced engine money reads Unpriced, never 0.
 */
export default function InsuranceMoneyPart({ read }: { read: OrderInsuranceRead }) {
  const { t } = useTranslation('document')
  const badge = moneySourceBadge(read.moneySource)
  const table = moneyTable(read)
  const engine = read.money.engine
  const order: [string, number][] = [
    ['amountDue', read.amountDue],
    ['onAccount', read.onAccountAmount],
    ['paid', read.paidAmount],
  ]

  return (
    <div className="flex min-w-0 flex-col gap-2" data-insurance-money="">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className={`${HEADING} text-muted-foreground`}>{t('insurance.money.heading')}</h4>
        <span data-money-source={badge.code}>
          <StatusBadge sev={badge.sev}>{badge.code === 'unknown' ? <Ltr>{read.moneySource}</Ltr> : t(badge.labelKey)}</StatusBadge>
        </span>
        <span className="text-muted-foreground" data-money-meaning="">
          {t(badge.meaningKey)}
        </span>
      </div>

      {table.hasGap && (
        <p className="flex items-center gap-1.5 text-attention-800" data-money-gap-note="">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t('insurance.money.gapNote')}
        </p>
      )}
      {!engine.priced && (
        <p className="text-muted-foreground" data-money-unpriced-lines="">
          {t('insurance.money.unpricedLines')}{' '}
          <Ltr>{formatParts(engine.unpricedLines.map(String))}</Ltr>
        </p>
      )}

      <div className="min-w-0 overflow-x-auto">
        <table className="border-collapse" aria-label={t('insurance.money.label')} data-money-table="">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="py-1 pe-6 text-start font-medium">
                {t('insurance.money.columns.figure')}
              </th>
              {(['channel', 'current', 'engine'] as const).map((col) => (
                <th key={col} scope="col" className="py-1 pe-6 text-end font-medium">
                  {t(`insurance.money.columns.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.figure} className="border-b border-border last:border-b-0" data-money-row={row.figure}>
                <th scope="row" className="py-1 pe-6 text-start font-normal text-muted-foreground">
                  {t(`insurance.money.figures.${row.figure}`)}
                </th>
                <td className="py-1 pe-6 text-end" data-money-col="channel">
                  <InsuranceCell cell={row.channel} noneKey={read.money.channel ? undefined : 'insurance.money.notSent'} />
                </td>
                <td className="py-1 pe-6 text-end font-medium" data-money-col="current">
                  <InsuranceCell cell={row.current} />
                </td>
                <td className="py-1 pe-6 text-end" data-money-col="engine">
                  <InsuranceCell cell={row.engine} gap={row.gap} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 sm:grid-cols-[auto_auto_auto_auto_auto_1fr]" data-money-order="">
        {order.map(([key, value]) => (
          <div key={key} className="contents" data-money-order-figure={key}>
            <dt className="text-muted-foreground">{t(`insurance.money.order.${key}`)}</dt>
            <dd className="min-w-0 pe-4 font-medium">
              <InsuranceCell cell={moneyCell(value, read.currency, { kind: 'none' })} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
