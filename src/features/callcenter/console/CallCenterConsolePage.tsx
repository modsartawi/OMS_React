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
 */
import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { SessionState } from '@/core/models/callcenter'
import { CALLCENTER_ACCESS_KEY, callCenterApi, newRequestId, openKey, sessionKey } from './api'
import { applyState } from './session-state'
import {
  abandonTargetOfExisting,
  abandonTargetOfSession,
  readOpenResult,
  type PendingAbandon,
} from './open-outcome'
import AbandonConfirm from './AbandonConfirm'
import ConsoleCard from './ConsoleCard'
import ConsoleShell from './ConsoleShell'
import ExistingOrderScreen from './ExistingOrderScreen'

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
    queryFn: () => callCenterApi.open(requestId),
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
      const fresh = await callCenterApi.getState(transactionId!)
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
      setRequestId(newRequestId())
    },
    [queryClient],
  )

  const abandon = useMutation({
    mutationFn: (action: { transactionId: string; requestId: string }) =>
      callCenterApi.abandon(action.transactionId, action.requestId),
    onSuccess: (_result, action) => startFresh(action.transactionId),
    // A failed abandon is shown in the dialog and retried on the SAME id; the
    // order is untouched, so there is nothing to undo. `SESSION_CLOSED` — the
    // order was already gone — is deliberately NOT special-cased here: that
    // code, and the stale-tab return-to-start it triggers everywhere, is
    // [164](.issues/164-busy-collision-and-staleness.md)'s whole subject, and
    // half of it here would be the half that later has to be unpicked.
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

  return (
    <>
      {/* Abandoning from inside a live order is the SAME act as abandoning the
          one on the already-open screen — same confirmation, same wording, same
          landing on a fresh order. It is only reachable while the order is
          actually open; there is nothing to void once it has been submitted. */}
      <ConsoleShell
        state={session.data}
        onAbandon={
          session.data.status === 'open'
            ? () =>
                setAbandoning({
                  target: abandonTargetOfSession(session.data),
                  requestId: newRequestId(),
                })
            : undefined
        }
      />
      {abandonDialog}
    </>
  )
}

/** A full-viewport waiting state. Chrome-less like everything else here, and
 *  deliberately without an exit: it resolves on its own within one request. */
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
}: {
  marker: string
  title: string
  body: string
  retry?: () => void
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
            {t('actions.retry')}
          </button>
        )}
      </div>
    </ConsoleCard>
  )
}
