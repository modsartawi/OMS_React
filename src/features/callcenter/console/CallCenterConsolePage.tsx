/**
 * The call-center console — slice 0 (ticket 162): the spine, thin.
 *
 * A granted agent reaches `/callcenter`, the console opens a real server-side
 * order, and the three-column shell renders **from the returned `SessionState`**.
 * Nothing is hand-made and nothing is client-computed.
 *
 * Two properties this file exists to hold:
 *
 * 1. **The probe fails closed.** One boolean, one shared cache key with the nav
 *    leaf (134 §6, ticket 125's pattern). Unresolved or errored ⇒ the refusal,
 *    never the console — and the refusal fires **no** `Open`, which is why the
 *    session lives in a child component that a denied agent never mounts.
 * 2. 🚩 **The refusal carries its own way home.** The route is chrome-less by
 *    ruling (map 126 note 13): there is no nav to leave by, so every non-console
 *    state on this screen offers *Back to the portal* and *Sign out* (134 §8). A
 *    denial the agent can only escape by closing the tab is the failure this
 *    slice exists to prevent.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { signOut } from '@/core/auth/sign-out'
import type { SessionState } from '@/core/models/callcenter'
import { CALLCENTER_ACCESS_KEY, callCenterApi, newRequestId, sessionKey } from './api'
import { applyState } from './session-state'
import ConsoleShell from './ConsoleShell'

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
        tone="denied"
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
  const [transactionId, setTransactionId] = useState<string | null>(null)

  // 🚩 **One user action, one `requestId`** (law 3 / §4), reused verbatim across
  // every retry of that action. Opening the console IS one action — the failure
  // card's *Try again* is a retry of it, not a second one. A fresh id there would
  // make an `Open` that landed server-side before the transport failed look like
  // a genuinely new action to the server's ledger: the double-open the ring
  // buffer exists to prevent, on the verb that mints a real OMS order.
  const [requestId] = useState(newRequestId)

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
    queryKey: ['callcenter', 'open', requestId] as const,
    queryFn: () => callCenterApi.open(requestId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  const existing = open.data?.outcome === 'refusedExisting' ? open.data.existing : null
  const openedState = open.data?.outcome === 'opened' ? open.data.state : null

  // The cache is the store of record, and the write is GUARDED — the same entry
  // point every later verb uses. There is no reducer and no delta protocol;
  // `applyState` is the whole write path. Idempotent, so a re-run is free.
  useEffect(() => {
    if (!openedState) return
    queryClient.setQueryData<SessionState>(sessionKey(openedState.transactionId), (current) =>
      applyState(current, openedState),
    )
    setTransactionId(openedState.transactionId)
  }, [openedState, queryClient])

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

  if (existing) {
    // Slice 0 stops honestly here rather than inventing 163's screen: the agent
    // is told, and is not stranded. Resume / abandon-and-start-fresh is 163's.
    return (
      <ConsoleNotice
        tone="attention"
        marker="existing"
        title={t('existing.title')}
        body={t('existing.hint', { count: existing.lineCount })}
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
        tone="denied"
        marker={notGranted ? 'denied' : 'openFailed'}
        title={t(notGranted ? 'access.deniedTitle' : 'open.failedTitle')}
        body={notGranted ? t('access.deniedHint') : apiErrorMessage(open.error, t('open.failedHint'))}
        retry={notGranted ? undefined : () => void open.refetch()}
      />
    )
  }

  if (!session.data) return <ConsoleStatus message={t('open.opening')} spinner />

  return <ConsoleShell state={session.data} />
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
 * Every dead end on a chrome-less screen, with the two ways out it owes the
 * agent (134 §8). *Back to the portal* is an in-app link rather than a silent
 * redirect — 125's explain-don't-redirect ruling: an agent teleported away never
 * learns whether they were refused or the check merely failed.
 */
function ConsoleNotice({
  tone,
  marker,
  title,
  body,
  retry,
}: {
  tone: 'denied' | 'attention'
  marker: string
  title: string
  body: string
  retry?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const edge = tone === 'attention' ? 'border-attention-border' : 'border-border'
  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <div
        className={`w-full max-w-md rounded-lg border ${edge} bg-card p-6 text-center shadow-sm`}
        role="alert"
        data-cc-notice={marker}
      >
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-center gap-2">
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {t('actions.retry')}
            </button>
          )}
          <Link
            to="/"
            data-cc-home
            className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t('actions.backToPortal')}
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            data-cc-signout
            className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t('actions.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
