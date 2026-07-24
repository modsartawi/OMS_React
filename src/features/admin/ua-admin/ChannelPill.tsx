import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { channelMark } from './helpers'

/** Which channel a person's one-time codes go down, and whether that channel can
 *  actually reach them (ticket 722). Shared by the grid column and the detail
 *  pane so "on email with no address" reads identically in both. */
export default function ChannelPill({
  phoneClass,
  email,
  deliveryChannel,
}: {
  phoneClass: string
  email?: string
  deliveryChannel?: string
}) {
  const { t } = useTranslation('ua-admin')
  const mark = channelMark({ phoneClass, email, deliveryChannel })
  return <StatusBadge sev={mark.sev}>{t(`delivery.${mark.key}`)}</StatusBadge>
}
