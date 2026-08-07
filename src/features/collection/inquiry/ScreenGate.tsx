import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import { ApiError, apiErrorMessage } from '@/core/api'
import type { CollectionAccessResult } from '@/core/models/collection'
import { COLLECTION_ACCESS_KEY, collectionApi } from './api'

/**
 * The in-page backstop every Collections screen stands behind (ticket 253).
 *
 * ⚠️ It is **not** the security boundary — the endpoint's grant filter is. This
 * exists so a hand-typed `/collection/deposits` renders a sentence rather than a
 * broken screen when the nav never offered it. Both exist for different reasons
 * and neither substitutes for the other.
 *
 * It reads the SAME `COLLECTION_ACCESS_KEY` the four nav leaves read, so the
 * whole area costs one network call and the nav and the screen can never
 * disagree. The per-screen predicate is passed in rather than derived here: the
 * four grants are independent, and a ragged group is the correct answer.
 *
 * Fails closed — pending shows the checking state, and anything that is not an
 * explicit grant (a refusal, a thrown probe, a shape nobody agreed to) shows the
 * denial.
 */
export default function ScreenGate({
  can,
  title,
  subtitle,
}: {
  can: (r: CollectionAccessResult | null | undefined) => boolean
  title: string
  subtitle: string
}) {
  const { t } = useTranslation('collection')
  const access = useQuery({
    queryKey: COLLECTION_ACCESS_KEY,
    queryFn: () => collectionApi.access(),
    staleTime: Infinity,
    retry: false,
  })

  if (access.isPending) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('access.checking')}
      </div>
    )
  }

  if (!can(access.data)) {
    // Both branches deny — that is the fail-closed rule, and only the sentence
    // differs. It distinguishes the two reasons a supervisor can be standing
    // here: an unreachable probe is a retry, a refused one is an administrator.
    //
    // 🚩 A **403 is a refusal, not an outage**, and it is the likeliest real
    // answer while the door is young: a route without `.AllowCookieSession()`,
    // or behind a grant filter that said no, comes back as exactly that (issue
    // 802). "Try again in a moment" against a permanently shut door invites a
    // retry loop; the administrator sentence is the true one.
    const refused = access.error instanceof ApiError && access.error.statusCode === 403
    const unreachable = access.isError && !refused
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">
          {unreachable ? t('access.unreachableTitle') : t('access.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable
            ? apiErrorMessage(access.error, t('access.unreachableHint'))
            : t('access.deniedHint')}
        </p>
      </div>
    )
  }

  return (
    <section className="flex h-full w-full flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>
      {/* The body each of 254–257 fills. It takes no `children` prop yet — one
          would be an abstraction with no caller, and the slice that needs it can
          add it in the same change that uses it. */}
      <p className="text-sm text-muted-foreground">{t('shell.comingSoon')}</p>
    </section>
  )
}
