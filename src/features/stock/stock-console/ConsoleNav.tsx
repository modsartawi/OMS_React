import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { CONSOLE_PAGES, consolePageActive } from './console-pages'

/**
 * The stock console's top links (oms 940): Stores now; Find an item or a batch (943) and Feeds and switches (942) join
 * with their tickets. The menu keeps its one leaf; these are the way between the console's pages. Which link is lit is
 * `./console-pages`' (pure, tested): Stores stays lit on a store's and an item's page.
 */
export default function ConsoleNav() {
  const { t } = useTranslation('stock-console')
  const { pathname } = useLocation()
  return (
    <nav aria-label={t('nav.label')} className="flex gap-1 border-b border-border/60" data-console-nav="">
      {CONSOLE_PAGES.map((p) => {
        const active = consolePageActive(p, pathname)
        return (
          <Link
            key={p.key}
            to={p.to}
            aria-current={active ? 'page' : undefined}
            data-console-page={p.key}
            className={
              'border-b-2 px-3 py-1.5 text-sm transition-colors ' +
              (active
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`nav.${p.key}`)}
          </Link>
        )
      })}
    </nav>
  )
}
