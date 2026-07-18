import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { ApiError } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { couponsApi } from './api'
import CouponDetailPane from './CouponDetailPane'

// The web Coupon SUPPORT screen (ticket 523; map 497 / spec 505; server 518). A lean,
// scoped screen for a CouponsSupport-only agent: no template/import tooling, no
// refund/reset/deactivate — just a code search → the shared CouponDetailPane in
// `mode="support"` (instance + read-only template + the "where redeemed" ledger + a
// Reactivate action). An admin (superset) also sees it. Shares the ['coupons','access']
// probe key with the Admin screen + nav (issue 429), so it's one call.
//
// This is the Inquiry workspace's single-panel twin, but a standalone page with its own
// access gate: the gate opens on CanSupport (which the server sets = support OR admin),
// and the pane's support tiering hides every admin-only action. The server 518 gate
// stays authoritative — a support agent who deep-links a refund is refused 403.
export default function CouponSupportPage() {
  const { t } = useTranslation('coupons')
  const [codeInput, setCodeInput] = useState('')
  // The committed code (set on Search) — drives the query key so a re-search refetches.
  const [code, setCode] = useState<string | null>(null)

  const access = useQuery({ queryKey: ['coupons', 'access'], queryFn: () => couponsApi.access() })

  const details = useQuery({
    queryKey: ['coupons', 'detail', code],
    queryFn: () => couponsApi.getCouponDetails(code!),
    enabled: code !== null,
    retry: false,
  })

  function search() {
    const c = codeInput.trim()
    if (c) setCode(c)
  }

  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  // Deep-link backstop: the nav hides this leaf without CanSupport, but a pasted URL still
  // lands here — deny it in-page (the server grant stays authoritative on every call).
  if (access.data?.canSupport !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('support.deniedHint')}</p>
      </div>
    )
  }

  const notFound = details.isError && details.error instanceof ApiError && details.error.statusCode === 404

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t('eyebrow')}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t('support.title')}</h1>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('inquiry.searchLabel')}
          <input
            type="text"
            className="w-64 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
            value={codeInput}
            placeholder={t('inquiry.searchPlaceholder')}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </label>
        <Button variant="primary" onClick={search} disabled={!codeInput.trim() || details.isFetching}>
          {details.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {t('inquiry.search')}
        </Button>
      </div>

      {code === null ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          {t('inquiry.enterCodeHint')}
        </p>
      ) : notFound ? (
        <ErrorBanner message={t('inquiry.notFound', { code })} className="p-3" />
      ) : details.isError ? (
        <ErrorBanner message={t('inquiry.loadFailed')} className="p-3" />
      ) : details.isPending ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('inquiry.loading')}
        </div>
      ) : (
        <CouponDetailPane
          key={code}
          details={details.data}
          mode="support"
          onChanged={async () => {
            await details.refetch()
          }}
        />
      )}
    </section>
  )
}
