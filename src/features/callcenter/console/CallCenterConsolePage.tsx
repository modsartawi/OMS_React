/**
 * The call-center console's route — every state the screen can be in, and the
 * one place that decides which.
 *
 * Slice 0 (ticket 162) put the spine here: a granted agent reaches
 * `/callcenter`, the console opens a real server-side order, and the
 * three-column shell renders **from the returned `SessionState`**. Nothing is
 * hand-made and nothing is client-computed.
 *
 * Ticket 163 added the branch that `Open` can take instead: one active order per
 * agent (law 9), so an agent who already has one is refused **with its
 * identity, on the success path**, and chooses. Which makes this file's job the
 * whole open path — and three properties it exists to hold:
 *
 * 1. **The probe fails closed.** One boolean, one shared cache key with the nav
 *    leaf (134 §6, ticket 125's pattern). Unresolved or errored ⇒ the refusal,
 *    never the console — and the refusal fires **no** `Open`, which is why the
 *    session lives in a child component that a denied agent never mounts.
 * 2. 🚩 **Every non-console state carries its own way home.** The route is
 *    chrome-less by ruling (map 126 note 13): there is no nav to leave by. That
 *    is `ConsoleCard`'s, not a prop and not a per-state decision — a state the
 *    agent can only escape by closing the tab is the failure 162 existed to
 *    prevent, and the one a hand-rolled second card reintroduces.
 * 3. 🚩 **Never a silent auto-resume, and never left with nothing.** An agent
 *    who has picked up a new caller must not inherit the previous caller's
 *    basket (127), so the choice screen renders no order at all until they
 *    choose — and every way that choice can fail still leaves both choices
 *    reachable.
 *
 * Ticket 164 adds the resilience spine, deliberately **before** the verbs that
 * will lean on it hardest, so they inherit it rather than retrofit it. Three
 * properties, and one seam that carries all three:
 *
 * 4. **A collision is routine and looks routine.** Every call goes through
 *    `runGuarded`, which rides out `SESSION_BUSY` on the contract's bounded
 *    schedule (`api.ts`) and reports it as a strip in the flow — never a spinner
 *    over the basket, and never a state without an action in it.
 * 5. 🚩 **A dead order is never written to and never rendered.** `SESSION_CLOSED`
 *    and `NOT_YOUR_SESSION` come back through the same seam and return the tab
 *    to the start (§6.2) — which is the stale-tab harm closed from the side 163
 *    could not reach.
 * 6. **A major `contractVersion` mismatch stops the console** rather than
 *    mis-rendering money (law 10). Minor drift, either way, is a non-event.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import type { SessionState } from '@/core/models/callcenter'
import {
  CALLCENTER_ACCESS_KEY,
  callCenterApi,
  newRequestId,
  openKey,
  sessionKey,
  withBusyRetry,
} from './api'
import { applyState, checkContractVersion } from './session-state'
import { readSessionFault, type ShownSessionFault } from './session-fault'
import {
  abandonTargetOfExisting,
  abandonTargetOfSession,
  readOpenResult,
  type PendingAbandon,
} from './open-outcome'
import {
  beginStoreMove,
  committingStoreMove,
  isCommitting,
  rebindRefusal,
  repreviewingStoreMove,
  storeMovePreview,
  type RebindRefusal,
  type StoreMove,
  type StoreMovePreview,
} from './store-move'
import AbandonConfirm from './AbandonConfirm'
import AddressPicker from './AddressPicker'
import type { BusyPhase } from './BusyStrip'
import ConsoleCard from './ConsoleCard'
import ConsoleShell from './ConsoleShell'
import ExistingOrderScreen from './ExistingOrderScreen'
import StoreMoveConfirm, { type PreviewReissue } from './StoreMoveConfirm'
import StorePicker from './StorePicker'

/**
 * The rebind refusals this page answers ITSELF — with a fresh preview, or with
 * the banner over the basket. They are never also drawn as a dialog's own
 * failure: one refusal, one voice (167).
 */
const ANSWERED_BY_THE_PAGE = ['CONFIRM_TOKEN_STALE', 'CONFIRM_TOKEN_INVALID', 'REBIND_REFUSED']

