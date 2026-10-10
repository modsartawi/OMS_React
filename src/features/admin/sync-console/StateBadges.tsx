import { stateBadge } from './helpers'
import CodeBadgeView from './CodeBadgeView'

/**
 * A store's states as badges, in the order the door sent them (ticket 445). The
 * label and colour come from `stateBadge`; a state this bundle does not know is
 * drawn neutral with its raw code rather than a guessed word.
 */
export default function StateBadges({ states }: { states: readonly string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-states={states.join(' ')}>
      {/* Keyed by position too: a door that repeated a state must not collide two badges. */}
      {states.map((state, i) => (
        <CodeBadgeView key={`${i}-${state}`} badge={stateBadge(state)} code={state} />
      ))}
    </span>
  )
}
