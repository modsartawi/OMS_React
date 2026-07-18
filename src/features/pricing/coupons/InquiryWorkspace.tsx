import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { ApiError } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { couponsApi } from './api'
import CouponDetailPane from './CouponDetailPane'

// Inquiry workspace (ticket 521): enter a coupon code → load its details → act on it.
// Runs the shared CouponDetailPane in `admin` mode (full actions); after any successful
// mutation the pane calls back to refetch so counts/state update. A not-found code (404
// / CUP-09001) surfaces inline; other failures show a banner.
export default function InquiryWorkspace() {
  const { t } = useTranslation('coupons')
  const [codeInput, setCodeInput] = useState('')
  // The committed code (set on Search) — drives the query key so a re-search refetches.
  const [code, setCode] = useState<string | null>(null)

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

  const notFound = details.isError && details.error instanceof ApiError && details.error.statusCode === 404

  return (
    <div className="flex flex-col gap-4">
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
          mode="admin"
          onChanged={async () => {
            await details.refetch()
          }}
        />
      )}
    </div>
  )
}
