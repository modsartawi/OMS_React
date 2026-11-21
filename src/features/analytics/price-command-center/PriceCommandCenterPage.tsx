import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { usePermissions } from '@/core/permissions'
import ScreenGate from '@/core/ui/ScreenGate'
import { canViewPriceWatch } from './access'
import TabStrip from './TabStrip'
import { TAB_REGISTRY } from './tab-registry'
import { defaultTab, visibleTabs, type TabId } from './tabs'

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
  const open = defaultTab(visible, params.get('tab'))
  const Panel = TAB_REGISTRY.find((tab) => tab.id === open)?.Panel ?? null
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
    </TabStrip>
  )
}
