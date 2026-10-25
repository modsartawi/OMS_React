import { useTranslation } from 'react-i18next'
import type { HungerStationPushStatus, HungerStationSyncLine } from '@/core/models/hungerstation'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { TD } from '@/core/ui/sheet-table'
import { pushReading, readLine } from './sync-history'

// The cells the logs drawer, a push's lines and a material's history share (ticket 554).

/** A push's type in words; a value the contract does not name is shown as sent. */
export function PushType({ syncType }: { syncType: string }) {
  const { t } = useTranslation('hungerstation-stores')
  return syncType === 'F' || syncType === 'D' ? <>{t(`logs.type.${syncType}`)}</> : <Ltr>{syncType}</Ltr>
}

/** A push's status badge: Success, Error (red), or Running for a push with no end yet. */
export function PushStatus({ push }: { push: { status: HungerStationPushStatus; endTime?: string | null } }) {
  const { t } = useTranslation('hungerstation-stores')
  const reading = pushReading(push)
  if (reading === 'running') return <StatusBadge sev="mute">{t('logs.running')}</StatusBadge>
  return (
    <StatusBadge sev={reading === 'failed' ? 'bad' : 'ok'}>
      {push.status === 'S' || push.status === 'E' ? t(`pushStatus.${push.status}`) : <Ltr>{push.status}</Ltr>}
    </StatusBadge>
  )
}

/** A value the push did not send: blank (its title says why), never a zero. */
function NotSent() {
  const { t } = useTranslation('hungerstation-stores')
  return <span className="block min-h-4" title={t('lines.notSent')} data-not-sent="" />
}

/**
 * A line's sent values: active (an inactive line marked), quantity, maximum sales quantity, and the
 * price at 3 decimals with its currency — each machine value isolated whole. A `null` is blank.
 */
export function LineCells({ line }: { line: Pick<HungerStationSyncLine, 'active' | 'quantity' | 'maximumSalesQuantity' | 'price' | 'currencyKey'> }) {
  const { t } = useTranslation('hungerstation-stores')
  const r = readLine(line)
  return (
    <>
      <td className={TD} data-line-active={r.active ?? ''}>
        {r.active == null ? (
          <NotSent />
        ) : (
          <StatusBadge sev={r.active === 'active' ? 'ok' : 'warn'}>{t(`lines.active.${r.active}`)}</StatusBadge>
        )}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-line-quantity="">
        {r.quantity == null ? <NotSent /> : <Ltr>{r.quantity}</Ltr>}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-line-max-sales="">
        {r.maximumSalesQuantity == null ? <NotSent /> : <Ltr>{r.maximumSalesQuantity}</Ltr>}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-line-price="">
        {r.price == null ? <NotSent /> : <Ltr>{r.price}</Ltr>}
      </td>
    </>
  )
}
