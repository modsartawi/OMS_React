import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'
import type { AuthzAccessResult, RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'
import { indexRoles } from './helpers'
import UserDetailPane from './UserDetailPane'

// Worklist cards filter the LOADED result set (the estate never loads). Classifying a
// row by its roles needs role data the search DTO does not carry, so the ≤50 loaded
// rows are enriched with their directly-assigned roles below (cached per person, and
// re-used by the detail pane on select). `all` needs no role data.
type CardKey = 'all' | 'admins' | 'noroles' | 'composite'
const CARD_KEYS: CardKey[] = ['all', 'admins', 'noroles', 'composite']

interface Props {
  access: AuthzAccessResult
  catalog: RoleCatalogEntry[]
  /** Seed term when arriving via a "jump to person" from the Roles workspace's
   *  Held-by tab — runs the search immediately so the person is already loaded. */
  initialTerm?: string | null
}

export default function UsersWorkspace({ access, catalog, initialTerm }: Props) {
  const { t } = useTranslation('authz-admin')

  const seed = initialTerm?.trim() || ''
  const [term, setTerm] = useState(seed)
  const [showMinCharsHint, setShowMinCharsHint] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(seed.length >= 2 ? seed : null)
  const [card, setCard] = useState<CardKey>('all')
  const [selected, setSelected] = useState<UaEmployeeGridRow | null>(null)

  const byName = useMemo(() => indexRoles(catalog), [catalog])

  const list = useQuery({
    queryKey: ['authz-admin', 'search', submitted],
    queryFn: () => authzAdminApi.search(submitted!),
    enabled: submitted !== null,
  })

  const rows = list.data?.rows ?? []

  // Enrich each loaded row with its directly-assigned roles (same cache key the detail
  // pane reads, so a select is instant). Bounded by the 50-row search cap.
  const roleReads = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['authz-admin', 'assigned', r.employeeId],
      queryFn: () => authzAdminApi.assignedRoles(r.employeeId),
      enabled: submitted !== null,
    })),
  })

  const rolesById = useMemo(() => {
    const map = new Map<string, string[]>()
    rows.forEach((r, i) => {
      if (roleReads[i]?.isSuccess) map.set(r.employeeId, roleReads[i].data as string[])
    })
    return map
  }, [rows, roleReads])

  // Read status per person so an ERRORED enrichment renders a stable "unknown" rather
  // than a permanent "…", and card counts/filters can tell pending from failed.
  const readById = useMemo(() => {
    const map = new Map<string, (typeof roleReads)[number]>()
    rows.forEach((r, i) => {
      if (roleReads[i]) map.set(r.employeeId, roleReads[i])
    })
    return map
  }, [rows, roleReads])

  const enriching = submitted !== null && roleReads.some((q) => q.isPending)

  function matches(row: UaEmployeeGridRow, key: CardKey): boolean {
    if (key === 'all') return true
    const roles = rolesById.get(row.employeeId)
    if (!roles) return false // not yet enriched → excluded until its roles load
    if (key === 'noroles') return roles.length === 0
    if (key === 'admins') return roles.some((rn) => byName.get(rn)?.isProtected)
    if (key === 'composite') return roles.some((rn) => byName.get(rn)?.isComposite)
    return true
  }

  const counts = useMemo(() => {
    const c: Record<CardKey, number> = { all: rows.length, admins: 0, noroles: 0, composite: 0 }
    for (const row of rows) {
      if (matches(row, 'admins')) c.admins++
      if (matches(row, 'noroles')) c.noroles++
      if (matches(row, 'composite')) c.composite++
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rolesById, byName])

  const visible = rows.filter((r) => matches(r, card))

  function runSearch() {
    const trimmed = term.trim()
    if (trimmed.length < 2) {
      setShowMinCharsHint(true)
      return
    }
    setShowMinCharsHint(false)
    setCard('all')
    setSelected(null)
    setSubmitted(trimmed)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar: search is the primary affordance */}
      <div className="flex items-center gap-2 rounded-full border border-input bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          placeholder={t('search.placeholder')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
          autoFocus
        />
        <button
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
          onClick={runSearch}
        >
          {t('search.button')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{showMinCharsHint ? t('search.minChars') : t('search.hint')}</p>

      {/* worklist cards — filters over the loaded result set */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {CARD_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setCard(k)}
            className={
              'flex flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent ' +
              (card === k ? 'border-primary bg-accent' : 'border-border/60')
            }
          >
            <span
              className={
                'text-xl font-bold tabular-nums ' + (k === 'admins' ? 'text-amber-600 dark:text-amber-400' : '')
              }
            >
              {submitted === null ? '—' : enriching && k !== 'all' ? '…' : counts[k].toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{t(`cards.${k}`)}</span>
          </button>
        ))}
      </div>

      {/* split: grid left, detail right */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[7fr_5fr]">
        <div className="flex min-h-[24rem] flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
            <span className="font-semibold tracking-tight">
              {submitted === null
                ? t('grid.noQuery')
                : card === 'all'
                  ? t('grid.searchTitle', { term: submitted })
                  : t('grid.worklistTitle', { label: t(`cards.${card}`) })}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {list.data
                ? list.data.isCapped
                  ? t('grid.capped', { shown: rows.length, total: list.data.totalMatches.toLocaleString() })
                  : t('grid.matchCount', { count: visible.length })
                : ''}
            </span>
          </div>

          {submitted === null ? (
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
          ) : visible.length === 0 ? (
            // A role-based card can't assert "no matches" while rows are still being
            // classified — show a classifying state until enrichment settles.
            card !== 'all' && enriching ? (
              <div className="flex flex-1 items-center justify-center gap-2 p-10 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('grid.classifying')}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                {t('grid.noResults')}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="border-b border-border px-3 py-1.5">{t('grid.employee')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.name')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.mobile')}</th>
                    <th className="border-b border-border px-3 py-1.5">{t('grid.roles')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const roles = rolesById.get(r.employeeId)
                    return (
                      <tr
                        key={r.employeeId}
                        onClick={() => setSelected(r)}
                        className={
                          'cursor-pointer ' +
                          (selected?.employeeId === r.employeeId ? 'bg-accent' : 'hover:bg-muted/50')
                        }
                      >
                        <td className="border-b border-border px-3 py-1.5 tabular-nums">{r.employeeId}</td>
                        <td className="border-b border-border px-3 py-1.5">{r.displayName}</td>
                        <td className="border-b border-border px-3 py-1.5 tabular-nums">
                          {r.phone || t('grid.none')}
                        </td>
                        <td className="border-b border-border px-3 py-1.5 tabular-nums text-muted-foreground">
                          {roles === undefined
                            ? readById.get(r.employeeId)?.isError
                              ? t('grid.none')
                              : '…'
                            : roles.length === 0
                              ? t('grid.noRoles')
                              : t('grid.roleCount', { count: roles.length })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="min-h-[24rem] rounded-lg border border-border/60 bg-card p-3">
          {selected === null ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-10 text-center">
              <b className="text-sm">{t('detail.selectTitle')}</b>
              <span className="max-w-xs text-sm text-muted-foreground">{t('detail.selectHint')}</span>
            </div>
          ) : (
            <UserDetailPane
              key={selected.employeeId}
              employeeId={selected.employeeId}
              displayName={selected.displayName}
              access={access}
              catalog={catalog}
              onChanged={() => {
                /* role reads share the grid's cache keys; invalidation in the pane refreshes them */
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
