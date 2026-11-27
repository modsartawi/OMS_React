import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { MapPlace } from '@/core/map/map-panel'
import type { AdvisePin, AdviseReply, StoredRun, WeightSetListItem, WeightSetVersionRef } from '@/core/models/sourcing-run'
import { usePermissions } from '@/core/permissions'
import { canRunSourcingAdvisor, canSaveWeightSets } from '@/core/sourcing-advisor/access'
import { KEPT_RUNS_PATH, replayOrderOf, SIMULATOR_RUN_PARAM } from '@/core/sourcing-advisor/simulator-path'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { simulatorApi, storedRunQuery, weightSetsQuery, weightSetVersionQuery, workbenchQuery } from './api'
import { cartProblem, pointText, SIMULATOR_CHANNELS, type CartForm } from './cart'
import CartPanel from './CartPanel'
import KeepRun from './KeepRun'
import { cartAsk, openedAsk, openedSetting, openedWeightSet, runToOpen } from './kept-runs-model'
import { openDraft, setValue, waitsForSet, weightSetRef, type WeightDraft } from './draft-model'
import { addHeld, dropSent, holdPin, isHeld, keepHeld, pinsNow, runLines, toggleHeld, type HeldPin, type PinScope, type RunLines } from './line-pins'
import { pinChips, pinsClash, pinsCost, storesSeen } from './pins-model'
import PinsPanel from './PinsPanel'
import PlanCards from './PlanCards'
import { planNotes } from './plans-list-model'
import PlanNotes from './PlanNotes'
import PlansTable from './PlansTable'
import { cartAgain, cartRequest, movedAsk, plansAgain, plansStale, runBasis, runRequest, type LastRun, type RunAsk, type SimulatorRequest } from './replan-model'
import { cartRequestOf, replayProblem, replayRequest, type ReplayForm, type StartKind } from './replay'
import ReplayBanner from './ReplayBanner'
import RunBasisNotes from './RunBasisNotes'
import { SimulatorRunContext, type SimulatorRun } from './run-context'
import RunRefusal from './RunRefusal'
import RunSummary from './RunSummary'
import SimulatorTabs from './SimulatorTabs'
import StoredRunBanner from './StoredRunBanner'
import WeightSetPanel from './WeightSetPanel'
import { whatHappened } from './what-happened-model'

/**
 * OMS ▸ Sourcing simulator (ticket 962, BackOffice spec 4354 §19; SIMT decisions 1, 6, 12; the prototype
 * `.scratch/proto/4241-sourcing-simulator` is the look). The workbench: the left column starts a run — a cart, its
 * channel, the time of day and the customer placed on the map — and the right shows the plans, as cards or by a switch
 * as one table. Run calls the advise door's user route at the full level with `allPlans`; nothing runs on a change.
 *
 * Opens under the run grant (`canRunSourcingAdvisor`, a provisional key). Ticket 963 adds the pins and the weight set
 * under the cart: a changed weight or pin plans again on the same figures (`./replan-model`). Later tickets add replay
 * and the map tab (964), "why this plan" and "what the run used" (965), the solver tab (966); the tabs
 * register their panels in `./SimulatorTabs`. Ticket 969 keeps and names the run on screen (`./KeepRun`) and opens a
 * stored run by its link (`?run=<id>`) through the stored-run read door; its kept runs are `./KeptRunsPage`.
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
  /** What the run's line numbers name (review 4354 #1): a line pin set from its plans stands by that row. */
  lines: RunLines
}
interface RunOutput {
  reply: AdviseReply
  ask: RunAsk
  lines: RunLines
  /** Planning again found the held copy gone, so the cart ran again. */
  heldGone: boolean
  /** Ticket 969: a stored run opened by its link (`?run=`), not a run of this page. */
  stored?: StoredRun
}

