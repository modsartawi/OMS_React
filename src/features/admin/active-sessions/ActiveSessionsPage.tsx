import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { formatDateTime } from '@/core/util/date-format'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { ActiveSessionRow } from '@/core/models/session-monitor'
import { sessionMonitorApi } from './api'
import { isDormant, relativeTime, singleDistinctUser, type SessionChip, type SingleUser } from './helpers'
import type { ActiveSessionSearchResult, SessionCountsResult } from '@/core/models/session-monitor'

// Subtle per-channel badge tints (light + dark). Unknown channels fall back to
// the neutral muted chip — the label always comes from `channel.<key>` (i18n).
const CHANNEL_TONE: Record<string, string> = {
  web: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  mobile: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  backoffice: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  pos: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
}

// The channel chips, in screen order. `count` picks the field off the counts DTO.
// Idle is rendered separately (no count number, a per-channel tooltip). Chip label
// text comes from `chips.<chip>` (i18n). Ticket 009.
const CHANNEL_CHIPS: { chip: SessionChip; count: (c: SessionCountsResult) => number }[] = [
  { chip: 'all', count: (c) => c.all },
  { chip: 'web', count: (c) => c.web },
  { chip: 'mobile', count: (c) => c.mobile },
  { chip: 'backoffice', count: (c) => c.backoffice },
]

type Query = { chip: SessionChip; term: string }

