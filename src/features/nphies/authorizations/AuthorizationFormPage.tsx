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
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'
import { formatStamp } from '@/core/nphies/format'
import type { NphiesAuthSessionState } from '@/core/models/nphies'
import { authSessionApi } from './api'
import AddItemRow from './AddItemRow'
import RequestLines from './RequestLines'
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
  const eligibilityId = (params.get('from') ?? '').trim()
  const memberId = (params.get('coverage') ?? '').trim()
  const actingStore = useSession((s) => s.currentStoreCode)

  const access = useQuery({
    queryKey: NPHIES_ACCESS_KEY,
    queryFn: () => nphiesAccessApi.access(),
  })
  const allowed = access.data?.canOpenNphies === true

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
  const [refusal, setRefusal] = useState<AddItemRefusal | null>(null)
  const [refusalDetail, setRefusalDetail] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  const blockers = openBlockers(eligibilityId, memberId, actingStore)
  const canOpen = allowed && blockers.length === 0 && hardStop === null

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

  // ---- Leaving ------------------------------------------------------------
  const discardsWork = leavingDiscardsWork(state)

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
   */
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        sessionIsOpen &&
        nextLocation.pathname !== '/login' &&
        currentLocation.pathname !== nextLocation.pathname,
      [sessionIsOpen],
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

  const lines = projectSessionLines(state)

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
  const busy = adding || busyLineId !== null || leaving || refreshing

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
              disabled={!sessionIsOpen || busyLineId !== null || leaving}
            />

            <RequestLines
              lines={lines}
              onChangeQty={(lineId, quantity) => void changeQty(lineId, quantity)}
              onVoid={(lineId) => void voidLine(lineId)}
              busyLineId={busyLineId}
              disabled={!sessionIsOpen || adding || leaving}
            />

            {/* The money columns render and are not editable until 218. Read-only
                is the correct intermediate state, not a gap — and saying so beats
                an agent wondering which cells they are allowed to touch. */}
            <p className="text-xs text-muted-foreground">{t('form.lines.moneyIsTheEngines')}</p>
          </section>

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
