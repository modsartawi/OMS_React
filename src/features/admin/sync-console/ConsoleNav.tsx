import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { consolePages } from './console-pages'
import { usePermissions } from '@/core/permissions'

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
 *
 * Objects (ticket 662) is a read, shown to every console holder: the push objects and whether
 * the stores are enrolled. Its Enrol control is the page's, behind `canEnrol`.
 *
 * Scripts (ticket 663) is a read too, shown to every console holder: the store scripts sent and
 * each store's state. Its Send, Withdraw and Retry (664) are the page's, behind `canRunScripts`.
 *
 * Store database (oms 915, BackOffice spec 4016) is shown only with its own View grant.
 * The pages and their gating live in `./console-pages` (pure, tested).
 */
export default function ConsoleNav() {
  const { t } = useTranslation('sync-console')
  const pages = consolePages(usePermissions())
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
