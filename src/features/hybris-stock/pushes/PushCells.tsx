import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { statusLabel, targetLabel, typeLabel } from './push-labels'

/** A push's type in words (ticket 849). */
export function PushType({ type }: { type: string }) {
  const { t } = useTranslation('hybris-stock-pushes')
  return <span data-push-type={type}>{t(typeLabel(type))}</span>
}

/** A push's status — "Delivered to hot folder", never "live on the website". */
export function PushStatus({ status }: { status: string }) {
  const { t } = useTranslation('hybris-stock-pushes')
  const s = statusLabel(status)
  return (
    <span data-push-status={status}>
      <StatusBadge sev={s.sev}>{t(s.key)}</StatusBadge>
    </span>
  )
}

/** Where a push's files went — a shadow path Hybris does not import, or the live hot folder. */
export function PushTarget({ target }: { target: string }) {
  const { t } = useTranslation('hybris-stock-pushes')
  const s = targetLabel(target)
  return (
    <span data-push-target={target}>
      <StatusBadge sev={s.sev}>{t(s.key)}</StatusBadge>
    </span>
  )
}
