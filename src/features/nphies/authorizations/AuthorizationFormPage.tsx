import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { useSession } from '@/core/session'
import { useStoreLock } from '@/core/engine-session/store-lock'
import { newRequestId } from '@/core/engine-session/request-id'
import { readSessionFault, type ShownSessionFault } from '@/core/engine-session/session-fault'
import {
  NPHIES_ACCESS_KEY,
  SELECTION_REASON_VALUE_SET,
  codeSystemKey,
  diagnosesKey,
  nphiesAccessApi,
  nphiesLookupApi,
} from '@/core/nphies/api'
import { formatStamp } from '@/core/nphies/format'
import type {
  NphiesAuthSessionState,
  NphiesSessionDiagnosis,
  NphiesSessionInsurance,
} from '@/core/models/nphies'
import { authSessionApi, authorizationsApi } from './api'
import AddItemRow from './AddItemRow'
import Attachments from './Attachments'
import DeductibleTerms from './DeductibleTerms'
import Diagnoses from './Diagnoses'
import ReplayReport from './ReplayReport'
import RequestLines from './RequestLines'
import SubmitAct from './SubmitAct'
import {
  replayPlan,
  replayReport,
  type ReplayFinding,
  type ReplayOutcome,
  type ReplayPlan,
} from './replay'
import { toSubmitAttachments, type PreparedAttachment } from './attachment-prepare'
import { diagnosesChanged, lookupRowFor, principalDiagnosis } from './diagnosis-form'
import {
  clinicalEditGate,
  clinicalEditRequestFrom,
  placeRefusals,
  readSubmitFailure,
  readSubmitResult,
  submitBlockers,
  submitIsLocked,
  type ClinicalEditGate,
  type SubmitLanding,
} from './submit-gate'
import {
  admitSessionState,
  leavingDiscardsWork,
  liveLineCount,
  openBlockers,
  projectSessionLines,
  readAddRefusal,
  refusalMessage,
  refuseAdd,
  type AddItemRefusal,
} from './auth-session'

/**
 * The authorization form (ticket 217, spec 209 §2 + stories 22–32 · 64 · 65,
 * contract v1.0 §1.2 / §2 / §7) — **and it is a session, not a form**.
 *
 * The browser drives a real `NphiesAuth` transaction on the Till Submission
 * Platform, the way the till does, because the audit trail must show *what the
 * engine landed versus what the agent changed*. A payload assembled client-side
 * and posted at the end cannot show that: it only ever carries the survivors, and
 * "added then voided" is exactly what the trail exists to record. So the page
 * opens a transaction when it mounts, each act is a verb, and leaving abandons.
 *
 * Three consequences it honours out loud:
 *
 * - 🚩 **The acting store is the pricing plant** (law 8), bound once at `Open`
 *   and immutable for the life of the transaction. It is resolved *before* the
 *   first item — the session does not open without one — and the shell's store
 *   switcher is held still for as long as the session is open
 *   (`@/core/engine-session/store-lock`).
 * - 🚩 **There are no drafts** (law 9). Leaving abandons; a crashed tab is swept
 *   server-side. So the agent is warned before navigating away, and the warning
 *   is honest rather than polite: the request really is discarded.
 * - 🚩 **One scrolling page, no modal anywhere.** Even the leave warning is an
 *   inline banner at the top of the form, because a dialog is the surface this
 *   port exists to remove.
 *
 * Every mutating verb answers the whole state (law 3), so there is no reducer and
 * no delta protocol here — only `admitSessionState`, which is `core/`'s ordering
 * rule and contract-version hard stop (ticket 210) kept genuinely in the path.
 */
