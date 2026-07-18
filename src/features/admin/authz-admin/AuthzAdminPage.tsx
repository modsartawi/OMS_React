import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { authzAdminApi } from './api'
import UsersWorkspace from './UsersWorkspace'
import RolesWorkspace from './RolesWorkspace'

type Workspace = 'users' | 'roles'

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

  // Shared cache key with the shell's nav probe (429) → one call, not two.
  const access = useQuery({ queryKey: ['authz-admin', 'access'], queryFn: () => authzAdminApi.access() })
  const catalog = useQuery({
    queryKey: ['authz-admin', 'catalog'],
    queryFn: () => authzAdminApi.roleCatalog(),
    enabled: access.data?.screenAllowed === true,
  })

  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (access.data?.screenAllowed !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t('eyebrow')}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      </div>

      {/* Users | Roles workspace switch (Roles workspace lands in a later slice). */}
      <div
        className="inline-flex gap-1 self-start rounded-lg border border-border/60 bg-muted/40 p-1"
        role="tablist"
        aria-label={t('workspace.ariaLabel')}
      >
        {(['users', 'roles'] as Workspace[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={ws === id}
            onClick={() => switchWs(id)}
            className={
              'rounded-md px-4 py-1.5 text-sm font-semibold ' +
              (ws === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t(`workspace.${id}`)}
          </button>
        ))}
      </div>

      {catalog.isError ? (
        <ErrorBanner message={apiErrorMessage(catalog.error, t('toast.failed'))} className="p-4" />
      ) : ws === 'users' ? (
        <UsersWorkspace access={access.data} catalog={catalog.data ?? []} initialTerm={jumpTerm} />
      ) : (
        <RolesWorkspace access={access.data} catalog={catalog.data ?? []} onJumpToUser={jumpToUser} />
      )}
    </section>
  )
}