export default function CallCenterConsolePage() {
  const { t } = useTranslation('callcenter')

  // Both options MATCH the menu probe's on this shared key, and matching is the
  // point: a mismatched `staleTime` is the real bug ticket 125 hit — the
  // page-side observer refetched on mount and emptied the nav group under a
  // working screen. `retry: false` lands a fail-closed grant on the refusal at
  // once instead of holding "Checking access…" through a retry backoff.
  const access = useQuery({
    queryKey: CALLCENTER_ACCESS_KEY,
    queryFn: () => callCenterApi.access(),
    staleTime: Infinity,
    retry: false,
  })

  if (access.isPending) return <ConsoleStatus message={t('access.checking')} spinner />

  if (access.data?.canOpenConsole !== true) {
    // The console is closed either way — the probe fails closed. But WHICH copy
    // shows matters: an unreachable probe is a server fault, and telling a fully
    // entitled agent to ask for a grant they already hold sends support chasing
    // the wrong thing (125's late fix).
    //
    // A thrown `CONSOLE_NOT_GRANTED` (§7 — 403 carrying the envelope, so
    // `kind:'business'`) is a REFUSAL, not a fault: branching on the machine
    // code rather than on `isError` is what keeps a real denial from reading as
    // "try again shortly".
    const unreachable = access.isError && apiErrorCode(access.error) !== 'CONSOLE_NOT_GRANTED'
    return (
      <ConsoleNotice
        marker={unreachable ? 'unavailable' : 'denied'}
        title={t(unreachable ? 'access.unavailableTitle' : 'access.deniedTitle')}
        body={unreachable ? apiErrorMessage(access.error, t('access.unavailableHint')) : t('access.deniedHint')}
      />
    )
  }

  return <ConsoleSession />
}

/** Everything that touches the order. Mounted only once the grant is confirmed,
 *  so a refused agent can fire no `Open` — a property the drive asserts by
 *  recording every request rather than by reading this comment. */