export default function AuthorizationFormPage() {
  const { t } = useTranslation('authorizations')
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // 213's seam, verbatim: `?from=<eligId>&coverage=<memberId>`. A route carrying
  // two ids rather than a shared object, which is what lets an authorization be
  // raised days after the check it references.
  const fromParam = (params.get('from') ?? '').trim()
  const coverageParam = (params.get('coverage') ?? '').trim()
  /**
   * 🚩 **The reopen seam** (ticket 221, spec 209 §1) — `?copyOf=<authId>`.
   *
   * It rides the *existing* form route rather than a draft route, because there
   * is no draft: a reopen opens a **fresh session** and replays the stored
   * request through verbs that already exist (§3.9). The URL names the
   * authorization being replayed **from**, and nothing else — the eligibility and
   * the chosen coverage come out of the journal row, so a reopen cannot disagree
   * with what was actually submitted about which policy it was raised under.
   */
  const copyOf = (params.get('copyOf') ?? '').trim()
  const actingStore = useSession((s) => s.currentStoreCode)

  const access = useQuery({
    queryKey: NPHIES_ACCESS_KEY,
    queryFn: () => nphiesAccessApi.access(),
  })
  const allowed = access.data?.canOpenNphies === true

  /**
   * The **write-ahead journal row** — the whole of what a reopen is prefilled
   * from (§3.9).
   *
   * 🚩 It is read rather than the ordinary `AuthResponse/{id}` because it is the
   * only source that covers a **header-only** refusal: the service's own guards
   * throw before the lines are built, leaving a response with nothing to prefill
   * from. It also still carries the per-line cap, which `AuthLineDto` does not.
   *
   * Cached for the life of the page: it is a record of something that has already
   * happened, so it cannot change under the replay, and a refetch mid-replay would
   * be a second opinion about what was submitted.
   */
  const journal = useQuery({
    queryKey: ['nphies', 'authRequestJournal', copyOf] as const,
    queryFn: () => authorizationsApi.requestJournal(copyOf),
    enabled: allowed && copyOf !== '',
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  const plan = journal.data ? replayPlan(copyOf, journal.data) : null

  // 🚩 On a reopen the two ids are the JOURNAL's, not the URL's. A replay is
  // raised against the same eligibility and the same chosen coverage as the
  // request it replays, and a URL that also carried them could disagree with what
  // was submitted.
  const eligibilityId = copyOf !== '' ? (plan?.eligibilityId ?? '') : fromParam
  const memberId = copyOf !== '' ? (plan?.memberId ?? '') : coverageParam

  /**
   * The per-line selection reasons — `GET Nphies/CodeSystem?valueSet=SelectionReason`
   * (§3.8: "`codeSystem` carries the selection reasons").
   *
   * 🚩 **Fetched, never spelled into the client.** The chosen code reaches NPHIES
   * verbatim as the line's `extension-pharmacist-Selection-Reason`, and a value
   * set written out here is exactly the guessed shape spec 209 warns against. It
   * shares its cache entry with 215's cancellation reasons' door, keyed by value
   * set, so the two reads of one endpoint never collide.
   */
  const selectionReasons = useQuery({
    queryKey: codeSystemKey(SELECTION_REASON_VALUE_SET),
    queryFn: () => nphiesLookupApi.codeSystem(SELECTION_REASON_VALUE_SET),
    enabled: allowed,
    staleTime: 5 * 60 * 1000,
  })

  const [state, setState] = useState<NphiesAuthSessionState | null>(null)
  /** A contract major this client cannot speak (law 10). The form refuses to run
   *  rather than mis-render money at a national exchange. */
  const [hardStop, setHardStop] = useState<{ expected: string; received: string | null } | null>(
    null,
  )
  const [verbError, setVerbError] = useState<unknown>(null)
  /**
   * 🚩 **The transaction is not this tab's to write to any more** — `SESSION_CLOSED`
   * (submitted, abandoned or swept) or `NOT_YOUR_SESSION` (§6). Read through
   * `@/core/engine-session/session-fault`, which ticket 210 moved to `core/`
   * *because this contract names the same two codes with the same three reasons*;
   * this form is the second consumer it was moved for.
   *
   * It is a page-level state rather than a per-verb `catch` because the answer has
   * to be the same for every verb, including the five that arrive at 218–220: one
   * of them quietly showing a banner over a request that no longer exists is
   * exactly the defect the shared module prevents.
   */
  const [fault, setFault] = useState<ShownSessionFault | null>(null)
  const [adding, setAdding] = useState(false)
  const [busyLineId, setBusyLineId] = useState<string | null>(null)
  /** A `setInsurance` in flight. The block says it is re-pricing rather than the
   *  grid going quietly still — one rate edit re-prices every line (story 39). */
  const [repricing, setRepricing] = useState(false)
  /** A `setHeader` in flight — the diagnoses or the exception-prescription flag. */
  const [headerBusy, setHeaderBusy] = useState(false)
  /**
   * 🚩 **The attachments live here, on the form, and are sent by `submit`** —
   * they are not a verb and there is no upload endpoint (§1.2 / §3.5). They ride
   * as base64 inside the submit body, so until 220 presses that verb they are
   * held in page state, prepared and previewable, and go nowhere.
   *
   * That is also why they are not in the projection: the engine has never heard
   * of them, and a refresh of the state must not clear what the agent attached.
   */
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([])
  /**
   * 🚩 **Submit is a gated path, not a button** (ticket 220). Four pieces of
   * state, and each is a rule rather than a spinner:
   *
   * - `gate` — what the clinical-edit check found. It is asked **before** every
   *   submission (§3.7) and is one surface in two shapes.
   * - `landing` — where the submission left the agent (§7.3). 🚩 An `inFlight`
   *   landing **locks Submit forever**: the request may already be with the
   *   payer, and a second authorization for it is the worst outcome this screen
   *   can produce (law 6).
   * - `refusals` — a `Failed`'s reasons, placed on the rows that caused them.
   *   The agent stays on the form; this is what they fix from.
   * - `submitStartedAt` — so the wait is *visibly* working for its full 100 s
   *   window (story 63).
   */
  const [gate, setGate] = useState<ClinicalEditGate | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [landing, setLanding] = useState<SubmitLanding | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [refusal, setRefusal] = useState<AddItemRefusal | null>(null)
  const [refusalDetail, setRefusalDetail] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  /**
   * 🚩 **The replay, and above all its report** (ticket 221). The verbs are the
   * easy half; `findings` is the half that makes a reopen safe to have — an item
   * may since have been blocked, repriced or have lost its Nphies category, and a
   * silent restore would hand the agent a request quietly different from the one
   * they believe they are resending.
   */
  const [replaying, setReplaying] = useState(false)
  const [replayDone, setReplayDone] = useState(false)
  const [replayFindings, setReplayFindings] = useState<ReplayFinding[]>([])
  /** One replay per page life. The plan is a record of something that already
   *  happened, so re-running it could only raise the same lines twice. */
  const replayRan = useRef(false)

  // The live state, readable from callbacks that were created before it arrived —
  // the verbs need the transaction id and the current lines, and a stale closure
  // would send a duplicate check against a request from two adds ago.
  const stateRef = useRef<NphiesAuthSessionState | null>(null)
  stateRef.current = state
  /** Whether a leave has already been committed to. Read `abandonAnd`'s note. */
  const leavingRef = useRef(false)

  /**
   * The one door every state comes through.
   *
   * 🚩 `admitSessionState` is `core/`'s rule (ticket 210) and this is the only
   * place it is called, which is what makes "the client renders the latest and
   * never an older one" a property of the page rather than a promise about each
   * verb's `.then`.
   */
  const receive = useCallback((incoming: NphiesAuthSessionState, source: 'verb' | 'read') => {
    const admitted = admitSessionState(stateRef.current, incoming, source)
    if (!admitted.ok) {
      setHardStop({ expected: admitted.expected, received: admitted.received })
      return
    }
    stateRef.current = admitted.state
    setState(admitted.state)
  }, [])

  // 🚩 A reopen whose journal has not answered yet has no ids TO be missing, so
  // it states nothing about them. Without this the screen would announce "it was
  // not opened from an eligibility check" for as long as the read takes, and again
  // for good if the read fails — over the top of the banner that says what
  // actually went wrong.
  const awaitingJournal = copyOf !== '' && plan === null
  const blockers = awaitingJournal ? [] : openBlockers(eligibilityId, memberId, actingStore)
  const canOpen = allowed && !awaitingJournal && blockers.length === 0 && hardStop === null

  // ---- Open ---------------------------------------------------------------
  /**
   * 🚩 **One user action, one `requestId`** (law 3), reused verbatim across every
   * retry of that action. Opening the form IS one action, so the id is minted
   * once for the life of the page and a transport failure retried on the same one
   * — a fresh id would make an `Open` that landed server-side before the wire
   * failed look like a second request, and this door opens a second transaction
   * for a second id (§7.1: nothing is resumable, so there is no `refusedExisting`
   * to catch it).
   */
  const [openRequestId] = useState(newRequestId)

  /**
   * `Open` is a POST modelled as a **query**, exactly as the call-centre console
   * models its own (ticket 162's reasoning, which holds identically here): the
   * verb is idempotent by construction on its `requestId`, so what is left is a
   * query's semantics — one keyed result per page life, fetched once. It buys the
   * two properties an effect-plus-ref could not: concurrent mounts (StrictMode's,
   * and a re-render mid-flight) **dedupe into one request**, and the failure
   * survives to the render that has to draw it.
   */
  const open = useQuery({
    queryKey: ['nphies', 'authSession', 'open', openRequestId] as const,
    queryFn: () => authSessionApi.open(openRequestId, eligibilityId, memberId),
    enabled: canOpen,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  // The cache's answer, admitted through `core/`'s guard like every later verb —
  // idempotent, so a re-run is free.
  const openedState = open.data?.state ?? null
  useEffect(() => {
    if (openedState) receive(openedState, 'verb')
  }, [openedState, receive])

  // ---- The acting store, held still --------------------------------------
  // Law 8: the plant is bound and immutable, so the shell must not offer a switch
  // that the engine would ignore. Released when the transaction is no longer open.
  const sessionIsOpen = state?.status === 'open'
  useEffect(() => {
    if (!sessionIsOpen) return
    return useStoreLock.getState().hold()
  }, [sessionIsOpen])

  /**
   * 🚩 **The request is no longer this form's to change** — it has been lodged,
   * or the submit window elapsed with it possibly already at the payer (law 6).
   *
   * It is a separate fact from `sessionIsOpen` and that is the whole point: on an
   * `inFlight` landing the server never answered, so the local state still says
   * `open`. Every act this page offers — the verbs, the leave warning and above
   * all `Abandon` — has to read THIS, or the screen tells the agent it cannot
   * account for their request and then offers to void it.
   */
  const locked = submitIsLocked(landing)
  /** Nothing may be sent while the submit leg is open either: SIS.Api is at that
   *  moment building the upstream request from engine state, and a verb landing
   *  mid-flight would change what is being submitted. `replaying` is in here for
   *  the near-identical reason: a line typed into a request that is still being
   *  rebuilt would land in the middle of the replay and be reported as a
   *  difference from it. */
  const frozen = !sessionIsOpen || locked || submitting || checking || replaying

  // ---- Leaving ------------------------------------------------------------
  // 🚩 A locked request is NOT work to discard. Warning about it would invite
  // precisely the act that must never happen.
  const discardsWork = leavingDiscardsWork(state) && !locked

  // A closed tab is the one exit this page cannot mediate. The browser's own
  // prompt is what stands there; the server sweeps whatever escapes it (law 9).
  useEffect(() => {
    if (!discardsWork) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [discardsWork])

  /**
   * In-app navigation is intercepted **whenever a transaction is open**, not only
   * when there is something to lose.
   *
   * 🚩 Two different jobs behind one interception. With lines on the request the
   * agent is *warned* — inline, at the top of the same scrolling page, because no
   * modal opens anywhere in this flow. With an empty session there is nothing to
   * warn about, but the transaction still has to be **abandoned** rather than
   * left OPEN for the sweeper: leaving is what discards it, and a navigation that
   * slipped past would orphan the very litter law 9 exists to retire.
   *
   * 🚩 **The login bounce is exempt.** An expired portal session is `core/api`'s
   * to handle — it clears the session, toasts once and redirects, and feature code
   * never catches a 401 (`.claude/rules/api-envelope.md`). A blocker that held
   * that redirect would put a "leaving discards this request" warning in front of
   * an agent who has already been logged out, over a request no later verb could
   * save anyway.
   *
   * 🚩 **A locked request is exempt too, and for a graver reason.** After an
   * `inFlight` submission the transaction is still locally `open`, so without
   * this clause the one act the screen offers — go and check its status — would
   * be intercepted and answered with a *Discard* button, for a request that may
   * already be at the payer. Leaving simply proceeds: no warning, and above all
   * no `Abandon`.
   */
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        sessionIsOpen &&
        !locked &&
        nextLocation.pathname !== '/login' &&
        currentLocation.pathname !== nextLocation.pathname,
      [sessionIsOpen, locked],
    ),
  )

  /** Abandon, then go. `Abandon` answers no state (§7.2), so the caller owes the
   *  agent a landing — leaving them on a voided transaction is worse than the
   *  navigation they asked for. */
  const abandonAnd = useCallback(
    async (proceed: () => void) => {
      // 🚩 One leave, one abandon, one `proceed`. Abandoning clears the state,
      // which makes the auto-leave effect below newly true for a render — and a
      // second `proceed()` on a blocker that is already proceeding is a router
      // error AND a navigation that never completes. The ref closes that window
      // where the two `leaving`/`state` renders cannot.
      if (leavingRef.current) return
      leavingRef.current = true
      const live = stateRef.current
      setLeaving(true)
      try {
        if (live && live.status === 'open') {
          await authSessionApi.abandon(live.transactionId, newRequestId())
        }
      } catch {
        // 🚩 A failed abandon does not trap the agent. The transaction is swept
        // server-side after a timeout either way (law 9), so the navigation is
        // allowed through rather than held hostage to a call whose only job was
        // to be tidy about it.
      } finally {
        stateRef.current = null
        setState(null)
        setLeaving(false)
        proceed()
      }
    },
    [],
  )

  // An empty session leaves silently — abandoned, then through. The warning is
  // reserved for a request that has something on it, so that when it does appear
  // the agent has not been trained to click past it.
  useEffect(() => {
    if (blocker.state === 'blocked' && !discardsWork && !leavingRef.current) {
      void abandonAnd(() => blocker.proceed?.())
    }
  }, [blocker, discardsWork, abandonAnd])

  // ---- The verbs ----------------------------------------------------------
  /**
   * Run one verb against the live transaction, and read a session fault out of
   * whatever it throws.
   *
   * 🚩 The fault is caught HERE, once, for every verb — and it clears the state
   * rather than banner-ing over it, because a transaction that is closed or
   * somebody else's cannot be added to, re-priced or abandoned. Every other
   * failure is rethrown untouched: a guardrail refusal is the door's considered
   * answer to what was asked, and the request it refused from is still good.
   */
  const runVerb = useCallback(
    async (verb: (transactionId: string, requestId: string) => Promise<NphiesAuthSessionState>) => {
      const live = stateRef.current
      if (!live) return
      setVerbError(null)
      try {
        // One action, one id — reused verbatim only across retries of that action.
        const next = await verb(live.transactionId, newRequestId())
        receive(next, 'verb')
      } catch (error) {
        const dead = readSessionFault(error)
        if (dead) {
          setFault({
            ...dead,
            message: apiErrorMessage(
              error,
              t(dead.kind === 'closed' ? 'form.fault.closedHint' : 'form.fault.notYoursHint'),
            ),
          })
          // Nothing may keep pointing at a transaction that is gone — including
          // the leave path, which would otherwise try to abandon it on the way out.
          stateRef.current = null
          setState(null)
        }
        throw error
      }
    },
    [receive, t],
  )

  /** The two line verbs differ only in which one they send. */
  const runLineVerb = useCallback(
    async (
      lineId: string,
      verb: (transactionId: string, requestId: string) => Promise<NphiesAuthSessionState>,
    ) => {
      setBusyLineId(lineId)
      try {
        await runVerb(verb)
      } catch (error) {
        setVerbError(error)
      } finally {
        setBusyLineId(null)
      }
    },
    [runVerb],
  )

  /**
   * **The replay** (ticket 221, §3.9) — the journalled request, sent again through
   * the verbs this form already drives.
   *
   * 🚩 **A replay, not a restore.** There is no restore verb and this adds none:
   * the deductible terms go through `SetInsurance`, the diagnoses and the
   * exception-prescription flag through `SetHeader`, each line through `AddItem`,
   * and the two per-line overrides through `UpdateLineInsurance` and
   * `UpdateLineMeta` — the same six verbs an agent's own clicks send.
   *
   * 🚩 **Every refusal on the way is caught and KEPT, not swallowed.** An item
   * that has since been blocked, lost its Nphies category or stopped pricing at
   * the plant answers a business refusal (§6 kind 2), and the door's own sentence
   * is what the report shows. The replay carries on to the next line rather than
   * stopping: an agent needs the whole picture of what changed, not the first
   * thing that did.
   *
   * 🚩 It ends with a `State` read, because the lines land **pending** and the
   * engine prices them after (story 27). A report taken before that settles could
   * say nothing about the money — which is the one thing a reopen most has to be
   * able to say.
   */
  const runReplay = useCallback(
    async (plan: ReplayPlan) => {
      setReplaying(true)
      const outcomes: ReplayOutcome[] = []
      const refusalOf = (error: unknown) => apiErrorMessage(error, t('form.replay.refused'))
      try {
        await runVerb((transactionId, requestId) =>
          authSessionApi.setInsurance(transactionId, requestId, plan.insurance),
        )
        if (plan.diagnoses.length > 0 || plan.exceptionPrescription) {
          await runVerb((transactionId, requestId) =>
            authSessionApi.setHeader(transactionId, requestId, {
              diagnoses: plan.diagnoses,
              exceptionPrescription: plan.exceptionPrescription,
            }),
          )
        }
        for (const item of plan.items) {
          const outcome: ReplayOutcome = {
            itemNumber: item.itemNumber,
            addRefusal: null,
            capRefusal: null,
            metaRefusal: null,
          }
          outcomes.push(outcome)
          try {
            await runVerb((transactionId, requestId) =>
              authSessionApi.addItem(transactionId, requestId, item.itemNumber, item.quantity),
            )
          } catch (error) {
            outcome.addRefusal = refusalOf(error)
            continue
          }
          // The line the engine just landed, read off the state the verb answered
          // with — its `lineId` is the engine's and there is no way to guess one.
          const landed = (stateRef.current?.lines ?? []).find(
            (line) =>
              !line.voided &&
              line.itemNumber.trim().toUpperCase() === item.itemNumber.toUpperCase(),
          )
          if (!landed) continue
          // A cap of 0 is not re-sent at all: the engine ignores `<= 0` (§4), so
          // sending one would be asking for something that cannot take effect.
          if (item.maxCoverage > 0) {
            try {
              await runVerb((transactionId, requestId) =>
                authSessionApi.updateLineInsurance(
                  transactionId,
                  requestId,
                  landed.lineId,
                  item.maxCoverage,
                ),
              )
            } catch (error) {
              outcome.capRefusal = refusalOf(error)
            }
          }
          const meta: { daysSupply?: number; selectionReason?: string } = {}
          if (item.daysSupply > 0) meta.daysSupply = item.daysSupply
          if (item.selectionReason !== '') meta.selectionReason = item.selectionReason
          if (Object.keys(meta).length > 0) {
            try {
              await runVerb((transactionId, requestId) =>
                authSessionApi.updateLineMeta(transactionId, requestId, landed.lineId, meta),
              )
            } catch (error) {
              outcome.metaRefusal = refusalOf(error)
            }
          }
        }
        const live = stateRef.current
        if (live) receive(await authSessionApi.state(live.transactionId), 'read')
      } catch (error) {
        // A header verb that failed, or a transaction that died under the replay.
        // The banner says so; the report below still lists what was reached, which
        // is more than a blank form would.
        setVerbError(error)
      } finally {
        setReplayFindings(replayReport(plan, stateRef.current?.lines ?? [], outcomes))
        setReplaying(false)
        setReplayDone(true)
      }
    },
    [receive, runVerb, t],
  )

  // The replay begins the moment the fresh transaction exists, and exactly once.
  useEffect(() => {
    if (!plan || !state || replayRan.current) return
    replayRan.current = true
    void runReplay(plan)
  }, [plan, state, runReplay])

  const lines = projectSessionLines(state)
  const diagnoses = state?.header.diagnoses ?? []
  const principal = principalDiagnosis(diagnoses)

  /**
   * 🚩 **Whether the principal diagnosis is a neoplasm is the service's answer.**
   * `isNeedMorph` is a column on `NDiagnosis`, so the flag is fetched for the
   * principal's own code rather than derived from an ICD range spelled into the
   * browser — a range here would disagree with the table the exchange validates
   * against, and it would disagree silently.
   *
   * It is read on the page rather than inside the diagnoses block because the
   * submit gate asks the same question, and two components asking it separately
   * is how a banner and a field come to disagree. The key is the shared
   * `diagnosesKey`, so this and the picker's own search are one cache.
   */
  const principalLookup = useQuery({
    queryKey: diagnosesKey(principal?.code ?? ''),
    queryFn: () => nphiesLookupApi.diagnoses(principal?.code ?? ''),
    enabled: allowed && (principal?.code ?? '') !== '',
    staleTime: 5 * 60 * 1000,
  })
  const needsMorph = principal
    ? lookupRowFor(principalLookup.data, principal.code)?.isNeedMorph
    : false

  /**
   * 🚩 **Submit is a form state, not a submit-time throw**, and every reason it
   * is unavailable comes from **one module** (`./submit-gate`) rather than being
   * assembled here — no items, no attachment, no principal diagnosis, morphology
   * required and unset, coverage unpicked, provider unpicked, plus whatever the
   * server's own `submitBlockers` says. Each names itself, so the agent reads
   * what is missing instead of meeting it one refusal at a time.
   */
  const submitHolds = submitBlockers({ state, attachments, needsMorph })

  /** 🚩 A `Failed`'s reasons, placed. Nothing is dropped: a reason naming no line
   *  — or one this request does not hold — lands on the header, which is the
   *  header-only case where the service's guards threw before the lines existed. */
  const refusals = placeRefusals(
    landing?.kind === 'refused' ? landing.reasons : [],
    state?.lines ?? [],
  )

  async function add(itemNumber: string, qty: number) {
    // 🚩 The refusal at the moment of adding (§2.3). It is a forward statement of
    // the door's own rule, not a second opinion: the door still refuses, and the
    // catch below reads its answer into the identical shape.
    const refused = refuseAdd(stateRef.current?.lines ?? [], itemNumber, qty)
    if (refused) {
      setRefusal(refused)
      setRefusalDetail(null)
      return
    }
    setRefusal(null)
    setRefusalDetail(null)
    setAdding(true)
    try {
      await runVerb((transactionId, requestId) =>
        authSessionApi.addItem(transactionId, requestId, itemNumber, qty),
      )
    } catch (error) {
      const duplicate = readAddRefusal(error, stateRef.current?.lines ?? [], itemNumber)
      if (duplicate) {
        setRefusal(duplicate)
        setRefusalDetail(refusalMessage(error))
      } else {
        setVerbError(error)
      }
    } finally {
      setAdding(false)
    }
  }

  const changeQty = (lineId: string, quantity: number) =>
    runLineVerb(lineId, (transactionId, requestId) =>
      authSessionApi.changeQty(transactionId, requestId, lineId, quantity),
    )

  const voidLine = (lineId: string) =>
    runLineVerb(lineId, (transactionId, requestId) =>
      authSessionApi.voidLine(transactionId, requestId, lineId),
    )

  /**
   * The line's payer-share cap — `updateLineInsurance`.
   *
   * 🚩 It can **re-bucket sibling lines**, because per-group caps share a pool,
   * so the answer is the whole state like every other verb and the grid redraws
   * from it. Nothing patches the edited row.
   */
  const setMaxCoverage = (lineId: string, maxPayerShare: number) =>
    runLineVerb(lineId, (transactionId, requestId) =>
      authSessionApi.updateLineInsurance(transactionId, requestId, lineId, maxPayerShare),
    )

  /** Days supply — already 1–100 by the time it reaches here (`line-rules`). */
  const setDaysSupply = (lineId: string, daysSupply: number) =>
    runLineVerb(lineId, (transactionId, requestId) =>
      authSessionApi.updateLineMeta(transactionId, requestId, lineId, { daysSupply }),
    )

  /** The selection reason — a code, sent alone so a days-supply value is not
   *  restated on a verb that is not about it. */
  const setSelectionReason = (lineId: string, selectionReason: string) =>
    runLineVerb(lineId, (transactionId, requestId) =>
      authSessionApi.updateLineMeta(transactionId, requestId, lineId, { selectionReason }),
    )

  /**
   * The header deductible block — `setInsurance`, all three groups together.
   *
   * 🚩 **One edit re-prices the whole request through the engine**, which is the
   * point: the line amounts stay derived rather than half hand-set (story 39).
   * The browser recomputes nothing.
   */
  async function setInsurance(next: NphiesSessionInsurance) {
    setRepricing(true)
    try {
      await runVerb((transactionId, requestId) =>
        authSessionApi.setInsurance(transactionId, requestId, next),
      )
    } catch (error) {
      setVerbError(error)
    } finally {
      setRepricing(false)
    }
  }

  /**
   * The header's supporting material — `setHeader` (ticket 219).
   *
   * 🚩 **Only what changed is sent.** §1.2's body is five optional fields, unlike
   * `setInsurance`'s three groups that must travel together, so the diagnoses row
   * never restates a service date it has no control over.
   */
  async function setHeader(header: {
    diagnoses?: NphiesSessionDiagnosis[]
    exceptionPrescription?: boolean
  }) {
    setHeaderBusy(true)
    // 🚩 A gate raised against the OLD diagnoses is no longer an answer about
    // this request — the clinical-edit check reads the diagnoses and nothing
    // else, so changing them retires its verdict. Leaving it up would let
    // *Submit anyway* confirm a check that was never made.
    setGate(null)
    try {
      await runVerb((transactionId, requestId) =>
        authSessionApi.setHeader(transactionId, requestId, header),
      )
    } catch (error) {
      setVerbError(error)
    } finally {
      setHeaderBusy(false)
    }
  }

  /**
   * **The clinical-edit check, then the submission** (§3.7 → §3.5).
   *
   * 🚩 The check runs **before** the request goes, every time, because it is a
   * *submit*-time gate and not a dispense-time one. A clear answer falls straight
   * through to the submission — the ordinary case costs the agent nothing. A
   * warning or a fatal raises the gate and stops here; the agent either goes back
   * to the form or, on a warning only, confirms.
   */
  async function beginSubmit() {
    const live = stateRef.current
    if (!live || locked) return
    setLanding(null)
    setVerbError(null)
    setChecking(true)
    let decided: ClinicalEditGate | null = null
    try {
      const result = await authorizationsApi.clinicalEditValidate(clinicalEditRequestFrom(live))
      decided = clinicalEditGate(result.findings ?? [])
      setGate(decided)
    } catch (error) {
      // ⚠️ A check that could not run is NOT a licence to submit unchecked, and
      // it is not an in-flight submission either — nothing has been sent. It is
      // an ordinary failure the agent may retry.
      setVerbError(error)
    } finally {
      setChecking(false)
    }
    // Outside the check's own `finally`, so the two waits never overlap: an agent
    // watching "checking the diagnoses" for ninety seconds of a submission is
    // being told the wrong thing about what is happening.
    if (decided?.shape === 'clear') await sendSubmit()
  }

  /**
   * The submission itself — `Nphies/Session/Submit`, synchronous at 100 s.
   *
   * 🚩 **Its three outcomes, and none of them is "failed"** (§7.3). Lodged lands
   * on the detail; refused keeps the agent HERE with the reasons on the rows that
   * caused them; in-flight offers a status check and nothing else. A transport
   * failure on this leg is read as in-flight too — `readSubmitFailure` owns that
   * ruling, and it is why there is no retry anywhere near this function.
   */
  async function sendSubmit() {
    const live = stateRef.current
    if (!live || locked) return
    setGate(null)
    setSubmitting(true)
    setElapsedSeconds(0)
    const started = Date.now()
    // The wait says how long it has been waiting. A still screen for ninety
    // seconds is what makes an agent give up on a submission that is still going.
    const tick = window.setInterval(
      () => setElapsedSeconds(Math.round((Date.now() - started) / 1000)),
      1000,
    )
    try {
      const result = await authSessionApi.submit(
        live.transactionId,
        newRequestId(),
        toSubmitAttachments(attachments),
      )
      const next = readSubmitResult(result)
      setLanding(next)
      // A lodged submission answers the whole closed state like every other verb
      // (law 3), so the form follows it into `submitted` rather than being told
      // separately that it is over.
      if (result.outcome === 'submitted') {
        receive(result.state, 'verb')
        // 🚩 **The agent LANDS on the authorization** (§7.3, story 22's tempo):
        // the request is no longer theirs to edit and what they came for is what
        // the payer now says about it. Safe by construction — the transaction is
        // `submitted`, so the leave interception is inert and nothing is
        // abandoned on the way out.
        void navigate(`/nphies/authorizations/${encodeURIComponent(result.authId)}`)
      }
    } catch (error) {
      const dead = readSessionFault(error)
      if (dead) {
        setFault({
          ...dead,
          message: apiErrorMessage(
            error,
            t(dead.kind === 'closed' ? 'form.fault.closedHint' : 'form.fault.notYoursHint'),
          ),
        })
        stateRef.current = null
        setState(null)
        return
      }
      setLanding(readSubmitFailure(error))
    } finally {
      window.clearInterval(tick)
      setSubmitting(false)
    }
  }

  /** `State` is refresh, recovery and reload only (law 3) — never a way to
   *  "sync" after a verb, which has already answered with the whole state. */
  async function refresh() {
    const live = stateRef.current
    if (!live) return
    setRefreshing(true)
    setVerbError(null)
    try {
      receive(await authSessionApi.state(live.transactionId), 'read')
    } catch (error) {
      setVerbError(error)
    } finally {
      setRefreshing(false)
    }
  }

  // ---- Gates --------------------------------------------------------------
  if (access.isPending) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (!allowed) {
    const unreachable = access.isError
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">
          {unreachable ? t('access.unreachableTitle') : t('access.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable
            ? apiErrorMessage(access.error, t('access.unreachableHint'))
            : t('access.deniedHint')}
        </p>
      </div>
    )
  }

  const reference = state?.reference
  // 🚩 `submitting` and `checking` are in here: while the submit leg is open
  // SIS.Api is building the upstream request from engine state, and a verb that
  // landed mid-flight would change what is being submitted.
  const busy =
    adding ||
    busyLineId !== null ||
    leaving ||
    refreshing ||
    repricing ||
    headerBusy ||
    submitting ||
    checking ||
    replaying

  return (
    <section className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/nphies/authorizations"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {/* Logical: rtl:rotate-180 mirrors the arrow with the text direction. */}
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('form.backToList')}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{t('form.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('form.subtitle')}</p>
      </header>

      {/* 🚩 The leave warning, INLINE. Leaving genuinely discards the request —
          there is no draft to come back to — so the sentence says so rather than
          asking about unsaved changes. */}
      {blocker.state === 'blocked' && discardsWork && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{t('form.leave.warning')}</span>
          <Button
            variant="danger"
            disabled={leaving}
            onClick={() => void abandonAnd(() => blocker.proceed?.())}
          >
            {leaving ? t('form.leave.discarding') : t('form.leave.discard')}
          </Button>
          <Button variant="secondary" disabled={leaving} onClick={() => blocker.reset?.()}>
            {t('form.leave.stay')}
          </Button>
        </div>
      )}

      {/* 🚩 The transaction is gone or was never this tab's. The agent's way back
          is the list, not a retry: there is nothing here to retry against, and
          leaving the add-row live over a dead request is how a second one gets
          raised. The server's own sentence is passed through as data (§6 kind 2). */}
      {fault && (
        <ErrorBanner
          title={t(fault.kind === 'closed' ? 'form.fault.closedTitle' : 'form.fault.notYoursTitle')}
          message={fault.message}
          className="p-3"
        >
          <Link
            to="/nphies/authorizations"
            className="mt-2 inline-flex h-7 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-accent"
          >
            {t('form.fault.backToList')}
          </Link>
        </ErrorBanner>
      )}

      {hardStop && (
        <ErrorBanner
          title={t('form.hardStop.title')}
          message={t('form.hardStop.detail', {
            expected: hardStop.expected,
            received: hardStop.received ?? t('form.hardStop.noVersion'),
          })}
          className="p-3"
        />
      )}

      {blockers.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {t('form.blockers.intro')}{' '}
            {blockers.map((b) => t(`form.blockers.${b}`)).join(t('form.blockers.separator'))}
          </span>
        </div>
      )}

      {open.isError && (
        <ErrorBanner
          title={t('form.errors.openTitle')}
          message={apiErrorMessage(open.error, t('form.errors.openFailed'))}
          className="p-3"
        >
          {/* A retry of the SAME action, on the same id: an `Open` that landed
              before the wire failed is absorbed rather than doubled (law 3). */}
          <Button variant="secondary" className="mt-2" onClick={() => void open.refetch()}>
            {t('form.errors.openRetry')}
          </Button>
        </ErrorBanner>
      )}

      {verbError !== null && (
        <ErrorBanner
          title={t('form.errors.verbTitle')}
          message={apiErrorMessage(verbError, t('form.errors.verbFailed'))}
          className="p-3"
        />
      )}

      {open.isFetching && !state && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('form.opening')}
        </div>
      )}

      {/* 🚩 The reopen's report, ABOVE the request it describes and outside the
          block that needs a state — a journal that could not be read has to say
          so on a page that never opened a transaction. It is the whole reason a
          reopen is safe: what is on screen below may not be the request that was
          refused, and every place it differs is named. */}
      {copyOf !== '' && (
        <ReplayReport
          sourceAuthId={copyOf}
          // The journal read and the verbs it drives are one wait as far as the
          // agent is concerned: the request is being rebuilt either way.
          replaying={replaying || journal.isFetching}
          done={replayDone}
          findings={replayFindings}
          error={journal.isError ? apiErrorMessage(journal.error, t('form.replay.unreadable')) : null}
        />
      )}

      {state && reference && (
        <>
          {/* 🚩 Read-only VALUES, not disabled controls (story 24). A greyed-out
              combo holding nothing is the trap this port exists to remove — and
              the provider is inherited rather than re-picked, so the check and the
              authorization can never disagree about who is asking (story 25). */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:grid-cols-3 lg:grid-cols-4">
            <Fact label={t('form.identity.patientName')} value={reference.patientName} />
            <Fact label={t('form.identity.patientId')} value={reference.patientId} />
            <Fact label={t('form.identity.payer')} value={reference.payerCode} />
            <Fact label={t('form.identity.provider')} value={reference.providerCode} />
            <Fact label={t('form.identity.memberId')} value={reference.memberId} />
            <Fact label={t('form.identity.policyNumber')} value={reference.policyNumber} />
            <Fact label={t('form.identity.policyHolder')} value={reference.policyHolder} />
            <Fact
              label={t('form.identity.serviceDate')}
              value={formatStamp(state.header.serviceDate)}
            />
          </dl>

          {/* 🚩 The plant, stated as a fact of the transaction. It is invisible in
              the NPHIES payload and decisive in every amount in it, so an agent
              who cannot see which store priced this request cannot check it. */}
          <p className="text-xs text-muted-foreground">
            {t('form.plant', { plant: state.plant })}
          </p>

          {/* 🚩 §2's `replayed`: the door recognised a `requestId` it had already
              applied and did not apply it twice. It is reachable from this screen
              — the open failure's *Try again* re-sends the same id (law 3) — so a
              request that arrives already built is explained rather than left to
              look like someone else's. */}
          {state.replayed && (
            <p className="text-xs text-muted-foreground" role="status">
              {t('form.replayed')}
            </p>
          )}

          {/* 🚩 Two of the agent's five inputs, above the lines they price:
              the group rates with their caps, and paid-outside. Inherited from
              the coverage and then correctable — and one edit re-prices every
              line through the engine, so the amounts below stay derived. */}
          <DeductibleTerms
            insurance={state.insurance}
            onCommit={(next) => void setInsurance(next)}
            busy={repricing}
            disabled={frozen || adding || busyLineId !== null || leaving}
          />

          {/* 🚩 The diagnoses that justify the request, with principal as a radio
              and morphology appearing with its cause. */}
          <Diagnoses
            diagnoses={diagnoses}
            exceptionPrescription={state.header.exceptionPrescription}
            needsMorph={needsMorph}
            onCommit={(next) => {
              // An idle re-pick sends nothing — every verb re-answers the whole
              // state, and a write that changed nothing is a write in the trail.
              if (!diagnosesChanged(diagnoses, next)) return
              void setHeader({ diagnoses: next })
            }}
            onExceptionPrescription={(next) => void setHeader({ exceptionPrescription: next })}
            busy={headerBusy}
            disabled={frozen || leaving}
          />

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                {t('form.lines.title', { count: liveLineCount(lines) })}
              </h2>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={busy}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')}
                  aria-hidden
                />
                {t('form.refresh')}
              </button>
            </div>

            <AddItemRow
              onAdd={(itemNumber, qty) => void add(itemNumber, qty)}
              busy={adding}
              refusal={refusal}
              refusalDetail={refusalDetail}
              disabled={frozen || busyLineId !== null || leaving}
            />

            <RequestLines
              lines={lines}
              onChangeQty={(lineId, quantity) => void changeQty(lineId, quantity)}
              onVoid={(lineId) => void voidLine(lineId)}
              onMaxCoverage={(lineId, cap) => void setMaxCoverage(lineId, cap)}
              onDaysSupply={(lineId, days) => void setDaysSupply(lineId, days)}
              onSelectionReason={(lineId, code) => void setSelectionReason(lineId, code)}
              selectionReasons={selectionReasons.data ?? []}
              refusalsByLine={refusals.byLine}
              busyLineId={busyLineId}
              disabled={frozen || adding || leaving || repricing}
            />

            {/* 🚩 Which cells are yours, said once, where the grid is. Everything
                else in a row is the engine's and is drawn as a value — the agent
                corrects the insurance terms, never the merchandise or its price. */}
            <p className="text-xs text-muted-foreground">{t('form.lines.moneyIsTheEngines')}</p>

            {selectionReasons.isError && (
              <p className="text-xs text-muted-foreground">
                {apiErrorMessage(selectionReasons.error, t('errors.selectionReasonsFailed'))}
              </p>
            )}
          </section>

          {/* 🚩 The files that evidence the request. They are prepared in the
              browser — downscaled, base64'd — and held here until `submit`
              carries them; there is no upload endpoint and no verb. */}
          <Attachments
            attachments={attachments}
            onAdd={(attachment) => setAttachments((held) => [...held, attachment])}
            onRemove={(id) => setAttachments((held) => held.filter((row) => row.id !== id))}
            disabled={frozen || leaving}
          />

          {/* 🚩 **Submit as a gated path** — every reason it is unavailable, the
              clinical-edit check in its two shapes, the wait, and the three
              outcomes. A refusal keeps the agent right here; a timeout says in
              flight and offers a status check, never a second submission. */}
          <SubmitAct
            blockers={submitHolds}
            gate={gate}
            landing={landing}
            submitting={submitting}
            elapsedSeconds={elapsedSeconds}
            checking={checking}
            headerReasons={refusals.header}
            refusalCount={refusals.total}
            patientId={reference.patientId}
            disabled={frozen || busy}
            onSubmit={() => void beginSubmit()}
            onConfirm={() => void sendSubmit()}
            onBackToForm={() => setGate(null)}
          />

          <div>
            {/* Leaving deliberately, through the same interception every other
                exit goes through — one rule, one surface. With lines on the
                request it raises the warning above; with none it abandons and
                goes. */}
            <Button
              variant="secondary"
              disabled={leaving}
              onClick={() => void navigate('/nphies/authorizations')}
            >
              {leaving ? t('form.leave.discarding') : t('form.leave.action')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

/** One read-only fact. A value, not a disabled control (story 24). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}
