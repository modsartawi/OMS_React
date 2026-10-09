import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

/**
 * The console's own page links (ticket 447), the prototype's top bar: the Fleet and
 * the fleet-wide Audit. 448 and 449 add Commands, New store and Sync pending here.
 * The menu keeps its one leaf; these are the way between the console's pages.
 */
const PAGES = [
  { to: '/admin/sync', key: 'fleet', end: true },
  { to: '/admin/sync/audit', key: 'audit', end: false },
] as const

export default function ConsoleNav() {
  const { t } = useTranslation('sync-console')
  return (
    <nav aria-label={t('nav.label')} className="flex gap-1 border-b border-border/60" data-console-nav="">
      {PAGES.map((p) => (
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