function ConsoleSession() {
  const { t } = useTranslation('callcenter')
  const queryClient = useQueryClient()

  /** The order `Open` minted for us. */
  const [openedId, setOpenedId] = useState<string | null>(null)
  /**
   * The order the agent CHOSE to resume, off the already-open screen (163).
   * Separate from `openedId` on purpose: they are answered by different verbs
   * (`open` mints, `getState` reads back) and the choice must outrank the
   * refusal that is still sitting in the open query's cache.
   */
  const [resumedId, setResumedId] = useState<string | null>(null)

  // 🚩 **One user action, one `requestId`** (law 3 / §4), reused verbatim across
  // every retry of that action. Opening the console IS one action — the failure
  // card's *Try again* is a retry of it, not a second one. A fresh id there would
  // make an `Open` that landed server-side before the transport failed look like
  // a genuinely new action to the server's ledger: the double-open the ring
  // buffer exists to prevent, on the verb that mints a real OMS order.
  //
  // It is STATE rather than a constant because 163 introduces the one thing that
  // is a genuinely new open: *abandon and start fresh*. Re-sending the first id
  // there would be replayed (§4) and answer `refusedExisting` all over again,
  // about an order that no longer exists.
  const [requestId, setRequestId] = useState(newRequestId)

  /**
   * The abandon in flight, if any: the target it is about to void plus **its
   * own** requestId, minted when the confirmation opens. One confirmation is one
   * action — a *Try again* inside the dialog re-sends the same id, and a second
   * abandon later in the console's life is a second action with a second id.
   */
  const [abandoning, setAbandoning] = useState<PendingAbandon | null>(null)

  /**
   * The strip, as two independent facts rather than one slot (164).
   *
   * `colliding` is a schedule currently running; `stalled` is a schedule that
   * ran out, holding the only handle on the action that never landed. 🚩 They
   * are separate because calls overlap — which is not a corner case here but
   * the very condition `SESSION_BUSY` announces. Sharing one slot lets a second
   * call's first retry overwrite the first call's *manual retry* and take the
   * agent's only way to finish it with it.
   */
  const [colliding, setColliding] = useState<{ retry: number } | null>(null)
  const [stalled, setStalled] = useState<{ again: () => void } | null>(null)

  // A live collision outranks a spent one: while something is still being
  // ridden out, "still busy — try again" would be asking the agent to do what
  // the console is already doing.
  const busy: BusyPhase | null = colliding
    ? { phase: 'retrying', retry: colliding.retry }
    : stalled
      ? { phase: 'exhausted', again: stalled.again }
      : null

  /**
   * The order died under this tab — abandoned, submitted, swept, or never this
   * agent's to begin with (§6.2). It outranks every other state on the screen:
   * whatever is rendered when this is set is a basket that no longer exists.
   */
  const [fault, setFault] = useState<ShownSessionFault | null>(null)

  /**
   * The address book, open or not (166). A boolean rather than a route or a
   * region: it is one caller's short list, read when it is opened and closed the
   * moment it has answered.
   */
  const [pickingAddress, setPickingAddress] = useState(false)

  /** The store override, open or not (167) — the other way into the same rebind. */
  const [pickingStore, setPickingStore] = useState(false)

  /**
   * The plant rebind in flight (167), as three facts that belong to the ACTION
   * rather than to the screen:
   *
   * - `move` is the action itself, carrying the one `requestId` that survives
   *   the confirm re-send and the re-preview (§4).
   * - `preview` is the diff the server pinned to that action's token. 🚩 It is
   *   held here and NOT read off the cache, because a preview response carries
   *   the *unchanged* state — same `version` — so `applyState` rightly keeps
   *   what is on screen and the confirmation never reaches it (§5).
   * - `reissue` says why the agent is being shown a second preview of the same
   *   action, which is the whole reason they are being asked twice.
   */
  const [move, setMove] = useState<StoreMove | null>(null)
  const [preview, setPreview] = useState<StoreMovePreview | null>(null)
  const [reissue, setReissue] = useState<PreviewReissue | null>(null)

  /** `REBIND_REFUSED` — atomic, so the order behind it is untouched. It outlives
   *  the action that raised it: the agent has to read it, and it names the line
   *  they have to void. */
  const [refusal, setRefusal] = useState<RebindRefusal | null>(null)

  /** How many calls are currently riding out a collision. A ref, not state: it
   *  arbitrates who may clear the strip and is never itself rendered. */
  const colliders = useRef(0)

  /**
   * 🚩 **The one seam every server call on this screen goes through** — built at
   * this ticket rather than at the tenth verb, so tickets 165–174 inherit it
   * instead of each remembering it.
   *
   * It does three things and refuses to do a fourth: it rides out a routine
   * collision on the contract's schedule (never touching any other error), it
   * publishes that collision as a strip rather than as a fault, and it reads a
   * dead-order refusal once, here, so "return to the start" cannot become a
   * branch per verb. Everything else — what the call meant, what to render — is
   * still the caller's.
   *
   * `again` is the caller's own re-run, held for the strip's manual retry. A
   * caller that has its own failure surface (the abandon dialog, the open
   * failure card) passes none, and then the ceiling simply surfaces as that
   * surface's error: two places offering the same retry is how an agent ends up
   * pressing the wrong one.
   *
   * 🚩 **Calls overlap**, so a call only stops SAYING it is colliding once no
   * other call still is — a plain last-writer-wins would pull the strip out
   * from under a retry that is still running.
   */
  const runGuarded = async <T,>(verb: () => Promise<T>, again?: () => void): Promise<T> => {
    let mine = false
    const settle = () => {
      if (mine) colliders.current -= 1
      mine = false
      if (colliders.current === 0) setColliding(null)
    }
    try {
      const result = await withBusyRetry(verb, {
        onRetry: (retry) => {
          if (!mine) {
            mine = true
            colliders.current += 1
          }
          setColliding({ retry })
        },
      })
      settle()
      // The order answered, so any standing offer to retry is out of date —
      // the claim it was waiting on is demonstrably free.
      setStalled(null)
      return result
    } catch (err) {
      settle()
      // Only a spent SCHEDULE leaves a strip behind; any other failure is the
      // caller's to draw, and a strip left over it would blame the mutex.
      if (apiErrorCode(err) === 'SESSION_BUSY' && again) setStalled({ again })
      const dead = readSessionFault(err)
      if (dead) {
        // Nothing may keep pointing at the dead order — including a confirmation
        // asking whether to void something that is already gone.
        setAbandoning(null)
        setFault({
          ...dead,
          message: apiErrorMessage(err, t(dead.kind === 'closed' ? 'fault.closedHint' : 'fault.notYoursHint')),
        })
      }
      throw err
    }
  }

  /**
   * `Open` is a POST, and it is modelled as a **query** rather than a mutation
   * on purpose. The contract makes it idempotent by construction — the same
   * `requestId` is never re-applied and answers `replayed: true` (§4) — so what
   * is left is exactly a query's semantics: one keyed result per console life,
   * fetched once, refetched by an explicit retry that re-sends the same id.
   *
   * It also buys the two properties the effect-plus-mutation shape could not:
   * concurrent mounts (StrictMode's, and a re-render mid-flight) **dedupe into
   * one request** rather than needing a ref to guard them, and the failure state
   * survives to the render that has to draw it.
   */
  const open = useQuery({
    queryKey: openKey(requestId),
    // Guarded like every other call — a collision here is ridden out silently
    // under "Opening a new order…", which is the honest thing for it to say. No
    // `again`: there is no console to hang a strip on yet, and the open failure
    // card below already owns the retry (on the SAME id, law 3).
    queryFn: () => runGuarded(() => callCenterApi.open(requestId)),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  // The whole open path in one closed set of four (see `open-outcome.ts`): the
  // discriminant and the two nullable payloads are read ONCE, here, so no branch
  // below can silently fall through a malformed pair into an eternal spinner.
  const outcome = readOpenResult(open.data)
  const openedState = outcome.kind === 'opened' ? outcome.state : null

  // The cache is the store of record, and the write is GUARDED — the same entry
  // point every later verb uses. There is no reducer and no delta protocol;
  // `applyState` is the whole write path. Idempotent, so a re-run is free.
  useEffect(() => {
    if (!openedState) return
    queryClient.setQueryData<SessionState>(sessionKey(openedState.transactionId), (current) =>
      applyState(current, openedState),
    )
    setOpenedId(openedState.transactionId)
    // 🚩 A resumed id must NOT outlive the order it pointed at. `transactionId`
    // reads `resumedId ?? openedId`, so leaving a stale resume in place while
    // `Open` mints a new order would render the old one and orphan the new —
    // a real OMS order created and never shown. Whatever `Open` just returned
    // is now the order.
    setResumedId(null)
  }, [openedState, queryClient])

  /** The order on screen. A resume outranks whatever `Open` last answered. */
  const transactionId = resumedId ?? openedId

  /** Re-read the order — the agent's hand on `getState`, which §6.1 names the
   *  universal recovery action after any conflict. Also the strip's manual
   *  retry once the busy schedule is spent. */
  const refreshSession = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: sessionKey(transactionId ?? '') })
  }, [queryClient, transactionId])

  // Seeded by the write above, so this observer fires no request. `getState`
  // is the query function for what it is for (law 2): refresh, recovery, reload
  // and second tab — none of which is this mount.
  //
  // Its answer goes through the SAME guard: a `getState` racing a mutation is
  // the one read that can carry an older `version` than what is on screen, so
  // the entry point has to be the entry point — one write path, not two.
  const session = useQuery({
    queryKey: sessionKey(transactionId ?? ''),
    queryFn: async () => {
      const fresh = await runGuarded(() => callCenterApi.getState(transactionId!), refreshSession)
      const current = queryClient.getQueryData<SessionState>(sessionKey(transactionId!))
      return applyState(current, fresh)
    },
    enabled: transactionId !== null,
    staleTime: Infinity,
    retry: false,
  })

  /**
   * Abandon, then open — **in that order** (163), and only ever as a pair. The
   * verb returns no state (§8.2), so the landing is this callback's whole job:
   * forget the voided order and mint a genuinely new open action. Both the
   * already-open screen's *start fresh* and the live order's *abandon* funnel
   * through here, because they are the same act.
   */
  const startFresh = useCallback(
    (voidedId: string) => {
      // An abandoned order must not be renderable from cache — the stale-tab
      // harm (127) starts with a basket that is still on screen.
      queryClient.removeQueries({ queryKey: sessionKey(voidedId) })
      setResumedId(null)
      setOpenedId(null)
      setAbandoning(null)
      // A rebind is about a basket that no longer exists — the preview, the
      // token and the refusal go with it.
      setMove(null)
      setPreview(null)
      setReissue(null)
      setRefusal(null)
      setPickingStore(false)
      colliders.current = 0
      setColliding(null)
      setStalled(null)
      setFault(null)
      setRequestId(newRequestId())
    },
    [queryClient],
  )

  /**
   * The two customer verbs (165), as one mutation because they are one act with
   * two directions and the agent may only be doing one of them at a time — so
   * one pending flag and one error surface is the honest shape.
   *
   * Both return the **whole `SessionState`** (law 2), and it is written through
   * the same guarded entry point as everything else: `applyState` decides,
   * never a hand-patched header. 🚩 Which is what makes *removing the caller
   * clears the address and keeps the derived store* free — that is the server's
   * ruling (§6.3) arriving in the projection, not a client rule about what to
   * clear. A console that emptied `plant` on remove would re-price the basket
   * on the next attach, which is exactly what the rule exists to prevent.
   */
  const customer = useMutation({
    // No `again`: the rail draws this call's own failure, and a strip offering
    // a second retry beside it is one retry too many (164's ruling).
    mutationFn: (action: { customerId: string | null }) => {
      // 🚩 Minted ONCE, outside the thunk. `runGuarded` re-runs the thunk on
      // every `SESSION_BUSY` retry, and a fresh id inside it would make each
      // retry a genuinely new action to the server's ledger (law 3 / §4) — the
      // double-apply the ring buffer exists to prevent, on the verb that binds
      // a real caller to a real order.
      const requestId = newRequestId()
      return runGuarded(() =>
        action.customerId === null
          ? callCenterApi.removeCustomer(transactionId!, requestId)
          : callCenterApi.attachCustomer(transactionId!, requestId, action.customerId),
      )
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      // 🚩 The book belongs to whoever is attached, so a change of caller closes
      // it. Without this, an agent who opened the book, removed the caller and
      // attached the next one would have the new caller's addresses spring open
      // by themselves — the previous call's intent, acted on in this one.
      setPickingAddress(false)
    },
    retry: false,
  })

  /**
   * `addItem` (168) — the one verb the search panel has, on its own mutation
   * because it is its own act with its own failure surface.
   *
   * 🚩 **It sends an item number and a quantity, never a price** (law 1): the
   * estimate the agent was looking at when they pressed *Add* is a
   * material-master figure that has never been near the engine. What the line
   * costs comes back in the projection, VAT included, and is the only figure the
   * caller is ever told.
   *
   * Quantity is 1: the search row's action is *add this*, and changing how many
   * is the basket's own verb (`changeQty`, ticket 170).
   */
  const addItem = useMutation({
    // No `again`: the panel draws this call's own failure under the rows, where
    // the agent's eye already is, and a strip offering a second retry behind it
    // is one retry too many (164's ruling).
    mutationFn: (action: { itemNumber: string }) => {
      // 🚩 Minted ONCE, outside the thunk — `runGuarded` re-runs it on every
      // `SESSION_BUSY` retry, and a fresh id inside would make each retry a
      // genuinely new action to the server's ledger (law 3 / §4): the same item
      // added six times, on the verb the agent presses most.
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.addItem(transactionId!, requestId, action.itemNumber, 1))
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
    },
    retry: false,
  })

  /**
   * What the panel says about the last add.
   *
   * ⚠️ **Beyond availability is 169's, not this slice's.** It arrives as
   * `pendingConfirmation: belowAtp` on the SUCCESS path with the unchanged state
   * (§5.2), so nothing was added — and a console that said nothing at all would
   * leave the agent watching a basket that did not move. Until 169 draws the
   * acceptance, the honest answer is the outcome: it was not added, and why.
   * Where availability is merely *unknown* the server raises no confirmation at
   * all, so this sentence cannot reach a degraded stock read.
   */
  const addOutcome = addItem.isError
    ? apiErrorMessage(addItem.error, t('search.addFailed'))
    : addItem.data?.pendingConfirmation?.kind === 'belowAtp'
      ? t('search.addBeyondAvailability')
      : null

  /**
   * 🚩 **The plant rebind, as ONE action** — the verb the agent reached it by is
   * a parameter, not a second flow (167). Picking an address derives the store
   * (`setAddress`, §5.1's usual path) and overriding it names one (`setStore`,
   * the explicit operator override); both re-price the same basket at the same
   * new branch, so both take the same two-phase path and the same modal. A
   * second confirmation mechanism would be a defect.
   *
   * Three things this mutation does and nothing else does:
   *
   * 1. **The whole returned state is written through `applyState`**, as always.
   *    On a preview the version has NOT moved (§5 — the unchanged state), so
   *    the write is a no-op and the diff never reaches the cached state: it
   *    belongs to the act that raised it, which is why it is held here.
   * 2. 🚩 **`CONFIRM_TOKEN_STALE` re-previews rather than committing.** The
   *    basket moved underneath, so the token is dropped, the **same
   *    `requestId`** goes back out without it, and the agent is shown the fresh
   *    diff. The console never commits a change the agent did not see.
   * 3. **`REBIND_REFUSED` is a banner, not a crash.** Atomic by contract —
   *    nothing partial was persisted — so the order on screen is already
   *    correct and all that is owed is naming the line that stopped it.
   *
   * Every other failure stays on the surface that raised it: the address book,
   * the store picker, or the sheet.
   */
  const rebind = useMutation({
    // No `again`: each of those three surfaces draws this call's own failure,
    // and a strip offering a second retry behind it is one retry too many
    // (164's ruling).
    mutationFn: (move: StoreMove) =>
      // 🚩 The id is the MOVE's, minted once at `beginStoreMove` and carried
      // through the confirm and the re-preview (law 3 / §4). Nothing here mints
      // one — a fresh id inside the thunk would let a busy retry look like a
      // second rebind of a real basket.
      runGuarded(() =>
        move.kind === 'address'
          ? callCenterApi.setAddress(transactionId!, move.requestId, move.target, move.confirmToken)
          : callCenterApi.setStore(transactionId!, move.requestId, move.target, move.confirmToken),
      ),
    onSuccess: (fresh, move) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      const previewed = storeMovePreview(fresh.pendingConfirmation)
      if (previewed) {
        // Are-you-sure, on the success path. The token pins THIS diff, so it
        // travels with the action rather than with the screen.
        setMove(committingStoreMove(move, previewed.confirmToken))
        setPreview(previewed)
        // The sheet is the surface now: one modal at a time, and the picker the
        // agent came from has done its job.
        setPickingAddress(false)
        setPickingStore(false)
        return
      }
      // Applied — inline on an empty basket, or committed exactly as previewed.
      // The action is over, and so is everything it was holding.
      clearRebind()
      setPickingAddress(false)
      setPickingStore(false)
    },
    onError: (err, move) => {
      const code = apiErrorCode(err)
      // 🚩 The re-preview answers a spent TOKEN, so it is only ever raised by a
      // send that carried one. That condition is what BOUNDS it: the re-send
      // carries none, so a server answering the same code again falls through to
      // the ordinary failure surface instead of round-tripping a live basket
      // forever. `CONFIRM_TOKEN_INVALID` (expired, or already used) is answered
      // the same way on purpose — both mean *this token cannot commit*, and the
      // only safe answer to that is a diff the agent can look at again.
      if (
        move.confirmToken !== undefined &&
        (code === 'CONFIRM_TOKEN_STALE' || code === 'CONFIRM_TOKEN_INVALID')
      ) {
        setReissue(code === 'CONFIRM_TOKEN_STALE' ? 'stale' : 'expired')
        setPreview(null)
        const again = repreviewingStoreMove(move)
        setMove(again)
        rebind.mutate(again)
        return
      }
      if (code === 'REBIND_REFUSED') {
        setRefusal(
          rebindRefusal(
            // The server's own sentence (§7) — it names the store and the count.
            apiErrorMessage(err, t('rebind.refusedFallback')),
            err instanceof ApiError ? err.data : null,
            preview,
          ),
        )
        setMove(null)
        setPreview(null)
        setReissue(null)
      }
      // Anything else is left to the surface that raised it, below.
    },
    retry: false,
  })

  /** Everything one rebind action was holding. */
  const clearRebind = () => {
    setMove(null)
    setPreview(null)
    setReissue(null)
    setRefusal(null)
    rebind.reset()
  }

  /**
   * What one surface — the address book, the store picker — should be saying
   * about the rebind right now: the target it is applying, and the failure it
   * owns. The two always travel together and are always asked per surface, so
   * they are answered together rather than by two parallel lookups.
   *
   * 🚩 A code this page has already turned into a re-preview or a banner is NOT
   * that surface's error. Without that filter, a refusal being answered
   * elsewhere would also appear inside a dialog the console is closing, and the
   * agent would be told the same thing twice in two voices.
   */
  const rebindOn = (kind: StoreMove['kind']) => {
    const mine = rebind.variables?.kind === kind
    const answeredHere = ANSWERED_BY_THE_PAGE.includes(apiErrorCode(rebind.error) ?? '')
    return {
      pending: mine && rebind.isPending ? (rebind.variables?.target ?? null) : null,
      error: mine && rebind.isError && !answeredHere ? rebind.error : null,
    }
  }
  /** The commit's own failure, for the sheet — the same filter, on the send that
   *  is carrying a token. */
  const commitError =
    rebind.isError &&
    isCommitting(rebind.variables ?? null) &&
    !ANSWERED_BY_THE_PAGE.includes(apiErrorCode(rebind.error) ?? '')
      ? apiErrorMessage(rebind.error, t('rebind.failed'))
      : null

  /** Closing forgets the last refusal with it — a failure the agent has walked
   *  away from must not be waiting for them the next time they open the book. */
  const closeAddressBook = () => {
    setPickingAddress(false)
    rebind.reset()
  }

  const closeStorePicker = () => {
    setPickingStore(false)
    rebind.reset()
  }

  /** Declining costs nothing: the preview was the engine door run and not
   *  persisted (129), so there is no trace to undo — only the sheet to close. */
  const declineMove = () => {
    setMove(null)
    setPreview(null)
    setReissue(null)
    rebind.reset()
  }

  const abandon = useMutation({
    // No `again`: the dialog is this call's own failure surface (164), and the
    // strip offering a second retry behind a modal is one retry too many.
    mutationFn: (action: { transactionId: string; requestId: string }) =>
      runGuarded(() => callCenterApi.abandon(action.transactionId, action.requestId)),
    onSuccess: (_result, action) => startFresh(action.transactionId),
    // A failed abandon is shown in the dialog and retried on the SAME id; the
    // order is untouched, so there is nothing to undo. The one failure that is
    // NOT the dialog's is the order having already gone: `runGuarded` reads
    // `SESSION_CLOSED` and returns the tab to the start (164), because asking
    // again whether to void something already voided is a dead end.
    //
    // `retry: false` is react-query's blind retry, and it stays off: the only
    // retryable failure here is a claim collision, which `runGuarded` has
    // already ridden out on the contract's schedule.
    retry: false,
  })

  const confirmAbandon = () =>
    abandoning &&
    abandon.mutate({ transactionId: abandoning.target.transactionId, requestId: abandoning.requestId })
  const cancelAbandon = () => {
    setAbandoning(null)
    abandon.reset()
  }
  const abandonDialog = (
    <AbandonConfirm
      target={abandoning?.target ?? null}
      busy={abandon.isPending}
      error={abandon.isError ? apiErrorMessage(abandon.error, t('abandon.failed')) : null}
      onConfirm={confirmAbandon}
      onCancel={cancelAbandon}
    />
  )

  // 🚩 The dead order outranks everything. A tab that has been told its order
  // is gone must stop showing it AT ONCE — a basket still on screen is the
  // beginning of the stale-tab harm (§6.2), not the end of it. *Start again*
  // mints a genuinely new open action, which either opens or lands on 163's
  // choice screen naming the agent's real current order — which is exactly the
  // "offer `getState` on the agent's own order" §7 asks for after
  // `NOT_YOUR_SESSION`, without the console having to guess at an id.
  if (fault) {
    return (
      <ConsoleNotice
        marker={fault.kind === 'closed' ? 'sessionClosed' : 'notYourSession'}
        title={t(
          fault.kind === 'closed'
            ? fault.reason
              ? `fault.closed.${fault.reason}`
              : 'fault.closedTitle'
            : 'fault.notYoursTitle',
          // An unknown `reason` is a minor-version addition (§9) and must read
          // as the general case rather than as a raw key.
          { defaultValue: t('fault.closedTitle') },
        )}
        // The server's own words, passed through as data (§7).
        body={fault.message}
        retry={() => startFresh(transactionId ?? '')}
        retryLabel={t('fault.startAgain')}
      />
    )
  }

  // Held until the resumed order has actually been READ — the choice screen
  // stays up, with its *Resume* button saying so, rather than flicking to a
  // generic spinner. `session.data` is the only thing that ends it.
  if (outcome.kind === 'existing' && !session.data) {
    // 🚩 The choice, full-screen, with NO basket behind it — the previous
    // caller's basket is never inherited and is never even drawn (127).
    //
    // A failed resume stays HERE, with the failure named on the card, rather
    // than replacing the choice with a card of its own: *abandon and start
    // fresh* is the action that still gets the agent an order, and a screen
    // that hides it the moment the read fails leaves them with neither
    // (163's Done-when). `getState` is a pure read (law 2), so *Resume* is
    // free to be a retry of itself.
    return (
      <>
        <ExistingOrderScreen
          existing={outcome.existing}
          resuming={session.isFetching || abandon.isPending}
          resumeError={
            session.isError ? apiErrorMessage(session.error, t('state.readFailed')) : null
          }
          onResume={() => {
            if (resumedId) void session.refetch()
            else setResumedId(outcome.existing.transactionId)
          }}
          onStartFresh={() =>
            setAbandoning({
              target: abandonTargetOfExisting(outcome.existing),
              requestId: newRequestId(),
            })
          }
        />
        {abandonDialog}
      </>
    )
  }

  // There is deliberately NO third "the state read failed" card here. Every way
  // `session` can be without data is already answered: the resume path fails
  // onto the choice screen above (where *abandon and start fresh* still gets the
  // agent an order), and the `Open` path seeds the cache before it sets an id,
  // so it always has data. A card for the remaining case would be a card no
  // agent can reach — and the reload story that would need one (an order id in
  // the URL) is not a thing this route has.

  if (outcome.kind === 'malformed') {
    // The server answered something the contract does not describe. Named and
    // escapable, rather than a spinner that never resolves.
    return (
      <ConsoleNotice
        marker="malformed"
        title={t('open.malformedTitle')}
        body={t('open.malformedHint')}
        retry={() => void open.refetch()}
      />
    )
  }

  if (open.isError) {
    // The door carries the grant filter on every route, not only the probe (134
    // §6 — the probe is show/hide hygiene, never the enforcement). So `Open` can
    // refuse a session the probe admitted, and that refusal is the DENIAL, with
    // no *Try again*: retrying a grant the agent does not hold is a dead loop.
    const notGranted = apiErrorCode(open.error) === 'CONSOLE_NOT_GRANTED'
    return (
      <ConsoleNotice
        marker={notGranted ? 'denied' : 'openFailed'}
        title={t(notGranted ? 'access.deniedTitle' : 'open.failedTitle')}
        body={notGranted ? t('access.deniedHint') : apiErrorMessage(open.error, t('open.failedHint'))}
        retry={notGranted ? undefined : () => void open.refetch()}
      />
    )
  }

  if (!session.data) return <ConsoleStatus message={t('open.opening')} spinner />

  // 🚩 Checked on the first state of the session and before a single figure is
  // drawn (law 10 / §9). A major mismatch means a field this console reads has
  // been removed or re-meant, and the only honest answer to that is to refuse to
  // run: a console that mis-renders money is worse than a console that is down,
  // because the agent reads the wrong number out loud. There is no *Try again* —
  // retrying cannot change which client is installed.
  const contract = checkContractVersion(session.data.contractVersion)
  if (!contract.ok) {
    return (
      <ConsoleNotice
        marker="contractVersion"
        title={t('contract.title')}
        body={t('contract.hint', {
          expected: contract.expected,
          received: contract.received ?? t('contract.noneSent'),
        })}
      />
    )
  }

  return (
    <>
      {/* Abandoning from inside a live order is the SAME act as abandoning the
          one on the already-open screen — same confirmation, same wording, same
          landing on a fresh order. It is only reachable while the order is
          actually open; there is nothing to void once it has been submitted. */}
      <ConsoleShell
        state={session.data}
        busy={busy}
        onRefresh={refreshSession}
        refreshing={session.isFetching}
        customerActions={{
          onAttach: (member) => customer.mutate({ customerId: member.loyId }),
          onRemove: () => customer.mutate({ customerId: null }),
          busy: customer.isPending,
          // The fallback follows the DIRECTION that failed — `variables` is the
          // action the mutation is reporting on. One sentence for both would
          // tell an agent whose remove failed that the caller could not be
          // attached, which is the opposite of what happened.
          error: customer.isError
            ? apiErrorMessage(
                customer.error,
                t(customer.variables?.customerId === null ? 'rail.removeFailed' : 'rail.attachFailed'),
              )
            : null,
        }}
        addItem={{
          // 🚩 Passed only while the door says it will accept an add — the same
          // rule as the address book and the store chip: a control the door
          // refuses is worse than no control.
          onAdd: session.data.capabilities.canAddItem
            ? (itemNumber) => addItem.mutate({ itemNumber })
            : null,
          pending: addItem.isPending ? (addItem.variables?.itemNumber ?? null) : null,
          error: addOutcome,
          // 🚩 The outcome belongs to the act, not to the screen: a new search is
          // a new question, and `reset` is what stops the last one's refusal
          // standing over it. Nothing else clears it — a successful add already
          // replaces the mutation's own data.
          dismissError: addItem.reset,
        }}
        onAbandon={
          session.data.status === 'open'
            ? () =>
                setAbandoning({
                  target: abandonTargetOfSession(session.data),
                  requestId: newRequestId(),
                })
            : undefined
        }
        // 🚩 Passed only while the door says the book will answer — the one
        // place `canOpenAddressBook` is read on the way in, so the rail draws
        // the offer without re-testing the rule (§6.3, and 165's ruling that a
        // control the door refuses is worse than no control).
        onPickAddress={
          session.data.capabilities.canOpenAddressBook ? () => setPickingAddress(true) : undefined
        }
        // 🚩 Same rule, other capability: the store chip re-opens only where the
        // door says it will accept an override (§2), so the console never draws
        // a control it has to apologise for.
        onChangeStore={
          session.data.capabilities.canChangeStore ? () => setPickingStore(true) : undefined
        }
        refusal={refusal}
        onDismissRefusal={() => setRefusal(null)}
      />
      {/* Mounted on the same condition. A caller removed in another tab shuts
          the book from under an open dialog, which is the honest outcome: the
          addresses on screen are no longer readable and the order no longer has
          a customer to read them for. */}
      {session.data.header.customer && session.data.capabilities.canOpenAddressBook && (
        <AddressPicker
          open={pickingAddress}
          customerId={session.data.header.customer.customerId}
          currentAddressNumber={session.data.header.address?.addressNumber ?? null}
          apply={{
            pending: rebindOn('address').pending,
            error: rebindOn('address').error,
            // 🚩 One action per pick: a genuinely new rebind mints a genuinely
            // new id, and the confirm re-send below reuses it (§4).
            onPick: (addressNumber) => rebind.mutate(beginStoreMove('address', addressNumber)),
          }}
          onClose={closeAddressBook}
        />
      )}
      {/* The deliberate override (US14) — the same rebind, asked for outright. */}
      <StorePicker
        open={pickingStore}
        currentPlant={session.data.header.plant}
        pending={rebindOn('store').pending}
        error={
          rebindOn('store').error ? apiErrorMessage(rebindOn('store').error, t('store.applyFailed')) : null
        }
        onPick={(storeCode) => rebind.mutate(beginStoreMove('store', storeCode))}
        onClose={closeStorePicker}
      />
      {/* 🚩 The console's ONE confirmation surface. Both ways in land here, and
          169's below-availability acceptance reuses it verbatim. */}
      <StoreMoveConfirm
        preview={preview}
        reissue={reissue}
        busy={rebind.isPending}
        error={commitError}
        onConfirm={() => move && rebind.mutate(move)}
        onCancel={declineMove}
      />
      {abandonDialog}
    </>
  )
}

