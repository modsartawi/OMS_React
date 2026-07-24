import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import type { DerivedStatus } from './helpers'

/** The one status pill, shared by the grid and the detail pane. Renders through
 *  the core badge (ticket 086) — this component's job is now only key → label. */
export default function StatusPill({ status }: { status: DerivedStatus }) {
  const { t } = useTranslation('ua-admin')
  return <StatusBadge sev={status.sev}>{t(`status.${status.key}`)}</StatusBadge>
}
