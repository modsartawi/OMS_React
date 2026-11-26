import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdviseCartRequest, AdvisePlan, AdviseReply, PlanGoal } from '@/core/models/sourcing-run'
import Chip from '@/core/ui/Chip'
import { SIMULATOR_TABS, type SimulatorTab } from './tabs'
import WhatTheRunUsed from './WhatTheRunUsed'
import WhyThisPlan from './WhyThisPlan'

/** What every tab's panel is handed: the run's reply, the request that made it, and the plan chosen in the strip. */
export interface SimulatorTabProps {
  reply: AdviseReply
  request: AdviseCartRequest | null
  /** The plan picked above the panel; the Recommended plan until the user picks another. Undefined when no plan shows. */
  plan: AdvisePlan | undefined
}

/**
 * Each tab's panel, by the ticket that builds it: 964 registers `map`, 965 `why` and `used`, 966 `solver`.
 */
const TAB_PANELS: Partial<Record<SimulatorTab, ComponentType<SimulatorTabProps>>> = {
  why: WhyThisPlan,
  used: WhatTheRunUsed,
}

/**
 * The tab strip under the plans: a plan picker, a tablist and the ONE open panel. Tab ids are `sim-tab-<tab>`, the panel
 * `sim-tab-panel`; each tab carries `data-sim-tab`, the panel `data-sim-tab-panel`, each plan choice `data-sim-plan-pick`.
 */
export default function SimulatorTabs({ reply, request }: Omit<SimulatorTabProps, 'plan'>) {
  const { t } = useTranslation('sourcing-simulator')
  const [open, setOpen] = useState<SimulatorTab>('map')
  const [picked, setPicked] = useState<PlanGoal | null>(null)
  const plan = reply.plans.find((p) => p.goal === picked) ?? reply.plans[0]
  const Panel = TAB_PANELS[open]
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-tabs="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1">
          {SIMULATOR_TABS.map((tab) => (
            <Chip
              key={tab}
              variant="tab"
              on={open === tab}
              id={`sim-tab-${tab}`}
              aria-controls="sim-tab-panel"
              onClick={() => tab !== open && setOpen(tab)}
              data-sim-tab={tab}
            >
              {t(`tabs.names.${tab}`)}
            </Chip>
          ))}
        </div>
        {reply.plans.length > 1 && (
          <div role="group" aria-label={t('tabs.planLabel')} className="flex flex-wrap gap-1">
            {reply.plans.map((p) => (
              <Chip key={p.goal} on={plan?.goal === p.goal} onClick={() => setPicked(p.goal)} data-sim-plan-pick={p.goal}>
                {t(`goal.${p.goal}`, { defaultValue: p.goal })}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div role="tabpanel" id="sim-tab-panel" aria-labelledby={`sim-tab-${open}`} data-sim-tab-panel={open}>
        {Panel ? (
          <Panel reply={reply} request={request} plan={plan} />
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-sim-tab-pending="">
            {t('tabs.pending')}
          </p>
        )}
      </div>
    </section>
  )
}
