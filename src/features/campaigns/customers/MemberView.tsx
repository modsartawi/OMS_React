import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import type { RuleMember, RuleWalletCoupon, Says } from '@/core/models/rule-campaign'
import { ruleMemberBudgetsQuery, ruleMemberWalletQuery } from '@/core/rules/api'
import { campaignCouponsPath, couponFinderPath } from '@/core/rules/campaign-state'
import SaysBoth from '@/core/rules/SaysBoth'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatNumber } from '@/core/util/number-format'
import { profileBudgetRows, type ProfileBudgetRow } from './budgets-used'

/**
 * One member as the rule engine reads them (ticket 519): who they are, their points balance, their
 * coupon wallet and the budgets they have used. The wallet and the budgets are separate doors
 * (BackOffice 2754 and 2744), so each loads — or fails — on its own.
 */
export default function MemberView({ member: m }: { member: RuleMember }) {
  const { t } = useTranslation('rule-customers')
  const facts: [string, string | null, boolean][] = [
    ['loyaltyId', m.id, true],
    ['mobile', m.mobile, true],
    ['tier', m.tier, false],
  ]
  return (
    <div className="flex flex-col gap-5" data-member={m.id}>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold" data-member-name="">
          <bdi>{m.name}</bdi>
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-member-facts="">
          {facts.map(([k, v, machine]) => (
            <div key={k} className="flex flex-col gap-0.5" data-member-fact={k}>
              <dt className="text-xs text-muted-foreground">{t(`member.${k}`)}</dt>
              <dd className="text-sm">{v == null || v === '' ? <span className="text-muted-foreground">{t('none')}</span> : machine ? <Ltr>{v}</Ltr> : <bdi>{v}</bdi>}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="flex flex-col gap-2" data-member-points="">
        <h3 className="text-sm font-semibold">{t('points.title')}</h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['spend', 'tier', 'pending'] as const).map((k) => (
            <div key={k} className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3" data-member-point={k}>
              <dt className="text-xs text-muted-foreground">{t(`points.${k}`)}</dt>
              <dd className="text-lg font-semibold">
                <Ltr>{formatNumber(m.points[k])}</Ltr>
              </dd>
              <p className="text-xs text-muted-foreground">{t(`points.${k}Hint`)}</p>
            </div>
          ))}
        </dl>
      </section>

      <Wallet memberId={m.id} />
      <BudgetsUsed memberId={m.id} />
    </div>
  )
}

/** A section's loading and failure lines; the section draws its own content once read. */
function Reading({ pending, error, failedKey }: { pending: boolean; error: unknown; failedKey: string }) {
  const { t } = useTranslation('rule-customers')
  if (pending)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('loading')}
      </p>
    )
  return error ? <ErrorBanner className="p-2.5" message={apiErrorMessage(error, t(failedKey))} /> : null
}

const gridProps = {
  theme: omsGridTheme,
  rowHeight: OMS_GRID_ROW_HEIGHT,
  headerHeight: OMS_GRID_HEADER_HEIGHT,
  animateRows: false,
  suppressColumnVirtualisation: true,
  domLayout: 'autoHeight' as const,
}

/** A campaign: its code as a link to its coupons page, then its names in both languages. */
function CampaignCell({ data }: ICellRendererParams<{ campaignId: string; campaignCode: string; campaignName: Says }>) {
  if (!data) return null
  return (
    <span className="flex flex-col gap-0.5 py-1.5 leading-snug">
      <Link to={campaignCouponsPath(data.campaignId)} className="w-fit font-mono font-medium text-primary hover:underline" data-member-campaign={data.campaignId}>
        <Ltr>{data.campaignCode}</Ltr>
      </Link>
      <SaysBoth says={data.campaignName} />
    </span>
  )
}

/** A wallet code as a link into the coupon finder. */
function CodeCell({ value }: ICellRendererParams<RuleWalletCoupon, string>) {
  if (!value) return null
  return (
    <Link to={couponFinderPath(value)} className="font-mono font-medium text-primary hover:underline" data-wallet-code={value}>
      <Ltr>{value}</Ltr>
    </Link>
  )
}

const WALLET_COL_DEF: ColDef<RuleWalletCoupon> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, suppressHeaderMenuButton: true }