function Workbench() {
  const { t } = useTranslation('sourcing-simulator')
  const [form, setForm] = useState<CartForm>(firstForm)
  const [view, setView] = useState<PlansView>('cards')
  // 964: a run starts from a cart or from an order to replay. 974: the old order link's replay offer opens the page set
  // to replay its order (`?replay=`, `simulatorReplayPath`); nothing runs until Run.
  const [replayAsked] = useState(() => replayOrderOf(new URLSearchParams(window.location.search)))
  const [start, setStart] = useState<StartKind>(replayAsked ? 'replay' : 'build')
  const [replay, setReplay] = useState<ReplayForm>({ orderNumber: replayAsked, withPoint: false, movedTo: null })
  const workbench = useQuery(workbenchQuery())
  const queryClient = useQueryClient()
  const permissions = usePermissions()
  const canSave = canSaveWeightSets(permissions)

  // The pins and the weight set (ticket 963). The draft lives here, in the browser, and goes to the door in full.
  // Review 4354 #1: a line pin is held by the row (or the replayed order's line) it was set on, and each request maps it
  // to that row's line number now; a change that orphans it — the row gone, a switch of start — drops it.
  const [held, setHeld] = useState<HeldPin[]>([])
  const scope: PinScope = { start, form, replay }
  const pins = pinsNow(held, scope)
  const rescope = (next: PinScope) => setHeld((h) => keepHeld(h, next))
  const changeForm = (next: CartForm) => {
    setForm(next)
    rescope({ ...scope, form: next })
  }
  const changeStart = (next: StartKind) => {
    setStart(next)
    rescope({ ...scope, start: next })
  }
  const changeReplay = (next: ReplayForm) => {
    setReplay(next)
    rescope({ ...scope, replay: next })
  }
  const sets = useQuery(weightSetsQuery())
  const [picked, setPicked] = useState<WeightSetVersionRef | null>(null)
  const chosen = picked ?? firstChoice(sets.data)
  const version = useQuery(weightSetVersionQuery(chosen))
  const [edited, setEdited] = useState<WeightDraft | null>(null)
  const base = version.data && chosen && version.data.name === chosen.name && version.data.version === chosen.version ? version.data : null
  const draft = base ? (edited && edited.base.name === base.name && edited.base.version === base.version ? edited : openDraft(base)) : null

  const [last, setLast] = useState<LastRun | null>(null)
  // The stored run last opened by its link (ticket 969). Review 2 #3: while the form holds its cart as set back — no
  // point, which is never stored — the cart asked is the stored run's own, so a changed pin or weight plans again on its
  // figures; Run is then open only for that, as the cart alone cannot run without a point.
  const [openedRecord, setOpenedRecord] = useState<AdviseReply | null>(null)
  const fromForm = cartAsk(form, openedRecord)
  const cart = start === 'build' ? fromForm.cart : replayRequest(replay)
  const ask: RunAsk | null = cart ? { cart, pins, weightSet: draft ? weightSetRef(draft) : null } : null
  const problem = start === 'build' ? (fromForm.fromStored && ask && plansAgain(ask, last) ? null : cartProblem(form)) : replayProblem(replay)
  // Review 4354 #7: Run waits for the set's draft, so no run goes out naming no set only to read as stale when it opens.
  const waiting = waitsForSet({ draft: !!draft, setsRead: sets.isSuccess, setsFailed: sets.isError, chosen: !!chosen, versionFailed: version.isError })
  // Review 4354 #2: the reply on screen is kept here, not read off the mutation (a new run clears its data), so the
  // plans, the tabs and what is open in them stay mounted — dimmed — while the next run plans.
  const [shown, setShown] = useState<RunOutput | null>(null)
  // Ticket 969: a stored run's link (`?run=<id>`, `simulatorRunPath`) opens it here straight away (owner, on the 969
  // prototype), through the stored-run read door — not an advise call (BackOffice 4281 decision 11, 4380 "open"). Its
  // plans show as stored, its cart or order is set back on the left, and a run made from here drops the link.
  const [params, setParams] = useSearchParams()
  const openId = runToOpen(params)
  const opened = useQuery(storedRunQuery(openId))
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!openId) {
      if (openedFor) setOpenedFor(null)
      return
    }
    const data = opened.data
    if (!data || openedFor === openId) return
    setOpenedFor(openId)
    const setting = openedSetting(data.record)
    const next: PinScope = setting.start === 'build' ? { start: 'build', form: setting.form, replay } : { start: 'replay', form, replay: setting.replay }
    if (setting.start === 'build') setForm(setting.form)
    else setReplay(setting.replay)
    setStart(setting.start)
    setHeld([])
    setOpenedRecord(data.record)
    // Review 2 #2: the weight set panel names the set the plans were made on.
    setPicked(openedWeightSet(data.record))
    setEdited(null)
    const ask = openedAsk(data.record)
    // A changed pin or weight then plans again on the stored run's own figures (`basedOnRun`).
    setLast({ ask, runId: data.record.runId })
    setShown({ reply: data.record, ask, lines: runLines(next), heldGone: false, stored: data })
  }, [openId, opened.data, openedFor, form, replay])
  const openGone = opened.isError && apiErrorCode(opened.error) === 'ADVISE-404'
  const run = useMutation({
    mutationFn: async ({ ask, request, lines }: RunInput): Promise<RunOutput> => {
      try {
        return { reply: await simulatorApi.advise(request), ask, lines, heldGone: false }
      } catch (err) {
        // Planning again after the 30 minutes: the held copy is gone, so the cart runs again with a read of its own.
        const again = cartAgain(request, err, ask)
        if (!again) throw err
        return { reply: await simulatorApi.advise(again), ask, lines, heldGone: true }
      }
    },
    onSuccess: (out) => {
      setShown(out)
      setLast({ ask: out.ask, runId: out.reply.runId })
      // The address no longer names the run on screen.
      if (params.has(SIMULATOR_RUN_PARAM))
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete(SIMULATOR_RUN_PARAM)
            return next
          },
          { replace: true },
        )
    },
    // A refused run shows its refusal in place of the plans, as before; "try again" then plans from nothing on screen.
    onError: () => setShown(null),
  })
  const ran = shown
  const reply = ran?.reply
  const notes = useMemo(() => (reply ? planNotes(reply) : null), [reply])
  const happened = useMemo(() => (reply ? whatHappened(reply) : null), [reply])
  // Review 2 #2: a stored run opened by its link reads as stale once a pin or the set changes from what it ran; while
  // the set's draft is still read, the form asks nothing to compare yet.
  const stale = plansStale(ran ? { ask: ran.ask, stored: !!ran.stored } : null, waiting ? null : ask)
  // A chip carries the refusal of the run that was sent with it; a pin added since has none yet.
  const chips = useMemo(() => pinChips(pins, ran ? ran.reply : null).map((c) => (ran && ran.ask.pins.some((p) => JSON.stringify(p) === JSON.stringify(c.pin)) ? c : { ...c, refusal: null })), [pins, ran])
  const cost = useMemo(() => (reply ? pinsCost(reply) : {}), [reply])
  const clash = useMemo(() => (ran ? pinsClash(ran.reply, ran.ask.pins) : null), [ran])
  const basis = ran ? runBasis(ran.reply, { heldGone: ran.heldGone }) : null
  // A plan's pin buttons name the line by the number of the run on screen: held by the row that number named then.
  const fromPlans = (pin: AdvisePin) => (ran ? holdPin(pin, ran.lines) : null)
  const pinning = {
    pressed: (pin: AdvisePin) => {
      const h = fromPlans(pin)
      return !!h && isHeld(held, h)
    },
    // Review 4354 #10: a pressed button takes its pin off again.
    onPin: (pin: AdvisePin) => {
      const h = fromPlans(pin)
      if (h) setHeld((x) => toggleHeld(x, h))
    },
    cost,
  }

  // 964: the map tab moves the customer and the run plans again from there, as a new run with its own read — the cart's
  // point, or a replay's point placed by hand (kind REPLAY_MOVED_POINT); "Back to the order's point" plans the replay
  // from the order's own point again. Review 4354 #3: what is planned again is the run on screen, with only its point
  // changed — never the form as it is now, which may have changed since or be unable to run. The map tab shows only
  // beside a reply, so there is always a run on screen to move.
  const replanFrom = (point: { lat: number; lng: number } | null) => {
    if (!ran) return
    const next = movedAsk(ran.ask, point)
    run.mutate({ ask: next, request: runRequest(next, last), lines: ran.lines })
  }
  const moveCustomer = (place: MapPlace) => {
    if (!ran) return
    const point = { lat: Number(pointText(place.lat)), lng: Number(pointText(place.lon)) }
    if ('lines' in ran.ask.cart) setForm((f) => ({ ...f, lat: pointText(point.lat), lng: pointText(point.lng) }))
    else setReplay((r) => ({ ...r, movedTo: point }))
    replanFrom(point)
  }
  const backToOrder = () => {
    setReplay((r) => ({ ...r, movedTo: null }))
    replanFrom(null)
  }
  const runContext: SimulatorRun = { moveCustomer }

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-sourcing-simulator="">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4" data-sim-left="">
          <CartPanel
            form={form}
            onChange={changeForm}
            maps={workbench.data?.maps ?? null}
            problem={problem}
            running={run.isPending}
            waiting={waiting}
            onRun={() => ask && run.mutate({ ask, request: runRequest(ask, last), lines: runLines(scope) })}
            start={start}
            onStart={changeStart}
            replay={replay}
            onReplay={changeReplay}
            reply={reply ?? null}
          />
          <PinsPanel
            pins={pins}
            chips={chips}
            stores={storesSeen(reply ?? null)}
            onAdd={(pin) => {
              const h = holdPin(pin, runLines(scope))
              if (h) setHeld((x) => addHeld(x, h))
            }}
            onRemove={(pin) => setHeld((x) => dropSent(x, pin, scope))}
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
            <Link to={KEPT_RUNS_PATH} className="me-auto text-xs text-primary underline underline-offset-2" data-kept-runs-link="">
              {t('kept.link')}
            </Link>
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
          {openId && opened.isPending && (
            <p className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground" role="status" data-stored-opening="">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('stored.opening')}
            </p>
          )}
          {openId && openGone && !reply && (
            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-card p-6 text-sm" data-stored-gone={openId}>
              <p className="font-semibold">{t('stored.gone.title')}</p>
              <p className="text-muted-foreground">{t('stored.gone.hint')}</p>
            </div>
          )}
          {openId && opened.isError && !openGone && !reply && <ErrorBanner className="px-3 py-2" message={apiErrorMessage(opened.error, t('stored.failed'))} />}
          {run.isError && !run.isPending && (
            <RunRefusal error={run.error} retrying={run.isPending} onRetry={() => run.variables && run.mutate(run.variables)} />
          )}
          {stale && !run.isPending && (
            <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-run-stale="">
              {t('run.stale')}
            </p>
          )}

          {reply && notes ? (
            <div
              className={`flex flex-col gap-3 transition-opacity ${run.isPending ? 'pointer-events-none opacity-60' : ''}`}
              aria-busy={run.isPending}
              data-run-earlier={run.isPending ? '' : undefined}
            >
              {ran?.stored && <StoredRunBanner stored={ran.stored} />}
              <ReplayBanner reply={reply} onBack={backToOrder} busy={run.isPending} />
              <RunSummary reply={reply} notes={notes} />
              <KeepRun key={reply.runId} reply={reply} stored={!!ran?.stored} />
              {basis && <RunBasisNotes weightSet={reply.weightSet} basis={basis} clash={clash} />}
              {reply.plans.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-run-no-plans="">
                  {t('plans.noShown')}
                </p>
              ) : view === 'cards' ? (
                <PlanCards plans={reply.plans} pinning={pinning} happened={happened} />
              ) : (
                <PlansTable plans={reply.plans} pinsCost={cost} happened={happened} />
              )}
              <PlanNotes notes={notes} />
              <SimulatorRunContext.Provider value={runContext}>
                <SimulatorTabs reply={reply} request={ran ? cartRequestOf(cartRequest(ran.ask)) : null} />
              </SimulatorRunContext.Provider>
            </div>
          ) : (
            !run.isPending &&
            !run.isError &&
            !(openId && (opened.isPending || opened.isError)) && (
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