/** A full-viewport waiting state. Chrome-less like everything else here, and
 *  deliberately without an exit: it resolves on its own — within one request,
 *  or within the bounded busy schedule if that request met the claim (164). */
function ConsoleStatus({ message, spinner }: { message: string; spinner?: boolean }) {
  return (
    <div
      className="flex h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground"
      role="status"
      data-cc-status
    >
      {spinner && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {message}
    </div>
  )
}

/**
 * Every dead end on a chrome-less screen. The two ways out are `ConsoleCard`'s
 * and are not optional (134 §8); all this adds is what happened and, where
 * retrying is honest, a way to.
 */
function ConsoleNotice({
  marker,
  title,
  body,
  retry,
  /** What the action is called when *Try again* is not what it does — 164's
   *  dead-order screen starts a new order rather than re-running anything. */
  retryLabel,
}: {
  marker: string
  title: string
  body: string
  retry?: () => void
  retryLabel?: string
}) {
  const { t } = useTranslation('callcenter')
  return (
    <ConsoleCard tone="denied" marker={marker}>
      <div className="text-center">
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {retry && (
          <button
            type="button"
            onClick={retry}
            data-cc-retry
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {retryLabel ?? t('actions.retry')}
          </button>
        )}
      </div>
    </ConsoleCard>
  )
}
