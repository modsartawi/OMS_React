import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { helpHref } from '@/core/help/help-routes'
import type { Permissions } from '@/core/permissions'
import type { HelpArticleMeta, HelpLang } from '@/core/models/help'
import HelpAccessBadge from './HelpAccessBadge'
import { inReadingOrder } from './help-contents'

/**
 * The contents rail (oms 951, BackOffice spec 4182 §D): the area's articles in reading order, each a link with its
 * access badge. Every article stays a link — the help is readable whatever the reader holds.
 */
export default function HelpContentsRail({
  area,
  articles,
  activeSlug,
  permissions,
  lang,
}: {
  area: string
  articles: readonly HelpArticleMeta[]
  activeSlug: string | null
  permissions: Permissions
  lang: HelpLang
}) {
  const { t } = useTranslation('help', { lng: lang })
  return (
    <nav aria-label={t('contents.label')} data-help-contents>
      <ol className="flex flex-col gap-1">
        {inReadingOrder(articles).map((a) => {
          const active = a.slug === activeSlug
          return (
            <li key={a.slug} data-help-entry={a.slug} className={`flex flex-col gap-1 rounded-md px-2 py-1.5 ${active ? 'bg-primary-050' : ''}`}>
              <Link
                to={helpHref(area, a.slug)}
                aria-current={active ? 'page' : undefined}
                className={`text-sm ${active ? 'font-semibold text-primary' : 'text-foreground hover:text-primary'}`}
              >
                <bdi>{a.title}</bdi>
              </Link>
              <HelpAccessBadge access={a.access} permissions={permissions} lang={lang} quiet />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
