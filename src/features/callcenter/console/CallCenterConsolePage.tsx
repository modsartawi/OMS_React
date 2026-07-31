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
import type {
  CustomerAddressBookEntry,
  CustomerAddressCapture,
  DeliveryType,
  PaymentType,
  SessionState,
} from '@/core/models/callcenter'
import {
  addressBookKey,
  CALLCENTER_ACCESS_KEY,
  callCenterApi,
  customerRequestsKey,
  newRequestId,
  openKey,
  sessionKey,
  withBusyRetry,
  type PickedSlot,
} from './api'
import { applyState, checkContractVersion } from './session-state'
import { readSessionFault, type ShownSessionFault } from './session-fault'
import {
  abandonTargetOfExisting,
  abandonTargetOfSession,
  readOpenResult,
  type PendingAbandon,
} from './open-outcome'
import { commitWasSwallowed, isCommitting, type ConfirmableAction } from './confirm-action'
import {
  beginStoreMove,
  committingStoreMove,
  rebindRefusal,
  repreviewingStoreMove,
  storeMovePreview,
  type RebindRefusal,
  type StoreMove,
  type StoreMovePreview,
} from './store-move'
import {
  beginAdd,
  belowAtpAsk,
  committingAdd,
  reaskingAdd,
  type BelowAtpAsk,
  type ItemAdd,
} from './below-atp'
import {
  beginLineEdit,
  committingLineEdit,
  lineRefusalKey,
  reaskingLineEdit,
  type LineEdit,
} from './line-edit'
import { classifyAdd, type AddOutcome, type GuidanceAdd } from './add-outcome'
import {
  linkGate,
  linkedCard,
  reportWithout,
  requestOffer,
  requestRows,
  skippedReport,
  submitRefusal,
  unlinkCost,
  type LinkReport,
  type SkippedRow,
} from './linked-request'
import { readSubmitFailure, readSubmitResult, type SubmitOutcome } from './submit-outcome'
import AbandonConfirm from './AbandonConfirm'
// 188 / §6.5 — the one predicate that turns a book `PUT` into an order act.
import { rePinAfterEdit } from './address-book'
import AddressPicker from './AddressPicker'
import BelowAtpConfirm from './BelowAtpConfirm'
import type { BusyPhase } from './BusyStrip'
import ConsoleCard from './ConsoleCard'
import ConsoleShell, { type SwallowedCommit } from './ConsoleShell'
import CouponPicker from './CouponPicker'
import { couponRemoveFailure, couponSurface } from './coupon-view'
import ExistingOrderScreen from './ExistingOrderScreen'
import FulfilmentPicker from './FulfilmentPicker'
import NoteForm from './NoteForm'
import { currentMode, currentPaymentType, isPickup } from './fulfilment-view'
import {
  CLOSED_SIGNUP,
  codeSent,
  signupCapture,
  signupConfirmCapture,
  signupCreated,
  type SignupState,
} from './signup-view'
import PaymentPicker from './PaymentPicker'
import RequestPicker from './RequestPicker'
import SlotPicker from './SlotPicker'
import SourceForm from './SourceForm'
import type { PreviewReissue } from './ConfirmSheet'
import StoreMoveConfirm from './StoreMoveConfirm'
import StorePicker from './StorePicker'
import UnlinkConfirm from './UnlinkConfirm'

