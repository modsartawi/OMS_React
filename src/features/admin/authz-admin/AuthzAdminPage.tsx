import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Chip from '@/core/ui/Chip'
import { usePermissions } from '@/core/permissions'
import type { AuthzRoleLists } from '@/core/models/authz-admin'
import { AUTHZ_ROLE_LISTS_KEY, authzAdminApi, canOpenAuthzAdmin } from './api'
import UsersWorkspace from './UsersWorkspace'
import RolesWorkspace from './RolesWorkspace'

type Workspace = 'users' | 'roles'

/** No lists (pending past the gate, or a failed read): nothing to assign or revoke. The doors re-check anyway. */
const NO_ROLE_LISTS: AuthzRoleLists = { assignableRoles: [], revocableRoles: [] }

export default function AuthzAdminPage() {
  const { t } = useTranslation('authz-admin')
  const [ws, setWs] = useState<Workspace>('users')
  // Set only when the Roles workspace's "Held by" jumps to a person; seeds the
  // Users workspace search on arrival. Cleared on any manual tab switch.
  const [jumpTerm, setJumpTerm] = useState<string | null>(null)

  function switchWs(id: Workspace) {
    setJumpTerm(null)
    setWs(id)
  }
  function jumpToUser(userId: string) {
    setJumpTerm(userId)
    setWs('users')
  }

  // The screen grant comes from the one permissions answer the nav leaf reads (oms 914); the role lists are this
  // page's own read, asked only once the grant is in.
  const permissions = usePermissions()
  const allowed = canOpenAuthzAdmin(permissions)
  const lists = useQuery({ queryKey: AUTHZ_ROLE_LISTS_KEY, queryFn: () => authzAdminApi.roleLists(), enabled: allowed })
  const catalog = useQuery({
    queryKey: ['authz-admin', 'catalog'],
    queryFn: () => authzAdminApi.roleCatalog(),
    enabled: allowed,
  })

  if (!permissions.settled || (allowed && lists.isPending)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (!allowed) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  const roleLists = lists.data ?? NO_ROLE_LISTS

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t('eyebrow')}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      </div>

      {/* Users | Roles workspace switch (Roles workspace lands in a later slice). */}
      <div className="inline-flex gap-1 self-start" role="tablist" aria-label={t('workspace.ariaLabel')}>
        {(['users', 'roles'] as Workspace[]).map((id) => (
          <Chip key={id} variant="tab" on={ws === id} onClick={() => switchWs(id)} data-authz-workspace={id}>
            {t(`workspace.${id}`)}
          </Chip>
        ))}
      </div>

      {catalog.isError ? (
        <ErrorBanner message={apiErrorMessage(catalog.error, t('toast.failed'))} className="p-4" />
      ) : ws === 'users' ? (
        <UsersWorkspace roleLists={roleLists} catalog={catalog.data ?? []} initialTerm={jumpTerm} />
      ) : (
        <RolesWorkspace roleLists={roleLists} catalog={catalog.data ?? []} onJumpToUser={jumpToUser} />
      )}
    </section>
  )
}
