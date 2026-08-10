import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import { ApiError, apiErrorMessage } from '@/core/api'
import type { RetailInvoiceAccessResult } from '@/core/models/retail-invoice'
import { retailInvoiceAccessQuery } from './api'

/**
 * The in-page backstop the Reports screens stand behind (ticket 263).
 *
 * 🚩 **Copied from `features/collection/inquiry/ScreenGate.tsx`, not imported** —
 * a feature may not import a feature (`feature-structure`), and collection has the
 * only one. ⚠️ It is deliberately **not** graduated to `core/`: two copies is the
 * duplication the rule accepts, and a **third** area is the trigger (spec 261
 * §Out of Scope).
 *
 * ⚠️ It is **not** the security boundary — the endpoint's grant filter is. This
 * exists so a hand-typed `/reports/invoice` renders a sentence rather than a
 * broken screen when the nav never offered it. Both exist for different reasons
 * and neither substitutes for the other, and on this rail the difference bites
 * hard: `Search` and `Download` re-check the grant and refuse with a **bare 403
 * carrying no body at all**, so a screen that rendered its grid regardless would
 * show an empty result where the truth is a refusal. 264 and 265 own those
 * per-call arms; this gate owns the screen-level one.
 *
 * It reads the SAME `RETAIL_INVOICE_ACCESS_KEY` the nav leaf reads, so the area
 * costs one network call and the nav and the screen can never disagree. The
 * predicate is **passed in** rather than spelled here for the same reason: the
 * Page hands it the very `canOpenRetailInvoice` the leaf's probe was built with,
 * so there is literally ONE reading of the grant rather than two that could drift.
 * An inline `screenAllowed === true` here would be the second one.
 *
 * Fails closed — pending shows the checking state, and anything that is not an
 * explicit grant (a refusal, a thrown probe, a shape nobody agreed to) shows the
 * denial.
 */
export default function ScreenGate({
  can,
  title,
  subtitle,
  children,
}: {
  can: (r: RetailInvoiceAccessResult | null | undefined) => boolean
  title: string
  subtitle: string
  /** The screen's body — required, unlike collection's copy, which tolerates an
   *  absent one because 253 left three shells standing with nothing in them. This
   *  area has one screen and it always has a body: 263's landing state, which 264
   *  replaces with the toolbar and the grid. A gate that silently rendered a bare
   *  header would be a way for a screen to go missing without failing. */
  children: ReactNode
}) {
  const { t } = useTranslation('reports')
  const access = useQuery(retailInvoiceAccessQuery())

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
    // differs. It distinguishes the two reasons a user can be standing here: an
    // unreachable probe is a retry, a refused one is an administrator.
    //
    // 🚩 `Access` is **cookie-only and answers a denial with 200**, so the
    // ordinary refusal arrives as `screenAllowed: false` and lands in this branch
    // with no error at all. A 403 *from the probe itself* is the other thing
    // entirely — an unmarked route, or a cookie branch that said no (issue 802) —
    // and it is still a refusal rather than an outage, so it reads as one. "Try
    // again in a moment" against a permanently shut door invites a retry loop.
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
      {children}
    </section>
  )
}
