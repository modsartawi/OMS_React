import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { StoreDetail } from '@/core/models/sync-console'
import { stateBadge } from './helpers'
import { hostBadge } from './store-helpers'
import CodeBadgeView from './CodeBadgeView'
import StateBadges from './StateBadges'

/**
 * The store page's header (ticket 446): the code, the description, the host, the
 * door's states and the "pending" badge.
 *
 * The pending badge reads `controlPending` and nothing else, so it is left out of
 * the state badges beside it — the Fleet table's split, kept on this page.
 */
export default function StoreHeader({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
      <h2 className="font-mono text-2xl font-medium" data-store-code="">
        <Ltr>{row.code}</Ltr>
      </h2>
      <bdi className="text-sm">{row.description}</bdi>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-store-host={row.host}>
        {t('store.host')}
        <CodeBadgeView badge={hostBadge(row.host)} code={row.host} />
      </span>
      <StateBadges states={row.states.filter((s) => s !== 'controlPending')} />
      {row.controlPending && (
        <span data-control-pending="">
          <StatusBadge sev={stateBadge('controlPending').sev}>{t('store.pending')}</StatusBadge>
        </span>
      )}
    </div>
  )
}
