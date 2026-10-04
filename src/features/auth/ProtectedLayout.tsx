import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation, useMatches } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSession } from '@/core/session'
import { paletteOptedOut } from '@/core/commands/palette-model'
import { authApi } from './api'
import AppShell from '@/layout/AppShell'
import CommandPaletteHost from '@/layout/CommandPaletteHost'

/**
 * Single guard on the layout parent (all children inherit it).
 * Bootstrap semantics (Angular parity): one Auth/Me probe per page life,
 * post-login short-circuits it, transport failure is NOT cached (retry re-probes),
 * anonymous is a 200-with-flag response — never a 401.
 */
export default function ProtectedLayout({ chromeless = false }: { chromeless?: boolean } = {}) {
  const { t } = useTranslation()
  const location = useLocation()
  const hydrated = useSession((s) => s.loaded)
  const setSession = useSession((s) => s.setSession)
  // The app-wide palette is hosted HERE (spec 380 K7), above the shell rather than in it.
  // A route opts out through an explicit `handle` flag (375 R4), never through
  // `chromeless`: the print routes.
  const hostPalette = !paletteOptedOut(useMatches().map((m) => m.handle))

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: !hydrated, // post-login the store is already hydrated
    staleTime: Infinity, // cached success for the page lifetime
    retry: false, // failure surfaces immediately with a Retry button
  })

  const authenticated = me.data?.authenticated === true
  useEffect(() => {
    if (!hydrated && authenticated) setSession(me.data!)
  }, [hydrated, authenticated, me.data, setSession])

  // A print route renders its OWN page inside this guard's session/auth/theme,
  // not AppShell's chrome (241: the page's whole body is the document) — so the
  // one place that decides "authenticated" is still this file, and only the
  // chrome differs. The call center joined the shell in ticket 407.
  if (hydrated)
    return (
      <>
        {chromeless ? <Outlet /> : <AppShell />}
        {hostPalette && <CommandPaletteHost />}
      </>
    )

  if (me.isPending || authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('bootstrap.loading')}
      </div>
    )
  }

  if (me.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="text-base font-medium">{t('bootstrap.failedTitle')}</div>
        <p className="max-w-sm text-sm text-muted-foreground">{t('bootstrap.failedHint')}</p>
        <button
          type="button"
          onClick={() => me.refetch()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('actions.retry')}
        </button>
      </div>
    )
  }

  // Not pending, not error, not authenticated → anonymous: go to login.
  const returnUrl = encodeURIComponent(location.pathname + location.search)
  return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
}
