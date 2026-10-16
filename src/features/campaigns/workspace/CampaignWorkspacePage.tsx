import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { ArrowLeft, LayoutGrid, Loader2, type LucideIcon } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { RuleCampaignFeatures } from '@/core/models/rule-campaign'
import { ruleCampaignQuery } from '@/core/rules/api'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import { campaignPath, campaignState } from '@/core/rules/campaign-state'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { WorkspaceContext } from './context'

/**
 * The campaign's own menu (the prototype's `CMENU` + Settings ▸): Dashboard, Rule builder, Coupons
 * when the coupons feature is on, Versions, Settings. Each slice appends its page as it lands —
 * a menu item whose page has not landed is left out (ticket 501), so today it is the Dashboard.
 * `to` is relative to the workspace (`''` = `/campaigns/:id`).
 */
interface WorkspaceMenuItem {
  key: string
  to: string
  icon: LucideIcon
  /** Shown only when the campaign's features allow it (Coupons). Absent = always. */
  when?: (features: RuleCampaignFeatures) => boolean
}

const WORKSPACE_MENU: WorkspaceMenuItem[] = [{ key: 'dashboard', to: '', icon: LayoutGrid }]

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
          {WORKSPACE_MENU.filter((item) => !item.when || item.when(c.features)).map((item) => (
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
              <item.icon className="h-4 w-4" aria-hidden />
              {t(`menu.${item.key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet context={context} />
      </div>
    </div>
  )
}
