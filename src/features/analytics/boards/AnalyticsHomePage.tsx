import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ChartColumn, LayoutDashboard, Plus, SearchX } from 'lucide-react'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsItem, AnalyticsLabel, AnalyticsModel } from '@/core/models/analytics'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair, fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import AskBox from './AskBox'
import { ANALYTICS_ITEMS_KEY, ANALYTICS_MODEL_KEY, analyticsApi } from './api'
import { newViewLink } from './editor'
import { homeGroups } from './home'
import TierBadge from './TierBadge'
import { labelIn } from './view-model'
import { analyticsRefusal } from './wire'

/**
 * The analytics home at `/analytics` (spec 766 §F, user stories 3–6; ticket 770) — the menu leaf's
 * destination, behind `canViewAnalytics` like every analytics page.
 *
 * Reads `GET Analytics/Items` once and lists it in three groups — Certified, Shared, then Mine, newest
 * change first (`./home`) — each item with its tier badge, owner and last change. The search narrows the
 * one list by title in either language, without a call per key. An item opens `/analytics/board/:id` or
 * `/analytics/view/:id` by its kind.
 *
 * The toolbar row above the groups (`data-analytics-home-header`) is the page's header slot: 782's ask box
 * joins the search there.
 */
export default function AnalyticsHomePage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('home.title')} subtitle={t('home.subtitle')}>
      <HomeBody />
    </ScreenGate>
  )
}

const itemHref = (item: Pick<AnalyticsItem, 'id' | 'kind'>) =>
  `/analytics/${item.kind === 'board' ? 'board' : 'view'}/${encodeURIComponent(item.id)}`

/** The title an untitled view is shown (and found) by, in both languages: "<measure> by <dimension>". */
function generatedTitle(item: AnalyticsItem, model: AnalyticsModel | undefined): AnalyticsLabel {
  const q = item.definition.query
  const m = model?.measures.find((x) => x.key === q.measures[0])
  const d = model?.dimensions.find((x) => x.key === q.dimensions[0])
  if (item.kind !== 'view' || !m || !d) return { en: '', ar: '' }
  const say = (lng: 'en' | 'ar') =>
    i18n.getFixedT(lng, 'boards')('view.generatedTitle', { measure: labelIn(m.label, lng), dimension: labelIn(d.label, lng) })
  return { en: say('en'), ar: say('ar') }
}

function HomeBody() {
  const { t } = useTranslation('boards')
  const [search, setSearch] = useState('')
  const items = useQuery({ queryKey: ANALYTICS_ITEMS_KEY, queryFn: () => analyticsApi.items(), retry: false })
  // Only to name untitled views; the list never waits on it.
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })

  const fallback = useMemo(() => {
    const m = model.data
    return (it: AnalyticsItem) => generatedTitle(it, m)
  }, [model.data])
  const groups = useMemo(() => homeGroups(items.data ?? [], search, fallback), [items.data, search, fallback])

  let body: ReactNode
  if (items.error) {
    const refusal = analyticsRefusal(items.error, t('home.loadFailed'))
    body = <ErrorBanner title={t('home.loadFailed')} message={'key' in refusal ? t(refusal.key) : refusal.message} />
  } else if (!items.data) {
    body = (
      <div className="text-sm text-muted-foreground" role="status">
        {t('home.loading')}
      </div>
    )
  } else if (items.data.length === 0) {
    body = (
      <div className="rounded-lg border border-border/60 bg-card p-6 text-sm" data-analytics-home-empty>
        <p className="font-medium">{t('home.emptyTitle')}</p>
        <p className="mt-1 text-muted-foreground">{t('home.empty')}</p>
      </div>
    )
  } else if (groups.length === 0) {
    body = (
      <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground" data-analytics-home-no-match>
        <SearchX className="size-4" aria-hidden />
        {t('home.noMatch', { search: fsi(search.trim()) })}
      </p>
    )
  } else {
    body = groups.map((g) => (
      <section key={g.tier} className="flex flex-col gap-2" data-analytics-group={g.tier}>
        <h2 className="flex items-baseline gap-2 text-sm font-semibold tracking-tight">
          {t(`home.group.${g.tier}`)}
          <span className="text-xs font-normal text-muted-foreground">
            <Ltr>{g.items.length}</Ltr>
          </span>
        </h2>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
          {g.items.map((it) => (
            <HomeRow key={it.id} item={it} title={labelIn(it.title, i18n.language) || labelIn(fallback(it), i18n.language)} />
          ))}
        </ul>
      </section>
    ))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3" data-analytics-home-header>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('home.searchPlaceholder')}
          aria-label={t('home.searchLabel')}
          wrapperClassName="w-80 max-w-full"
          data-analytics-home-search
        />
        <AskBox />
        {/* 775: build a view from the model. */}
        <Link to={newViewLink().to} className={buttonClass('secondary')} data-analytics-new-view>
          <Plus className="size-4" aria-hidden />
          {t('editor.newView')}
        </Link>
      </div>
      {body}
    </div>
  )
}

function HomeRow({ item, title }: { item: AnalyticsItem; title: string }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const KindIcon = item.kind === 'board' ? LayoutDashboard : ChartColumn
  const changed = formatPair(formatDay(item.updatedAt, lang), formatClock(item.updatedAt, lang))
  return (
    <li data-analytics-item={item.id}>
      <Link
        to={itemHref(item)}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-label={t(`home.kind.${item.kind}`)} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-analytics-item-title>
          <bdi>{title || t('home.untitled')}</bdi>
        </span>
        <span data-analytics-item-tier={item.tier}>
          <TierBadge tier={item.tier} />
        </span>
        <span className="text-xs text-muted-foreground" data-analytics-item-owner>
          <Trans t={t} i18nKey="home.owner" values={{ owner: item.owner }} components={{ owner: <bdi /> }} />
        </span>
        {changed && (
          <span className="text-xs text-muted-foreground" data-analytics-item-changed>
            <Trans t={t} i18nKey="home.changed" values={{ at: changed }} components={{ at: <Ltr /> }} />
          </span>
        )}
      </Link>
    </li>
  )
}