/**
 * The refusals this page answers ITSELF — with a fresh preview, or with the
 * banner over the basket. They are never also drawn as a dialog's own failure:
 * one refusal, one voice (167). The two token codes reach BOTH two-phase actions
 * (the rebind's and the add's), which is why the list is shared rather than
 * spelled per surface.
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

  /** The slot picker, open or not (173) — the slot chip re-opening its section. */
  const [pickingSlot, setPickingSlot] = useState(false)

  /**
   * The two axis chips' modals (182), open or not — *delivering, or collecting?*
   * and *how are they paying?*.
   *
   * Two flags rather than one `'fulfilment' | 'payment' | null`, matching every
   * other section on this page: they are two acts on two verbs, and the console
   * already opens one modal at a time by construction.
   */
  const [pickingFulfilment, setPickingFulfilment] = useState(false)
  const [pickingPayment, setPickingPayment] = useState(false)

  /**
   * 🚩 The slot the agent chose had lapsed — `SLOT_UNAVAILABLE` (409), which the
   * contract calls *a warning path, not a submit blocker* (§7).
   *
   * It is held apart from the mutation's ordinary error state precisely so it
   * can be DRAWN differently: the order is untouched, the call carries on, and
   * the picker stays open with the windows still in front of the agent. A soft
   * gate rendered as a failure is a soft gate the console has quietly hardened.
   */
  const [slotLapsed, setSlotLapsed] = useState(false)

  /** The source + reference form, open or not (173). One flag for two chips:
   *  they collapse two fields of one act. */
  const [editingSource, setEditingSource] = useState(false)

  /** The order note, open or not (183) — the note chip re-opening its own
   *  section. One free-text field, on one verb, like every other chip. */
  const [editingNote, setEditingNote] = useState(false)

  /**
   * The coupon modal, open or not (189) — the last chip in the row, and the only
   * one an order need never fill.
   *
   * 🚩 Its two refusals are held on the MUTATIONS below rather than here,
   * because they belong to different halves of the same modal: a refused apply
   * is drawn under the entry box and a refused REMOVE beside the list it did not
   * alter. A refused removal reported above the entry box reads as a refused
   * apply, which is the one misreading this surface cannot afford.
   */
  const [pickingCoupon, setPickingCoupon] = useState(false)

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

  /**
   * The add in flight (169), as the same three facts — for the same reasons:
   *
   * - `add` is the action, carrying the one `requestId` that survives the
   *   acceptance and the re-ask (§4).
   * - `belowAtp` is what the server pinned to that action's token. 🚩 Held here
   *   and NOT read off the cache, because the ask carries the *unchanged* state
   *   — same `version` — so `applyState` rightly keeps what is on screen.
   * - `addReissue` says why the agent is being asked twice.
   */
  const [add, setAdd] = useState<ItemAdd | null>(null)
  const [belowAtp, setBelowAtp] = useState<BelowAtpAsk | null>(null)
  const [addReissue, setAddReissue] = useState<PreviewReissue | null>(null)
  /** An ask this console could not state truthfully, so it drew no sheet — and
   *  the add therefore did not land. See `addItem.onSuccess`. */
  const [addUnconfirmable, setAddUnconfirmable] = useState(false)
  /** 🚩 An acceptance the server swallowed as a replay (177 / BackOffice 858).
   *  Console-wide rather than per-surface: by the time it is known the sheet the
   *  agent answered has closed, and the one thing that must not happen is their
   *  walking away believing it applied. */
  const [swallowed, setSwallowed] = useState<SwallowedCommit | null>(null)
  /** How many adds have landed on the basket this console life. The search
   *  panel's signal to put its rows away — a question that has been answered. */
  const [addsLanded, setAddsLanded] = useState(0)

  /**
   * An add launched from a guidance card (172), as the two facts classifying its
   * outcome needs: which offer the agent was working on, and **the state before
   * the add**.
   *
   * 🚩 The snapshot is held with the ACTION rather than read back off the cache,
   * for the same reason the rebind's preview is: by the time the answer arrives
   * the cache already holds the new state, and *what the engine did* is only
   * legible as a difference. It survives the below-availability acceptance —
   * that ask carries the UNCHANGED state, so the add has not happened yet and
   * the same *before* is still the right one to compare against.
   */
  const [addedFrom, setAddedFrom] = useState<(GuidanceAdd & { before: SessionState }) | null>(null)

  /** What the engine actually did with that add — fired, fired a different
   *  offer, or nothing at all. Drawn in the strip's pinned head (171's slot). */
  const [guidanceOutcome, setGuidanceOutcome] = useState<AddOutcome | null>(null)

  /** The offer the item search is narrowed to — `Search the other 994` (172).
   *  Page state because the request comes from the guidance strip and lands in
   *  the search panel, at the other end of the centre column. */
  const [searchScope, setSearchScope] = useState<{ offerId: string; description: string } | null>(null)

  /**
   * The correction in flight (170) — quantity, unit of measure or void — as the
   * same three facts, for the same reasons. A quantity RAISED beyond
   * availability takes 169's confirm path unchanged, which is why `editAsk` and
   * `editReissue` exist here at all and why they feed the same sheet: a second
   * acceptance surface would be the defect both slices exist to prevent.
   */
  const [edit, setEdit] = useState<LineEdit | null>(null)
  const [editAsk, setEditAsk] = useState<BelowAtpAsk | null>(null)
  const [editReissue, setEditReissue] = useState<PreviewReissue | null>(null)

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
      // Likewise an acceptance about an item on a basket that no longer exists.
      setAdd(null)
      setBelowAtp(null)
      setAddReissue(null)
      setAddUnconfirmable(false)
      // And the guidance an abandoned basket's offers were about: the outcome
      // banner, the add it classified, and the search narrowed to one of them.
      setAddedFrom(null)
      setGuidanceOutcome(null)
      setSearchScope(null)
      // And a correction to a line on a basket that no longer exists.
      setEdit(null)
      setEditAsk(null)
      setEditReissue(null)
      setPickingStore(false)
      // And the request a basket that no longer exists was converting: the new
      // order holds no link, so a report about the old one's copied lines is news
      // about somebody else's basket.
      setPickingRequest(false)
      setRequestReport(null)
      // …and a confirmation asking whether to take back a link on an order that
      // is gone, which is the same dead end the abandon dialog is cleared for.
      setUnlinking(null)
      // And the header sections of a basket that no longer exists.
      setPickingSlot(false)
      setSlotLapsed(false)
      setEditingSource(false)
      // And a submit of a basket that no longer exists — including its order
      // number, which belongs to an order this agent is no longer on.
      setSubmitAction(null)
      setPlaced(null)
      colliders.current = 0
      setColliding(null)
      setStalled(null)
      setFault(null)
      setRequestId(newRequestId())
    },
    [queryClient],
  )

  /**
   * The caller who is not a member yet (190) — the enrolment's four steps, held
   * on the page because its two calls are the page's.
   *
   * 🚩 **It is not order state and is not cleared with the order.** Nothing about
   * a signup is a fact of the ORDER — it belongs to the caller, who is still on
   * the line after an abandon — so `startFresh` deliberately does not touch it.
   * What DOES close it is a change of who the order holds, below: an enrolment
   * that has reached its attach has nothing left to do.
   */
  const [signup, setSignup] = useState<SignupState>(CLOSED_SIGNUP)

  /**
   * *Send code* — `SignUpByBranch` (contract §6.6).
   *
   * 🚩 **Not a session verb**, so no `runGuarded` and no busy retry: the signup
   * precedes attach, there is no transaction to scope it to and no claim to
   * collide with. It still mints a `requestId`, once and outside the thunk, for
   * the same reason every other action does (law 3 / §4).
   *
   * 🚩 The body is `signupCapture`'s — no branch, and the mobile as typed. The
   * two omissions are the ticket's two 🚩s and they are structural: neither field
   * exists on `LoyaltySignupCapture` to be filled in here by accident.
   */
  const sendCode = useMutation({
    mutationFn: (state: SignupState) =>
      callCenterApi.signUpByBranch(newRequestId(), signupCapture(state)),
    // The step moves on the SERVER's answer, never on the press: a code that was
    // never sent must not put the agent in front of a box asking for it.
    onSuccess: () => setSignup(codeSent),
    retry: false,
  })

  /**
   * *Confirm* — `ConfirmSignUpByBranch`, and the member it answers with.
   *
   * 🚩 **It ends at a member the agent still has to attach** (165's two steps).
   * Nothing here calls `attachCustomer`: enrolling somebody and putting them on
   * a live order are two acts, and only the second one is about this order.
   */
  const confirmOtp = useMutation({
    mutationFn: (state: SignupState) =>
      callCenterApi.confirmSignUpByBranch(newRequestId(), signupConfirmCapture(state)),
    onSuccess: (member) => setSignup((current) => signupCreated(current, member)),
    retry: false,
  })

  /** Whichever leg last failed, in the server's own words — one surface, because
   *  only one of the two can be in flight. A refused code and an unreachable
   *  loyalty service are both business outcomes the agent says out loud, so
   *  neither is dressed as a crash nor as the other (§7). */
  const signupLegFailure = sendCode.isError
    ? apiErrorMessage(sendCode.error, t('signup.sendFailed'))
    : confirmOtp.isError
      ? apiErrorMessage(confirmOtp.error, t('signup.confirmFailed'))
      : null

  /** Closing the panel, and forgetting the last attempt's failure with it —
   *  cancelling and starting again is the honest retry here, since there is no
   *  resend (CC2 has none, and a countdown the console invented would promise an
   *  expiry only the loyalty service knows). */
  const closeSignup = () => {
    setSignup(CLOSED_SIGNUP)
    sendCode.reset()
    confirmOtp.reset()
  }

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
      // 🚩 And so does the request picker, for the same reason and a sharper one:
      // `removeCustomer` clears the link server-side (880 §6) because a request
      // belongs to a CALLER, not to an order — so nothing about the previous
      // caller's requests may survive them, including the report of what a link
      // copied. That absence is the whole abuse answer (195): link caller A's
      // request, swap to caller B, submit, and the 055b spine would otherwise
      // complete A's request against B's order.
      setPickingRequest(false)
      setRequestReport(null)
      // …and the sheet asking whether to take back a link the server has just
      // cleared: 195's obligation on this arm is an ABSENCE, and a confirmation
      // still naming the previous caller's request would be the console
      // contradicting the projection it has just been handed.
      setUnlinking(null)
      // 🚩 And the enrolment closes with it (190). Attaching is what the created
      // member was FOR, so a panel still holding them afterwards would offer a
      // second attach of somebody already on the order; and the caller being
      // swapped out makes an enrolment about the last one stale in the same way
      // the rail's own search is.
      closeSignup()
    },
    retry: false,
  })

  /** Whichever of the two customer verbs last failed, in the server's own words.
   *  The fallback follows the DIRECTION that failed — `variables` is the action
   *  the mutation is reporting on. One sentence for both would tell an agent
   *  whose remove failed that the caller could not be attached, which is the
   *  opposite of what happened. */
  const customerFailure = customer.isError
    ? apiErrorMessage(
        customer.error,
        t(customer.variables?.customerId === null ? 'rail.removeFailed' : 'rail.attachFailed'),
      )
    : null

  /**
   * What the signup panel shows — its own leg's failure, or, once it is holding a
   * created member, the failure of the ATTACH it offers.
   *
   * 🚩 The second half is not decoration. The panel draws its own *Attach*
   * button, and the rail's attach failure is drawn beside the LOOKUP's card —
   * which is not on screen on this path. Without this, an attach that failed
   * under the signup's own button would re-enable it and say nothing.
   */
  const signupError =
    signupLegFailure ?? (signup.step === 'created' ? customerFailure : null)

  /**
   * The delivery slot (173, US19) — `setSlot`, on its own mutation because it is
   * its own act with its own surface.
   *
   * 🚩 **The soft gate is honoured here and nowhere else.** A window that has
   * gone since the list was read answers `SLOT_UNAVAILABLE` (409), which §7
   * calls *a warning path, not a submit blocker*: the order is untouched, the
   * picker stays open, and the agent chooses another window. Nothing about it
   * touches submit — only `capabilities.submitBlockers` can, and this code is
   * deliberately not in it.
   *
   * 🚩 It returns the whole `SessionState` like everything else, so the chip is
   * RE-RENDERED from the projection rather than patched from what was clicked:
   * whether the slot the agent picked is the slot the order holds is the
   * server's answer, not this console's assumption.
   */
  const slot = useMutation({
    // No `again`: the picker draws this call's own failure, and a strip offering
    // a second retry behind a modal is one retry too many (164's ruling).
    mutationFn: ({ slotId, ...window }: PickedSlot) => {
      // 🚩 Minted ONCE, outside the thunk — a fresh id inside it would make each
      // busy retry a genuinely new action to the server's ledger (law 3 / §4).
      const requestId = newRequestId()
      // v1.2 (§10): the window's own four descriptive fields ride with it, because
      // the slot catalogue is not on this door and the CLCN header stamps all five.
      return runGuarded(() => callCenterApi.setSlot(transactionId!, requestId, slotId, window))
    },
    // The last attempt's lapse belongs to the last attempt; left standing it
    // would warn about a window the agent is no longer choosing.
    onMutate: () => setSlotLapsed(false),
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      // The section has answered, so the chip it collapsed into is the surface
      // again (135's progressive disclosure).
      setPickingSlot(false)
    },
    onError: (err) => {
      if (apiErrorCode(err) === 'SLOT_UNAVAILABLE') setSlotLapsed(true)
      // Anything else is the picker's own failure, drawn below.
    },
    retry: false,
  })

  /**
   * How the order arrives (182, US5–US17) — `setFulfilment`, the call's first
   * question and the widest change of state on this screen.
   *
   * 🚩 **Nothing about the flip is computed here.** The verb returns the whole
   * `SessionState` and every consequence rides in it: the server clears
   * `address`, drops `MISSING_SLOT`, zeroes `deliveryFee` and sets
   * `retainedAddressLabel` in the same response (capture 09). What the console
   * decides is only what the agent SEES of that — the rail's face, the absent
   * slot chip, the absent delivery region — and `fulfilment-view.ts` decides it
   * once, for all four surfaces.
   *
   * 🚩 **No confirmation path, by the contract's own shape** (§5.1): the flip
   * never moves the plant, and the re-derivation on the way back to delivery
   * reaches the `storeChange` modal through `setAddress`'s existing rule rather
   * than through a second one here. So this is an ordinary one-shot verb.
   */
  const fulfilment = useMutation({
    // No `again`: the picker draws this call's own failure (164's ruling).
    mutationFn: (mode: DeliveryType) => {
      // 🚩 Minted ONCE, outside the thunk — a fresh id inside it would make each
      // busy retry a genuinely new action to the server's ledger (law 3 / §4).
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.setFulfilment(transactionId!, requestId, mode))
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      // The section has answered, so the chip it collapsed into is the surface
      // again (135's progressive disclosure).
      setPickingFulfilment(false)
    },
    retry: false,
  })

  /**
   * How the caller pays (182, US18–US23) — `setPaymentType`.
   *
   * 🚩 **Not a tender, and no money moves through this console.** `Online` tells
   * OMS to send a payment link the caller completes elsewhere; nothing here sees
   * a gateway or a result (§2.4). It re-prices nothing and can raise no
   * confirmation, which is why it is the plainest verb on the page.
   *
   * 🚩 **An axis independent of the mode.** All four combinations are legal, and
   * the chip's WORD following the mode is a rendering (`paymentWordKey`) rather
   * than a second rule about the value — the wire keeps saying `CashOnDelivery`
   * while the agent reads *Pay on collection*.
   */
  const payment = useMutation({
    // No `again`: the picker draws this call's own failure (164's ruling).
    mutationFn: (value: PaymentType) => {
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.setPaymentType(transactionId!, requestId, value))
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      setPickingPayment(false)
    },
    retry: false,
  })

  /**
   * The document source and its reference (173, US20) — `setDocumentSource`, ONE
   * verb carrying both fields.
   *
   * 🚩 **Which sources require a reference is the SERVER's rule**, evaluated over
   * the pair. The console sends what the agent keyed and words the refusal
   * (`SOURCE_REFERENCE_REQUIRED`, 400) if there is one; it never predicts the
   * answer, because a client-side required-field rule is a second opinion about
   * a predicate this console does not own — the same reasoning that keeps
   * `submitBlockers` the only thing that dims *Place order*.
   */
  const documentSource = useMutation({
    // No `again`: the form draws this call's own failure.
    mutationFn: (action: { documentSource: string; sourceReference: string }) => {
      const requestId = newRequestId()
      return runGuarded(() =>
        callCenterApi.setDocumentSource(
          transactionId!,
          requestId,
          action.documentSource,
          action.sourceReference,
        ),
      )
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      setEditingSource(false)
    },
    retry: false,
  })

  /**
   * What the caller told the agent (183, v1.3) — `setOrderNote`, the loosest
   * field on the header and the plainest verb on the page.
   *
   * 🚩 **`null` is a real act, not an empty save.** Clearing is what stops a
   * stale instruction travelling to the store with an order the caller has since
   * changed their mind about, so the console sends `null` rather than `''`:
   * *empty but present* is not the same fact as *no instruction*, and the
   * difference is what the picker reads.
   *
   * 🚩 **It blocks nothing.** No `submitBlocker` names it and it is never
   * price-affecting — an order with no note is an ordinary order — so there is no
   * capability to test on the way in and nothing here touches submit.
   */
  const orderNote = useMutation({
    // No `again`: the form draws this call's own failure (164's ruling).
    mutationFn: (note: string | null) => {
      // 🚩 Minted ONCE, outside the thunk — a fresh id inside it would make each
      // busy retry a genuinely new action to the server's ledger (law 3 / §4).
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.setOrderNote(transactionId!, requestId, note))
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      // The section has answered, so the chip it collapsed into is the surface
      // again (135's progressive disclosure).
      setEditingNote(false)
    },
    retry: false,
  })

  /**
   * The caller's coupon, redeemed (189, v1.10) — `applyCoupon`.
   *
   * 🚩 **The modal STAYS OPEN on success**, unlike every other section on this
   * page. The others collapse back into their chip because they have answered a
   * question; this one has just changed what the order holds, and the agent's
   * next question — *did it come off the price?* — is answered by the list and
   * the amount that are drawn right here. A second, different code is also an
   * ordinary next act (the engine holds a list), and closing would put the entry
   * box away between two halves of one conversation.
   *
   * 🚩 **Nothing is optimistic and nothing is pre-screened.** The redeem burns
   * the code before the engine sees it, so the chip fills from the RESPONSE —
   * a console that drew the coupon on the press would show one that was refused.
   */
  const applyCoupon = useMutation({
    // No `again`: the modal draws this call's own failure (164's ruling).
    mutationFn: (code: string) => {
      // 🚩 Minted ONCE, outside the thunk — a fresh id inside it would make each
      // busy retry a genuinely new redemption to the server's ledger (law 3).
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.applyCoupon(transactionId!, requestId, code))
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
    },
    retry: false,
  })

  /**
   * The coupon taken back off (189) — `removeCoupon`, and the one refusal on
   * this console that means the OPPOSITE of what its wording usually does.
   *
   * 🚩 **`COUPON_REVERSAL_REFUSED` means nothing changed.** The server reverses
   * the burn at the coupon service before it voids the line (issue 211's till
   * invariant), so a refused reversal leaves the order byte-identical with the
   * coupon still on it — where a failed remove elsewhere would leave the agent
   * safe to say *it did not come off*. Here the agent must be able to say both
   * halves: it did not come off, AND nothing else moved either. So this is the
   * one code the console words itself (`coupon.refusedReversal`) instead of
   * passing the envelope's sentence through, and the wording names `abandon` as
   * the only escape — because there is no second way to take it off.
   */
  /**
   * The refusal, worded. `coupon-view` decides WHICH sentence and whether it
   * outranks the server's; all this does is apply that answer — because
   * `apiErrorMessage` would otherwise prefer the envelope's own shorter phrase
   * and the *nothing changed* sentence would never reach the agent at all.
   */
  const couponRemoveMessage = (error: unknown) => {
    const failure = couponRemoveFailure(apiErrorCode(error))
    return failure.overridesServer
      ? t(failure.key)
      : apiErrorMessage(error, t(failure.key))
  }

  const removeCoupon = useMutation({
    mutationFn: (code: string) => {
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.removeCoupon(transactionId!, requestId, code))
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
    },
    retry: false,
  })

  /**
   * The caller's still-open sales requests (194, v1.11) — the read that makes the
   * rail volunteer one.
   *
   * 🚩 **Fired off the attached caller, and keyed by them.** The door scopes the
   * list to whoever is on the session row (880 §3) — the console sends the
   * TRANSACTION id and no customer id at all — so the cache key has to move with
   * the caller or a swap would show the previous one's requests. `enabled` is what
   * makes the read impossible before an attach, where it would refuse
   * `NO_CUSTOMER_ATTACHED`.
   *
   * A pure read: no `runGuarded`, no `requestId`, nothing to collide with.
   */
  const requests = useQuery({
    queryKey: customerRequestsKey(session.data?.header.customer?.customerId ?? ''),
    queryFn: () => callCenterApi.customerRequests(transactionId!),
    enabled: session.data?.header.customer != null && session.data?.status === 'open',
    // 🚩 Read ONCE per caller, deliberately. The list is the pharmacist's and it
    // can change under the call — but a re-read is not the console's answer to
    // that: 195 rules that the console must not pre-check the request, because
    // narrowing the window invites a reader to believe it was closed. The guard is
    // the submit refusal, and a list that moved while the agent read it out would
    // be the harm without the protection.
    staleTime: 60_000,
    retry: false,
  })

  /** The picker is drawn only when the agent asks for it — 🚩 nothing opens by
   *  itself: they are mid-greeting, and a picker over the basket takes the call
   *  away from them. */
  const [pickingRequest, setPickingRequest] = useState(false)

  /**
   * What the copy did NOT put on the order — held here, because by the time the
   * agent works through it the picker has closed and one of its rows raises the
   * below-availability sheet.
   *
   * 🚩 **It is news about an act, not state about an order.** The link itself is
   * read off `header.linkedRequest` in the projection and remembered nowhere; this
   * is the per-line report of one press, which no re-read can reproduce.
   */
  const [requestReport, setRequestReport] = useState<LinkReport | null>(null)

  /**
   * The link (194) — **one press, one act, one id**.
   *
   * 🚩 **No `addItem` loop.** The verb stamps the request and its reason, copies
   * the store, copies the items through `addItem`'s own guardrails server-side,
   * prefills `sourceReference` where it is empty, and for `TMRA` forces pickup and
   * paid-online — all in the one `SessionState` it answers with. N ids for one
   * agent action would be §4 law 3 broken by design, and the guardrail outcomes
   * belong to the server's own copy.
   *
   * 🚩 **The chips are not told anything.** `fulfilment` and `payment` already draw
   * from the projection, so the TMRA consequences announce themselves; a second
   * voice here would be a client rule about what a reason code does.
   */
  const linkRequest = useMutation({
    mutationFn: (documentNo: string) => {
      // Minted ONCE, outside the thunk — a fresh id per busy retry would make each
      // retry a genuinely new link to the server's ledger (law 3 / §4).
      const requestId = newRequestId()
      return runGuarded(() => callCenterApi.linkRequest(transactionId!, requestId, documentNo))
    },
    onSuccess: (result) => {
      queryClient.setQueryData<SessionState>(sessionKey(result.state.transactionId), (current) =>
        applyState(current, result.state),
      )
      // The picker has answered its question: which request this order converts.
      // What is left to read is the report, and it is drawn above the columns
      // rather than inside a modal the agent has finished with.
      setPickingRequest(false)
      setRequestReport(skippedReport(result))
    },
    retry: false,
  })

  /**
   * The undo in flight, if any (195) — its own `requestId`, minted when the
   * confirmation opens, exactly as the abandon's is. One confirmation is one
   * action: a *Try again* inside the sheet re-sends the same id, and a second
   * unlink later in the console's life is a second action with a second id.
   *
   * 🚩 It is the CONFIRMATION's state and not the verb's, because the whole point
   * of this slice is that the verb is never reached without it: unlink removes the
   * copied lines, and an agent who read it as *stop referencing this request*
   * would lose a basket they meant to keep.
   */
  const [unlinking, setUnlinking] = useState<{ requestId: string } | null>(null)

  /**
   * Taking the link back (195) — **a full undo, not a stamp being cleared**.
   *
   * 🚩 The console removes nothing itself. The door clears both columns, removes
   * the copied lines, resets `plantSource` and returns the two axes to the session
   * defaults, all in the one `SessionState` it answers with (880 §5) — so the
   * empty basket, the re-shut store gate and the re-opened link offer are the
   * projection arriving through `applyState`, not a client rewind of a copy this
   * console never made.
   *
   * 🚩 **The caller is untouched**, which is the sheet's third fact and is true
   * here by omission: nothing on this path names the customer.
   */
  const unlink = useMutation({
    // No `again`: the sheet is this call's own failure surface, and a strip
    // offering a second retry behind a modal is one retry too many (164's ruling).
    mutationFn: (action: { requestId: string }) =>
      // The id is the CONFIRMATION's, re-sent verbatim by a retry inside the sheet
      // — a fresh id per busy retry would make each retry a genuinely new undo to
      // the server's ledger (law 3 / §4).
      runGuarded(() => callCenterApi.unlinkRequest(transactionId!, action.requestId)),
    onSuccess: (fresh) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      setUnlinking(null)
      // 🚩 The report is news about a copy that no longer exists. Its rows claim
      // *this line did not land*, over a basket the undo has just emptied — every
      // line is off the order now, and a banner still singling out two of them
      // would be describing an act the agent has taken back.
      setRequestReport(null)
    },
    retry: false,
  })

  /** One press, one confirmation, one action — and the id is minted HERE rather
   *  than at the send, so the sheet's own *Try again* re-sends the same one. Both
   *  ways in (the card, and the submit refusal's escape) come through this: they
   *  are the same act with the same cost. */
  const beginUnlink = () => setUnlinking({ requestId: newRequestId() })

  const cancelUnlink = () => {
    setUnlinking(null)
    unlink.reset()
  }

  /**
   * Placing the order (174) — the one moment this console is deliberately **not**
   * optimistic, and the only verb whose answer is a real OMS document.
   *
   * 🚩 **It sends only the transaction id.** No document, no lines, no amounts,
   * no fee: the CLCN document is built server-side from engine state, which is
   * what makes the browser unable to influence what the caller pays (map note 3).
   *
   * 🚩 **The receipt HOLDS until an order number exists.** There is no optimistic
   * hand-off — CC2's research recommends one and it is ruled out here, because an
   * optimistically confirmed order that then refuses is a phone call the agent
   * cannot take back. Which is why nothing is written on `onMutate` beyond
   * clearing the last attempt's news.
   *
   * 🚩 **Both successes are the same news**, and this file cannot tell them apart
   * even if it tried: `readSubmitResult` drops the outcome word and `replayed`
   * before either reaches state. Once-only is keyed on the transaction id, and
   * the server completes the local tail on the replay path too (§8.3).
   *
   * Neither failure closes the order. `SUBMIT_REFUSED` names a field to fix and
   * `SUBMIT_UNAVAILABLE` is a transient outage the agent rides out — both leave
   * the transaction Open, which is what makes a refusal a correction rather than
   * a lost basket.
   */
  /**
   * The press in flight or last attempted: its `requestId`, and **the order
   * version it was made against**.
   *
   * 🚩 The version is what makes a refusal stop being true. `SUBMIT_REFUSED`
   * names a field, the agent fixes it — and that fix is a verb, so the version
   * moves. A danger box still saying *the order was not placed* under a receipt
   * the agent has just corrected is a console arguing with itself.
   */
  const [submitAction, setSubmitAction] = useState<{ requestId: string; version: number } | null>(null)
  const [placed, setPlaced] = useState<SubmitOutcome | null>(null)

  const submit = useMutation({
    // No `again`: the receipt draws this call's own outcome, at the foot where
    // the agent's hand already is, and a strip offering a second retry beside it
    // is one retry too many (164's ruling).
    mutationFn: (action: { requestId: string }) =>
      // 🚩 The id is the PRESS's, minted at `placeOrder` and re-sent verbatim by
      // the retry a transient outage offers. Minting one inside the thunk would
      // make every busy retry a new action to the server's ledger — on the one
      // verb that mints a real OMS order.
      runGuarded(() => callCenterApi.submit(transactionId!, action.requestId)),
    // The last attempt's news belongs to the last attempt.
    onMutate: () => setPlaced(null),
    onSuccess: (result) => {
      // Law 2, as everywhere: the whole returned state goes through the one
      // write path. It is what closes the order on screen — the corrections, the
      // abandon and the header sections all read `status` and stand down.
      //
      // Keyed on the order this submit was FOR rather than on the response's own
      // id: `submit` is the one verb whose result is not primarily a projection
      // (§8.3), and there is exactly one order it could be about.
      if (result.state) {
        queryClient.setQueryData<SessionState>(sessionKey(transactionId!), (current) =>
          applyState(current, result.state!),
        )
      }
      setPlaced(readSubmitResult(result))
    },
    retry: false,
  })

  /**
   * What the last attempt said, worded once. A `SUBMIT_UNAVAILABLE` that reached
   * here as anything but `retryable` would be the defect this ticket names — see
   * the coded-envelope rule in `core/api.ts`.
   *
   * 🚩 Read through `submitAction` rather than off the mutation alone, and only
   * while the order is still the one the attempt was about. *Abandon and start
   * fresh* forgets the action outright; an ordinary correction moves the version
   * — and either way a refusal about an order that has since changed must not be
   * waiting at the foot of the receipt.
   */
  const submitFailure =
    submit.isError && submitAction && session.data?.version === submitAction.version
      ? readSubmitFailure(submit.error, t('submit.failed'))
      : null

  /**
   * 🚩 **One press, one `requestId`, reused verbatim across every retry of that
   * press** (law 3 / §4) — including the retry a transient outage offers, and
   * including a retry after a failure this console could not classify, which is
   * precisely the case where the submit may have landed server-side. Only a
   * press with no standing failure behind it mints a new id, which is what makes
   * *fix the field and place it again* a genuinely new action.
   *
   * Once-only is keyed on the transaction id either way, so no path here can
   * mint a second order; what the id buys is a server-side ledger that reads as
   * one attempt rather than as several.
   */
  const placeOrder = () => {
    const action = submitFailure
      ? submitAction!
      : { requestId: newRequestId(), version: session.data?.version ?? -1 }
    setSubmitAction(action)
    submit.mutate(action)
  }

  /**
   * `addItem` (168, 169) — the one verb the search panel has, on its own mutation
   * because it is its own act with its own failure surface.
   *
   * 🚩 **It sends an item number and a quantity, never a price** (law 1): the
   * estimate the agent was looking at when they pressed *Add* is a
   * material-master figure that has never been near the engine. What the line
   * costs comes back in the projection, VAT included, and is the only figure the
   * caller is ever told.
   *
   * 🚩 **Beyond availability it is TWO-PHASE, on the same protocol as the plant
   * rebind** (169): a quantity the store cannot cover answers `200` with the
   * unchanged state and a `belowAtp` token, and the acceptance is a second send
   * of this same verb carrying the **same `requestId`** plus the token (§4/§5.2).
   * The token is the audit record — it proves the agent was shown the number
   * they accepted, which a client-set boolean never could. Where availability is
   * merely *unknown* the server raises nothing at all, and this path is never
   * entered: a degraded stock read must not become a workflow.
   *
   * Quantity is 1: the search row's action is *add this*, and changing how many
   * is the basket's own verb (`changeQty`, ticket 170).
   */
  const addItem = useMutation({
    // No `again`: the panel draws this call's own failure under the rows, where
    // the agent's eye already is, and a strip offering a second retry behind it
    // is one retry too many (164's ruling).
    mutationFn: (add: ItemAdd) =>
      // 🚩 The id is the ADD's, minted once at `beginAdd` and carried through the
      // acceptance and the re-ask. Nothing here mints one — a fresh id inside the
      // thunk would let a busy retry look like the same item added twice, on the
      // verb the agent presses most.
      runGuarded(() =>
        callCenterApi.addItem(transactionId!, add.requestId, add.itemNumber, add.qty, add.confirmToken),
      ),
    // The last add's unreadable-ask sentence belongs to the last add. Left
    // standing under the rows it would describe the one now in flight.
    onMutate: () => {
      setAddUnconfirmable(false)
      // The last add's outcome belongs to the last add. Left standing over the
      // one now in flight it would describe the wrong press.
      setGuidanceOutcome(null)
    },
    onSuccess: (fresh, add) => {
      // Read BEFORE the write: "did the accepted add actually land" is a
      // difference between two projections, and the cache is about to hold only
      // the later one.
      const before = queryClient.getQueryData<SessionState>(sessionKey(fresh.transactionId))
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      const asked = belowAtpAsk(fresh.pendingConfirmation)
      if (asked) {
        // Are-you-sure, on the success path — nothing was added. The token pins
        // THESE figures, so it travels with the action rather than the screen.
        setAdd(committingAdd(add, asked.confirmToken))
        setBelowAtp(asked)
        return
      }
      // 🚩 858: an acceptance the server swallowed as a replay. The agent said
      // yes to a below-availability add, the answer was a 200, and the line is
      // not in the basket. Say so — silence here is the outcome that sends them
      // on to read out a total for an item nobody is sending.
      //
      // 🚩 *Applied* is asked of the BASKET, never of `replayed` alone: a replay
      // is also how §6.4 resolves a commit that already landed, so the flag on its
      // own would accuse a real add. The engine either opens a line or raises an
      // existing one, so the item's total quantity is what moves either way — and
      // fixture 04 shows why nothing softer will do, answering `hasBelowAtp: true`
      // over zero lines.
      if (commitWasSwallowed(add, fresh, qtyOf(fresh, add.itemNumber) > qtyOf(before, add.itemNumber))) {
        setSwallowed('belowAtp')
        clearAdd()
        return
      }
      // 🚩 The add landed, so the engine has re-priced — and what it DID is only
      // legible as a difference. Three outcomes, and the two that a naive
      // implementation gets wrong (a different offer fired; nothing fired and
      // the offer stays with its meter advanced) are the ones the agent most
      // needs said out loud (`add-outcome.ts`).
      if (addedFrom && add.offerId === addedFrom.offerId)
        setGuidanceOutcome(classifyAdd(addedFrom.before, fresh, addedFrom))
      clearAdd()
      // 🚩 The add is ON the basket, so the question the search rows answered is
      // over and the panel puts them away. Counted HERE and not on every success:
      // the two paths above this line are an ask (nothing added) and a
      // guidance classification, and the one below is an ask this console could
      // not word — none of them is a landing, and a list cleared under any of
      // them would take away rows the agent is still working from.
      if (fresh.pendingConfirmation?.kind !== 'belowAtp') {
        setAddsLanded((n) => n + 1)
        // 🚩 194 — and the skipped row for this item goes with it. The row says
        // *this did not land, and here is how to land it*; once a line for the item
        // is on the order that sentence is false, and a banner still making it
        // would be the console arguing with the basket. Pruned on ANY landed add,
        // not only on the report's own *add anyway*: an agent who typed the item
        // into the search box has answered the same row.
        setRequestReport((report) => reportWithout(report, add.itemNumber))
      }
      // 🚩 A `belowAtp` block this console cannot state truthfully — figures
      // missing or not numbers (§5.2 says the server does not raise one then) —
      // is still an ask, and an ask carries the UNCHANGED state. So nothing was
      // added, and saying nothing would leave the agent watching a basket that
      // did not move. It is not the acceptance sheet, because there is no number
      // to accept; it is the outcome, under the rows.
      setAddUnconfirmable(fresh.pendingConfirmation?.kind === 'belowAtp')
    },
    onError: (err, add) => {
      const code = apiErrorCode(err)
      // 🚩 The same bounded re-ask as the rebind (167): only a send that CARRIED
      // a token can raise these, and the re-send carries none, so a server
      // answering the same code again falls through to the ordinary failure
      // surface instead of round-tripping forever.
      if (
        add.confirmToken !== undefined &&
        (code === 'CONFIRM_TOKEN_STALE' || code === 'CONFIRM_TOKEN_INVALID')
      ) {
        setAddReissue(code === 'CONFIRM_TOKEN_STALE' ? 'stale' : 'expired')
        setBelowAtp(null)
        const again = reaskingAdd(add)
        setAdd(again)
        addItem.mutate(again)
        return
      }
      // 🚩 A failed ACCEPTANCE stays in the sheet the agent is looking at, with
      // the failure named there and the same acceptance still offered — the id
      // and the token are unchanged, so pressing again is a retry of the one
      // action rather than a second one (law 3). Closing the modal and moving
      // the sentence to the panel behind it is exactly the two-voices failure
      // 167 ruled out.
      if (add.confirmToken !== undefined) return
      // An ordinary add failure has no sheet — the panel draws it, under the
      // rows, where the agent's eye already is.
      clearAdd()
    },
    retry: false,
  })

  /** Everything one add action was holding — including the *before* a guidance
   *  add was going to be classified against, which is dead the moment the action
   *  is over however it ended. The OUTCOME is not cleared here: it is what the
   *  agent has to read, and it outlives the action that produced it. */
  const clearAdd = () => {
    setAdd(null)
    setBelowAtp(null)
    setAddReissue(null)
    setAddUnconfirmable(false)
    setAddedFrom(null)
  }

  /**
   * What the panel says about the last add. Beyond availability is no longer a
   * sentence here — it is the sheet, and the agent answers it.
   *
   * 🚩 Silent while the sheet is open: a failure of the acceptance is named IN
   * the sheet, and one refusal in two voices is the thing 167 settled.
   */
  const addOutcome = belowAtp
    ? null
    : addItem.isError
      ? apiErrorMessage(addItem.error, t('search.addFailed'))
      : addUnconfirmable
        ? t('search.addNotConfirmable')
        : null

  /** Declining costs nothing: the ask carried the UNCHANGED state, so there is
   *  no line to remove — only the sheet to close. */
  const declineAdd = () => {
    clearAdd()
    addItem.reset()
  }

  /**
   * The basket's three corrections (170), as ONE mutation — because they are one
   * act with three shapes, only one of them can be in flight at a time (the
   * engine's claim is a mutual exclusion), and one pending flag plus one failure
   * surface is therefore the honest shape. The same reasoning that made attach
   * and remove one mutation at 165.
   *
   * 🚩 **Each returns the whole `SessionState`**, so the basket and the receipt
   * are RE-RENDERED rather than patched — including `totals`, which is how the
   * delivery fee re-quotes live as the basket crosses its threshold (US36)
   * without this console knowing the fee rule at all (that is 156's, server-side).
   *
   * 🚩 **A quantity raised beyond availability takes 169's path unchanged**: the
   * same `belowAtp` block, the same sheet, the same token on the same
   * `requestId`. Nothing about it is re-implemented here.
   */
  const lineEdit = useMutation({
    // No `again`: the row draws this call's own failure, on the line it was
    // about, and a strip offering a second retry above it is one retry too many.
    mutationFn: (correction: LineEdit) =>
      // 🚩 The id is the CORRECTION's, minted once at `beginLineEdit` and carried
      // through an acceptance and a re-ask. A fresh id inside the thunk would let
      // a busy retry look like two voids of a line the caller can only lose once.
      runGuarded(() => {
        const { requestId, lineId } = correction
        if (correction.kind === 'qty')
          return callCenterApi.changeQty(transactionId!, requestId, lineId, correction.qty, correction.confirmToken)
        if (correction.kind === 'uom')
          return callCenterApi.changeUom(transactionId!, requestId, lineId, correction.uom)
        return callCenterApi.voidLine(transactionId!, requestId, lineId)
      }),
    onSuccess: (fresh, correction) => {
      queryClient.setQueryData<SessionState>(sessionKey(fresh.transactionId), (current) =>
        applyState(current, fresh),
      )
      const asked = belowAtpAsk(fresh.pendingConfirmation)
      if (asked) {
        // Are-you-sure, on the success path — the quantity did NOT change. The
        // token pins THESE figures, so it travels with the action.
        setEdit(committingLineEdit(correction, asked.confirmToken))
        setEditAsk(asked)
        return
      }
      clearEdit()
    },
    onError: (err, correction) => {
      const code = apiErrorCode(err)
      // The same bounded re-ask as the add and the rebind: only a send that
      // CARRIED a token can raise these, and the re-send carries none.
      if (
        correction.confirmToken !== undefined &&
        (code === 'CONFIRM_TOKEN_STALE' || code === 'CONFIRM_TOKEN_INVALID')
      ) {
        setEditReissue(code === 'CONFIRM_TOKEN_STALE' ? 'stale' : 'expired')
        setEditAsk(null)
        const again = reaskingLineEdit(correction)
        setEdit(again)
        lineEdit.mutate(again)
        return
      }
      // A failed ACCEPTANCE stays in the sheet the agent is looking at (169's
      // ruling); an ordinary failure is drawn on the line, by `lineFailure`.
      if (correction.confirmToken !== undefined) return
      // The action is over — its failure is drawn on the line by `lineFailure`,
      // and nothing may keep pointing at an ask that is no longer being made.
      clearEdit()
    },
    retry: false,
  })

  /** Everything one correction was holding. */
  const clearEdit = () => {
    setEdit(null)
    setEditAsk(null)
    setEditReissue(null)
  }

  /**
   * 🚩 What a refused correction says, wherever it is drawn.
   *
   * The three codes this verb family raises are worded by the console
   * (`line-edit.ts`), because the server's own sentence answers the wrong
   * question — an agent told "line L2 not found" mid-call has no idea that the
   * screen has simply fallen behind. Anything else is the server's own words
   * (§7), never flattened into a generic failure.
   *
   * It is ONE function because the same refusal can arrive on either send: the
   * first, which the line draws, or the token-carrying acceptance, which the
   * sheet draws. Wording only the first would leave the agent reading a machine
   * sentence at exactly the moment they are being asked to decide.
   */
  const lineRefusal = (fallback: string) => {
    const key = lineRefusalKey(apiErrorCode(lineEdit.error))
    return key ? t(`line.refused.${key}`) : apiErrorMessage(lineEdit.error, fallback)
  }

  /**
   * What the basket should say about the last correction, on the line it was
   * about. Silent while the sheet is open: a failure of the acceptance is named
   * IN the sheet, and one refusal in two voices is what 167 settled.
   */
  const lineFailure =
    lineEdit.isError && lineEdit.variables && !editAsk
      ? { lineId: lineEdit.variables.lineId, message: lineRefusal(t('line.refused.fallback')) }
      : null

  /** Declining a quantity raise costs nothing: the ask carried the UNCHANGED
   *  state, so the line still holds what it held — only the sheet to close. */
  const declineEdit = () => {
    clearEdit()
    lineEdit.reset()
  }

  /**
   * A failed COMMIT — the send that carried a token — worded for the sheet the
   * agent is looking at. Ordinary failures belong to the surface that raised
   * them, and a code this page has already answered by re-asking belongs to
   * neither: one refusal, one voice (167).
   */
  const commitFailure = (
    mutation: { isError: boolean; error: unknown; variables?: ConfirmableAction | null },
    fallback: string,
  ) =>
    mutation.isError && isCommitting(mutation.variables) && !ANSWERED_BY_THE_PAGE.includes(apiErrorCode(mutation.error) ?? '')
      ? apiErrorMessage(mutation.error, fallback)
      : null

  /**
   * 🚩 **The one below-availability acceptance on screen**, whichever verb
   * raised it — the add (169) or the quantity raise (170). They cannot both be
   * asking: each is a claim on the same order, so the second would have
   * collided. Answering them through one object is what keeps the sheet one
   * mechanism rather than one per verb.
   */
  const acceptance = belowAtp
    ? {
        // The verb is the acceptance's, and it changes the WORDS and nothing
        // else: an agent raising a line already in the basket must not be asked
        // whether to *add* it.
        verb: 'add' as const,
        ask: belowAtp,
        item: add?.description,
        reissue: addReissue,
        busy: addItem.isPending,
        error: commitFailure(addItem, t('belowAtp.failed')),
        confirm: () => add && addItem.mutate(add),
        cancel: declineAdd,
      }
    : editAsk
      ? {
          verb: 'raise' as const,
          ask: editAsk,
          item: edit?.description,
          reissue: editReissue,
          busy: lineEdit.isPending,
          // 🚩 Worded like the first send: a `LINE_NOT_FOUND` on the acceptance
          // is the same fact and needs the same sentence.
          error:
            commitFailure(lineEdit, t('belowAtp.raiseFailed')) === null
              ? null
              : lineRefusal(t('belowAtp.raiseFailed')),
          confirm: () => edit && lineEdit.mutate(edit),
          cancel: declineEdit,
        }
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
      // 🚩 858: an acceptance the server swallowed as a replay. The agent said
      // yes, the answer was a 200, and the plant did not move. Say so — silence
      // here sends them on to quote a price from a store the order is not at.
      //
      // 🚩 *Applied* is the PLANT, against the one the token pinned — not the
      // `replayed` flag, which is also §6.4's answer for a commit that landed, and
      // not the version, which both captures advance while applying nothing. A
      // preview that named no target cannot be judged, so it is not accused.
      if (commitWasSwallowed(move, fresh, !preview?.toPlant || fresh.header.plant === preview.toPlant)) {
        setSwallowed('storeChange')
        clearRebind()
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

  /**
   * The address book's WRITES — two in 187, three since 188 — on the **customer**
   * door rather than this order's (§6.5).
   *
   * 🚩 **A create auto-applies.** `POST` answers the whole row including the new
   * `addressNumber`, so the console hands it straight to the rebind above with
   * no re-read of the book: the only reason an agent creates an address mid-call
   * is to deliver to it (179 ruling 6). The apply is the ordinary one — an empty
   * basket takes it inline, a basket with lines gets §5.1's preview — because it
   * IS the ordinary one, and a second path to `setAddress` is the kind of
   * second implementation this contract keeps refusing to have.
   *
   * 🚩 **A correction of the address the order holds IS an order act** (188 /
   * §6.5 rule 1) — `updateAddress.onSuccess` asks `rePinAfterEdit` and, on a
   * match, fires the same rebind. A correction to any OTHER row is a pure book
   * act and must fire nothing: that asymmetry is the ticket, and treating the
   * two alike in either direction is the failure it exists to prevent.
   *
   * ⚠️ **A DELETE has no order act behind it and cannot be given one** — see
   * `deleteAddress` below for why the answer there is a refusal rather than a
   * cascade.
   *
   * None of the three carries a `requestId` and none rides `withBusyRetry`:
   * there is no transaction lease to collide with on the address door. (The
   * re-pin that follows a correction does — but it is the ordinary rebind, and
   * it mints its own id at `beginStoreMove`.)
   */

  /**
   * The book's cache key for the caller who is attached RIGHT NOW. Keyed by the
   * customer (`api.ts`), which is what stops a write from landing on the
   * previous caller's book; `null` when there is nobody attached, a state in
   * which neither write is reachable at all (§6.3 — the door refuses, and the
   * picker is only mounted while `canOpenAddressBook` holds).
   */
  const bookKey = () => {
    const customerId = session.data?.header.customer?.customerId
    return customerId ? addressBookKey(customerId) : null
  }

  const createAddress = useMutation({
    mutationFn: (capture: CustomerAddressCapture) => callCenterApi.createCustomerAddress(capture),
    onSuccess: (entry) => {
      if (!entry?.addressNumber) return
      // 🚩 **No re-read — the row is put where the read would have found it.**
      // The create answered the whole entry, so a `GET` between the write and
      // the apply would spend a call to learn what is already in hand. Seeding
      // matters on the path that is NOT the happy one: if the apply is refused
      // (a store-less district), the book stays open and the agent sees the
      // address they just saved rather than a list missing it, which is what
      // would invite them to key it a second time.
      const key = bookKey()
      if (key)
        queryClient.setQueryData<CustomerAddressBookEntry[]>(key, (current) =>
          current
            ? [...current.filter((row) => row.addressNumber !== entry.addressNumber), entry]
            : current,
        )
      rebind.mutate(beginStoreMove('address', entry.addressNumber))
    },
  })

  const updateAddress = useMutation({
    mutationFn: ({
      addressNumber,
      capture,
    }: {
      addressNumber: string
      capture: CustomerAddressCapture
    }) => callCenterApi.updateCustomerAddress(addressNumber, capture),
    // The book is re-read so the corrected line is what the agent sees — the
    // `PUT` answers `true`, not the row, so unlike the create there is nothing
    // to seed.
    onSuccess: (_ok, { addressNumber }) => {
      const key = bookKey()
      if (key) void queryClient.invalidateQueries({ queryKey: key })
      // 🚩 **188 / §6.5 rule 1 — the re-pin.** `setAddress` carries only an
      // `addressNumber` and an edit does not change it, so a `PUT` that moves an
      // address from one district to another leaves the ORDER on a plant derived
      // from a district the address has left, with `header.address.line` still
      // rendering the old composition. Nothing on the wire would say so.
      //
      // So the console re-issues `setAddress` with that same number, and it is a
      // rule rather than a mechanism: this is the ORDINARY rebind, which already
      // carries the whole re-derivation, already raises §5.1's preview when there
      // are lines, and already refuses `NO_DELIVERY_STORE_FOR_DISTRICT`. The
      // agent sees exactly the store-move preview a *different* address would
      // have shown them.
      //
      // ⚠️ It can leave the book **saved** and the order **refusing** — the
      // caller corrects their address into a district carrying no store. That is
      // drawn, not prevented (`address.savedNotMoved`): rolling back a correction
      // the caller just made would be the console overruling them.
      //
      // 🚩 The server's side of this is a NEGATIVE obligation, pinned in
      // BackOffice 878 §3: a same-number `setAddress` must not be short-circuited
      // as a no-op. It is the one call on this contract that looks idempotent and
      // is not — same `addressNumber` in, a different plant possibly out.
      const rePin = rePinAfterEdit(addressNumber, session.data?.header.address?.addressNumber)
      if (rePin !== null) rebind.mutate(beginStoreMove('address', rePin))
    },
  })

  /**
   * 188 / §6.5 rule 2 — a row off the book, and the ONE book act that has no
   * order act behind it.
   *
   * `AddressPicker` omits the control on the address the order holds, and the
   * server refuses that one with `ADDRESS_IN_USE_BY_ORDER` (409): the sidecar
   * keeps an `addressNumber` while the submit builder copies address *fields*
   * and `GetCustomerAddresses` filters `IsDeleted = 0`, so deleting it yields an
   * order that cannot build a shipping address at its LAST step. The refusal is
   * the guard and the omission is the courtesy — which is why the code is
   * handled (`addressRefusalKey`) even though this console's own UI cannot
   * provoke it.
   *
   * Clearing the order's address instead was rejected: it cascades a **book** act
   * into **order** state, silently shutting §2.3's opening gate mid-call.
   *
   * 🚩 Nothing here touches the session. `mutateAsync` rejects into the picker,
   * which is where the agent and the row they aimed at both are.
   */
  const deleteAddress = useMutation({
    mutationFn: (addressNumber: string) => callCenterApi.deleteCustomerAddress(addressNumber),
    onSuccess: () => {
      const key = bookKey()
      if (key) void queryClient.invalidateQueries({ queryKey: key })
    },
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

  /**
   * 🚩 **One header section at a time** (175 §9's variant 4).
   *
   * While a chip opened a `<dialog>` this was true by construction — the backdrop
   * meant a second chip could not be reached. A section in the flow leaves the
   * chip row live above it, which is the point of drawing it there, and that is
   * exactly what makes the invariant this page's to keep: two open sections would
   * be two half-answered questions stacked over the basket.
   *
   * 🚩 A section also **opens clean**. Its own close resets its verb, but a
   * section DISPLACED by another never gets its close — so the reset happens on
   * the way in as well, and only for the section being opened. Nothing here
   * touches a verb the agent did not just ask for: a rebind mid-flight belongs to
   * the confirmation sheet, not to whichever chip was pressed after it.
   */
  const openSection = (
    which: 'store' | 'slot' | 'source' | 'fulfilment' | 'payment' | 'coupon' | 'note',
  ) => {
    setPickingStore(which === 'store')
    setPickingSlot(which === 'slot')
    setEditingSource(which === 'source')
    setPickingFulfilment(which === 'fulfilment')
    setPickingPayment(which === 'payment')
    setPickingCoupon(which === 'coupon')
    setEditingNote(which === 'note')
    switch (which) {
      case 'slot':
        // The lapse is the slot's alone, and it is a warning about a window the
        // agent has since left behind (§7's soft gate).
        setSlotLapsed(false)
        slot.reset()
        break
      case 'source':
        documentSource.reset()
        break
      case 'fulfilment':
        fulfilment.reset()
        break
      case 'payment':
        payment.reset()
        break
      case 'note':
        orderNote.reset()
        break
      case 'coupon':
        applyCoupon.reset()
        removeCoupon.reset()
        break
      case 'store':
        break
    }
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

  /**
   * 🚩 **What the chips open into** (175 §9's variant 4, second half): seven
   * sections, drawn by the shell directly under the chip row they collapsed
   * rather than in a dialog over the order.
   *
   * They are built HERE because every one of them is a verb this page owns and a
   * mutation this page holds; all the shell contributes is the place. A closed
   * section renders nothing, so at rest this whole node is empty and the chip row
   * sits straight on top of the item search — v3's resting state, which is what
   * variant 4 asked for.
   *
   * 🚩 The address book is NOT among them, and neither are the confirmation
   * sheets. A section is a header field the agent reads out while the caller is
   * still talking, with the basket and receipt in view; a store move the caller
   * has to agree to, an abandon, a below-availability acceptance are acts that
   * must be finished before anything else on the screen is true. Those stay
   * modal, which is the distinction this arrangement is drawing.
   */
  const headerSection = (
    <>
      {/* The slot, at the ORDER's store (173). The windows are read fresh on
          every open — a window free two minutes ago may be full now. */}
      <SlotPicker
        open={pickingSlot}
        plant={session.data.header.plant}
        current={session.data.header.slot}
        apply={{
          pending: slot.isPending ? (slot.variables?.slotId ?? null) : null,
          // 🚩 The lapse is NOT an error here: it is the soft gate's own outcome
          // and the picker draws it as a warning. Wording it as a failure would
          // harden a gate the contract deliberately left soft.
          error:
            slot.isError && !slotLapsed ? apiErrorMessage(slot.error, t('slot.applyFailed')) : null,
          lapsed: slotLapsed,
          onPick: (picked) => slot.mutate(picked),
        }}
        onClose={() => {
          setPickingSlot(false)
          setSlotLapsed(false)
          slot.reset()
        }}
      />
      {/* 🚩 *Delivering, or collecting?* (182) — two full-sentence choices, never
          a toggle: a toggle has a default and a default here is a guess about the
          caller. Each option states its consequence BEFORE it is chosen, because
          the consequence is what the agent has to know in order to ask. */}
      <FulfilmentPicker
        open={pickingFulfilment}
        current={currentMode(session.data.header)}
        pending={fulfilment.isPending ? (fulfilment.variables ?? null) : null}
        error={
          fulfilment.isError ? apiErrorMessage(fulfilment.error, t('fulfilment.failed')) : null
        }
        onPick={(mode) => fulfilment.mutate(mode)}
        onClose={() => {
          setPickingFulfilment(false)
          fulfilment.reset()
        }}
      />
      {/* *How are they paying?* (182). No money moves here — `Online` is an
          instruction to OMS to send a link, not a tender. */}
      <PaymentPicker
        open={pickingPayment}
        current={currentPaymentType(session.data.header)}
        // 🚩 Passed in rather than re-derived inside the modal, so the chip and
        // the options cannot disagree about which word they are using.
        pickup={isPickup(session.data.header)}
        pending={payment.isPending ? (payment.variables ?? null) : null}
        error={payment.isError ? apiErrorMessage(payment.error, t('payment.failed')) : null}
        onPick={(value) => payment.mutate(value)}
        onClose={() => {
          setPickingPayment(false)
          payment.reset()
        }}
      />
      {/* The document source and its reference (173) — two chips, one form, one
          verb, because the reference belongs to the source it references. */}
      <SourceForm
        open={editingSource}
        currentSource={session.data.header.documentSource}
        currentReference={session.data.header.sourceReference}
        apply={{
          busy: documentSource.isPending,
          // 🚩 The mandatory-reference rule is the SERVER's; all the console owes
          // it is words. Anything else is the server's own sentence (§7).
          error: documentSource.isError
            ? apiErrorCode(documentSource.error) === 'SOURCE_REFERENCE_REQUIRED'
              ? t('source.refusedReferenceRequired')
              : apiErrorMessage(documentSource.error, t('source.applyFailed'))
            : null,
          onApply: (source, reference) =>
            documentSource.mutate({ documentSource: source, sourceReference: reference }),
        }}
        onClose={() => {
          setEditingSource(false)
          documentSource.reset()
        }}
      />
      {/* What the caller told the agent (183) — free text, and the one field on
          this header whose CLEARING is as much an act as its setting. */}
      <NoteForm
        open={editingNote}
        current={session.data.header.orderNote}
        apply={{
          busy: orderNote.isPending,
          error: orderNote.isError ? apiErrorMessage(orderNote.error, t('note.failed')) : null,
          onApply: (note) => orderNote.mutate(note),
        }}
        onClose={() => {
          setEditingNote(false)
          orderNote.reset()
        }}
      />
      {/* The caller's coupon (189) — the console's ONE coupon surface, and the
          only place a coupon's money is drawn. The chip carries the code; the
          receipt gains no coupon row, because the engine has already flattened
          the discount onto the lines it touched. */}
      <CouponPicker
        open={pickingCoupon}
        // 🚩 Both capabilities are read HERE and nowhere else. `canRemove` is the
        // server's own boolean — never `coupons.length > 0` — because the
        // removal reverses a burn at the coupon service before it touches the
        // order, and whether that remote leg is reachable is not a count.
        surface={couponSurface(session.data.header, session.data.capabilities)}
        pendingApply={applyCoupon.isPending}
        pendingRemove={removeCoupon.isPending ? (removeCoupon.variables ?? null) : null}
        applyError={
          applyCoupon.isError ? apiErrorMessage(applyCoupon.error, t('coupon.applyFailed')) : null
        }
        // 🚩 THE sentence of this ticket. `COUPON_REVERSAL_REFUSED` is the one
        // refusal the console words itself: the reverse runs before the void, so
        // the order is untouched and the coupon is STILL ON IT — the opposite of
        // what "could not remove" means everywhere else on this screen. An agent
        // reading the server's shorter phrase would tell the caller the discount
        // had gone. Which sentence that is belongs to `coupon-view` with the
        // rest of the coupon's rules, so it can be proved without a browser;
        // every other failure still keeps the envelope's own words (§7).
        removeError={removeCoupon.isError ? couponRemoveMessage(removeCoupon.error) : null}
        // Each verb clears the OTHER's failure on the way in: the two are drawn
        // at opposite ends of one modal, and a refusal left standing under a
        // list that has since changed is a sentence about an order that is gone.
        onApply={(code) => {
          removeCoupon.reset()
          applyCoupon.mutate(code)
        }}
        onRemove={(code) => {
          applyCoupon.reset()
          removeCoupon.mutate(code)
        }}
        onClose={() => {
          setPickingCoupon(false)
          applyCoupon.reset()
          removeCoupon.reset()
        }}
      />
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
    </>
  )

  return (
    <>
      {/* Abandoning from inside a live order is the SAME act as abandoning the
          one on the already-open screen — same confirmation, same wording, same
          landing on a fresh order. It is only reachable while the order is
          actually open; there is nothing to void once it has been submitted. */}
      <ConsoleShell
        state={session.data}
        busy={busy}
        // 🚩 175 §9 — the chips' sections land IN the centre column, under the row
        // they collapsed. The shell owns the place; this page owns the verbs.
        headerSection={headerSection}
        // One open at a time (`openSection`), so this is the whole question the
        // sequence card needs answered before it stands down.
        headerSectionOpen={
          pickingStore ||
          pickingSlot ||
          editingSource ||
          pickingFulfilment ||
          pickingPayment ||
          pickingCoupon ||
          editingNote
        }
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
          error: customerFailure,
        }}
        // 🚩 The caller the lookup could not find, enrolled without leaving the
        // console (190) — INLINE in the rail, because the wait between *Send
        // code* and the code arriving is SPOKEN and a modal would take the basket
        // away for the length of a conversation the agent is having anyway. It
        // hangs off the not-found lookup as the ordinary next thing: a miss is
        // not a failure.
        signup={{
          state: signup,
          actions: {
            // 🚩 A failure belongs to the ATTEMPT, not to the panel: the agent
            // who re-types the code the caller just repeated is asking a new
            // question, and the last one's refusal must not stand over it.
            onChange: (next) => {
              setSignup(next)
              if (sendCode.isError) sendCode.reset()
              if (confirmOtp.isError) confirmOtp.reset()
            },
            onSendCode: () => sendCode.mutate(signup),
            onConfirm: () => confirmOtp.mutate(signup),
            onCancel: closeSignup,
            // 🚩 The SAME attach the lookup's own card uses — one verb, one
            // `requestId`, one error surface. A freshly enrolled caller reaches
            // the order by exactly the path a found one does (165).
            onAttach: (member) => customer.mutate({ customerId: member.loyId }),
            sending: sendCode.isPending,
            confirming: confirmOtp.isPending,
            error: signupError,
          },
        }}
        addItem={{
          // 🚩 Passed only while the door says it will accept an add — the same
          // rule as the address book and the store chip: a control the door
          // refuses is worse than no control.
          // 🚩 One action per press: the id is minted HERE, once, and the
          // acceptance re-sends it (§4).
          onAdd: session.data.capabilities.canAddItem
            ? (itemNumber, description) => addItem.mutate(beginAdd({ itemNumber, qty: 1, description }))
            : null,
          pending: addItem.isPending ? (addItem.variables?.itemNumber ?? null) : null,
          error: addOutcome,
          landed: addsLanded,
          // 🚩 The outcome belongs to the act, not to the screen: a new search is
          // a new question, and `reset` is what stops the last one's refusal
          // standing over it. Nothing else clears it — a successful add already
          // replaces the mutation's own data.
          dismissError: () => {
            addItem.reset()
            setAddUnconfirmable(false)
          },
        }}
        // 🚩 The same verb, launched from a card (172) — one `addItem`, not a
        // second add path: a card that had its own would be a second place for
        // the below-availability acceptance and the busy retry to be forgotten.
        guidance={{
          onAdd: session.data.capabilities.canAddItem
            ? (from) => {
                // The state BEFORE, held with the action: what the engine did is
                // only legible as a difference, and by the time the answer
                // arrives the cache holds the after.
                setAddedFrom({ ...from, before: session.data })
                addItem.mutate(
                  beginAdd({ itemNumber: from.itemNumber, qty: 1, description: from.itemName, offerId: from.offerId }),
                )
              }
            : null,
          // The row that launched it, and only that row, says *Adding…* — and it
          // does not move while it runs (the resolution is not re-fetched).
          pending: addItem.isPending && addedFrom ? addedFrom : null,
          outcome: guidanceOutcome,
          dismissOutcome: () => setGuidanceOutcome(null),
          // The route to the rest of a big set: the console's own search,
          // narrowed — never a second list.
          onSearchRest: (offerId, description) => setSearchScope({ offerId, description }),
        }}
        searchScope={searchScope}
        onClearSearchScope={() => setSearchScope(null)}
        // 🚩 The three corrections are offered only while the order is OPEN: a
        // submitted basket has nothing to correct, and a control that would be
        // refused is worse than no control (165's ruling, and the same one the
        // abandon button already follows).
        lineEdit={
          session.data.status === 'open'
            ? {
                onQty: (line, qty) =>
                  lineEdit.mutate(
                    // The description travels so the acceptance sheet can name
                    // what the agent is holding rather than an item number. It
                    // is display only — the wire carries the line id (law 1).
                    beginLineEdit({ kind: 'qty', lineId: line.lineId, qty, description: line.description }),
                  ),
                onUom: (line, uom) =>
                  lineEdit.mutate(beginLineEdit({ kind: 'uom', lineId: line.lineId, uom })),
                onVoid: (line) => lineEdit.mutate(beginLineEdit({ kind: 'void', lineId: line.lineId })),
                // 🚩 Unfinished, not merely in flight: a quantity raise waiting
                // on the agent's acceptance is still this line's correction, and
                // the field must keep what they typed until it settles. Which is
                // the two halves below — the call itself, and the ask it raised.
                pending: lineEdit.isPending ? lineEdit.variables : editAsk ? edit : null,
                error: lineFailure,
              }
            : null
        }
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
          session.data.capabilities.canChangeStore ? () => openSection('store') : undefined
        }
        // 🚩 Offered only while the order is OPEN — the same rule the three
        // corrections and the abandon button follow. There is no capability of
        // their own for these two sections (§2 lists none), and a submitted
        // order has no header left to capture.
        onChangeSlot={session.data.status === 'open' ? () => openSection('slot') : undefined}
        onChangeSource={session.data.status === 'open' ? () => openSection('source') : undefined}
        // Same rule again (183): there is no capability of its own for the note
        // (§2 lists none), and a submitted order has no header left to capture.
        onChangeNote={session.data.status === 'open' ? () => openSection('note') : undefined}
        // 🚩 189 — **a shut gate is not a shut chip.** The coupon chip opens on
        // the OPEN rule alone; `canApplyCoupon` is deliberately not tested here,
        // because an order may hold a coupon the agent has to read out on a call
        // where a new one may not be applied. The modal is where the reason is
        // said, and `couponSurface` is what says it — the one place the two
        // capabilities are read.
        onChangeCoupon={session.data.status === 'open' ? () => openSection('coupon') : undefined}
        // 🚩 The two axis chips (182). Only the OPEN rule is applied here —
        // `canChangeFulfilment` / `canChangePaymentType` are read inside the
        // shell, through `capabilityGate`, because the shell is also what prints
        // the reason beside the row. Testing the capability here too would be the
        // same predicate in two places, and the one that went stale would be the
        // one still drawing the chip.
        onChangeFulfilment={
          session.data.status === 'open' ? () => openSection('fulfilment') : undefined
        }
        onChangePayment={session.data.status === 'open' ? () => openSection('payment') : undefined}
        // 🚩 194 — the count block and the linked card, derived ONCE here off the
        // same state the picker reads, so the rail, the card and the modal cannot
        // disagree about whether this order converts a request. The read itself is
        // scoped by the door; the console never sends a customer id.
        requests={{
          offer: requestOffer(session.data, requests.data),
          card: linkedCard(session.data),
          onView: () => setPickingRequest(true),
          // 🚩 195 — the press opens the CONFIRMATION, never the verb. Offered
          // only while the order is open, the same rule the corrections and the
          // abandon follow: a submitted order's link is history, and a control
          // the door would refuse is worse than no control.
          onUnlink: session.data.status === 'open' ? beginUnlink : undefined,
        }}
        // The lines the copy did not take, and the one act they offer.
        requestReport={{
          report: requestReport,
          // 🚩 The ORDINARY add, on the ordinary gate: `canAddItem` is what decides,
          // exactly as it does for a typed row, and the server answers with the same
          // `belowAtp` acceptance. Absent while the gate is shut — a handle that
          // would be refused is worse than no handle.
          onAddAnyway: session.data.capabilities.canAddItem
            ? (row: SkippedRow) =>
                addItem.mutate(beginAdd({ itemNumber: row.itemNumber, qty: row.quantity }))
            : undefined,
          onDismiss: () => setRequestReport(null),
        }}
        refusal={refusal}
        swallowed={swallowed}
        onDismissSwallowed={() => setSwallowed(null)}
        onDismissRefusal={() => setRefusal(null)}
        submit={{
          // 🚩 The DOOR decides whether this order may be placed (§2), with no
          // exception and no client-side predicate beside it — the console never
          // re-implements *is this order complete*, and the reason a dead button
          // is dead is `submitBlockers` (173).
          onPlace:
            session.data.status === 'open' && session.data.capabilities.canSubmit
              ? placeOrder
              : undefined,
          placing: submit.isPending,
          outcome: placed,
          failure: submitFailure,
          // 🚩 195 — the request was converted or cancelled behind the agent's
          // back. Read off the refusal's CODE and the order's own link, and only
          // while a refusal is actually standing: `submitFailure` is already
          // version-gated, so the escape disappears the moment the unlink lands.
          requestGone: submitFailure ? submitRefusal(apiErrorCode(submit.error), session.data) : null,
          onUnlink: beginUnlink,
          // 🚩 The next call, from the finished screen. `startFresh` is the whole
          // act here — the ABANDON half belongs to a live order and this one is
          // already a document, so there is nothing to void and nothing to
          // confirm. Offered only once a placement has actually landed: it is a
          // way ON from an outcome, never a way out of an order in progress
          // (that is *abandon*, and it asks first).
          onNewOrder: placed ? () => startFresh(session.data!.transactionId) : undefined,
        }}
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
          // 🚩 The writes are handed over as promises, not as pending/error
          // props: the form is a second VIEW of this dialog, so the failure that
          // belongs in front of the agent's own typing is held there — while the
          // create's auto-apply, which is an ORDER act, stays here with every
          // other rebind and keeps §5.1's one confirmation mechanism.
          write={{
            onCreate: (capture) => createAddress.mutateAsync(capture).then(() => undefined),
            onUpdate: (addressNumber, capture) =>
              updateAddress.mutateAsync({ addressNumber, capture }).then(() => undefined),
            onDelete: (addressNumber) =>
              deleteAddress.mutateAsync(addressNumber).then(() => undefined),
          }}
          onClose={closeAddressBook}
        />
      )}
      {/* The caller's open request, and what linking it will copy (194). 🚩 It is
          NOT `DocumentDetailsPage`: that page has no view-only mode, so reusing it
          would hand an agent change-store / reschedule / close-request mid-call —
          and `callcenter → oms` is a boundary violation. The picker shows the lines
          it is about to copy and links out for the rest. */}
      <RequestPicker
        open={pickingRequest}
        rows={requestRows(requests.data)}
        // 🚩 The gate is read HERE and nowhere else, and the picker opens whatever
        // it says: an agent may need to READ a request on an order it can no longer
        // be linked onto (a basket with lines, most of all). The modal is where the
        // reason is said — 189's ruling that a shut gate is not a shut chip.
        gate={linkGate(session.data.capabilities)}
        actions={{
          onLink: (documentNo) => linkRequest.mutate(documentNo),
          pending: linkRequest.isPending ? (linkRequest.variables ?? null) : null,
          error: linkRequest.isError
            ? apiErrorMessage(linkRequest.error, t('request.linkFailed'))
            : null,
        }}
        onClose={() => {
          setPickingRequest(false)
          linkRequest.reset()
        }}
      />
      {/* 🚩 Taking the link back (195) — the console's one confirmation surface
          again, with a body of its own. It asks because unlink EMPTIES THE
          BASKET: an agent who reads it as *stop referencing this request* would
          lose a basket they meant to keep. The cost is read off the state at the
          moment it is drawn rather than remembered from the copy, so a link whose
          lines were partly skipped offers to remove what actually landed — and a
          link that has gone from under the sheet (the caller removed in another
          tab) closes it rather than asking about nothing. */}
      <UnlinkConfirm
        cost={unlinking ? unlinkCost(session.data) : null}
        busy={unlink.isPending}
        error={unlink.isError ? apiErrorMessage(unlink.error, t('request.unlink.failed')) : null}
        onConfirm={() => unlinking && unlink.mutate(unlinking)}
        onCancel={cancelUnlink}
      />
      {/* 🚩 The console's ONE confirmation surface, twice: the same `ConfirmSheet`
          with two bodies. Both kinds of `pendingConfirmation` land in the same
          modal, with the same buttons and the same re-issue notice — a second
          confirmation mechanism would be the defect (167, 169). */}
      <StoreMoveConfirm
        preview={preview}
        reissue={reissue}
        busy={rebind.isPending}
        error={commitError}
        onConfirm={() => move && rebind.mutate(move)}
        onCancel={declineMove}
      />
      {/* 🚩 ONE below-availability acceptance on screen, whichever verb raised
          it: the add (169) and the quantity raise (170) reach the SAME sheet
          with the same figures and the same buttons. Two mount points would be
          the second mechanism this pattern exists to prevent. */}
      <BelowAtpConfirm
        ask={acceptance?.ask ?? null}
        verb={acceptance?.verb}
        itemName={acceptance?.item}
        reissue={acceptance?.reissue ?? null}
        busy={acceptance?.busy ?? false}
        // The panel draws an ordinary failure where the agent's eye is; what
        // belongs in the sheet is only a failure of the ACCEPTANCE they are
        // looking at — and never one this page has already answered by re-asking.
        error={acceptance?.error ?? null}
        onConfirm={() => acceptance?.confirm()}
        onCancel={() => acceptance?.cancel()}
      />
      {abandonDialog}
    </>
  )
}

/** A full-viewport waiting state. Chrome-less like everything else here, and
 *  deliberately without an exit: it resolves on its own — within one request,
 *  or within the bounded busy schedule if that request met the claim (164). */
/**
 * How much of one item the basket holds, across every line carrying it.
 *
 * 🚩 Summed rather than counted, and it is not money: the engine may open a new
 * line for an add or raise an existing one, so line COUNT misses the second case
 * and would read a raised line as an add that never landed. Law 1 is untouched —
 * this is a quantity, and quantities are the one thing the client may reason
 * about (`basket-view.ts` holds the rule that money never is).
 */
function qtyOf(state: SessionState | null | undefined, itemNumber: string): number {
  return (state?.lines ?? [])
    .filter((line) => line.itemNumber === itemNumber)
    .reduce((total, line) => total + line.qty, 0)
}

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
