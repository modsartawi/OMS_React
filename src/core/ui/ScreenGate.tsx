import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import { ApiError, apiErrorMessage } from '@/core/api'

/**
 * The in-page backstop a gated screen stands behind — **graduated to `core/` by
 * ticket 268**, from the two identical copies 253 and 263 had left behind.
 *
 * 🚩 **This is the graduation 261 §Out of Scope named in advance.** Its ruling was
 * "two copies is the duplication the rule accepts, and a **third** area is the
 * trigger" — and `features/collection/settlement` is that third area. So the gate
 * moves up rather than being copied again, and the two former copies
 * (`features/collection/inquiry/ScreenGate.tsx`,
 * `features/reports/retail-invoice/ScreenGate.tsx`) are deleted, not left to drift.
 *
 * ⚠️ It is **not** the security boundary — the endpoint's grant filter is. This
 * exists so a hand-typed `/collection/settlement` renders a sentence rather than a
 * broken screen when the nav never offered it. Both exist for different reasons and
 * neither substitutes for the other.
 *
 * Four things are **passed in** rather than decided here, and each for a reason
 * a shipped screen had already settled:
 *
 * - **`query`** — the area's own access query *options*, not just its key. The
 *   options travel together (`staleTime: Infinity`, `retry: false`) because
 *   react-query merges the options of concurrent observers, so a consumer that
 *   quietly dropped `retry: false` would make a refused probe retry under a gate
 *   whose whole ruling is to fail closed on the first no.
 * - **`can`** — the very predicate the nav leaf's probe was built with, so there is
 *   literally ONE reading of the grant rather than two that could drift. An inline
 *   `=== true` here would be the second one.
 * - **`ns`** — the area's i18n namespace. The five `access.*` keys exist in each
 *   namespace and their sentences legitimately differ ("No access to this screen"
 *   vs "No access to invoices"); a single core namespace would flatten a sentence
 *   the reader is meant to act on. What core owns is the **shape**, not the copy.
 * - **`keyPrefix`** — where in that namespace the five sentences live, defaulting
 *   to `access` so every existing caller is unchanged. Added at ticket 296, when
 *   the `reports` namespace acquired a **second** gated screen: an area namespace
 *   holds one screen's `access.*` block, and the IDoc inspector's denial must not
 *   tell a consultant they lack the grant for *invoices*. Two screens, two
 *   grants, two sentences, one namespace.
 *
 * Fails closed — pending shows the checking state, and anything that is not an
 * explicit grant (a refusal, a thrown probe, a shape nobody agreed to) shows the
 * denial.
 */
export interface AccessQuery<T> {
  /** react-query key — MUST equal the nav probe's key so the call dedupes. */
  queryKey: readonly unknown[]
  queryFn: () => Promise<T>
  staleTime: number
  /** `false` and not a number: a refusal is an answer, not an outage. */
  retry: false
}

export default function ScreenGate<T>({
  query,
  can,
  ns,
  keyPrefix = 'access',
  title,
  subtitle,
  children,
}: {
  query: AccessQuery<T>
  can: (r: T | null | undefined) => boolean
  ns: string
  /** Which `<keyPrefix>.*` block in `ns` holds this screen's five sentences.
   *  Defaults to `access` — the shape every caller before 296 used. */
  keyPrefix?: string
  title: string
  subtitle: string
  /** The screen's body — **required**, which is the stricter of the two copies'
   *  contracts (263's) and the one worth keeping: a gate that silently rendered a
   *  bare header would be a way for a screen to go missing without failing. A slice
   *  whose body has not landed yet passes its own placeholder, in its own words. */
  children: ReactNode
}) {
  const { t } = useTranslation(ns)
  const access = useQuery(query)
  // Built once rather than interpolated at each of the five call sites: five
  // separate `${keyPrefix}.` concatenations is five chances to typo one and ship
  // a raw key onto a denial screen nobody looks at until it is someone's outage.
  const k = (key: string) => `${keyPrefix}.${key}`

  if (access.isPending) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t(k('checking'))}
      </div>
    )
  }

  if (!can(access.data)) {
    // Both branches deny — that is the fail-closed rule, and only the sentence
    // differs. It distinguishes the two reasons a user can be standing here: an
    // unreachable probe is a retry, a refused one is an administrator.
    //
    // 🚩 A **403 is a refusal, not an outage**, and it is the likeliest real answer
    // while a door is young: a route without `.AllowCookieSession()`, or behind a
    // grant filter that said no, comes back as exactly that (issue 802). "Try again
    // in a moment" against a permanently shut door invites a retry loop; the
    // administrator sentence is the true one. The ordinary refusal on a live door
    // is quieter still — a 200 whose flag is `false`, which lands here with no
    // error at all.
    const refused = access.error instanceof ApiError && access.error.statusCode === 403
    const unreachable = access.isError && !refused
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">
          {unreachable ? t(k('unreachableTitle')) : t(k('deniedTitle'))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable
            ? apiErrorMessage(access.error, t(k('unreachableHint')))
            : t(k('deniedHint'))}
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
      {children}
    </section>
  )
}
