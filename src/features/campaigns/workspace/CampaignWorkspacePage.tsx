import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ChevronDown, ChevronRight, LayoutGrid, ListTree, Loader2, SlidersHorizontal, Ticket, type LucideIcon } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { ruleCampaignQuery } from '@/core/rules/api'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import { campaignPath, campaignState } from '@/core/rules/campaign-state'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { WorkspaceContext } from './context'
import { drawnMenu, drawnSettings, type WorkspaceMenuKey } from './menu'

/** Each menu item's icon — here, not in `./menu`, so the menu's rules stay a pure, React-free module. */
const MENU_ICON: Record<WorkspaceMenuKey, LucideIcon> = { dashboard: LayoutGrid, rules: ListTree, coupons: Ticket }

function MenuIcon({ item }: { item: WorkspaceMenuKey }) {
  const Icon = MENU_ICON[item]
  return <Icon className="h-4 w-4" aria-hidden />
}

/**
 * A campaign's workspace (ticket 501): its side menu beside the page, at `/campaigns/:id/…`. One
 * feature for the dashboard and, later, the builder, settings, coupons and versions — one cluster
 * sharing the campaign menu and, from 505, a draft.
 */
export default function CampaignWorkspacePage() {
  const { t } = useTranslation('campaign-workspace')
  const { id = '' } = useParams()
  const campaign = useQuery(ruleCampaignQuery(id))
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
    <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" data-workspace-back="">
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {t('back')}
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

  const c = campaign.data
  const context: WorkspaceContext = { campaign: c }

  return (
    <div className="flex min-w-0 flex-col gap-4 md:flex-row" data-workspace={c.id}>
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
            <CampaignStateBadge state={campaignState(c, new Date())} />
          </span>
        </div>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t('menu.label')}</div>
        <nav className="flex flex-col gap-0.5">
          {drawnMenu(c.features).map((item) => (
            <NavLink
              key={item.key}
              to={item.to ? `${base}/${item.to}` : base}
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
              else navigate(`${base}/settings/details`)
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
                  to={`${base}/settings/${page}`}
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
        <Outlet context={context} />
      </div>
    </div>
  )
}
