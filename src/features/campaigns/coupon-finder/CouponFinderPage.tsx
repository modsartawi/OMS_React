import { useId, useMemo, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Loader2, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import type { RuleCouponFound, RuleCouponUse } from '@/core/models/rule-campaign'
import { ruleCouponFindQuery } from '@/core/rules/api'
import { campaignCouponsPath, ruleCustomerPath, ruleSessionPath } from '@/core/rules/campaign-state'
import { COUPON_STATUS_SEV, cleanCode } from '@/core/rules/coupon'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import SaysBoth from '@/core/rules/SaysBoth'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatDateTime } from '@/core/util/date-format'
import { codeFromParams, codeToParams } from './finder-query'

/**
 * Campaigns ▸ Coupon finder (ticket 519, BackOffice spec 2737): support enters a code — a customer
 * on the phone, a cashier who cannot apply one — and reads where it belongs and where it is: its
 * campaign, batch, status, local validity, the member it is bound to, and each sale that used it,
 * whose sale id opens the customer session. Read-only; the code lives in the address.
 *
 * One door, `RuleCampaign/Coupons/{code}` (PROVISIONAL, BackOffice 2754). No access probe on the
 * leaf yet: the door fails closed on the server; ticket 520 adds the probe.
 */
export default function CouponFinderPage() {
  const { t } = useTranslation('coupon-finder')
  const { query: code, update } = useUrlQuery(codeFromParams, codeToParams)
  const found = useQuery(ruleCouponFindQuery(code))
  const inputId = useId()

  const find = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Codes are kept upper-case with no spaces, so `wknd 20` finds WKND20.
    const typed = cleanCode(String(new FormData(e.currentTarget).get('code') ?? ''))
    // The same code again is a fresh look: a till may just have redeemed it.
    if (typed === code) void found.refetch()
    else if (typed) update(() => typed)
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-4" data-coupon-finder="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      {/* Keyed by the code asked, so Back or a wallet's code link refills the box. */}
      <form key={code} className="flex items-end gap-2" onSubmit={find} data-finder-form="">
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
            {t('form.code')}
          </label>
          <input
            id={inputId}
            name="code"
            dir="ltr"
            autoComplete="off"
            className={`${RULE_INPUT} w-64 font-mono`}
            defaultValue={code}
            data-finder-code=""
          />
        </div>
        <Button type="submit" variant="secondary" data-finder-find="">
          <Search className="size-3.5" aria-hidden />
          {t('form.find')}
        </Button>
      </form>

      {!code ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-finder-empty="">
          {t('form.hint')}
        </p>
      ) : found.isPending ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t('result.loading')}
        </p>
      ) : found.isError ? (
        <div data-finder-refusal="">
          <ErrorBanner className="p-2.5" title={t('result.failedTitle')} message={apiErrorMessage(found.error, t('result.failed'))} />
        </div>
      ) : (
        <FoundCoupon coupon={found.data} />
      )}
    </section>
  )
}

/** The code's facts, then its uses. */
function FoundCoupon({ coupon: c }: { coupon: RuleCouponFound }) {
  const { t } = useTranslation('coupon-finder')
  return (
    <div className="flex flex-col gap-4" data-finder-result={c.code}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-base font-semibold">
          <Ltr>{c.code}</Ltr>
        </h2>
        <span data-finder-status={c.status}>
          <StatusBadge sev={COUPON_STATUS_SEV[c.status]}>{t(`status.${c.status}`)}</StatusBadge>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3" data-finder-facts="">
        <Fact k="campaign">
          <Link
            to={campaignCouponsPath(c.campaignId)}
            className="w-fit font-mono font-medium text-primary hover:underline"
            data-finder-campaign={c.campaignId}
          >
            <Ltr>{c.campaignCode}</Ltr>
          </Link>
          <SaysBoth says={c.campaignName} />
        </Fact>
        <Fact k="batch">
          <Ltr>{c.batch}</Ltr>
        </Fact>
        <Fact k="kind">{t(`kind.${c.kind}`)}</Fact>
        <Fact k="from">{c.from ? <Ltr>{c.from}</Ltr> : t('facts.atOnce')}</Fact>
        <Fact k="until">{c.until ? <Ltr>{c.until}</Ltr> : t('facts.noEnd')}</Fact>
        <Fact k="member">
          {c.member ? (
            <Link to={ruleCustomerPath(c.member)} className="w-fit font-mono font-medium text-primary hover:underline" data-finder-member={c.member}>
              <Ltr>{c.member}</Ltr>
            </Link>
          ) : (
            <span className="text-muted-foreground">{t('facts.anyone')}</span>
          )}
        </Fact>
      </dl>

      <Uses uses={c.uses} />
    </div>
  )
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  const { t } = useTranslation('coupon-finder')
  return (
    <div className="flex flex-col gap-0.5" data-finder-fact={k}>
      <dt className="text-xs text-muted-foreground">{t(`facts.${k}`)}</dt>
      <dd className="flex flex-col gap-0.5 text-sm">{children}</dd>
    </div>
  )
}

const COL_DEF: ColDef<RuleCouponUse> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The sale id as a link into its customer session. */
function SaleIdCell({ value }: ICellRendererParams<RuleCouponUse, string>) {
  if (!value) return null
  return (
    <Link to={ruleSessionPath(value)} className="font-mono font-medium text-primary hover:underline" data-finder-sale={value}>
      <Ltr>{value}</Ltr>
    </Link>
  )
}

/** Each sale that redeemed the code, in HQ's order (rows keyed by position: a universal code may
 *  carry two uses of one sale): when (local), at which store, and its sale id. */
function Uses({ uses }: { uses: RuleCouponUse[] }) {
  const { t } = useTranslation('coupon-finder')
  const columns = useMemo(
    (): ColDef<RuleCouponUse>[] => [
      { colId: 'at', field: 'at', headerName: t('uses.columns.at'), valueFormatter: ({ value }) => formatDateTime(value as string), width: 170 },
      { colId: 'store', field: 'store', headerName: t('uses.columns.store'), width: 120 },
      { colId: 'saleId', field: 'saleId', headerName: t('uses.columns.saleId'), cellRenderer: SaleIdCell, flex: 1, minWidth: 200 },
    ],
    [t],
  )
  return (
    <section className="flex flex-col gap-2" data-finder-uses={uses.length}>
      <h3 className="text-sm font-semibold">
        <Trans t={t} i18nKey="uses.title" count={uses.length} values={{ n: uses.length }} components={{ n: <Ltr /> }} />
      </h3>
      {uses.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-finder-unused="">
          {t('uses.none')}
        </p>
      ) : (
        <div data-finder-uses-grid="">
          <AgGridReact<RuleCouponUse>
            theme={omsGridTheme}
            rowData={uses}
            columnDefs={columns}
            defaultColDef={COL_DEF}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            domLayout="autoHeight"
          />
        </div>
      )}
    </section>
  )
}
