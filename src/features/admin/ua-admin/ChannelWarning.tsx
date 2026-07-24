import { useTranslation } from 'react-i18next'
import { hasDestination, normalizeChannel } from './helpers'

/**
 * The alert an administrator sees while the channel they have CHOSEN has nothing
 * to send to (ticket 722). Unlike `ChannelPill` — which reports the stored record
 * — this reads the pending edit, so the consequence is visible before the save
 * rather than after.
 *
 * Both surfaces render it from the one `hasDestination` rule; a hand-rolled
 * `channel === 'email' && !email` at each call site would be the same rule
 * spelled a third and fourth time.
 */
export default function ChannelWarning({
  phoneClass,
  email,
  deliveryChannel,
  className,
}: {
  phoneClass: string
  email: string
  deliveryChannel: string
  className: string
}) {
  const { t } = useTranslation('ua-admin')
  if (hasDestination({ phoneClass, email, deliveryChannel })) return null
  const key = normalizeChannel(deliveryChannel) === 'email' ? 'warnNoEmail' : 'warnNoPhone'
  return (
    <p className={className} role="alert">
      {t(`delivery.${key}`)}
    </p>
  )
}
