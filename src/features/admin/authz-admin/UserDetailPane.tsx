import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Button from '@/core/ui/Button'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import type { AuthzAccessResult, RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'
import { formatStamp, grantText, inScope, indexRoles, provenance, roleKind } from './helpers'
import AssignRoleModal from './AssignRoleModal'

type Tab = 'roles' | 'effective' | 'audit'

interface Props {
  employeeId: string
  displayName: string
  access: AuthzAccessResult
  catalog: RoleCatalogEntry[]
  /** Refresh the counts + the current grid list after a role-visible change. */
  onChanged: () => void
}

export default function UserDetailPane({ employeeId, displayName, access, catalog, onChanged }: Props) {
  const { t } = useTranslation('authz-admin')
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('roles')
  const [assignOpen, setAssignOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const byName = useMemo(() => indexRoles(catalog), [catalog])

  const rolesQuery = useQuery({
    queryKey: ['authz-admin', 'assigned', employeeId],
    queryFn: () => authzAdminApi.assignedRoles(employeeId),
  })
  const effective = useQuery({
    queryKey: ['authz-admin', 'effective', employeeId],
    queryFn: () => authzAdminApi.effectiveAuthorizations(employeeId),
    enabled: tab === 'effective',
  })
  const audit = useQuery({
    queryKey: ['authz-admin', 'audit', employeeId],
    queryFn: () => authzAdminApi.audit(employeeId),
    enabled: tab === 'audit',
  })

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['authz-admin', 'assigned', employeeId] }),
      qc.invalidateQueries({ queryKey: ['authz-admin', 'effective', employeeId] }),
      qc.invalidateQueries({ queryKey: ['authz-admin', 'audit', employeeId] }),
    ])
    onChanged()
  }

  async function removeRole(roleName: string) {
    const ok = await confirmAction(
      t('roles.removeBody', { role: roleName, name: displayName || employeeId }),
      t('roles.removeTitle'),
    )
    if (!ok) return
    setActing(true)
    try {
      await authzAdminApi.revokeRole(employeeId, roleName)
      notify.success(t('roles.removed'), t('roles.removedDetail', { role: roleName }))
      await refresh()
    } catch (err) {
      // Guardrail refusals (LAST_ADMIN, …) surface the server message + code verbatim.
      notify.apiError(t('toast.failed'), err)
    } finally {
      setActing(false)
    }
  }

  const roles = rolesQuery.data ?? []
  // No UaUser row (or a shell with zero roles): the next assign MAY auto-create the
  // shell (story 8). We can't distinguish "no row" from "row, no roles" via the API,
  // so the banner is worded conditionally.
  const showAutoCreateBanner = rolesQuery.isSuccess && roles.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold tracking-tight text-balance">
          {displayName || employeeId}{' '}
          <span className="font-normal text-muted-foreground">({employeeId})</span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label={t('tabs.ariaLabel')}>
        {(['roles', 'effective', 'audit'] as Tab[]).map((id) => (
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
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {/* ---- Roles tab ---- */}
      {tab === 'roles' && (
        <div className="flex flex-col gap-3">
          {rolesQuery.isPending ? (
            <Loading label={t('roles.loading')} />
          ) : rolesQuery.isError ? (
            <ErrorBanner message={apiErrorMessage(rolesQuery.error, t('toast.failed'))} className="p-4" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {roles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{t('roles.none')}</span>
                ) : (
                  roles.map((rn) => {
                    const kind = roleKind(byName.get(rn))
                    const removable = inScope(rn, access.revocableRoles)
                    return (
                      <span
                        key={rn}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pe-1 ps-3 text-sm font-medium"
                      >
                        <span>{rn}</span>
                        {kind !== 'single' && (
                          <span
                            className={
                              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                              (kind === 'system'
                                ? 'bg-attention-050 text-attention-800'
                                : 'bg-primary/10 text-primary')
                            }
                          >
                            {t(`kind.${kind}`)}
                          </span>
                        )}
                        {removable ? (
                          <button
                            className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-danger-050 hover:text-danger-800 disabled:opacity-40"
                            title={t('roles.remove')}
                            onClick={() => removeRole(rn)}
                            disabled={acting}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            title={t('roles.outOfScopeHint')}
                          >
                            {t('roles.outOfScope')}
                          </span>
                        )}
                      </span>
                    )
                  })
                )}
              </div>

              {/* Assign is entitled by S_USER_AGR, surfaced as assignableRoles — so the
                  button keys on that, not the S_USER_MAINT tier flag. */}
              {access.assignableRoles.length > 0 ? (
                <div>
                  <Button variant="primary" onClick={() => setAssignOpen(true)} disabled={acting}>
                    {t('roles.assign')}
                  </Button>
                </div>
              ) : null}

              {showAutoCreateBanner && (
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <span aria-hidden>ⓘ</span>
                  <span>{t('roles.autoCreate')}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---- Effective authorizations tab ---- */}
      {tab === 'effective' && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">{t('effective.intro')}</p>
          {effective.isPending ? (
            <Loading label={t('effective.loading')} />
          ) : effective.isError ? (
            <ErrorBanner message={apiErrorMessage(effective.error, t('toast.failed'))} className="p-4" />
          ) : !effective.data || effective.data.length === 0 ? (
            <span className="text-muted-foreground">{t('effective.none')}</span>
          ) : (
            effective.data.map((g) => {
              const { text, wildcard } = grantText(g)
              return (
                <div
                  key={g.authorizationId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
                >
                  <span className="font-mono text-xs tabular-nums">{text}</span>
                  {wildcard && (
                    <span className="rounded-full bg-danger-050 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-800">
                      {t('effective.wildcard')}
                    </span>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground">
                    {t('effective.via', { path: provenance(g) })}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ---- Audit tab ---- */}
      {tab === 'audit' && (
        <div className="flex flex-col gap-1.5 text-sm">
          {audit.isPending ? (
            <Loading label={t('audit.loading')} />
          ) : audit.isError ? (
            <ErrorBanner message={apiErrorMessage(audit.error, t('toast.failed'))} className="p-4" />
          ) : !audit.data || audit.data.length === 0 ? (
            <span className="text-muted-foreground">{t('audit.none')}</span>
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

      <AssignRoleModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        employeeId={employeeId}
        assigned={roles}
        access={access}
        catalog={catalog}
        onAssigned={refresh}
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
