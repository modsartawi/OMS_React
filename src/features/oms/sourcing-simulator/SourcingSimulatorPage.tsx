import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { AdvisePin, AdviseReply, WeightSetListItem, WeightSetVersionRef } from '@/core/models/sourcing-run'
import { usePermissions } from '@/core/permissions'
import { canRunSourcingAdvisor, canSaveWeightSets } from '@/core/sourcing-advisor/access'
import Chip from '@/core/ui/Chip'
import ScreenGate from '@/core/ui/ScreenGate'
import { toIsoDate } from '@/core/util/date-format'
import { simulatorApi, weightSetsQuery, weightSetVersionQuery, workbenchQuery } from './api'
import { adviseRequest, cartProblem, SIMULATOR_CHANNELS, type CartForm } from './cart'
import CartPanel from './CartPanel'
import { openDraft, setValue, weightSetRef, type WeightDraft } from './draft-model'
import { addPin, pinChips, pinsClash, pinsCost, removePin, storesSeen } from './pins-model'
import PinsPanel from './PinsPanel'
import PlanCards from './PlanCards'
import { planNotes } from './plans-list-model'
import PlanNotes from './PlanNotes'
import PlansTable from './PlansTable'
import { cartAgain, cartRequest, runBasis, runRequest, sameAsk, type LastRun, type RunAsk, type SimulatorRequest } from './replan-model'
import RunBasisNotes from './RunBasisNotes'
import RunRefusal from './RunRefusal'
import RunSummary from './RunSummary'
import SimulatorTabs from './SimulatorTabs'
import WeightSetPanel from './WeightSetPanel'

/**
 * OMS ▸ Sourcing simulator (ticket 962, BackOffice spec 4354 §19; SIMT decisions 1, 6, 12; the prototype
 * `.scratch/proto/4241-sourcing-simulator` is the look). The workbench: the left column starts a run — a cart, its
 * channel, the time of day and the customer placed on the map — and the right shows the plans, as cards or by a switch
 * as one table. Run calls the advise door's user route at the full level with `allPlans`; nothing runs on a change.
 *
 * Opens under the run grant (`canRunSourcingAdvisor`, a provisional key). Ticket 963 adds the pins and the weight set
 * under the cart: a changed weight or pin plans again on the same figures (`./replan-model`). Later tickets add replay
 * and the map tab (964), "why this plan" and "what the run used" (965), the solver tab (966); the tabs
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

/** The set the picker opens on: the candidate set's marked version, else the first set's latest. */
const firstChoice = (sets: readonly WeightSetListItem[] | undefined): WeightSetVersionRef | null => {
  const marked = sets?.find((s) => s.candidateVersion !== null)
  if (marked) return { name: marked.name, version: marked.candidateVersion! }
  const first = sets?.find((s) => s.versions.length > 0)
  return first ? { name: first.name, version: first.versions[first.versions.length - 1] } : null
}

interface RunInput {
  ask: RunAsk
  request: SimulatorRequest
}
interface RunOutput {
  reply: AdviseReply
  ask: RunAsk
  /** Planning again found the held copy gone, so the cart ran again. */
  heldGone: boolean
}

