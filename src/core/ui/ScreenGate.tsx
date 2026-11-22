import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import { usePermissions, type Permissions } from '@/core/permissions'
import PageHelpButton from '@/core/help/PageHelpButton'

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
 * Since oms 914 (BackOffice spec 4002) the grant is read off the ONE permissions answer
 * (`@/core/permissions`), not a per-area probe. Three things are **passed in**:
 *
 * - **`can`** — the very predicate the nav leaf declares (`requires`), so there is
 *   literally ONE reading of the grant rather than two that could drift.
 * - **`ns`** — the area's i18n namespace. The five `access.*` keys exist in each
 *   namespace and their sentences legitimately differ ("No access to this screen"
 *   vs "No access to invoices"); a single core namespace would flatten a sentence
 *   the reader is meant to act on. What core owns is the **shape**, not the copy.
 * - **`keyPrefix`** — where in that namespace the five sentences live, defaulting
 *   to `access` (ticket 296: two gated screens in one namespace, two sentences).
 *
 * Fails closed — pending shows the checking state, and anything that is not an
 * explicit grant (a refusal, an errored or malformed answer) shows the denial.
 */
export default function ScreenGate({
  can,
  ns,
  keyPrefix = 'access',
  title,
  subtitle,
  children,
}: {
  /** The leaf's own predicate over the one permissions answer. */
  can: (p: Permissions) => boolean
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
  const permissions = usePermissions()
  // Built once rather than interpolated at each of the five call sites: five
  // separate `${keyPrefix}.` concatenations is five chances to typo one and ship
  // a raw key onto a denial screen nobody looks at until it is someone's outage.
  const k = (key: string) => `${keyPrefix}.${key}`

  if (!permissions.settled) {
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

  if (!can(permissions)) {
    // Both branches deny — that is the fail-closed rule, and only the sentence
    // differs: an unreadable permissions answer is a retry, a refused grant is an
    // administrator. (A 403 from a door already invalidated the answer, so the
    // refetched answer is what lands here.)
    const unreachable = permissions.failed
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
          {unreachable ? t(k('unreachableHint')) : t(k('deniedHint'))}
        </p>
      </div>
    )
  }

  return (
    <section className="flex h-full w-full flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {/* oms 952: the "?" opening the page's help article — drawn on the analytics pages only. */}
        <PageHelpButton />
      </header>
      {children}
    </section>
  )
}
