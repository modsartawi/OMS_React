import { useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Lock, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Button from '@/core/ui/Button'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import type { AuthzAccessResult, RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'
import { formatStamp, grantText, inScope } from './helpers'
import EditRoleModal from './EditRoleModal'
import BindGrantModal from './BindGrantModal'
import AddMemberModal from './AddMemberModal'
import DeleteBlockedModal from './DeleteBlockedModal'

type Tab = 'grants' | 'heldby' | 'audit'

interface Props {
  roleName: string
  access: AuthzAccessResult
  catalog: RoleCatalogEntry[]
  onJumpToUser: (userId: string) => void
  onDeleted: () => void
}

export default function RoleDetailPane({ roleName, access, catalog, onJumpToUser, onDeleted }: Props) {
  const { t } = useTranslation('authz-admin')
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('grants')
  const [editOpen, setEditOpen] = useState(false)
  const [bindOpen, setBindOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [blocked, setBlocked] = useState<{ users: number; grants: number; composites: number } | null>(null)
  const [acting, setActing] = useState(false)

  const detail = useQuery({
    queryKey: ['authz-admin', 'role', roleName],
    queryFn: () => authzAdminApi.roleDetail(roleName),
  })
  const holders = useQuery({
    queryKey: ['authz-admin', 'holders', roleName],
    queryFn: () => authzAdminApi.roleHolders(roleName),
    enabled: tab === 'heldby',
  })
  const audit = useQuery({
    queryKey: ['authz-admin', 'roleaudit', roleName],
    queryFn: () => authzAdminApi.roleAudit(roleName),
    enabled: tab === 'audit',
  })

  // "Which composites include this single role?" — needed for both the Held-by tab and
  // the delete-in-use composite count. The API has no reverse index, so scan each
  // composite's members (few composites; each detail shares the ['role', name] cache
  // key, so selecting a composite reuses this fetch).
  const composites = useMemo(() => catalog.filter((r) => r.isComposite), [catalog])
  const compositeDetails = useQueries({
    queries: composites.map((c) => ({
      queryKey: ['authz-admin', 'role', c.roleName],
      queryFn: () => authzAdminApi.roleDetail(c.roleName),
    })),
  })
  const inComposites = useMemo(() => {
    const names: string[] = []
    composites.forEach((c, i) => {
      const d = compositeDetails[i]?.data
      if (d?.memberSingleRoleNames.includes(roleName)) names.push(c.roleName)
    })
    return names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composites, compositeDetails, roleName])
  // The composite-membership count is only trustworthy once every composite detail has
  // resolved — a pending read makes inComposites read a false 0, which would let the
  // delete pre-check take the "safe" path on an in-use role. Delete waits for this.
  const compositesSettled = compositeDetails.every((d) => !d.isPending)

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['authz-admin', 'role'] }),
      qc.invalidateQueries({ queryKey: ['authz-admin', 'holders', roleName] }),
      qc.invalidateQueries({ queryKey: ['authz-admin', 'roleaudit', roleName] }),
      qc.invalidateQueries({ queryKey: ['authz-admin', 'catalog'] }),
      // A person's assigned-role reads can go stale when membership changes.
      qc.invalidateQueries({ queryKey: ['authz-admin', 'assigned'] }),
    ])
  }

  const d = detail.data
  const canManage = access.canManageRoles
  const isProtected = d?.isProtected ?? false

  async function unbindGrant(authorizationId: string, label: string) {
    const ok = await confirmAction(t('roleDetail.unbindBody', { grant: label, role: roleName }), t('roleDetail.unbindTitle'))
    if (!ok) return
    setActing(true)
    try {
      await authzAdminApi.unbindGrant(roleName, authorizationId)
      notify.success(t('roleDetail.unbound'))
      await refresh()
    } catch (err) {
      notify.apiError(t('toast.failed'), err)
    } finally {
      setActing(false)
    }
  }

  async function removeMember(singleRoleName: string) {
    const ok = await confirmAction(t('roleDetail.removeMemberBody', { member: singleRoleName, role: roleName }), t('roleDetail.removeMemberTitle'))
    if (!ok) return
    setActing(true)
    try {
      await authzAdminApi.removeCompositeMember(roleName, singleRoleName)
      notify.success(t('roleDetail.memberRemoved'))
      await refresh()
    } catch (err) {
      notify.apiError(t('toast.failed'), err)
    } finally {
      setActing(false)
    }
  }

  // Revoke a holder from THIS role, delegation-aware. The role side answers "who holds
  // it?"; revoking here is the same guarded act as the Users pane, so the LAST_ADMIN
  // guardrail (revoke that would empty an admin role → 409) surfaces from the role side
  // too (ticket line 33). Break-glass stays a deliberate SQL act, per the server.
  async function revokeHolder(userId: string, displayName: string) {
    const ok = await confirmAction(
      t('roleDetail.revokeBody', { name: displayName || userId, role: roleName }),
      t('roleDetail.revokeTitle'),
    )
    if (!ok) return
    setActing(true)
    try {
      await authzAdminApi.revokeRole(userId, roleName)
      notify.success(t('roleDetail.revoked'), t('roleDetail.revokedDetail', { role: roleName }))
      await refresh()
    } catch (err) {
      // LAST_ADMIN (and any other guardrail refusal) surfaces the server message verbatim.
      notify.apiError(t('toast.failed'), err)
    } finally {
      setActing(false)
    }
  }

  async function tryDelete() {
    if (!d) return
    // Protected system role → server refuses 409 SYSTEM_ROLE; surface the guardrail up front.
    if (isProtected) {
      notify.error(t('roleDetail.systemRoleTitle'), t('roleDetail.systemDeleteBody', { role: roleName }))
      return
    }
    // Wait for the composite-membership scan before trusting the in-use pre-check — a
    // pending read would understate the composite count and skip the blocked modal.
    if (!compositesSettled) {
      notify.info(t('roleDetail.stillChecking'))
      return
    }
    // In-use → the delete is hard-blocked; show the counts modal (matching the server's
    // 409 IN_USE) rather than attempting a delete that will fail.
    const users = d.directHolderCount
    const grants = d.boundGrants.length
    const composites = inComposites.length
    if (users > 0 || grants > 0 || composites > 0) {
      setBlocked({ users, grants, composites })
      return
    }
    const ok = await confirmAction(t('roleDetail.deleteBody', { role: roleName }), t('roleDetail.deleteTitle'))
    if (!ok) return
    setActing(true)
    try {
      await authzAdminApi.deleteRole(roleName)
      notify.success(t('roleDetail.deleted'), t('roleDetail.deletedDetail', { role: roleName }))
      onDeleted()
      await refresh()
    } catch (err) {
      // A concurrent assignment could still make the server 409 after our pre-check.
      notify.apiError(t('toast.failed'), err)
    } finally {
      setActing(false)
    }
  }

  if (detail.isPending) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('roleDetail.loading')}
      </div>
    )
  }
  if (detail.isError || !d) {
    return <ErrorBanner message={apiErrorMessage(detail.error, t('toast.failed'))} className="p-4" />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* header: name + kind pills + edit/delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span aria-hidden className="text-primary">
              {d.isComposite ? '◈' : '◆'}
            </span>
            <span className="truncate">{d.roleName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                (d.isComposite ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')
              }
            >
              {t(`kind.${d.isComposite ? 'composite' : 'single'}`)}
            </span>
            {isProtected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <Lock className="h-3 w-3" />
                {t('kind.system')}
              </span>
            )}
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {t('roleDetail.holdersPill', { count: d.directHolderCount })}
            </span>
          </div>
          {d.description ? (
            <p className="mt-1 text-sm text-muted-foreground text-balance">{d.description}</p>
          ) : null}
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-1.5">
            <Button variant="secondary" onClick={() => setEditOpen(true)} disabled={acting}>
              {t('roleDetail.edit')}
            </Button>
            <Button variant="danger" onClick={tryDelete} disabled={acting}>
              {t('roleDetail.delete')}
            </Button>
          </div>
        )}
      </div>

      {isProtected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-200">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t('roleDetail.systemBanner')}</span>
        </div>
      )}
      {!canManage && (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
          {t('roleDetail.readOnlyBanner')}
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-1 border-b border-border" role="tablist" aria-label={t('roleDetail.tabsAria')}>
        {(['grants', 'heldby', 'audit'] as Tab[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              'border-b-2 px-3 py-1.5 text-sm ' +
              (tab === id
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {id === 'grants'
              ? t(d.isComposite ? 'roleDetail.tabs.members' : 'roleDetail.tabs.grants')
              : t(`roleDetail.tabs.${id}`)}
          </button>
        ))}
      </div>

      {/* ---- Grants (single) / Members (composite) ---- */}
      {tab === 'grants' &&
        (d.isComposite ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-xs text-muted-foreground">{t('roleDetail.membersIntro')}</p>
            {d.memberSingleRoleNames.length === 0 ? (
              <span className="text-muted-foreground">{t('roleDetail.membersEmpty')}</span>
            ) : (
              d.memberSingleRoleNames.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
                >
                  <span aria-hidden className="text-primary">
                    ◆
                  </span>
                  <span className="font-medium">{m}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {catalog.find((r) => r.roleName === m)?.description ?? ''}
                  </span>
                  {canManage && (
                    <button
                      className="ms-auto grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-red-500/15 hover:text-red-600 disabled:opacity-40"
                      title={t('roleDetail.removeMember')}
                      onClick={() => removeMember(m)}
                      disabled={acting}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
            {canManage && (
              <div>
                <Button variant="secondary" onClick={() => setMemberOpen(true)} disabled={acting}>
                  {t('roleDetail.addMember')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {d.boundGrants.length === 0 ? (
              <span className="text-muted-foreground">{t('roleDetail.grantsEmpty')}</span>
            ) : (
              d.boundGrants.map((g) => {
                const { text, wildcard } = grantText(g)
                return (
                  <div
                    key={g.authorizationId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-xs tabular-nums">{text}</span>
                    {wildcard && (
                      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                        {t('effective.wildcard')}
                      </span>
                    )}
                    {canManage &&
                      (isProtected ? (
                        <span
                          className="ms-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          title={t('roleDetail.unbindLockedHint')}
                        >
                          <Lock className="h-3 w-3" />
                          {t('roleDetail.locked')}
                        </span>
                      ) : (
                        <button
                          className="ms-auto rounded-full px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
                          onClick={() => unbindGrant(g.authorizationId, text)}
                          disabled={acting}
                        >
                          {t('roleDetail.unbind')}
                        </button>
                      ))}
                  </div>
                )
              })
            )}
            {/* Binding a NEW grant to a protected role is allowed — protection bars only
                delete and unbinding seeded grants (the server has no bind-side SYSTEM_ROLE
                check). Only unbind stays locked on a protected role. */}
            {canManage && (
              <div>
                <Button variant="secondary" onClick={() => setBindOpen(true)} disabled={acting}>
                  {t('roleDetail.bindGrant')}
                </Button>
              </div>
            )}
          </div>
        ))}

      {/* ---- Held by ---- */}
      {tab === 'heldby' && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('roleDetail.directlyHeldBy')}
            </div>
            {holders.isPending ? (
              <Loading label={t('roleDetail.holdersLoading')} />
            ) : holders.isError ? (
              <ErrorBanner message={apiErrorMessage(holders.error, t('toast.failed'))} className="p-4" />
            ) : !holders.data || holders.data.length === 0 ? (
              <span className="text-muted-foreground">{t('roleDetail.noHolders')}</span>
            ) : (
              holders.data.map((h) => {
                const revocable = inScope(roleName, access.revocableRoles)
                return (
                  <div
                    key={h.userId}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5"
                  >
                    <button
                      onClick={() => onJumpToUser(h.userId)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={t('roleDetail.jumpToUser')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.displayName || h.userId}</span>
                        <span className="block text-xs tabular-nums text-muted-foreground">{h.userId}</span>
                      </span>
                      {!h.isActive && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t('roleDetail.inactive')}
                        </span>
                      )}
                      <span aria-hidden className="text-muted-foreground">
                        →
                      </span>
                    </button>
                    {revocable && (
                      <button
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-red-500/15 hover:text-red-600 disabled:opacity-40"
                        title={t('roleDetail.revoke')}
                        onClick={() => revokeHolder(h.userId, h.displayName)}
                        disabled={acting}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
          {inComposites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('roleDetail.memberOfComposites')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inComposites.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    ◈ {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Audit ---- */}
      {tab === 'audit' && (
        <div className="flex flex-col gap-1.5 text-sm">
          {audit.isPending ? (
            <Loading label={t('roleDetail.auditLoading')} />
          ) : audit.isError ? (
            <ErrorBanner message={apiErrorMessage(audit.error, t('toast.failed'))} className="p-4" />
          ) : !audit.data || audit.data.length === 0 ? (
            <span className="text-muted-foreground">{t('roleDetail.auditNone')}</span>
          ) : (
            <>
              {audit.data.map((a) => (
                <div key={a.entryId} className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5">
                  <span className="tabular-nums text-muted-foreground">{formatStamp(a.timestamp)}</span> ·{' '}
                  <b>{t(`audit.actions.${a.action}`, { defaultValue: a.action })}</b>
                  {a.performedBy ? (
                    <>
                      {' '}
                      {t('audit.by')} <span className="tabular-nums">{a.performedBy}</span>
                    </>
                  ) : null}
                  {a.details ? <span className="text-muted-foreground"> — {a.details}</span> : null}
                </div>
              ))}
              <span className="text-xs text-muted-foreground">{t('audit.legend')}</span>
            </>
          )}
        </div>
      )}

      <EditRoleModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        roleName={roleName}
        isProtected={isProtected}
        description={d.description}
        onSaved={async () => {
          setEditOpen(false)
          await refresh()
        }}
      />
      <BindGrantModal
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        roleName={roleName}
        boundIds={d.boundGrants.map((g) => g.authorizationId)}
        onBound={async () => {
          setBindOpen(false)
          await refresh()
        }}
      />
      <AddMemberModal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        compositeName={roleName}
        members={d.memberSingleRoleNames}
        catalog={catalog}
        onAdded={async () => {
          setMemberOpen(false)
          await refresh()
        }}
      />
      <DeleteBlockedModal
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        roleName={roleName}
        counts={blocked}
        onGoUsers={() => {
          setBlocked(null)
          setTab('heldby')
        }}
        onGoGrants={() => {
          setBlocked(null)
          setTab('grants')
        }}
        onGoComposites={() => {
          setBlocked(null)
          setTab('heldby')
        }}
      />
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}
