import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { StoreDetail } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
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
 *
 * A disabled store (BackOffice 3913, ticket 900) adds one line under it: who disabled
 * it, when, and why, so anyone opening it knows it was taken out on purpose.
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
      {row.isDisabled === true && (
        <p className="basis-full text-sm text-muted-foreground" data-store-disabled="">
          <Trans
            t={t}
            i18nKey="store.disabled"
            // A stamp the door did not record reads "Not recorded", never a gap in the sentence.
            values={{
              who: row.disabledBy || t('store.unrecorded'),
              at: row.disabledAt ? formatDateTime(row.disabledAt) : t('store.unrecorded'),
              reason: row.disableReason || t('store.unrecorded'),
            }}
            components={{ who: <bdi />, at: row.disabledAt ? <Ltr /> : <bdi />, reason: <bdi /> }}
          />
        </p>
      )}
    </div>
  )
}
