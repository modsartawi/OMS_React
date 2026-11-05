import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import type { SdDocumentLogModel } from '@/core/models/sd-document'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { HEADING } from './facts-heading'
import InsuranceCell from './InsuranceCell'
import { moneySourceBadge } from './insurance-section'
import { timelineRows, type BeforeAfter, type ChangeMoneyView, type ChangeRow, type LogRow } from './insurance-timeline'

/**
 * The Insurance section's **Changes** part (ticket 788; BackOffice 3393, spec 3389 user stories
 * 59–63): one timeline, oldest first, of every accepted act (pick, swap, quantity, void, restore,
 * ceiling) with who and when, item / quantity before → after and the reason, and the money source
 * with the patient and insurer totals before → after — merged with the order's document log. An act
 * accepted before money was recorded reads "Not recorded", never 0; the act that left the channel's
 * money (`CHANNEL` → `ENGINE`) is marked.
 *
 * `logs` are the page's own document log rows, merged only when the read carries no log of its own.
 */
export default function InsuranceChangesPart({ read, logs }: { read: OrderInsuranceRead; logs?: readonly SdDocumentLogModel[] | null }) {
  const { t } = useTranslation('document')
  const rows = timelineRows(read.timeline, logs, read.currency)
  return (
    <div className="flex min-w-0 flex-col gap-2" data-insurance-changes="">
      <h4 className={`${HEADING} text-muted-foreground`}>{t('insurance.changes.heading')}</h4>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t('insurance.changes.empty')}</p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse" aria-label={t('insurance.changes.label')}>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {(['when', 'who', 'what', 'change', 'money'] as const).map((col) => (
                  <th key={col} scope="col" className="py-1 pe-3 text-start align-bottom font-medium">
                    {t(`insurance.changes.columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows.map((row) => (row.kind === 'change' ? <ChangeTr key={row.key} row={row} /> : <LogTr key={row.key} row={row} />))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function WhenWho({ at, by }: { at: string; by: string }) {
  return (
    <>
      <td className="py-1.5 pe-3 whitespace-nowrap tabular-nums">
        <Ltr>{at}</Ltr>
      </td>
      <td className="py-1.5 pe-3">
        <bdi>{by}</bdi>
      </td>
    </>
  )
}

function LogTr({ row }: { row: LogRow }) {
  const { t } = useTranslation('document')
  return (
    <tr className="border-b border-border align-top text-muted-foreground last:border-b-0" data-timeline-log={row.action}>
      <WhenWho at={row.at} by={row.by} />
      <td className="py-1.5 pe-3">
        <span className="me-1.5 text-xs">{t('insurance.changes.log')}</span>
        <bdi>{row.description || row.action}</bdi>
      </td>
      <td className="py-1.5 pe-3" colSpan={2}>
        {row.note && <bdi>{row.note}</bdi>}
      </td>
    </tr>
  )
}

/** `before → after`, each side its own whole value; a missing side is said. */
function Sides({ label, sides }: { label: string; sides: BeforeAfter }) {
  const { t } = useTranslation('document')
  const side = (v: string | null) => (v === null ? <span className="italic">{t('insurance.changes.nothing')}</span> : <Ltr>{v}</Ltr>)
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {side(sides.before)}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
      {side(sides.after)}
    </span>
  )
}

function MoneySide({ money, side }: { money: ChangeMoneyView; side: 'before' | 'after' }) {
  const { t } = useTranslation('document')
  if (money.kind === 'notRecorded')
    return (
      <span className="text-muted-foreground italic" data-change-money={side} data-not-recorded="">
        {t('insurance.changes.notRecorded')}
      </span>
    )
  const badge = moneySourceBadge(money.source)
  return (
    <span className="flex flex-col gap-0.5" data-change-money={side} data-change-source={money.source}>
      <span>
        <StatusBadge sev={badge.sev}>{badge.code === 'unknown' ? <Ltr>{money.source}</Ltr> : t(badge.labelKey)}</StatusBadge>
      </span>
      <span className="text-xs">
        <span className="text-muted-foreground">{t('insurance.changes.patient')}</span> <InsuranceCell cell={money.patient} />
      </span>
      <span className="text-xs">
        <span className="text-muted-foreground">{t('insurance.changes.insurer')}</span> <InsuranceCell cell={money.insurer} />
      </span>
    </span>
  )
}

function ChangeTr({ row }: { row: ChangeRow }) {
  const { t } = useTranslation('document')
  const notRecorded = row.before.kind === 'notRecorded' && row.after.kind === 'notRecorded'
  return (
    <tr
      className={`border-b border-border align-top last:border-b-0 ${row.channelToEngine ? 'bg-attention-050' : ''}`}
      data-timeline-change={row.act}
      data-channel-to-engine={row.channelToEngine ? '' : undefined}
    >
      <WhenWho at={row.at} by={row.by} />
      <td className="py-1.5 pe-3">
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge sev="mute">{row.actKey ? t(row.actKey) : <Ltr>{row.act}</Ltr>}</StatusBadge>
          {row.lineNumber !== null && (
            <span className="text-xs text-muted-foreground">
              {t('insurance.changes.line')} <Ltr>{row.lineNumber}</Ltr>
            </span>
          )}
        </div>
      </td>
      <td className="py-1.5 pe-3">
        <div className="flex flex-col gap-0.5">
          {row.item && <Sides label={t('insurance.changes.item')} sides={row.item} />}
          {row.quantity && <Sides label={t('insurance.changes.quantity')} sides={row.quantity} />}
          {row.reason && (
            <span className="text-xs text-muted-foreground" data-change-reason="">
              {t('insurance.changes.reason')} <bdi>{row.reason}</bdi>
            </span>
          )}
        </div>
      </td>
      <td className="py-1.5 pe-3">
        {notRecorded ? (
          <span className="flex flex-col" data-change-money="both" data-not-recorded="">
            <span className="text-muted-foreground italic">{t('insurance.changes.notRecorded')}</span>
            <span className="text-xs text-muted-foreground">{t('insurance.changes.notRecordedNote')}</span>
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <MoneySide money={row.before} side="before" />
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
              <MoneySide money={row.after} side="after" />
            </div>
            {row.channelToEngine && (
              <span className="text-xs font-medium text-attention-800" data-change-channel-to-engine="">
                {t('insurance.changes.channelToEngine')}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
