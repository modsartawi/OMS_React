import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, PackageSearch, ShieldAlert } from 'lucide-react'

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
import { eligibilityApi } from './api'
import { pageCountFor } from '@/core/nphies/list-window'
import ListPager from '@/core/nphies/ListPager'
import {
  buildEligibilityListParams,
  defaultEligibilityCriteria,
  type EligibilityListCriteria,
} from './list-params'
import { ELIGIBILITY_LIST_DEFAULT_COL_DEF, buildEligibilityListColumns } from './list-columns'
import ListFilters from './ListFilters'

/**
 * The eligibility list (ticket 212, spec 209 §6) — the screen an agent lands on.
 *
 * **Last 7 days, newest first, server-paged, and the window says so.** The chip is
 * the ticket: the underlying read is an unordered `Take(20000)`, so a silently
 * truncated list reads as *"that's everything"*, which is exactly the failure mode
 * this screen inherits if the window is invisible. Removing the chip drops the
 * window from the query rather than substituting a wider one.
 *
 * Both status axes come from `@/core/nphies/status` — the same derivation the
 * check result renders and 214's authorization list reuses unchanged.
 *
 * Every rule about what reaches the server is in the pure `list-params` module;
 * this file is the controlled shell over it, which is what makes those rules
 * testable with no React Testing Library in the repo (spec 209's tier-1 ruling).
 */
export default function EligibilityListPage() {
  const { t } = useTranslation('eligibility')

  // The area's ONE probe, on the key the nav leaf and the check page share → one
  // network call for the whole area. Fails closed: pending and errored both draw
  // something other than the list.
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
  // midnight rollover re-renders the page, and "is this still the default
  // window?" is asked against the same day the default was built from.
  const [today] = useState(() => new Date())
  const [criteria, setCriteria] = useState<EligibilityListCriteria>(() =>
    defaultEligibilityCriteria(today),
  )
  // The panel's draft. Typing does not refetch; Search promotes it (the BBY
  // inquiry toolbar's split). The chip is the exception — it acts on `criteria`
  // directly, because it states the window that is actually in force.
  const [draft, setDraft] = useState<EligibilityListCriteria>(criteria)

  const params = useMemo(() => buildEligibilityListParams(criteria), [criteria])

  const list = useQuery({
    queryKey: ['nphies', 'eligibility', 'list', params],
    // 🚩 The criteria travel WITH the answer. With `keepPreviousData`, `criteria`
    // advances the instant the agent clicks while `list.data` is still the
    // previous query's — so a chip read from `criteria` would say "no date
    // window" over the four rows the window was still hiding, and the pager would
    // read "Page 2 of 2" over page 1's rows. Both are the "that's everything"
    // confusion this ticket exists to remove, produced by the screen itself.
    // Pairing them here means everything the agent reads describes the same read.
    queryFn: async () => ({ criteria, page: await eligibilityApi.list(params) }),
    enabled: allowed,
    // Keep the current page's rows on screen while the next loads, so paging is a
    // step rather than a stutter of blanks.
    placeholderData: keepPreviousData,
    // 🚩 No `refetchInterval` anywhere on this feature (§3.6, spec 209 §6): the
    // Nphies service's own worker polls the exchange every 15 s, so waiting is
    // the normal path to a verdict and a browser poll would only add load.
  })

  const onChange = useCallback(
    (patch: Partial<EligibilityListCriteria>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  )
  // Any new filter starts at page 1 — page is a field of the criteria, so this is
  // the whole of that rule.
  const onSearch = useCallback(() => setCriteria({ ...draft, page: 1 }), [draft])
  const onReset = useCallback(() => {
    const fresh = defaultEligibilityCriteria(new Date())
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

  const columns = useMemo(() => buildEligibilityListColumns(t), [t])

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
    // administrator. Same rule as the check page (211).
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
  // with the rows above it — and on a capped size the last rows become
  // unreachable behind a disabled Next.
  const answered = list.data
  const rows = answered?.page.rows ?? []
  const total = answered?.page.total ?? 0
  const shownPage = answered?.page.page ?? criteria.page
  const shownPageSize = answered?.page.pageSize
  // 🚩 THREE states, not two. `?? null` here would collapse "not answered yet"
  // into "the agent removed the window" — so for the ~10 s a cold read takes
  // against real data (and for as long as an error stands), the chip asserted
  // "no date window, showing every check on record" while the request it had just
  // sent carried a seven-day one. That is the exact "that's everything" lie this
  // ticket exists to prevent, told by the screen itself, and no stubbed drive can
  // see it because a stub answers instantly. Found driving live, 2026-08-02.
  //
  // With an answer, the window is the ANSWER's — that is the keepPreviousData
  // pairing rule above, and it still holds. Without one, it is what we ASKED for,
  // which is the only honest thing to say about rows that do not exist yet.
  const shownWindow = answered ? answered.criteria.window : criteria.window
  // Dim-and-disable rather than blank whenever rows are showing and a read is in
  // flight — the spinner then means FIRST load again.
  const refreshing = list.isFetching && answered !== undefined
  const pages = pageCountFor(total, shownPageSize)

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
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* The TRUE total, not the page's row count — `rows.length` on a
                server-paged list is a page size wearing a total's clothes. */}
            <span className="tabular-nums text-muted-foreground">
              {t('list.matchCount', { count: total, formatted: total.toLocaleString() })}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
              <PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
              <div className="text-base font-semibold tracking-tight">{t('list.empty.title')}</div>
              <p className="text-sm text-muted-foreground">
                {/* The hint names the window when there IS one, because "nothing
                    matched" and "nothing matched this week" send an agent in two
                    different directions — so it reads the window that produced
                    this empty result, never the one just requested. */}
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
                defaultColDef={ELIGIBILITY_LIST_DEFAULT_COL_DEF}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                animateRows={false}
                {...omsGridDirection}
              />
            </div>
          )}

          {/* 🚩 `|| shownPage > 1` is the escape hatch, not a flourish. A refetch
              that shrinks the total (rows aged out of the window, a narrower
              read) can leave the agent standing on a page that no longer exists;
              if the footer unmounted because the result now fits one page, they
              would be looking at an empty grid with no control that goes back. */}
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