// Ticket 009 — filter chips above the grid: All / Web / Mobile / BackOffice /
// Idle, each channel chip showing a server-computed count (true estate-wide
// total, independent of the 50-row page). Clicking a chip sets the active filter
// (a `channel`, or `idleOnly` for Idle) and re-queries; the active chip is marked.
// A chip composes with the search term. Revoke (010/011) and auto-refresh (012)
// land in later tickets. Ticket 008 landed the search box + monitoring table.
export default function ActiveSessionsPage() {
  const { t } = useTranslation('active-sessions')
  const qc = useQueryClient()

  const [term, setTerm] = useState('')
  const [query, setQuery] = useState<Query | null>(null)

  const access = useQuery({
    queryKey: ['active-sessions', 'access'],
    queryFn: () => sessionMonitorApi.access(),
  })

  const counts = useQuery({
    queryKey: ['active-sessions', 'counts'],
    queryFn: () => sessionMonitorApi.counts(),
    enabled: access.data?.canOpen === true,
  })

  const listKey = ['active-sessions', 'list', query] as const
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => sessionMonitorApi.search(query!.term, query!.chip),
    enabled: query !== null && access.data?.canOpen === true,
    // Keep the monitor live: re-run the CURRENT capped query every 30s (ticket
    // 012). The queryKey holds the term+chip, so the poll only ever reloads the
    // view on screen — a tab left open doesn't fan out. `refetchIntervalInBackground`
    // stays default-false, so an unfocused tab pauses. Optimistic revokes (010/011)
    // reconcile against the server truth on the next tick.
    refetchInterval: 30_000,
  })

  // A coarse clock so the "updated N ago" stamp advances between fetches. The
  // freshness buckets are minute-grained (relativeTime), so a 15s tick is ample;
  // it only forces a re-render, never a refetch.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  function runSearch() {
    // A term composes with the active chip (default All); the term-less "All live"
    // view is reached by clicking a chip instead.
    const trimmed = term.trim()
    if (!trimmed) return
    setQuery({ chip: query?.chip ?? 'all', term: trimmed })
  }

  function selectChip(chip: SessionChip) {
    // Keep the committed term so Web/Idle narrows the current search, and sync the
    // box to it so an un-searched edit never lingers out of step with the grid.
    const committed = query?.term ?? ''
    setTerm(committed)
    setQuery({ chip, term: committed })
  }

  // Revoke one session: confirm (naming the person + channel), drop the row
  // optimistically so the sign-out feels instant, then call the door. On success
  // toast + refresh the chip counts (the estate total just dropped by one). On
  // failure restore the row and surface the envelope message via apiErrorMessage
  // (notify.apiError). A dead session answers business-success, so it never lands
  // here — the row simply leaves. This is a session action; the person stays
  // enabled. Ticket 010.
  async function revoke(row: ActiveSessionRow) {
    const name = row.displayName || row.userId
    const channel = t(`channel.${row.channel}`, { defaultValue: row.channel })
    const ok = await confirmAction(
      t('confirm.revokeBody', { name, channel }),
      t('confirm.revokeTitle'),
    )
    if (!ok) return

    const previous = qc.getQueryData<ActiveSessionSearchResult>(listKey)
    qc.setQueryData<ActiveSessionSearchResult>(listKey, (old) =>
      old
        ? {
            ...old,
            rows: old.rows.filter((r) => r.sessionId !== row.sessionId),
            totalMatches: Math.max(0, old.totalMatches - 1),
          }
        : old,
    )

    try {
      await sessionMonitorApi.revoke(row.sessionId)
      notify.success(t('toast.revoked'), t('toast.revokedDetail', { name, channel }))
      void qc.invalidateQueries({ queryKey: ['active-sessions', 'counts'] })
    } catch (err) {
      qc.setQueryData(listKey, previous)
      notify.apiError(t('toast.revokeFailed'), err)
    }
  }

  // Revoke every device for the one person the result set resolves to — the
  // lost-phone / leaver hammer (ticket 011). Only reachable from the context bar,
  // which shows only for a single-distinct-user set. Confirm states the blast
  // radius (device count), then drop that user's rows optimistically so the
  // sign-out feels instant, and call the new door. On success toast with the
  // server-reported `revokedCount` (the true number killed, which can exceed the
  // capped view) and refresh the chip counts. On failure restore the rows and
  // surface the envelope message. The person stays enabled — this is a session
  // action, not an account one.
  async function revokeAll(user: SingleUser) {
    const name = user.displayName || user.userId
    const ok = await confirmAction(
      t('confirm.revokeAllBody', { name, count: user.count }),
      t('confirm.revokeAllTitle'),
    )
    if (!ok) return

    const previous = qc.getQueryData<ActiveSessionSearchResult>(listKey)
    qc.setQueryData<ActiveSessionSearchResult>(listKey, (old) => {
      if (!old) return old
      const remaining = old.rows.filter((r) => r.userId !== user.userId)
      const removed = old.rows.length - remaining.length
      return {
        ...old,
        rows: remaining,
        totalMatches: Math.max(0, old.totalMatches - removed),
      }
    })

    try {
      const res = await sessionMonitorApi.revokeAllForUser(user.userId)
      notify.success(
        t('toast.revokedAll'),
        t('toast.revokedAllDetail', { name, count: res.revokedCount }),
      )
      void qc.invalidateQueries({ queryKey: ['active-sessions', 'counts'] })
    } catch (err) {
      qc.setQueryData(listKey, previous)
      notify.apiError(t('toast.revokeAllFailed'), err)
    }
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
  const activeChip = query?.chip ?? null
  // The revoke-all bar shows only when the loaded result is the COMPLETE,
  // all-channels set for one person (ticket 011): a mixed set never offers the
  // estate-wide hammer, and neither does a channel/idle-narrowed or 50-capped set
  // — those would state a per-channel or first-page count that understates the
  // true blast radius the confirm promises (spec 006 story 26). Clear the chip
  // back to All to get the hammer on a channel-filtered search.
  const soleUser =
    list.data && query?.chip === 'all' && !list.data.isCapped
      ? singleDistinctUser(list.data.rows)
      : null
  const gridTitle =
    query === null
      ? t('grid.noQuery')
      : query.term
        ? t('grid.searchTitle', { term: query.term })
        : query.chip === 'all'
          ? t('grid.allTitle')
          : query.chip === 'idle'
            ? t('grid.idleTitle')
            : t('grid.channelTitle', { channel: t(`channel.${query.chip}`) })
  // "updated N ago" freshness — reuse the row last-seen wording against the last
  // successful fetch, re-derived on each nowTick so it advances between polls.
  const freshness =
    query !== null && list.data && list.dataUpdatedAt
      ? relativeTime(new Date(list.dataUpdatedAt).toISOString(), new Date(nowTick))
      : null

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>

      {/* search box — the primary affordance */}
      <div className="flex overflow-hidden rounded-full border border-input bg-background">
        <span className="flex items-center ps-4 text-muted-foreground">
          <Search className="h-4 w-4" />
        </span>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          placeholder={t('search.placeholder')}
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
      <p className="text-xs text-muted-foreground">{t('search.hint')}</p>

      {/* filter chips — server-counted channel filters + the Idle chip */}
      <div className="flex flex-wrap gap-2">
        {CHANNEL_CHIPS.map((c) => (
          <button
            key={c.chip}
            onClick={() => selectChip(c.chip)}
            aria-pressed={activeChip === c.chip}
            className={
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ' +
              (activeChip === c.chip
                ? 'border-primary bg-accent font-medium'
                : 'border-border/60 hover:bg-muted/50')
            }
          >
            <span>{t(`chips.${c.chip}`)}</span>
            <span className="tabular-nums text-xs text-muted-foreground">
              {countsData ? c.count(countsData).toLocaleString() : '—'}
            </span>
          </button>
        ))}
        <button
          onClick={() => selectChip('idle')}
          aria-pressed={activeChip === 'idle'}
          title={t('chips.idleTooltip')}
          className={
            'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ' +
            (activeChip === 'idle'
              ? 'border-primary bg-accent font-medium'
              : 'border-border/60 hover:bg-muted/50')
          }
        >
          {t('chips.idle')}
        </button>
      </div>

      {/* revoke-all context bar — only for a single-distinct-user result */}
      {soleUser && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-accent/40 px-4 py-2">
          <span className="text-sm">
            {t('revokeAll.summary', {
              name: soleUser.displayName || soleUser.userId,
              count: soleUser.count,
            })}
          </span>
          <button
            className="shrink-0 rounded-full border border-red-600/40 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-600/10 dark:text-red-400"
            onClick={() => revokeAll(soleUser)}
          >
            {t('revokeAll.button')}
          </button>
        </div>
      )}

      {/* live-monitoring table */}
      <div className="flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
          <span className="font-semibold tracking-tight">{gridTitle}</span>
          <div className="flex items-center gap-3">
            <span className="tabular-nums text-muted-foreground">
              {list.data
                ? list.data.isCapped
                  ? t('grid.capped', {
                      shown: list.data.rows.length,
                      total: list.data.totalMatches.toLocaleString(),
                    })
                  : t('grid.matchCount', { count: list.data.rows.length })
                : ''}
            </span>
            {freshness && (
              <span className="tabular-nums text-muted-foreground">
                {t('freshness.updated', {
                  ago: t(`relative.${freshness.key}`, { count: freshness.count }),
                })}
              </span>
            )}
            {query !== null && (
              <button
                onClick={() => void list.refetch()}
                aria-label={t('freshness.refresh')}
                title={t('freshness.refresh')}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 font-medium transition-colors hover:bg-muted/50"
              >
                {/* Spins on any fetch (manual or the 30s poll) as live-monitor
                    feedback; not disabled — TanStack dedups a concurrent refetch. */}
                <RefreshCw className={'h-3.5 w-3.5 ' + (list.isFetching ? 'animate-spin' : '')} />
                {t('freshness.refresh')}
              </button>
            )}
          </div>
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
          <ErrorBanner message={apiErrorMessage(list.error, t('grid.failed'))} className="m-3 p-4" />
        ) : list.data.rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
            {t('grid.noResults')}
          </div>
        ) : (
          <SessionsTable rows={list.data.rows} onRevoke={revoke} />
        )}
      </div>
    </section>
  )
}

