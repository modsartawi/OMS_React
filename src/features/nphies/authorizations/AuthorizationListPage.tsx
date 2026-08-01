import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
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
import { authorizationsApi } from './api'
import { buildAuthListParams, defaultAuthCriteria, type AuthListCriteria } from './list-params'
import { AUTH_LIST_DEFAULT_COL_DEF, buildAuthListColumns } from './list-columns'
import ListFilters from './ListFilters'

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

  const columns = useMemo(() => buildAuthListColumns(t), [t])

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
    </section>
  )
}
