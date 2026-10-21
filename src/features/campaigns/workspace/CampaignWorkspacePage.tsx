import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, History, LayoutGrid, ListTree, Loader2, SlidersHorizontal, Ticket, type LucideIcon } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ruleCampaignQuery } from '@/core/rules/api'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import { campaignPath, campaignState } from '@/core/rules/campaign-state'
import { draftStateInput } from './settings-form'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import type { WorkspaceContext } from './context'
import { drawnMenu, drawnSettings, type WorkspaceMenuKey } from './menu'
import { useWorkspaceList, type StepTarget } from './useWorkspaceList'

/** Each menu item's icon — here, not in `./menu`, so the menu's rules stay a pure, React-free module. */
const MENU_ICON: Record<WorkspaceMenuKey, LucideIcon> = { dashboard: LayoutGrid, rules: ListTree, coupons: Ticket, versions: History }

function MenuIcon({ item }: { item: WorkspaceMenuKey }) {
  const Icon = MENU_ICON[item]
  return <Icon className="h-4 w-4" aria-hidden />
}

/** Prev or Next (537): a link when the neighbour is known, else disabled — at the list's end, or
 *  while the neighbouring page is read. */
function Step({ which, target }: { which: 'prev' | 'next'; target: StepTarget }) {
  const { t } = useTranslation('campaign-workspace')
  const Icon = which === 'prev' ? ChevronLeft : ChevronRight
  const body = (
    <>
      {which === 'next' && t(`listContext.${which}`)}
      <Icon className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {which === 'prev' && t(`listContext.${which}`)}
    </>
  )
  const look = 'inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium '
  if (target.state === 'ready')
    return (
      <Link to={target.to} className={look + 'text-foreground hover:bg-accent'} data-workspace-step={which} data-step-state="ready">
        {body}
      </Link>
    )
  return (
    <span aria-disabled="true" className={look + 'cursor-not-allowed text-muted-foreground opacity-60'} data-workspace-step={which} data-step-state={target.state}>
      {body}
    </span>
  )
}

/**
 * A campaign's workspace (ticket 501): its side menu beside the page, at `/campaigns/:id/…`. One
 * feature for the dashboard and, later, the builder, settings, coupons and versions — one cluster
 * sharing the campaign menu and, from 505, a draft.
 *
 * Since ticket 537 it knows the promotion's list it was opened from (`useWorkspaceList`): the way
 * back is that list as it was filtered, Prev / Next step through it, and every link of the menu keeps
 * the context. A direct link falls back to the Promotions list with no Prev / Next.
 */
export default function CampaignWorkspacePage() {
  const { t } = useTranslation('campaign-workspace')
  const { id = '' } = useParams()
  const campaign = useQuery(ruleCampaignQuery(id))
  const list = useWorkspaceList(id)
  const base = campaignPath(id)
  // Settings ▸ opens its pages beneath it, and is open whenever one of them is (ticket 509).
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onSettings = pathname.startsWith(`${base}/settings`)
  const [settingsOpen, setSettingsOpen] = useState(onSettings)
  useEffect(() => {
    if (onSettings) setSettingsOpen(true)
  }, [onSettings])

  const back = (
    <Link to={list.back} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" data-workspace-back="">
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      <span>
        {!list.context ? (
          t('back')
        ) : list.context.promotionCode === null ? (
          t('listContext.backNoPromotion')
        ) : (
          <Trans t={t} i18nKey="listContext.back" values={{ promotion: list.context.promotionCode }} components={{ c: <Ltr /> }} />
        )}
      </span>
    </Link>
  )

  if (campaign.isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    )
  }

  if (campaign.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        {back}
        <ErrorBanner className="w-full p-3" title={t('failedTitle')} message={apiErrorMessage(campaign.error, t('failed'))} />
      </div>
    )
  }

  const d = campaign.data
  const c = d.campaign
  const context: WorkspaceContext = { draft: d, listContext: list.context, back: list.back, link: list.link, uploadedFrom: list.uploadedFrom }

  return (
    <div className="flex min-w-0 flex-col gap-4 md:flex-row" data-workspace={d.code}>
      <aside
        aria-label={t('menu.label')}
        className="flex shrink-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 md:w-60 md:self-start"
      >
        {back}
        <div className="flex flex-col gap-1" data-workspace-name="">
          <b className="text-sm leading-snug">
            <bdi>{c.name.en || t('untitled')}</bdi>
          </b>
          {c.name.ar && (
            <bdi className="block text-sm leading-snug text-muted-foreground">
              {c.name.ar}
            </bdi>
          )}
          <span>
            <CampaignStateBadge state={campaignState(draftStateInput(d), new Date())} />
          </span>
        </div>
        {list.steps && (
          <div role="group" aria-label={t('listContext.steps')} className="flex items-center gap-1.5" data-workspace-steps="">
            <Step which="prev" target={list.steps.prev} />
            <Step which="next" target={list.steps.next} />
          </div>
        )}
        {list.failure != null && (
          <div data-workspace-list-failed="" data-denied={isBareDenial(list.failure) ? '' : undefined}>
            <ErrorBanner className="p-2" message={isBareDenial(list.failure) ? t('listContext.denied') : apiErrorMessage(list.failure, t('listContext.failed'))} />
          </div>
        )}
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t('menu.label')}</div>
        <nav className="flex flex-col gap-0.5">
          {drawnMenu(d.features).map((item) => (
            <NavLink
              key={item.key}
              to={list.link(item.to ? `${base}/${item.to}` : base)}
              end={!item.to}
              data-workspace-menu={item.key}
              className={({ isActive }) =>
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ' +
                (isActive ? 'bg-primary-050 font-medium text-primary-800' : 'text-foreground hover:bg-accent')
              }
            >
              <MenuIcon item={item.key} />
              {t(`menu.${item.key}`)}
            </NavLink>
          ))}
          <button
            type="button"
            aria-expanded={settingsOpen}
            onClick={() => {
              // From another page it lands on Settings' first page, as the prototype does, and opens
              // once it got there (a page with unsaved changes may keep the reader where they are).
              if (onSettings) setSettingsOpen((open) => !open)
              else navigate(list.link(`${base}/settings/details`))
            }}
            className={
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors ' +
              (onSettings ? 'font-medium text-primary-800' : 'text-foreground hover:bg-accent')
            }
            data-workspace-menu="settings"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="flex-1">{t('menu.settings')}</span>
            {settingsOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />}
          </button>
          {settingsOpen && (
            <div className="flex flex-col gap-0.5 ps-6" data-workspace-settings-menu="">
              {drawnSettings().map((page) => (
                <NavLink
                  key={page}
                  to={list.link(`${base}/settings/${page}`)}
                  data-workspace-settings={page}
                  className={({ isActive }) =>
                    'rounded-md px-2 py-1 text-sm transition-colors ' +
                    (isActive ? 'bg-primary-050 font-medium text-primary-800' : 'text-foreground hover:bg-accent')
                  }
                >
                  {t(`settings.${page}.menu`)}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {/* Keyed by campaign: Prev / Next lands on the same page of another campaign, which starts afresh. */}
        <Outlet key={id} context={context} />
      </div>
    </div>
  )
}
