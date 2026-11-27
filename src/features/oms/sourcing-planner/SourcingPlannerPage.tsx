/**
 * Sourcing planner data (oms-react ticket 968, BackOffice spec 4354 §2, §5, §8, §19; server tickets BO 4361, 4362,
 * 4375 — all open, so the doors are stubs in the drive).
 *
 * One home for the eight tables every advisor run reads as they stand, each under one of the three planner grants:
 * buffer overrides and a store's hand-set stock confidence; the product rule rows and the restricted and bulky lists;
 * the store-by-mode table, the carrier contracts and the slot rule table. The owner's pick (variant A, ticket 968
 * Comments): a tab shows only to the holder of its grant; a row opens in a side sheet with its form, a reason where the
 * server keeps one, and its own history.
 */
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { usePermissions } from '@/core/permissions'
import { canOpenSourcingPlanner } from '@/core/sourcing-advisor/access'
import Chip from '@/core/ui/Chip'
import ScreenGate from '@/core/ui/ScreenGate'
import type { PlannerTableKey } from '@/core/models/sourcing-planner'
import { NS } from './display'
import PlannerTab from './PlannerTab'
import { GRANT_GROUPS, visibleTables } from './tables'

export default function SourcingPlannerPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canOpenSourcingPlanner} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <PlannerTabs />
    </ScreenGate>
  )
}

function PlannerTabs() {
  const { t } = useTranslation(NS)
  const permissions = usePermissions()
  const [params, setParams] = useSearchParams()
  const tables = visibleTables(permissions)
  const asked = params.get('tab') as PlannerTableKey | null
  const tab = asked && tables.includes(asked) ? asked : tables[0]
  const groups = GRANT_GROUPS.filter((g) => g.can(permissions))

  const select = (next: PlannerTableKey) => {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="flex w-full max-w-[96rem] min-w-0 flex-col rounded-lg border border-border/60 bg-card" data-sourcing-planner="">
      <div role="tablist" aria-label={t('tabsLabel')} className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border px-3 py-2">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-1" data-tab-group={g.key}>
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{t(`grants.${g.key}`)}</span>
            <div className="flex gap-1">
              {g.tables.map((s) => (
                <Chip key={s} variant="tab" on={tab === s} id={`planner-tab-${s}`} aria-controls="planner-tab-panel" onClick={() => s !== tab && select(s)} data-tab={s}>
                  {t(`tabs.${s}`)}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div role="tabpanel" id="planner-tab-panel" aria-labelledby={`planner-tab-${tab}`} className="p-3" data-tab-panel={tab}>
        <PlannerTab key={tab} table={tab} />
      </div>
    </div>
  )
}
