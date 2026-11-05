import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import type { InsuranceCondition, InsuranceLine, OrderInsuranceRead } from '@/core/models/order-insurance'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { HEADING } from './facts-heading'
import InsuranceCell from './InsuranceCell'
import { lineView, pricingSteps, RECEIVED_LINE_FIGURES, receivedLineKey } from './insurance-section'

/** The Lines table's columns, start to end. */
const COLUMNS = ['line', 'sent', 'dispensed', 'group', 'deductible', 'vat', 'patient', 'insurer', 'received', 'status'] as const

/**
 * The Insurance section's **Lines** part (ticket 787; spec 3389 user stories 43–54): per line, what
 * the channel sent (SFDA, text, item, quantity, unit) → what was dispensed (with the original item
 * and the pharmacist's reason on a swap); group, category, ceiling; the engine's deductible beside
 * the one applied; VAT, patient, insurer; the channel's own per-line split when it sent one; the
 * unresolved reason and the guard's decision. A voided line is struck through, never hidden. Each
 * line folds a **How it was priced** disclosure listing its conditions in step order; the header
 * (item-0) conditions fold under the table, their money read from `rate`.
 */
export default function InsuranceLinesPart({ read }: { read: OrderInsuranceRead }) {
  const { t } = useTranslation('document')
  return (
    <div className="flex min-w-0 flex-col gap-2" data-insurance-lines="">
      <h4 className={`${HEADING} text-muted-foreground`}>{t('insurance.lines.heading')}</h4>
      {read.lines.length === 0 ? (
        <p className="text-muted-foreground">{t('insurance.lines.empty')}</p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse" aria-label={t('insurance.lines.label')}>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {COLUMNS.map((col) => (
                  <th key={col} scope="col" className="py-1 pe-3 text-start align-bottom font-medium">
                    {t(`insurance.lines.columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            {read.lines.map((line) => (
              <LineRows key={line.lineNumber} line={line} currency={read.currency} />
            ))}
          </table>
        </div>
      )}
      {read.headerConditions.length > 0 && (
        <details className="min-w-0" data-header-conditions="">
          <summary className="cursor-pointer select-none text-primary">{t('insurance.priced.header')}</summary>
          <Steps conditions={read.headerConditions} currency={read.currency} />
        </details>
      )}
    </div>
  )
}

/** One line: its row, then a full-width row holding its "How it was priced". */
function LineRows({ line, currency }: { line: InsuranceLine; currency: string | null }) {
  const { t } = useTranslation('document')
  const view = lineView(line, currency)
  const received = view.received
  const struck = line.voided ? 'line-through text-muted-foreground' : ''
  const qty = (n: number, unit: string) => [String(n), unit].filter((p) => p.trim() !== '').join(' ')
  return (
    <tbody className="border-b border-border align-top" data-insurance-line={line.lineNumber} data-voided={line.voided ? '' : undefined}>
      <tr className={struck}>
        <td className="py-1.5 pe-3">
          <div className="flex flex-col items-start gap-1">
            <Ltr>{line.lineNumber}</Ltr>
            {/* An inline-flex badge is an atomic box: the row's strike does not cross the word. */}
            {line.voided && <StatusBadge sev="mute">{t('insurance.lines.voided')}</StatusBadge>}
          </div>
        </td>
        <td className="min-w-40 py-1.5 pe-3" data-line-col="sent">
          {line.sent ? (
            <div className="flex flex-col">
              <span className="font-mono text-xs">
                <Ltr>{line.sent.sfdaCode}</Ltr>
              </span>
              <bdi>{line.sent.text}</bdi>
              {line.sent.itemNumber && (
                <span className="font-mono text-xs">
                  <Ltr>{line.sent.itemNumber}</Ltr>
                </span>
              )}
              <span className="tabular-nums">
                <Ltr>{qty(line.sent.quantity, line.sent.unit)}</Ltr>
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground italic">{t('insurance.lines.notSent')}</span>
          )}
        </td>
        <td className="min-w-40 py-1.5 pe-3" data-line-col="dispensed">
          <div className="flex gap-1">
            {/* "sent → dispensed": the arrow follows the reading direction. */}
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
            <div className="flex min-w-0 flex-col">
              <span className="font-mono text-xs">
                <Ltr>{line.dispensedItemNumber}</Ltr>
              </span>
              <bdi>{line.dispensedItemDescription}</bdi>
              <span className="tabular-nums">
                <Ltr>{qty(line.dispensedQuantity, line.dispensedUnit)}</Ltr>
              </span>
              {line.originalItemNumber && (
                <span className="text-xs text-muted-foreground" data-line-original="">
                  {t('insurance.lines.original')}{' '}
                  <span className="font-mono">
                    <Ltr>{line.originalItemNumber}</Ltr>
                  </span>
                </span>
              )}
              {line.pharmacistReason && (
                <span className="text-xs text-muted-foreground" data-line-reason="">
                  {t('insurance.lines.reason')} <bdi>{line.pharmacistReason}</bdi>
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="py-1.5 pe-3" data-line-col="group">
          <dl className="grid grid-cols-[auto_auto] gap-x-2 text-xs">
            <dt className="text-muted-foreground">{t('insurance.lines.group')}</dt>
            <dd className="font-mono">
              <Ltr>{line.deductibleGroup}</Ltr>
            </dd>
            <dt className="text-muted-foreground">{t('insurance.lines.category')}</dt>
            <dd className="font-mono">
              <Ltr>{line.insuranceCategory}</Ltr>
            </dd>
            <dt className="text-muted-foreground">{t('insurance.lines.ceiling')}</dt>
            <dd>
              <InsuranceCell cell={view.ceiling} noneKey="insurance.lines.noCeiling" />
            </dd>
          </dl>
        </td>
        <td className="py-1.5 pe-3" data-line-col="deductible">
          <dl className="grid grid-cols-[auto_auto] gap-x-2">
            <dt className="text-xs text-muted-foreground">{t('insurance.lines.engine')}</dt>
            <dd data-line-engine-deductible="">
              <InsuranceCell cell={view.engineDeductible} gap={view.deductibleGap} />
            </dd>
            <dt className="text-xs text-muted-foreground">{t('insurance.lines.applied')}</dt>
            <dd className="font-medium">
              <InsuranceCell cell={view.appliedDeductible} />
            </dd>
          </dl>
        </td>
        <td className="py-1.5 pe-3">
          <InsuranceCell cell={view.vat} />
        </td>
        <td className="py-1.5 pe-3">
          <InsuranceCell cell={view.patient} />
        </td>
        <td className="py-1.5 pe-3">
          <InsuranceCell cell={view.insurer} />
        </td>
        <td className="py-1.5 pe-3" data-line-col="received">
          {received ? (
            <dl className="grid grid-cols-[auto_auto] gap-x-2 text-xs">
              {RECEIVED_LINE_FIGURES.map((figure) => (
                <Fragment key={figure}>
                  <dt className="text-muted-foreground">{t(receivedLineKey(figure))}</dt>
                  <dd data-line-received={figure}>
                    <InsuranceCell cell={received[figure]} />
                  </dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            <span className="text-muted-foreground italic">{t('insurance.money.notSent')}</span>
          )}
        </td>
        <td className="py-1.5 pe-3 text-xs" data-line-col="status">
          <div className="flex flex-col gap-0.5">
            {line.unresolvedReason && (
              <span className="text-attention-800" data-line-unresolved="">
                {t('insurance.lines.unresolved')} <bdi>{line.unresolvedReason}</bdi>
              </span>
            )}
            {view.unpricedReason && (
              <span className="text-muted-foreground" data-line-unpriced="">
                {t('insurance.money.unpriced')} <bdi>{view.unpricedReason}</bdi>
              </span>
            )}
            {line.guardDecision && (
              <span data-line-guard="">
                <span className="text-muted-foreground">{t('insurance.lines.guard')}</span>{' '}
                <span className="font-mono">
                  <Ltr>{line.guardDecision}</Ltr>
                </span>
              </span>
            )}
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={COLUMNS.length} className="pb-1.5">
          <details data-line-priced={line.lineNumber}>
            <summary className="cursor-pointer select-none text-xs text-primary">{t('insurance.priced.summary')}</summary>
            <Steps conditions={line.conditions} currency={currency} />
          </details>
        </td>
      </tr>
    </tbody>
  )
}

/** "How it was priced": the conditions in step order with description, base, rate and value. */
function Steps({ conditions, currency }: { conditions: readonly InsuranceCondition[]; currency: string | null }) {
  const { t } = useTranslation('document')
  const steps = pricingSteps(conditions, currency)
  if (steps.length === 0) return <p className="mt-1 text-xs text-muted-foreground">{t('insurance.priced.empty')}</p>
  return (
    <table className="mt-1 border-collapse text-xs" data-priced-steps="">
      <thead>
        <tr className="text-muted-foreground">
          {(['step', 'condition', 'base', 'rate', 'value'] as const).map((col) => (
            <th key={col} scope="col" className="py-0.5 pe-4 text-start font-medium">
              {t(`insurance.priced.columns.${col}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {steps.map((s) => (
          <tr key={s.key} data-priced-step={s.condType}>
            <td className="py-0.5 pe-4 tabular-nums">
              <Ltr>{s.stepNumber}</Ltr>
            </td>
            <td className="py-0.5 pe-4">
              <span className="font-mono">
                <Ltr>{s.condType}</Ltr>
              </span>{' '}
              <bdi>{s.description}</bdi>
            </td>
            <td className="py-0.5 pe-4">
              <InsuranceCell cell={s.base} />
            </td>
            <td className="py-0.5 pe-4 tabular-nums">
              <Ltr>{s.rate}</Ltr>
            </td>
            <td className="py-0.5 pe-4 font-medium" data-priced-value="">
              <InsuranceCell cell={s.money} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
