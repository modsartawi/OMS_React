import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { StoreRow } from '@/core/models/sync-console'
import { figure, mirrorLaneChip } from './helpers'

/**
 * A store's mirror lane as one compact chip (spec 2563, ticket 456): its till backlog,
 * inbox pending and open dead letters, coloured by the worst mirror state the door
 * sent (`mirrorLaneChip`). A store the mirror rail does not sweep reads "not on mirror",
 * muted, with no state. The states' words are the row's state badges; hovering the
 * chip names the worst one.
 */
export default function MirrorLaneChipView({ row }: { row: Pick<StoreRow, 'mirror' | 'states'> }) {
  const { t } = useTranslation('sync-console')
  const chip = mirrorLaneChip(row)
  if (chip.kind === 'notOnMirror')
    return (
      <span data-mirror-lane="notOnMirror">
        <StatusBadge sev={chip.sev}>{t('mirror.notOnMirror')}</StatusBadge>
      </span>
    )
  return (
    <span
      data-mirror-lane="onMirror"
      data-mirror-sev={chip.sev}
      data-mirror-worst={chip.worst ?? ''}
      title={chip.worst ? t(`states.${chip.worst}`) : t('mirror.healthy')}
    >
      <StatusBadge sev={chip.sev}>
        <span className="inline-flex items-center gap-2.5">
          <Segment label={t('mirror.chip.tillBacklog')} data="tillBacklog">
            {chip.tillBacklogCount === null ? t('mirror.chip.notMeasured') : <Ltr>{figure(chip.tillBacklogCount)}</Ltr>}
          </Segment>
          <Segment label={t('mirror.chip.inboxPending')} data="inboxPending">
            <Ltr>{figure(chip.inboxPending)}</Ltr>
          </Segment>
          <Segment label={t('mirror.chip.deadLetters')} data="deadLetters">
            <Ltr>{figure(chip.openDeadLetters)}</Ltr>
          </Segment>
        </span>
      </StatusBadge>
    </span>
  )
}

function Segment({ label, data, children }: { label: string; data: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" data-chip={data}>
      <span className="font-normal opacity-80">{label}</span>
      <span className="font-mono tabular-nums">{children}</span>
    </span>
  )
}
