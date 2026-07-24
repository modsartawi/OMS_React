import { useTranslation } from 'react-i18next'
import { DELIVERY_CHANNELS, type DeliveryChannel } from './helpers'

/**
 * The EXPLICIT delivery-channel choice, shared by the create modal and the detail
 * pane (ticket 722). Deliberately not inferred from which contact field is filled
 * in: an administrator marking someone `email` and leaving the address blank is
 * making a choice the server honours, so the screen must let them make it — and
 * then show the consequence, rather than quietly switching them back to SMS.
 */
export default function ChannelSelect({
  id,
  value,
  onChange,
  className,
  disabled,
}: {
  id: string
  value: DeliveryChannel
  onChange: (value: DeliveryChannel) => void
  className: string
  disabled?: boolean
}) {
  const { t } = useTranslation('ua-admin')
  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      aria-label={t('delivery.label')}
      onChange={(e) => onChange(e.target.value as DeliveryChannel)}
    >
      {DELIVERY_CHANNELS.map((c) => (
        <option key={c} value={c}>
          {t(`delivery.${c}`)}
        </option>
      ))}
    </select>
  )
}
