import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { AdviseCartRequest } from '@/core/models/sourcing-run'
import { canRunSourcingAdvisor } from '@/core/sourcing-advisor/access'
import Chip from '@/core/ui/Chip'
import ScreenGate from '@/core/ui/ScreenGate'
import { toIsoDate } from '@/core/util/date-format'
import { simulatorApi, workbenchQuery } from './api'
import { adviseRequest, cartProblem, SIMULATOR_CHANNELS, type CartForm } from './cart'
import CartPanel from './CartPanel'
import PlanCards from './PlanCards'
import { planNotes } from './plans-list-model'
import PlanNotes from './PlanNotes'
import PlansTable from './PlansTable'
import RunRefusal from './RunRefusal'
import RunSummary from './RunSummary'
import SimulatorTabs from './SimulatorTabs'

/**
 * OMS ▸ Sourcing simulator (ticket 962, BackOffice spec 4354 §19; SIMT decisions 1, 6, 12; the prototype
 * `.scratch/proto/4241-sourcing-simulator` is the look). The workbench: the left column starts a run — a cart, its
 * channel, the time of day and the customer placed on the map — and the right shows the plans, as cards or by a switch
 * as one table. Run calls the advise door's user route at the full level with `allPlans`; nothing runs on a change.
 *
 * Opens under the run grant (`canRunSourcingAdvisor`, a provisional key). Later tickets add the pins and the weight set
 * (963), replay and the map tab (964), "why this plan" and "what the run used" (965), the solver tab (966); the tabs
 * register their panels in `./SimulatorTabs`.
 *
 * ⚠ Built on a stub of BackOffice 4281's worked example: the door is BackOffice 4355–4357, still open.
 */
export default function SourcingSimulatorPage() {
  const { t } = useTranslation('sourcing-simulator')
  return (
    <ScreenGate can={canRunSourcingAdvisor} ns="sourcing-simulator" title={t('title')} subtitle={t('lede')}>
      <Workbench />
    </ScreenGate>
  )
}

type PlansView = 'cards' | 'table'
const VIEWS: readonly PlansView[] = ['cards', 'table']

const firstForm = (): CartForm => ({
  channel: SIMULATOR_CHANNELS[0],
  time: '',
  today: toIsoDate(new Date()),
  goodsTotal: '',
  lines: [{ key: 1, item: '', quantity: '1' }],
  lat: '',
  lng: '',
})

function Workbench() {
  const { t } = useTranslation('sourcing-simulator')
  const [form, setForm] = useState<CartForm>(firstForm)
  const [view, setView] = useState<PlansView>('cards')
  const workbench = useQuery(workbenchQuery())
  const request = adviseRequest(form)
  const problem = cartProblem(form)
  const run = useMutation({ mutationFn: (body: AdviseCartRequest) => simulatorApi.advise(body) })
  const reply = run.data
  const notes = useMemo(() => (reply ? planNotes(reply) : null), [reply])
  const stale = !!reply && !!run.variables && JSON.stringify(run.variables) !== JSON.stringify(request)

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-sourcing-simulator="">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <CartPanel
          form={form}
          onChange={setForm}
          maps={workbench.data?.maps ?? null}
          problem={problem}
          running={run.isPending}
          onRun={() => request && run.mutate(request)}
        />

        <div className="flex flex-col gap-3" data-sim-plans="">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t('plans.title')}</h2>
            <div role="group" aria-label={t('plans.viewLabel')} className="flex gap-1" data-plans-view={view}>
              {VIEWS.map((v) => (
                <Chip key={v} on={view === v} onClick={() => setView(v)} data-plans-view-switch={v}>
                  {t(`plans.view.${v}`)}
                </Chip>
              ))}
            </div>
          </div>

          {run.isPending && (
            <p className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground" role="status" data-run-planning="">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('run.planning')}
            </p>
          )}
          {run.isError && !run.isPending && (
            <RunRefusal error={run.error} retrying={run.isPending} onRetry={() => run.variables && run.mutate(run.variables)} />
          )}
          {stale && !run.isPending && (
            <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-run-stale="">
              {t('run.stale')}
            </p>
          )}

          {reply && notes && !run.isPending ? (
            <>
              <RunSummary reply={reply} notes={notes} />
              {reply.plans.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-run-no-plans="">
                  {t('plans.noShown')}
                </p>
              ) : view === 'cards' ? (
                <PlanCards plans={reply.plans} />
              ) : (
                <PlansTable plans={reply.plans} />
              )}
              <PlanNotes notes={notes} />
              <SimulatorTabs reply={reply} request={run.variables ?? null} />
            </>
          ) : (
            !run.isPending &&
            !run.isError && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-run-none="">
                {t('plans.none')}
              </p>
            )
          )}
        </div>
      </div>
    </section>
  )
}
