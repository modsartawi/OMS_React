import { useCallback, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { toast } from 'sonner'
import { Loader2, PackageSearch, RefreshCw, ShieldAlert } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import {
  NPHIES_ACCESS_KEY,
  PROVIDERS_KEY,
  nphiesAccessApi,
  nphiesLookupApi,
} from '@/core/nphies/api'
import { formatClock } from '@/core/nphies/format'
import { pageCountFor } from '@/core/nphies/list-window'
import ListPager from '@/core/nphies/ListPager'
import type { AuthListRow } from '@/core/models/nphies'
import { authorizationsApi } from './api'
import { buildAuthListParams, defaultAuthCriteria, type AuthListCriteria } from './list-params'
import { AUTH_LIST_DEFAULT_COL_DEF, buildAuthListColumns } from './list-columns'
import ListFilters from './ListFilters'
import CancelDialog from './CancelDialog'
import type { AuthAct } from './row-acts'

/**
 * The authorizations list (ticket 214, spec 209 §6 stories 66–70 and 76) — the
 * screen an agent lives on between raising a request and its verdict.
 *
 * **The same two axes as the eligibility list**, from the same
 * `@/core/nphies/status` module with only its Verdict value set differing, and
 * the same visible seven-day window as a removable chip. What is new here is the
 * two **row markers** — a payer query and a dispensed row — which are neither
 * axis: the payer raises a query asynchronously, so it can land on an
 * authorization that already has both a Request state and a Verdict.
 *
 * 🚩 **No browser polling.** The Nphies service runs `PollRequestWorker`, a
 * background service looping every 15 seconds over every unblocked provider, so a
 * pending authorization becomes complete on its own — the normal path to a verdict
 * is *waiting* (§3.6). There is a manual **Refresh** with the load time stated
 * beside it and no `refetchInterval` anywhere; the load time is what lets an agent
 * judge staleness for themselves instead of a spinner deciding for them.
 *
 * Every rule about what reaches the server is in the pure `list-params` module;
 * this file is the controlled shell over it, which is what makes those rules
 * testable with no React Testing Library in the repo (spec 209's tier-1 ruling).
 */
export default function AuthorizationListPage() {
  const { t } = useTranslation('authorizations')
  const navigate = useNavigate()

  // The area's ONE probe, on the key the nav leaves and every Nphies screen share
  // → one network call for the whole area. Fails closed: pending and errored both
  // draw something other than the list.
  const access = useQuery({
    queryKey: NPHIES_ACCESS_KEY,
    queryFn: () => nphiesAccessApi.access(),
  })
  const allowed = access.data?.canOpenNphies === true

  const providers = useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => nphiesLookupApi.providers(),
    enabled: allowed,
  })

  // Today is read ONCE, when the screen mounts, and the default window is derived
  // from it — so the chip an agent removed cannot silently reappear when a
  // midnight rollover re-renders the page.
  const [today] = useState(() => new Date())
  const [criteria, setCriteria] = useState<AuthListCriteria>(() => defaultAuthCriteria(today))
  // The panel's draft. Typing does not refetch; Search promotes it. The chip is
  // the exception — it acts on `criteria` directly, because it states the window
  // that is actually in force.
  const [draft, setDraft] = useState<AuthListCriteria>(criteria)

  const params = useMemo(() => buildAuthListParams(criteria), [criteria])

  const list = useQuery({
    queryKey: ['nphies', 'authorizations', 'list', params],
    // 🚩 The criteria travel WITH the answer. With `keepPreviousData`, `criteria`
    // advances the instant the agent clicks while `list.data` is still the
    // previous query's — so a chip read from `criteria` would say "no date
    // window" over the rows the window was still hiding. Pairing them here means
    // everything the agent reads describes the same read.
    queryFn: async () => ({ criteria, page: await authorizationsApi.list(params) }),
    enabled: allowed,
    placeholderData: keepPreviousData,
    // 🚩 No `refetchInterval` (§3.6). See the note at the top of the file.
  })

  const onChange = useCallback(
    (patch: Partial<AuthListCriteria>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  )
  // Any new filter starts at page 1 — page is a field of the criteria, so this is
  // the whole of that rule.
  const onSearch = useCallback(() => setCriteria({ ...draft, page: 1 }), [draft])
  const onReset = useCallback(() => {
    const fresh = defaultAuthCriteria(new Date())
    setDraft(fresh)
    setCriteria(fresh)
  }, [])
  /** The chip's ✕. Drops the window from the query **and** from the draft, so the
   *  date inputs agree with what was just removed. */
  const onRemoveWindow = useCallback(() => {
    setDraft((d) => ({ ...d, window: null }))
    setCriteria((c) => ({ ...c, window: null, page: 1 }))
  }, [])
  const goToPage = useCallback((page: number) => setCriteria((c) => ({ ...c, page })), [])

  // ---- the row's acts (ticket 215) ----------------------------------------
  //
  // Which acts a row offers is `row-acts`'; what happens when one fires is here.
  // The server stays authoritative throughout: a refusal that arrives anyway is a
  // BUSINESS OUTCOME with the server's own message (§6 kind 2), never a crash and
  // never a generic "unexpected" — `apiErrorMessage` passes the sentence through
  // as data, because a guardrail refusal is designed, not exceptional.
  const queryClient = useQueryClient()
  /** The act in flight, and the row it is on. One at a time: these acts change
   *  what the exchange holds, and a second click while the first is unanswered is
   *  a second ask. */
  const [acting, setActing] = useState<{ id: string; act: AuthAct } | null>(null)
  const [cancelRow, setCancelRow] = useState<AuthListRow | null>(null)

  /** Every act rewrites the authorization server-side, so the rows are re-read
   *  rather than patched in place — the answer is the server's, not a guess about
   *  what the act did. */
  const rereadRows = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['nphies', 'authorizations', 'list'] }),
    [queryClient],
  )
  const actFailed = useCallback(
    (err: unknown) => {
      const title = t('acts.results.refused')
      toast.error(title, { description: apiErrorMessage(err, title) })
    },
    [t],
  )

  const statusCheck = useMutation({
    mutationFn: (row: AuthListRow) => authorizationsApi.statusCheck(row.id),
    onSuccess: (result) => {
      // 🚩 `success: false` is NOT a failure here. The upstream sets it only when
      // the exchange's task came back `Completed`, so "still working on it" is the
      // ordinary answer of the very case this act exists for — a row that has
      // waited too long. It renders as data; reading it as an error would report
      // the normal path as a fault.
      const detail = result.status || t('acts.results.statusUnknown')
      if (result.success) toast.success(t('acts.results.statusChecked'), { description: detail })
      else toast.info(t('acts.results.statusChecked'), { description: detail })
    },
    onError: actFailed,
    onSettled: () => {
      setActing(null)
      rereadRows()
    },
  })

  const retry = useMutation({
    mutationFn: (row: AuthListRow) => authorizationsApi.retry(row.id),
    onSuccess: (result) => {
      // The retry's real product is not in this body — `ProcessPendingAuth` has by
      // then rewritten the authorization, which is what the re-read below shows.
      if (result.success) toast.success(t('acts.results.retried'))
      else
        toast.warning(t('acts.results.retriedNoAnswer'), {
          description: result.errorMessage || undefined,
        })
    },
    onError: actFailed,
    onSettled: () => {
      setActing(null)
      rereadRows()
    },
  })

  const cancel = useMutation({
    mutationFn: ({ row, reasonCode }: { row: AuthListRow; reasonCode: string }) =>
      authorizationsApi.cancel({
        reference: row.id,
        reasonCode,
        // Always false: the upstream throws "Nullify operation is not supported"
        // and SIS.Api forwards the flag as asked rather than downgrading it.
        nullify: false,
        // §1.3's one exception — operator input, and the row's own, because the
        // service narrows its lookup by it.
        providerCode: row.providerCode,
      }),
    onSuccess: (result) => {
      if (result.success) toast.success(t('acts.results.cancelled'))
      else
        toast.warning(t('acts.results.cancelNotConfirmed'), {
          description: result.status || undefined,
        })
      setCancelRow(null)
    },
    // 🚩 No toast on this one. A refused cancellation arrives while the dialog is
    // still open, and `@/core/ui/Modal` uses `showModal()` — the dialog and its
    // backdrop sit in the browser's TOP LAYER, above any toaster mounted in the
    // ordinary DOM whatever its z-index. The server's own sentence would be
    // painted under a 50% black scrim and unclickable. It renders INSIDE the
    // dialog instead, next to the control that raised it, and the dialog stays
    // open so the agent can read it, change the reason, or keep the
    // authorization.
    onSettled: () => {
      setActing(null)
      rereadRows()
    },
  })

  // 🚩 Read through a ref, not through the closure. `onAct` has to be STABLE —
  // it reaches the grid inside the column definitions, and AG Grid rebuilds every
  // cell when those change identity, which throws keyboard focus to the document
  // body the moment an agent presses one of these buttons. TanStack's mutation
  // objects are new on every render, so a `useCallback` over them is not stable.
  const live = useRef({ acting, statusCheck, retry, navigate })
  live.current = { acting, statusCheck, retry, navigate }

  const onAct = useCallback((act: AuthAct, row: AuthListRow) => {
    const { acting: inFlight, statusCheck: check, retry: again, navigate: go } = live.current
    // A second act while one is unanswered is a second ask, and on this screen an
    // ask reaches the national exchange. The banner above the grid is what says
    // so — a silently ignored click would teach nothing.
    if (inFlight) return
    if (act === 'statusCheck') {
      setActing({ id: row.id, act })
      check.mutate(row)
    } else if (act === 'retry') {
      setActing({ id: row.id, act })
      again.mutate(row)
    } else if (act === 'cancel') {
      // The one act that asks a question first: a cancellation carries a reason
      // code all the way to NPHIES, and it is terminal.
      setCancelRow(row)
    } else if (act === 'openRefusal') {
      // 🚩 The only act here that is not an ask of the exchange — it is a
      // NAVIGATION. Reopening raises nothing: it reaches the existing form route
      // with the source authorization named in the URL (spec 209 §1's
      // `?copyOf=<authId>`), and the form opens a FRESH session and replays the
      // journalled request through verbs that already exist. Nothing about this
      // row changes, so there is no re-read and no `acting` claim over the grid.
      void go(`/nphies/authorizations/new?copyOf=${encodeURIComponent(row.id)}`)
    }
  }, [])

  const columns = useMemo(() => buildAuthListColumns(t, onAct), [t, onAct])

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
    // The in-page backstop behind the hidden nav leaf, and it distinguishes the
    // two reasons: an unreachable probe is a retry, a refused one is an
    // administrator. Same rule as every other screen in the area.
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

  // Everything below describes ONE read: the rows, their total, the window that
  // produced them, and the page the SERVER says it served. Reading the page or
  // the size off client state instead would let a server that clamped an
  // out-of-range page, or capped the page size, render a footer that disagrees
  // with the rows above it.
  const answered = list.data
  const rows = answered?.page.rows ?? []
  const total = answered?.page.total ?? 0
  const shownPage = answered?.page.page ?? criteria.page
  const shownPageSize = answered?.page.pageSize
  const shownWindow = answered?.criteria.window ?? null
  const refreshing = list.isFetching && answered !== undefined
  const pages = pageCountFor(total, shownPageSize)
  // The instant the rows on screen came back — not the instant the agent last
  // clicked. `dataUpdatedAt` is 0 before the first answer, which `formatClock`
  // renders blank rather than as the epoch.
  const loadedAt = formatClock(list.dataUpdatedAt)
  // The row an act is running on, so the banner names it the way an agent does —
  // by the reference they are quoted on the phone, and by the id only when the
  // payer has not issued one yet.
  const actingRow = acting ? rows.find((r) => r.id === acting.id) : undefined

  return (
    <section className="flex h-full w-full flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t('list.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('list.subtitle')}</p>
      </header>

      <ListFilters
        draft={draft}
        // The window that produced the rows on screen, not the one that has been
        // asked for — see the note on the query above.
        appliedWindow={shownWindow}
        today={today}
        providers={providers.data ?? []}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        onRemoveWindow={onRemoveWindow}
      />

      {providers.isError && (
        <ErrorBanner
          message={apiErrorMessage(providers.error, t('errors.providersFailed'))}
          className="p-3"
        />
      )}
      {list.isError && (
        <ErrorBanner message={apiErrorMessage(list.error, t('errors.listFailed'))} className="p-3" />
      )}

      {/* 🚩 The act in flight, ABOVE the grid rather than inside the cell that
          fired it — a busy flag in the cell would have to travel through the
          column definitions, and a changed `columnDefs` makes AG Grid rebuild
          every cell and drop keyboard focus mid-act. Here it survives the
          re-render, it is announced (`role="status"`), and it is also the answer
          to why a second act does nothing: one ask at a time, because each of
          these reaches the national exchange. */}
      {acting && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2 text-xs"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('acts.inFlight', {
            act: t(`acts.${acting.act}`),
            reference: actingRow?.preAuthRef || acting.id,
          })}
        </div>
      )}

      {list.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label={t('list.loading')}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : list.isError ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* The TRUE total, not the page's row count — `rows.length` on a
                server-paged list is a page size wearing a total's clothes. */}
            <span className="tabular-nums text-muted-foreground">
              {t('list.matchCount', { count: total, formatted: total.toLocaleString() })}
            </span>
            {/* 🚩 Refresh, with the load time BESIDE it (story 76). The service
                polls the exchange itself every 15 s, so a pending row becomes
                complete on its own; what an agent needs is not a browser poll but
                to know how old this answer is and decide for themselves. */}
            <span className="flex items-center gap-2">
              {loadedAt && (
                <span className="tabular-nums text-muted-foreground" role="status">
                  {t('list.loadedAt', { at: loadedAt })}
                </span>
              )}
              <button
                type="button"
                onClick={() => void list.refetch()}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw
                  className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')}
                  aria-hidden
                />
                {t('list.refresh')}
              </button>
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
              <PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
              <div className="text-base font-semibold tracking-tight">{t('list.empty.title')}</div>
              <p className="text-sm text-muted-foreground">
                {/* The hint names the window when there IS one: "nothing matched"
                    and "nothing matched this week" send an agent in two different
                    directions. It reads the window that produced this empty
                    result, never the one just requested. */}
                {shownWindow ? t('list.empty.hintWindowed') : t('list.empty.hint')}
              </p>
            </div>
          ) : (
            <div
              className={'min-h-[24rem] flex-1 transition-opacity ' + (refreshing ? 'opacity-50' : '')}
              aria-busy={refreshing}
            >
              <AgGridReact<(typeof rows)[number]>
                theme={omsGridTheme}
                rowData={rows}
                columnDefs={columns}
                defaultColDef={AUTH_LIST_DEFAULT_COL_DEF}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                animateRows={false}
                {...omsGridDirection}
              />
            </div>
          )}

          {/* `|| shownPage > 1` is the escape hatch, not a flourish: a refetch
              that shrinks the total can leave the agent standing on a page that
              no longer exists, and an unmounted footer would leave them looking
              at an empty grid with no control that goes back. */}
          {(pages > 1 || shownPage > 1) && (
            <ListPager
              page={shownPage}
              pages={pages}
              busy={refreshing}
              onPage={goToPage}
              labels={{
                ariaLabel: t('list.pager.ariaLabel'),
                previous: t('list.pager.previous'),
                next: t('list.pager.next'),
                readout: t('list.pager.readout', {
                  page: shownPage,
                  pages: pages.toLocaleString(),
                }),
              }}
            />
          )}
        </>
      )}

      {/* The cancel act's confirmation and its reason (215). Mounted at the page
          so it survives the grid re-rendering under it. */}
      <CancelDialog
        row={cancelRow}
        busy={cancel.isPending}
        // The refusal renders in the dialog, over the top-layer problem above.
        error={cancel.error}
        onClose={() => {
          if (cancel.isPending) return
          cancel.reset()
          setCancelRow(null)
        }}
        onConfirm={(reasonCode) => {
          // `acting` too, not just this mutation: opening the dialog does not
          // claim the screen, so an act could have been started on another row
          // while the reason was being chosen.
          if (!cancelRow || cancel.isPending || acting) return
          setActing({ id: cancelRow.id, act: 'cancel' })
          cancel.mutate({ row: cancelRow, reasonCode })
        }}
      />
    </section>
  )
}