function Workbench() {
  const { t } = useTranslation('sourcing-simulator')
  const [form, setForm] = useState<CartForm>(firstForm)
  const [view, setView] = useState<PlansView>('cards')
  const workbench = useQuery(workbenchQuery())
  const queryClient = useQueryClient()
  const permissions = usePermissions()
  const canSave = canSaveWeightSets(permissions)

  // The pins and the weight set (ticket 963). The draft lives here, in the browser, and goes to the door in full.
  const [pins, setPins] = useState<AdvisePin[]>([])
  const sets = useQuery(weightSetsQuery())
  const [picked, setPicked] = useState<WeightSetVersionRef | null>(null)
  const chosen = picked ?? firstChoice(sets.data)
  const version = useQuery(weightSetVersionQuery(chosen))
  const [edited, setEdited] = useState<WeightDraft | null>(null)
  const base = version.data && chosen && version.data.name === chosen.name && version.data.version === chosen.version ? version.data : null
  const draft = base ? (edited && edited.base.name === base.name && edited.base.version === base.version ? edited : openDraft(base)) : null

  const cart = adviseRequest(form)
  const problem = cartProblem(form)
  const ask: RunAsk | null = cart ? { cart, pins, weightSet: draft ? weightSetRef(draft) : null } : null
  const [last, setLast] = useState<LastRun | null>(null)
  const run = useMutation({
    mutationFn: async ({ ask, request }: RunInput): Promise<RunOutput> => {
      try {
        return { reply: await simulatorApi.advise(request), ask, heldGone: false }
      } catch (err) {
        // Planning again after the 30 minutes: the held copy is gone, so the cart runs again with a read of its own.
        const again = cartAgain(request, err, ask)
        if (!again) throw err
        return { reply: await simulatorApi.advise(again), ask, heldGone: true }
      }
    },
    onSuccess: (out) => setLast({ ask: out.ask, runId: out.reply.runId }),
  })
  const ran = run.data
  const reply = ran?.reply
  const notes = useMemo(() => (reply ? planNotes(reply) : null), [reply])
  const stale = !!ran && (!ask || !sameAsk(ran.ask, ask))
  // A chip carries the refusal of the run that was sent with it; a pin added since has none yet.
  const chips = useMemo(() => pinChips(pins, ran ? ran.reply : null).map((c) => (ran && ran.ask.pins.some((p) => JSON.stringify(p) === JSON.stringify(c.pin)) ? c : { ...c, refusal: null })), [pins, ran])
  const cost = useMemo(() => (reply ? pinsCost(reply) : {}), [reply])
  const clash = useMemo(() => (ran ? pinsClash(ran.reply, ran.ask.pins) : null), [ran])
  const basis = ran ? runBasis(ran.reply, { heldGone: ran.heldGone }) : null
  const pinning = { pins, onPin: (pin: AdvisePin) => setPins((ps) => addPin(ps, pin)), cost }

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-sourcing-simulator="">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4" data-sim-left="">
          <CartPanel
            form={form}
            onChange={setForm}
            maps={workbench.data?.maps ?? null}
            problem={problem}
            running={run.isPending}
            onRun={() => ask && run.mutate({ ask, request: runRequest(ask, last) })}
          />
          <PinsPanel
            pins={pins}
            chips={chips}
            stores={storesSeen(reply ?? null)}
            onAdd={(pin) => setPins((ps) => addPin(ps, pin))}
            onRemove={(pin) => setPins((ps) => removePin(ps, pin))}
          />
          <WeightSetPanel
            sets={sets.data}
            setsFailed={sets.isError}
            chosen={chosen}
            onChoose={(ref) => {
              setPicked(ref)
              setEdited(null)
            }}
            draft={draft}
            reading={version.isFetching}
            onChange={(key, value) => draft && setEdited(setValue(draft, key, value))}
            canSave={canSave}
            onSaved={(ref) => {
              void queryClient.invalidateQueries({ queryKey: weightSetsQuery().queryKey })
              setPicked(ref)
              setEdited(null)
            }}
          />
        </div>

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
              {basis && <RunBasisNotes weightSet={reply.weightSet} basis={basis} clash={clash} />}
              {reply.plans.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-run-no-plans="">
                  {t('plans.noShown')}
                </p>
              ) : view === 'cards' ? (
                <PlanCards plans={reply.plans} pinning={pinning} />
              ) : (
                <PlansTable plans={reply.plans} pinsCost={cost} />
              )}
              <PlanNotes notes={notes} />
              <SimulatorTabs reply={reply} request={ran ? cartRequest(ran.ask) : null} />
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
