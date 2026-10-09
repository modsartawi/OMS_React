import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import Ltr from '@/core/ui/Ltr'
import { stateBadge } from './helpers'

/**
 * A store's states as badges, in the order the door sent them (ticket 445). The
 * label and colour come from `stateBadge`; a state this bundle does not know is
 * drawn neutral with its raw code rather than a guessed word.
 */
export default function StateBadges({ states }: { states: readonly string[] }) {
  const { t } = useTranslation('sync-console')
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-states={states.join(' ')}>
      {/* Keyed by position too: a door that repeated a state must not collide two badges. */}
      {states.map((state, i) => {
        const { labelKey, sev } = stateBadge(state)
        return (
          <StatusBadge key={`${i}-${state}`} sev={sev}>
            {labelKey ? t(labelKey) : <Ltr>{state}</Ltr>}
          </StatusBadge>
        )
      })}
    </span>
  )
}
