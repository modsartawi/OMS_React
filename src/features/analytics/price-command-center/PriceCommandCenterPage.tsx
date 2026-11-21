import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { usePermissions } from '@/core/permissions'
import ScreenGate from '@/core/ui/ScreenGate'
import { canViewPriceWatch } from './access'
import MaterialDrillDown from './MaterialDrillDown'
import TabStrip from './TabStrip'
import { TAB_REGISTRY } from './tab-registry'
import { defaultTab, visibleTabs, type TabId } from './tabs'
import { useQuery } from '@tanstack/react-query' // 938
import { DEFAULT_ALERT_FILTER, alertsRequest } from './alerts' // 938
import { priceAlertsApi } from './api' // 938

const NS = 'price-command-center'

/**
 * The price command center (oms 934, BackOffice spec 4127 decision 8): one Analytics page whose tabs are the price
 * index, the price alerts, the product grid, product matching and feed health. Behind the PriceWatch View grant
 * (`canViewPriceWatch`, the menu leaf's own predicate), failing closed; the server's grant filter is the boundary.
 *
 * The open tab lives in the URL (`?tab=`, replacing the entry so Back leaves the page). Tabs are registered in
 * `tab-registry.tsx`; each tab keeps its own state.
 */
export default function PriceCommandCenterPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canViewPriceWatch} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <CommandCenter />
    </ScreenGate>
  )
}

function CommandCenter() {
  const { t } = useTranslation(NS)
  const permissions = usePermissions()
  const [params, setParams] = useSearchParams()
  const visible = visibleTabs(TAB_REGISTRY, permissions)
  const ownOpenAlerts = useOwnOpenAlerts(visible, params.get('tab')) // 938
  const open = defaultTab(visible, params.get('tab'), ownOpenAlerts.known ? ownOpenAlerts.any : undefined)
  const Panel = TAB_REGISTRY.find((tab) => tab.id === open)?.Panel ?? null
  if (ownOpenAlerts.waiting) return <p className="text-sm text-muted-foreground">{t('index.opening')}</p>
  if (open === null || Panel === null) return <p className="text-sm text-muted-foreground">{t('tabs.none')}</p>
  return (
    <TabStrip<TabId>
      tabs={visible}
      open={open}
      onSelect={(tab) => setParams(new URLSearchParams({ tab }), { replace: true })}
      idPrefix="pcc"
      label={t('tabs.label')}
      tabLabel={(tab) => t(`tabs.${tab}`)}
    >
      <div className="pt-3">
        <Panel />
      </div>
      {/* 936: the material drill-down, open while the URL names a material (`drillDownSearch`), over any tab. */}
      <MaterialDrillDown />
    </TabStrip>
  )
}

/**
 * 938: whether the user has open price alerts of their own — Alerts opens for them, Index for everyone else. Asked only
 * when it decides something (no tab in the URL, both Index and Alerts showing), on the Alerts tab's own default read
 * (Mine, live), so opening Alerts afterwards reads it from the cache. A failed read is "not known": Alerts, as before.
 */
function useOwnOpenAlerts(visible: readonly TabId[], asked: string | null) {
  const decides = asked === null && visible.includes('index') && visible.includes('alerts')
  const { scope, query } = alertsRequest(DEFAULT_ALERT_FILTER)
  const mine = useQuery({
    queryKey: ['price-watch', 'alerts', scope, query],
    queryFn: () => priceAlertsApi.list(scope, query),
    retry: false,
    enabled: decides,
  })
  return {
    waiting: decides && mine.isPending && !mine.isError,
    known: decides && mine.isSuccess,
    any: (mine.data ?? []).some((a) => a.status === 'OPEN'),
  }
}
