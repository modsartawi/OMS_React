import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search } from 'lucide-react'
import type { AuthzAccessResult, RoleCatalogEntry } from '@/core/models/authz-admin'
import { roleKind } from './helpers'
import RoleDetailPane from './RoleDetailPane'
import NewRoleModal from './NewRoleModal'

// The role catalog is small (single + composite, no estate fan-out), so — unlike the
// Users workspace's server search — it loads whole and filters client-side. Worklist
// cards partition it the same way the mock does: all / single / composite / system.
type CardKey = 'all' | 'single' | 'composite' | 'system'
const CARD_KEYS: CardKey[] = ['all', 'single', 'composite', 'system']

interface Props {
  access: AuthzAccessResult
  catalog: RoleCatalogEntry[]
  /** Jump to a person in the Users workspace (from a role's Held-by tab). */
  onJumpToUser: (userId: string) => void
}

export default function RolesWorkspace({ access, catalog, onJumpToUser }: Props) {
  const { t } = useTranslation('authz-admin')
  const qc = useQueryClient()

  const [term, setTerm] = useState('')
  const [card, setCard] = useState<CardKey>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const counts = useMemo(() => {
    const c: Record<CardKey, number> = { all: catalog.length, single: 0, composite: 0, system: 0 }
    for (const r of catalog) {
      if (!r.isComposite) c.single++
      if (r.isComposite) c.composite++
      if (r.isProtected) c.system++
    }
    return c
  }, [catalog])

  function matches(r: RoleCatalogEntry, key: CardKey): boolean {
    if (key === 'single') return !r.isComposite
    if (key === 'composite') return r.isComposite
    if (key === 'system') return r.isProtected
    return true
  }

  const q = term.trim().toLowerCase()
  const visible = useMemo(
    () =>
      catalog
        .filter((r) => matches(r, card))
        .filter(
          (r) =>
            !q ||
            r.roleName.toLowerCase().includes(q) ||
            (r.description ?? '').toLowerCase().includes(q),
        ),
    [catalog, card, q],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar: filter-as-you-type over the loaded catalog */}
      <div className="flex items-center gap-2 rounded-full border border-input bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          placeholder={t('rolesWs.searchPlaceholder')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
        />
        {access.canManageRoles && (
          <button
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t('rolesWs.newRole')}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('rolesWs.hint')}</p>

      {/* worklist cards over the loaded catalog */}
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
                'text-xl font-bold tabular-nums ' + (k === 'system' ? 'text-amber-600 dark:text-amber-400' : '')
              }
            >
              {counts[k].toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{t(`rolesWs.cards.${k}`)}</span>
          </button>
        ))}
      </div>

      {/* split: catalog left, detail right */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[7fr_5fr]">
        <div className="flex min-h-[24rem] flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
            <span className="font-semibold tracking-tight">
              {card === 'all' ? t('rolesWs.catalogTitle') : t('rolesWs.worklistTitle', { label: t(`rolesWs.cards.${card}`) })}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {t('rolesWs.roleCount', { count: visible.length })}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
              {catalog.length === 0 ? t('rolesWs.catalogEmpty') : t('rolesWs.noResults')}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-1.5">
              {visible.map((r) => {
                const kind = roleKind(r)
                return (
                  <button
                    key={r.roleName}
                    onClick={() => setSelected(r.roleName)}
                    className={
                      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ' +
                      (selected === r.roleName ? 'bg-accent' : 'hover:bg-muted/50')
                    }
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
                      aria-hidden
                    >
                      {r.isComposite ? '◈' : '◆'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{r.roleName}</span>
                        {kind === 'system' && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            {t('kind.system')}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.description || t('rolesWs.noDescription')}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                      title={t('rolesWs.holderCountTitle')}
                    >
                      {r.directHolderCount}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="min-h-[24rem] rounded-lg border border-border/60 bg-card p-3">
          {selected === null ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-10 text-center">
              <b className="text-sm">{t('rolesWs.selectTitle')}</b>
              <span className="max-w-xs text-sm text-muted-foreground">{t('rolesWs.selectHint')}</span>
            </div>
          ) : (
            <RoleDetailPane
              key={selected}
              roleName={selected}
              access={access}
              catalog={catalog}
              onJumpToUser={onJumpToUser}
              onDeleted={() => setSelected(null)}
            />
          )}
        </div>
      </div>

      <NewRoleModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        catalog={catalog}
        onCreated={async (name) => {
          // The catalog query is owned by AuthzAdminPage and passed down read-only, so a
          // create must invalidate it here — otherwise the new role is absent from the
          // list, the card counts, and the member/assignable pickers until a remount.
          await qc.invalidateQueries({ queryKey: ['authz-admin', 'catalog'] })
          setNewOpen(false)
          setSelected(name)
        }}
      />
    </div>
  )
}
