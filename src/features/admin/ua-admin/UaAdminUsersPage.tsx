import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { deriveStatus, formatStamp } from './helpers'
import { visibleCards } from './cards'
import { buildUaUsersCsv, csvFileName } from './csv'
import {
  ExportCancelledError,
  ExportRunawayError,
  collectAllRows,
  downloadCsv,
  estimateWalkSeconds,
  needsConfirm,
} from './export'
import { uaAdminApi } from './api'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from './pager'
import GridPager from './GridPager'
import StatusPill from './StatusPill'
import ChannelPill from './ChannelPill'
import UserDetailPane from './UserDetailPane'
import NewIdentityModal from './NewIdentityModal'

/**
 * The 1-based page is a FIELD of the query, not separate state (ticket 148). That
 * buys three behaviours with no code: a new search or a card switch builds a
 * fresh query at page 1, and each page is its own cache entry.
 */
type Query = { kind: 'search'; term: string; page: number } | { kind: 'card'; card: string; page: number }

/** One id for the export's progress toast, so 120 pages update one toast. */
const EXPORT_TOAST_ID = 'ua-users-export'

export default function UaAdminUsersPage() {
  const { t } = useTranslation('ua-admin')
  const qc = useQueryClient()

  const [term, setTerm] = useState('')
  const [showMinCharsHint, setShowMinCharsHint] = useState(false)
  const [query, setQuery] = useState<Query | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  // A ref, not state: the running walk polls this between pages, and it must see
  // the click immediately rather than on the next render.
  const cancelExport = useRef(false)

  const access = useQuery({ queryKey: ['ua-admin', 'access'], queryFn: () => uaAdminApi.access() })
  const counts = useQuery({
    queryKey: ['ua-admin', 'counts'],
    queryFn: () => uaAdminApi.reportCounts(),
    enabled: access.data?.canOpen === true,
  })

  const list = useQuery({
    queryKey: ['ua-admin', 'list', query],
    queryFn: () =>
      query!.kind === 'search'
        ? uaAdminApi.search(query!.term, query!.page)
        : uaAdminApi.worklist(query!.card, query!.page),
    enabled: query !== null && access.data?.canOpen === true,
    // Keep the previous page's rows on screen while the next loads, so the
    // spinner means FIRST load again and a walk isn't a stutter of blanks.
    placeholderData: keepPreviousData,
    // A page already visited must come back INSTANTLY, not dim through a
    // round trip (ticket 148). The global default is `staleTime: 0`, which would
    // refetch every step back. A mutation still refreshes the page it's on —
    // `refreshLists` invalidates, and invalidation ignores staleness.
    staleTime: 30_000,
  })

  // Dim-and-disable, not blank: true whenever rows are showing and a read is in
  // flight (an uncached page, or a refetch after a mutation).
  const refreshing = list.isFetching && list.data !== undefined

  // A mutation HOLDS the page — nothing here does that, it is what having the
  // page in the query buys. This is only the one guard (ticket 149): a refetch
  // that leaves the current page empty above page 1 falls back to the new last
  // page, so fixing the final person on a worklist doesn't look like the screen
  // broke. Sitting on the list RESULT rather than in an action handler is what
  // makes it cover every caller of `refreshLists`, present and future.
  //
  // Gated on a settled read: with `keepPreviousData`, `list.data` mid-flight is
  // the previous page's rows, which would clamp off stale counts.
  // `null`, not `0`, when unsettled — 0 rows is the very signal the clamp reads,
  // so an unsettled read must not be able to look like an emptied page.
  const settledData = !list.isFetching && !list.isPlaceholderData ? list.data : undefined
  const settledPage = settledData !== undefined && query !== null ? query.page : null
  const settledRows = settledData?.rows.length ?? null
  const settledTotal = settledData?.totalMatches ?? null
  useEffect(() => {
    if (settledPage === null || settledRows === null || settledTotal === null) return
    const clamped = clampToLastPageWhenCurrentPageEmpties({
      page: settledPage,
      rowCount: settledRows,
      totalMatches: settledTotal,
    })
    if (clamped !== settledPage) goToPage(clamped)
  }, [settledPage, settledRows, settledTotal])

  function runSearch() {
    const trimmed = term.trim()
    if (trimmed.length < 2) {
      setShowMinCharsHint(true)
      return
    }
    setShowMinCharsHint(false)
    setQuery({ kind: 'search', term: trimmed, page: 1 })
  }

  function openCard(card: string) {
    setTerm('')
    setShowMinCharsHint(false)
    setQuery({ kind: 'card', card, page: 1 })
  }

  function goToPage(page: number) {
    setQuery((q) => (q === null ? q : { ...q, page }))
  }

  /**
   * The export walks the CURRENT QUERY's full match set from page 1 — it ignores
   * whichever page is on screen (spec 147, story 21), and it walks with
   * `uaAdminApi` directly so it never writes to the mounted query's cache:
   * downloading must not double as a navigation event.
   *
   * Past `EXPORT_CONFIRM_THRESHOLD` matches the walk is long enough to feel hung,
   * so it asks first (naming the count and the rough wait) and then runs behind a
   * cancellable toast rather than a blocking modal — the screen stays usable.
   * Below it, nothing appears: the file just arrives, as it does on every
   * narrowed card.
   *
   * The rule in both directions: cancel or any failure ⇒ **no file at all**. The
   * walk throws instead of returning what it had, so the string is never built
   * and nothing partial can land in a downloads folder looking complete.
   */
  async function exportCsv() {
    // `list.data` is what says how big this export is, so an unsettled count is
    // not a small one: without this, an export fired before the first read
    // landed would see 0 matches, skip the confirm and walk 6,000 people with no
    // progress and no way to stop it. The button is disabled for the same reason.
    if (query === null || exporting || list.data === undefined) return
    const q = query
    const totalMatches = list.data.totalMatches
    const long = needsConfirm(totalMatches)

    // Taken BEFORE the confirm, not after: the dialog is awaited, and a button
    // that stayed live through it could open a second dialog and start a second
    // walk over the same query.
    cancelExport.current = false
    setExporting(true)
    // One toast id, so 120 pages update the same toast instead of stacking 120 of
    // them. Only a long walk shows one — a card of 400 is over in a few seconds
    // and the button's own spinner already says so.
    const showProgress = (collected: number, total: number) => {
      if (!long) return
      toast.loading(t('export.progressTitle'), {
        id: EXPORT_TOAST_ID,
        description: t('export.progressDetail', {
          done: collected.toLocaleString(),
          total: total.toLocaleString(),
        }),
        duration: Infinity,
        cancel: { label: t('export.cancel'), onClick: () => (cancelExport.current = true) },
      })
    }

    try {
      if (long) {
        const accepted = await confirmAction(
          t('export.confirmBody', {
            formatted: totalMatches.toLocaleString(),
            seconds: estimateWalkSeconds(totalMatches),
          }),
          t('export.confirmTitle', { count: totalMatches, formatted: totalMatches.toLocaleString() }),
        )
        // Dismissed ⇒ nothing at all happened: no read, no toast, no file.
        if (!accepted) return
        showProgress(0, totalMatches)
      }

      const rows = await collectAllRows(
        (page) => (q.kind === 'search' ? uaAdminApi.search(q.term, page) : uaAdminApi.worklist(q.card, page)),
        {
          isCancelled: () => cancelExport.current,
          onProgress: (p) => showProgress(p.collected, p.totalMatches),
        },
      )
      // A search exports under the scope `search`; a card under its own code —
      // the label wouldn't survive sanitising into a filename.
      const scope = q.kind === 'search' ? 'search' : q.card
      downloadCsv(csvFileName(scope, new Date()), buildUaUsersCsv(rows, (key) => t(key)))
    } catch (err) {
      // No file at all, whichever way it ended — the string is never built, so
      // nothing partial can land. A cancellation says so quietly; the runaway
      // guard says the walk never ended, which is not the same news as a refusal;
      // anything else says what broke, through `apiErrorMessage`. 401 stays
      // `handle401`'s business.
      if (err instanceof ExportCancelledError) notify.info(t('export.cancelled'), t('export.cancelledDetail'))
      else if (err instanceof ExportRunawayError) notify.error(t('export.failed'), t('export.runawayDetail'))
      else notify.apiError(t('export.failed'), err, t('toast.failed'))
    } finally {
      if (long) toast.dismiss(EXPORT_TOAST_ID)
      setExporting(false)
    }
  }

  function refreshLists() {
    void qc.invalidateQueries({ queryKey: ['ua-admin', 'list'] })
    void qc.invalidateQueries({ queryKey: ['ua-admin', 'counts'] })
  }

  // ----- access states ------------------------------------------------------
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (access.data?.canOpen !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  const countsData = counts.data
  // The row as it will render — its length is also the grid's track count.
  const cardRow = visibleCards(countsData)
  const activeCard = query?.kind === 'card' ? query.card : null
  const gridTitle =
    query === null
      ? t('grid.noQuery')
      : query.kind === 'search'
        ? t('grid.searchTitle', { term: query.term })
        : t('grid.worklistTitle', { label: t(`cards.${query.card}`) })

  return (
    <section className="flex flex-col gap-3">
      {/* toolbar: search is the primary affordance */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 overflow-hidden rounded-full border border-input bg-background">
          <input
            className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm outline-none"
            placeholder={
              countsData
                ? t('search.placeholder', { count: countsData.allPeople.toLocaleString() })
                : t('search.placeholderNoCount')
            }
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
            }}
            autoFocus
          />
          <button
            className="bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            onClick={runSearch}
          >
            {t('search.button')}
          </button>
        </div>
        {/* Carries NO permission check of its own — it renders whenever the
            screen renders, behind the existing access probe (ticket 146). It is
            dead only when there is nothing to export yet. */}
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
          onClick={() => void exportCsv()}
          // Dead until a count has landed: how many people this exports is what
          // decides whether it asks first, so exporting before the first read
          // settles would silently skip the confirm (ticket 151).
          disabled={query === null || exporting || list.data === undefined}
        >
          {exporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('export.button')}
        </button>
        <button
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85"
          onClick={() => setNewOpen(true)}
        >
          {t('newIdentity')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{showMinCharsHint ? t('search.minChars') : t('search.hint')}</p>

      {/* Report cards — server-counted, worklist filters. The track is ONE
          PER CARD, not a fixed six slots: the seventh appears the moment the
          server starts sending its count (ticket 152), and six is a real state
          that has to look deliberate too. `auto-fit` was the obvious reach and
          is wrong here — it derives its own column count from the width, so
          around 1000px seven cards become six plus a full-width orphan, which
          is the row-with-a-hole this is avoiding. Counting them is exact at
          both arrangements. */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:[grid-template-columns:repeat(var(--card-count),minmax(0,1fr))]"
        style={{ '--card-count': cardRow.length } as CSSProperties}
      >
        {cardRow.map((c) => (
          <button
            key={c.card}
            // Not styling — the row's shape and order is what ticket 152 is
            // about, and this is what lets the drive assert it.
            data-card={c.card}
            onClick={() => openCard(c.card)}
            className={
              'flex flex-col items-start rounded-lg border bg-card px-3 py-2 text-start transition-colors hover:bg-accent ' +
              (activeCard === c.card ? 'border-primary bg-accent' : 'border-border/60')
            }
          >
            {/* `null` is the read still in flight; a real 0 prints as 0. */}
            <span className={`text-xl font-bold tabular-nums ${c.tone}`}>
              {c.count === null ? '—' : c.count.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{t(`cards.${c.card}`)}</span>
          </button>
        ))}
      </div>

      {/* split: grid left, detail right */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[7fr_5fr]">
        <div className="flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
            <span className="font-semibold tracking-tight">{gridTitle}</span>
            <span className="tabular-nums text-muted-foreground">
              {/* The TRUE total, not the page's row count — reading `rows.length`
                  made a 6,000-row card report "50" (ticket 148). */}
              {/* `count` drives the plural; `formatted` is what's shown, so 6,000
                  reads with a thousands separator. */}
              {list.data
                ? t('grid.matchCount', {
                    count: list.data.totalMatches,
                    formatted: list.data.totalMatches.toLocaleString(),
                  })
                : ''}
            </span>
          </div>

          {query === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-10 text-center">
              <b className="text-sm">{t('grid.emptyTitle')}</b>
              <span className="max-w-sm text-sm text-muted-foreground">{t('grid.emptyHint')}</span>
            </div>
          ) : /* The clamp's landing page, if it isn't cached, arrives behind the
                 EMPTIED page as placeholder — and rendering "no people match"
                 for that round trip is exactly the broken-looking screen the
                 clamp exists to prevent. A placeholder with no rows is not this
                 page's answer, so it reads as a first load. */
            list.isPending || (list.isPlaceholderData && list.data.rows.length === 0) ? (
            <div className="flex flex-1 items-center justify-center gap-2 p-10 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('grid.loading')}
            </div>
          ) : list.isError ? (
            <ErrorBanner message={apiErrorMessage(list.error, t('toast.failed'))} className="m-3 p-4" />
          ) : list.data.rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
              {t('grid.noResults')}
            </div>
          ) : (
            <div
              className={'overflow-x-auto transition-opacity ' + (refreshing ? 'pointer-events-none opacity-50' : '')}
              aria-busy={refreshing}
            >
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="text-start text-xs font-medium text-muted-foreground">
                    <th className="border-b border-border px-3 py-1.5">{t('grid.employee')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.name')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.mobile')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.channel')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.status')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.totp')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.lastLogin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.rows.map((r) => (
                    <tr
                      key={r.employeeId}
                      onClick={() => setSelectedId(r.employeeId)}
                      className={
                        'cursor-pointer ' + (selectedId === r.employeeId ? 'bg-accent' : 'hover:bg-muted/50')
                      }
                    >
                      <td className="border-b border-border px-3 py-1.5 tabular-nums">{r.employeeId}</td>
                      <td className="border-b border-border px-3 py-1.5">{r.displayName}</td>
                      <td className="border-b border-border px-3 py-1.5 tabular-nums">{r.phone || t('detail.none')}</td>
                      <td className="border-b border-border px-3 py-1.5">
                        {/* who is on the non-standard channel, and whether it can reach them */}
                        <ChannelPill phoneClass={r.phoneClass} email={r.email} deliveryChannel={r.deliveryChannel} />
                      </td>
                      <td className="border-b border-border px-3 py-1.5">
                        <StatusPill status={deriveStatus(r)} />
                      </td>
                      <td className="border-b border-border px-3 py-1.5">{r.isTotpEnrolled ? '✓' : t('detail.none')}</td>
                      <td className="border-b border-border px-3 py-1.5 tabular-nums">
                        {formatStamp(r.lastLoginAt) ?? t('grid.never')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* The footer exists only past the first page. `query` is non-null
              whenever `list.data` is, so `query.page` is safe here. */}
          {query !== null && list.data && !list.isError && showsPager(list.data.totalMatches) && (
            <div className="mt-auto">
              <GridPager
                page={query.page}
                totalMatches={list.data.totalMatches}
                isCapped={list.data.isCapped}
                busy={refreshing}
                onPage={goToPage}
              />
            </div>
          )}
        </div>

        <div className="min-h-[22rem] rounded-lg border border-border/60 bg-card p-3">
          {selectedId === null ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-10 text-center">
              <b className="text-sm">{t('detail.selectTitle')}</b>
              <span className="max-w-xs text-sm text-muted-foreground">{t('detail.selectHint')}</span>
            </div>
          ) : (
            <UserDetailPane key={selectedId} employeeId={selectedId} onChanged={refreshLists} />
          )}
        </div>
      </div>

      <NewIdentityModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setSelectedId(id)
          setTerm(id)
          setQuery({ kind: 'search', term: id, page: 1 })
          refreshLists()
        }}
      />
    </section>
  )
}