// Split out so `now` is stamped once per render of the loaded table (not per
// access/loading re-render) and the row helpers stay close to their columns.
function SessionsTable({
  rows,
  onRevoke,
}: {
  rows: ActiveSessionRow[]
  onRevoke: (row: ActiveSessionRow) => void
}) {
  const { t } = useTranslation('active-sessions')
  const now = new Date()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="text-start text-xs font-medium text-muted-foreground">
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.user')}</th>
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.store')}</th>
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.channel')}</th>
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.started')}</th>
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.lastSeen')}</th>
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.ip')}</th>
            <th className="border-b border-border px-3 py-1.5 text-start">{t('grid.client')}</th>
            <th className="border-b border-border px-3 py-1.5 text-end">{t('grid.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dormant = isDormant(r.channel, r.lastSeenTime, now)
            const rel = relativeTime(r.lastSeenTime, now)
            return (
              <tr key={r.sessionId} className="hover:bg-muted/50">
                <td className="border-b border-border px-3 py-1.5">
                  <div className="font-medium">{r.displayName || r.userId}</div>
                  <div className="tabular-nums text-xs text-muted-foreground">{r.userId}</div>
                </td>
                <td className="border-b border-border px-3 py-1.5 tabular-nums">{r.currentStoreCode || t('grid.none')}</td>
                <td className="border-b border-border px-3 py-1.5">
                  <span
                    className={
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (CHANNEL_TONE[r.channel] ?? 'border border-border bg-muted text-muted-foreground')
                    }
                  >
                    {t(`channel.${r.channel}`, { defaultValue: r.channel })}
                  </span>
                </td>
                <td className="border-b border-border px-3 py-1.5 tabular-nums text-muted-foreground">
                  {formatDateTime(r.createdTime) || t('grid.none')}
                </td>
                <td className="border-b border-border px-3 py-1.5">
                  <div
                    className={
                      'flex items-center gap-1.5 ' +
                      (dormant ? 'text-amber-700 dark:text-amber-300' : '')
                    }
                    title={dormant ? t('dormant.tooltip') : undefined}
                  >
                    {dormant && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
                    <span>{t(`relative.${rel.key}`, { count: rel.count })}</span>
                    {dormant && <span className="text-xs font-medium uppercase">{t('dormant.label')}</span>}
                  </div>
                  <div className="tabular-nums text-xs text-muted-foreground">
                    {formatDateTime(r.lastSeenTime) || t('grid.none')}
                  </div>
                </td>
                <td className="border-b border-border px-3 py-1.5 tabular-nums">{r.ipAddress || t('grid.none')}</td>
                <td className="max-w-[16rem] truncate border-b border-border px-3 py-1.5 text-muted-foreground" title={r.userAgent}>
                  {r.userAgent || t('grid.none')}
                </td>
                <td className="border-b border-border px-3 py-1.5 text-end">
                  <button
                    className="shrink-0 rounded-full text-xs font-medium text-red-700 hover:underline dark:text-red-400"
                    onClick={() => onRevoke(r)}
                  >
                    {t('grid.revoke')}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
