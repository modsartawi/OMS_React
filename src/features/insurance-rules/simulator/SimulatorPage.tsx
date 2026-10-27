import { useTranslation } from 'react-i18next'
import Chip from '@/core/ui/Chip'
import { useUrlQuery } from '@/core/ui/use-url-query'
import BacktestTab from './BacktestTab'
import { SIMULATOR_TABS, simulatorFromParams, simulatorToParams, type SimulatorQuery } from './query'
import SimulateTab from './SimulateTab'

const PANEL_ID = 'insurance-simulator-panel'

/**
 * Insurance rules ▸ Simulator — `/insurance-rules/simulator` (BackOffice spec 3126, door 3140, oms ticket 612).
 * Two tabs over the guard DRAFT:
 * - **Simulate** one typed request on a patient: each line's outcome, the rules that fired and the condition trace;
 * - **Back-test** the last 30 / 90 / 180 days: progress, then fires by severity, the requests it would have stopped
 *   (patient key masked), SAR, distinct patients / stores / pharmacists and the overlap with live guards.
 * The address keeps the tab, the window and the back-test followed (`?tab&days&id`).
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on a door is "You do not have access".
 */
export default function SimulatorPage() {
  const { t } = useTranslation('insurance-simulator')
  const { query, update } = useUrlQuery(simulatorFromParams, simulatorToParams)
  const set = (patch: Partial<SimulatorQuery>) => update((q) => ({ ...q, ...patch }))

  return (
    <section className="flex w-full flex-col gap-4" data-simulator-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1" data-simulator-tabs="">
        {SIMULATOR_TABS.map((tab) => (
          <Chip key={tab} variant="tab" on={query.tab === tab} aria-controls={PANEL_ID} onClick={() => set({ tab })} data-tab={tab}>
            {t(`tabs.${tab}`)}
          </Chip>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" className="flex min-w-0 flex-col gap-4">
        {/* Both stay mounted, so a typed request and its answer survive a look at the back-test. */}
        <div hidden={query.tab !== 'simulate'}>
          <SimulateTab />
        </div>
        <div hidden={query.tab !== 'backtest'}>
          <BacktestTab days={query.days} id={query.id} onDays={(days) => set({ days })} onStarted={(id) => set({ id })} />
        </div>
      </div>
    </section>
  )
}
