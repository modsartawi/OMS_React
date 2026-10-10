import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { CodeBadge } from './helpers'

/**
 * A `codeBadge` drawn: the label when the bundle knows the code, else the raw code,
 * isolated as a machine value, on the neutral badge. The one renderer of the
 * console's state, outcome and line badges.
 */
export default function CodeBadgeView({ badge, code }: { badge: CodeBadge; code: string }) {
  const { t } = useTranslation('sync-console')
  return <StatusBadge sev={badge.sev}>{badge.labelKey ? t(badge.labelKey) : <Ltr>{code}</Ltr>}</StatusBadge>
}
