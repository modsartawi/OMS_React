import { useTranslation } from 'react-i18next'

import type { PatternDispense } from '@/core/models/insurance-patterns'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { counted } from './words'

/**
 * A case's timeline (oms 922; BackOffice spec 4050 story 12): every dispense in time order — store, time, item, quantity,
 * days' supply, payer, channel and the pharmacist's user name (needed to spot a staff pattern; not the patient's
 * identity). A delivery or online dispense is marked: on the map it is a point, never a leg.
 */
export default function CaseTimeline({ dispenses }: { dispenses: PatternDispense[] }) {
  const { t } = useTranslation('insurance-patterns')
  const rows = [...dispenses].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.eventId - b.eventId))
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="pattern-timeline-title" data-testid="pattern-timeline">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 id="pattern-timeline-title" className="text-sm font-semibold">
          {t('case.timeline.title')}
        </h3>
        <span className="text-xs text-muted-foreground">{t('case.timeline.count', counted(rows.length))}</span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className={TH}>{t('case.timeline.store')}</th>
              <th className={TH}>{t('case.timeline.at')}</th>
              <th className={TH}>{t('case.timeline.item')}</th>
              <th className={`${TH} text-end`}>{t('case.timeline.quantity')}</th>
              <th className={`${TH} text-end`}>{t('case.timeline.daysSupply')}</th>
              <th className={TH}>{t('case.timeline.payer')}</th>
              <th className={TH}>{t('case.timeline.channel')}</th>
              <th className={TH}>{t('case.timeline.pharmacist')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.eventId} className="border-t border-border/60" data-testid="pattern-dispense" data-counter={d.counter}>
                <td className={TD}>
                  <Ltr>{formatPair(d.storeCode, d.storeName)}</Ltr>
                </td>
                <td className={TD}>
                  <Ltr>{formatDateTime(d.at)}</Ltr>
                </td>
                <td className={`${TD} whitespace-normal`}>
                  <Ltr>{formatPair(d.itemNumber, d.itemDescription)}</Ltr>
                </td>
                <td className={`${TD} text-end tabular-nums`}>
                  <Ltr>{formatFigure(d.quantity)}</Ltr>
                </td>
                <td className={`${TD} text-end tabular-nums`}>
                  {d.daysSupply === null ? <span className="text-muted-foreground">{t('case.timeline.daysUnknown')}</span> : <Ltr>{formatFigure(d.daysSupply)}</Ltr>}
                </td>
                <td className={TD}>
                  <Ltr>{d.payer}</Ltr>
                </td>
                <td className={TD}>
                  <span className="flex flex-wrap items-center gap-1">
                    <bdi>{d.channel}</bdi>
                    {!d.counter && <StatusBadge sev="mute">{t('case.timeline.delivery')}</StatusBadge>}
                  </span>
                </td>
                <td className={TD}>
                  <Ltr>{d.pharmacist}</Ltr>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
