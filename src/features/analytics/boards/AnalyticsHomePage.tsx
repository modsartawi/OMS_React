import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ChartColumn, FileText, LayoutDashboard, Library, Plus } from 'lucide-react'
import { itemHref } from '@/core/analytics-routes'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsItem } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair } from '@/core/util/bidi'
import { analyticsAccessQuery, canCurateAnalytics, canViewAnalytics } from './access'
import AnalyticsStatus from './AnalyticsStatus'
import AskBox from './AskBox'
import { homeNewLinks, homeSections, type HomeNewLink, type HomeSection } from './home-page'
import { ALL_ITEMS_PATH } from './library-pages'
import { analyticsHomeQuery } from './api'
import PinToggle from './PinToggle'
import TierBadge from './TierBadge'
import { analyticsRefusal, refusalWords } from './wire'

/**
 * The analytics Home at `/analytics` (ticket 840, BackOffice spec 3437 §G, user stories 3–7, 16): where an analytics
 * user lands. It reads `GET Analytics/Home` and shows three sections — Recent (my last 10 opens, recorded by the
 * server when an item is read), Pinned (all my pins) and New in Certified (the 5 newest) — each with its own empty
 * state, plus the ask box and, for an author, the New buttons (a runner builds nothing, 822). Every row has a pin
 * toggle. "All my items" opens the whole library (`/analytics/library`, `./AnalyticsLibraryPage`).
 *
 * Home items carry no definition, so an untitled view shows as Untitled here (no generated title).
 */
export default function AnalyticsHomePage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('home.title')} subtitle={t('home.subtitle')}>
      <HomeBody />
    </ScreenGate>
  )
}

const NEW_ICON: Record<HomeNewLink['key'], typeof Plus> = { view: Plus, board: LayoutDashboard, report: FileText }
const NEW_LABEL: Record<HomeNewLink['key'], string> = { view: 'editor.newView', board: 'boardEditor.newBoard', report: 'designer.newReport' }

function HomeBody() {
  const { t } = useTranslation('boards')
  const access = useQuery(analyticsAccessQuery())
  const home = useQuery(analyticsHomeQuery())
  const links = homeNewLinks(access.data)

  let body
  if (home.error) {
    body = <ErrorBanner title={t('home.sections.loadFailed')} message={refusalWords(analyticsRefusal(home.error, t('home.sections.loadFailed')), t)} />
  } else if (!home.data) {
    body = (
      <div className="text-sm text-muted-foreground" role="status">
        {t('home.sections.loading')}
      </div>
    )
  } else {
    body = homeSections(home.data).map((s) => <HomeSectionList key={s.key} section={s} />)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3" data-analytics-home-header>
        <AskBox />
        {links.map((l) => {
          const Icon = NEW_ICON[l.key]
          return (
            <Link key={l.key} to={l.to} className={buttonClass('secondary')} data-analytics-new={l.key}>
              <Icon className="size-4" aria-hidden />
              {t(NEW_LABEL[l.key])}
            </Link>
          )
        })}
        <Link to={ALL_ITEMS_PATH} className={`${buttonClass('ghost')} ms-auto`} data-analytics-home-all>
          <Library className="size-4" aria-hidden />
          {t('home.sections.allItems')}
        </Link>
      </div>
      {canCurateAnalytics(access.data) && <AnalyticsStatus />}
      {body}
    </div>
  )
}

function HomeSectionList({ section }: { section: HomeSection }) {
  const { t } = useTranslation('boards')
  return (
    <section className="flex flex-col gap-2" data-analytics-home-section={section.key}>
      <h3 className="text-sm font-semibold tracking-tight">{t(`home.sections.${section.key}.title`)}</h3>
      {section.empty ? (
        <p className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground" data-analytics-home-section-empty={section.key}>
          {t(`home.sections.${section.key}.empty`)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
          {section.items.map((it) => (
            <HomeItemRow key={it.id} item={it} />
          ))}
        </ul>
      )}
    </section>
  )
}

const kindIcon = (kind: AnalyticsItem['kind']) => (kind === 'board' ? LayoutDashboard : kind === 'report' ? FileText : ChartColumn)

function HomeItemRow({ item }: { item: AnalyticsItem }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const KindIcon = kindIcon(item.kind)
  const title = saysIn(item.title, lang)
  const changed = formatPair(formatDay(item.updatedAt, lang), formatClock(item.updatedAt, lang))
  return (
    <li className="flex items-center gap-1 pe-2" data-analytics-home-item={item.id}>
      <Link
        to={itemHref(item.kind, item.id)}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-label={t(`home.kind.${item.kind}`)} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-analytics-item-title>
          <bdi>{title || t('home.untitled')}</bdi>
        </span>
        <TierBadge tier={item.tier} />
        <span className="text-xs text-muted-foreground">
          <Trans t={t} i18nKey="home.owner" values={{ owner: item.owner }} components={{ owner: <bdi /> }} />
        </span>
        {changed && (
          <span className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="home.changed" values={{ at: changed }} components={{ at: <Ltr /> }} />
          </span>
        )}
      </Link>
      <PinToggle item={item} title={title} />
    </li>
  )
}