/** The member's coupon wallet: bound to them, enabled, unredeemed and in date. */
function Wallet({ memberId }: { memberId: string }) {
  const { t } = useTranslation('rule-customers')
  const wallet = useQuery(ruleMemberWalletQuery(memberId))
  const rows = wallet.data ?? []
  const columns = useMemo(
    (): ColDef<RuleWalletCoupon>[] => [
      { colId: 'code', field: 'code', headerName: t('wallet.columns.code'), cellRenderer: CodeCell, width: 180 },
      { colId: 'campaign', headerName: t('wallet.columns.campaign'), cellRenderer: CampaignCell, flex: 1, minWidth: 260, autoHeight: true, sortable: false },
      { colId: 'from', field: 'from', headerName: t('wallet.columns.from'), valueFormatter: ({ value }) => value || t('wallet.atOnce'), width: 130 },
      { colId: 'until', field: 'until', headerName: t('wallet.columns.until'), valueFormatter: ({ value }) => value || t('wallet.noEnd'), width: 130 },
    ],
    [t],
  )
  return (
    <section className="flex flex-col gap-2" data-member-wallet={wallet.isSuccess ? rows.length : ''}>
      <h3 className="text-sm font-semibold">{t('wallet.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('wallet.lede')}</p>
      <Reading pending={wallet.isPending} error={wallet.error} failedKey="wallet.failed" />
      {wallet.isSuccess &&
        (rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-wallet-empty="">
            {t('wallet.empty')}
          </p>
        ) : (
          <div data-wallet-grid="">
            <AgGridReact<RuleWalletCoupon> {...gridProps} rowData={rows} columnDefs={columns} defaultColDef={WALLET_COL_DEF} getRowId={({ data }) => data.code} />
          </div>
        ))}
    </section>
  )
}

/** Used of limit, with a bar; past the limit the overshoot is named, never clamped away. */
function UsedCell({ data }: ICellRendererParams<ProfileBudgetRow>) {
  const { t } = useTranslation('rule-customers')
  if (!data) return null
  return (
    <span className="flex flex-col gap-1 py-1.5 leading-snug" data-budget-used={data.usedOfLimit}>
      <Ltr>{data.usedOfLimit}</Ltr>
      <span className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={`block h-full rounded-full ${data.overshoot != null ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${data.share * 100}%` }} />
      </span>
      {data.overshoot != null && (
        <span className="text-xs text-danger-800" data-budget-over="">
          <Trans t={t} i18nKey="budgets.over" values={{ amount: data.overshoot }} components={{ v: <bdi dir="ltr" /> }} />
        </span>
      )}
    </span>
  )
}

function StateCell({ data }: ICellRendererParams<ProfileBudgetRow>) {
  const { t } = useTranslation('rule-customers')
  if (!data) return null
  return data.usedUp ? <StatusBadge sev="warn">{t('budgets.usedUp')}</StatusBadge> : <StatusBadge sev="ok">{t('budgets.open')}</StatusBadge>
}

const BUDGET_COL_DEF: ColDef<ProfileBudgetRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true, suppressHeaderMenuButton: true }

/** The profile-scope budgets the member has used: used / limit in the current period. */
function BudgetsUsed({ memberId }: { memberId: string }) {
  const { t } = useTranslation('rule-customers')
  const budgets = useQuery(ruleMemberBudgetsQuery(memberId))
  const rows = useMemo(() => profileBudgetRows(budgets.data ?? []), [budgets.data])
  const columns = useMemo(
    (): ColDef<ProfileBudgetRow>[] => [
      { colId: 'campaign', headerName: t('budgets.columns.campaign'), cellRenderer: CampaignCell, flex: 1, minWidth: 240, autoHeight: true },
      { colId: 'name', field: 'name', headerName: t('budgets.columns.name'), flex: 1, minWidth: 180 },
      { colId: 'used', headerName: t('budgets.columns.used'), cellRenderer: UsedCell, width: 220, autoHeight: true },
      { colId: 'period', field: 'period', headerName: t('budgets.columns.period'), valueFormatter: ({ value }) => t(`budgets.period.${value}`), width: 140 },
      { colId: 'state', headerName: t('budgets.columns.state'), cellRenderer: StateCell, width: 130 },
    ],
    [t],
  )
  return (
    <section className="flex flex-col gap-2" data-member-budgets={budgets.isSuccess ? rows.length : ''}>
      <h3 className="text-sm font-semibold">{t('budgets.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('budgets.lede')}</p>
      <Reading pending={budgets.isPending} error={budgets.error} failedKey="budgets.failed" />
      {budgets.isSuccess &&
        (rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-budgets-empty="">
            {t('budgets.empty')}
          </p>
        ) : (
          <div data-budgets-grid="">
            <AgGridReact<ProfileBudgetRow> {...gridProps} rowData={rows} columnDefs={columns} defaultColDef={BUDGET_COL_DEF} getRowId={({ data }) => data.key} />
          </div>
        ))}
    </section>
  )
}
