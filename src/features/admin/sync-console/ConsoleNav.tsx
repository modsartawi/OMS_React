import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { canReplayReceipts, syncConsoleAccessQuery } from './api'
import { wizardStart } from './onboard-helpers'
import { REPLAY_PATH } from './replay-draft'

/**
 * The console's own page links (ticket 447), the prototype's top bar: the Fleet, the
 * fleet's Recent passes, the fleet-wide Commands (448) and Audit, then New store and
 * Sync pending (449).
 * The menu keeps its one leaf; these are the way between the console's pages.
 *
 * New store is the wizard, which is nothing but controls: a holder who may onboard
 * nothing (`wizardStart` is `null`) is not shown the link. Sync pending is a read.
 *
 * Replay (spec 470, ticket 472) is shown only with `canReplay`, which does not need
 * `canOperate`; its page keeps its own in-page denial behind a hand-typed link.
 */
const PAGES = [
  { to: '/admin/sync', key: 'fleet', end: true },
  { to: '/admin/sync/passes', key: 'passes', end: false },
  { to: '/admin/sync/commands', key: 'commands', end: false },
  { to: '/admin/sync/audit', key: 'audit', end: false },
  { to: '/admin/sync/new-store', key: 'newStore', end: false },
  { to: '/admin/sync/pending', key: 'pending', end: false },
  { to: REPLAY_PATH, key: 'replay', end: false },
] as const

export default function ConsoleNav() {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const canOnboardAny = wizardStart(access.data, null) !== null
  const canReplay = canReplayReceipts(access.data)
  const pages = PAGES.filter((p) => (p.key !== 'newStore' || canOnboardAny) && (p.key !== 'replay' || canReplay))
  return (
    <nav aria-label={t('nav.label')} className="flex gap-1 border-b border-border/60" data-console-nav="">
      {pages.map((p) => (
        <NavLink
          key={p.key}
          to={p.to}
          end={p.end}
          data-console-page={p.key}
          className={({ isActive }) =>
            'border-b-2 px-3 py-1.5 text-sm transition-colors ' +
            (isActive
              ? 'border-primary font-semibold text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground')
          }
        >
          {t(`nav.${p.key}`)}
        </NavLink>
      ))}
    </nav>
  )
}
