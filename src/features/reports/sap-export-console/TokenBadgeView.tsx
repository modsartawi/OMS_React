import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { LABEL_TOKEN_CLASS, type TokenBadge } from './label-helpers'

/**
 * A label, flag or verdict drawn as a pill: its words when the bundle knows the value, else
 * the raw value isolated as a machine value, on the neutral token. The console's one badge
 * renderer — `StatusBadge`'s shape, with the console's six tokens (`./label-helpers`).
 */
export default function TokenBadgeView({ badge, value }: { badge: TokenBadge; value: string }) {
  const { t } = useTranslation('sap-export-console')
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LABEL_TOKEN_CLASS[badge.token]}`}
      data-token={badge.token}
    >
      {badge.labelKey ? t(badge.labelKey) : <Ltr>{value}</Ltr>}
    </span>
  )
}
