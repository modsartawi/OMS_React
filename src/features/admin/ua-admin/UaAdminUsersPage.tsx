import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { UaReportCountsResult } from '@/core/models/ua-user'
import { deriveStatus, formatStamp } from './helpers'
import { uaAdminApi } from './api'
import { showsPager } from './pager'
import GridPager from './GridPager'
import StatusPill from './StatusPill'
import ChannelPill from './ChannelPill'
import UserDetailPane from './UserDetailPane'
import NewIdentityModal from './NewIdentityModal'

// The six cards, in screen order. `count` picks the field off the counts DTO —
// note `mustChange` reads `mustChangePassword` (the one name asymmetry). `card`
// is BOTH the count key and the /ReportCards/{card} path arg.
const CARDS: { card: string; count: (c: UaReportCountsResult) => number; tone: string }[] = [
  { card: 'all', count: (c) => c.allPeople, tone: '' },
  { card: 'notSeeded', count: (c) => c.notSeeded, tone: 'text-danger-800' },
  { card: 'phoneGap', count: (c) => c.phoneGap, tone: 'text-attention-800' },
  { card: 'awaitingActivation', count: (c) => c.awaitingActivation, tone: 'text-sidebar-active' },
  { card: 'mustChange', count: (c) => c.mustChangePassword, tone: 'text-sidebar-active' },
  { card: 'disabled', count: (c) => c.disabled, tone: '' },
]

/**
 * The 1-based page is a FIELD of the query, not separate state (ticket 148). That
 * buys three behaviours with no code: a new search or a card switch builds a
 * fresh query at page 1, and each page is its own cache entry.
 */
type Query = { kind: 'search'; term: string; page: number } | { kind: 'card'; card: string; page: number }

export default function UaAdminUsersPage() {
  const { t } = useTranslation('ua-admin')
  const qc = useQueryClient()

  const [term, setTerm] = useState('')
  const [showMinCharsHint, setShowMinCharsHint] = useState(false)
  const [query, setQuery] = useState<Query | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

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
        <button
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85"
          onClick={() => setNewOpen(true)}
        >
          {t('newIdentity')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{showMinCharsHint ? t('search.minChars') : t('search.hint')}</p>

      {/* report cards — server-counted, worklist filters */}
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {CARDS.map((c) => (
          <button
            key={c.card}
            onClick={() => openCard(c.card)}
            className={
              'flex flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent ' +
              (activeCard === c.card ? 'border-primary bg-accent' : 'border-border/60')
            }
          >
            <span className={`text-xl font-bold tabular-nums ${c.tone}`}>
              {countsData ? c.count(countsData).toLocaleString() : '—'}
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
          ) : list.isPending ? (
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
                  <tr className="text-left text-xs font-medium text-muted-foreground">
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
