import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { RuleCampaignCoupon, RuleCouponStatus } from '@/core/models/rule-campaign'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatDateTime } from '@/core/util/date-format'

type Row = RuleCampaignCoupon

/** What the grid's renderers read from the page. */
export interface CouponGridContext {
  /** The status label, by status. */
  statusLabel: (status: RuleCouponStatus) => string
  /** Filters the list to a batch. */
  onBatch: (batch: string) => void
  /** The batch button's accessible name, for a batch. */
  batchLabel: (batch: string) => string
}

const STATUS_SEV: Record<RuleCouponStatus, Severity> = { unused: 'go', used: 'ok', disabled: 'mute', expired: 'mute' }

function StatusCell({ value, context }: ICellRendererParams<Row, RuleCouponStatus, CouponGridContext>) {
  return value ? <StatusBadge sev={STATUS_SEV[value]}>{context.statusLabel(value)}</StatusBadge> : null
}

/** The batch id as a button: a click filters the list to the batch, as the prototype's chip. */
function BatchCell({ value, context }: ICellRendererParams<Row, string, CouponGridContext>) {
  if (!value) return null
  return (
    <button
      type="button"
      className="font-mono text-primary hover:underline"
      onClick={() => context.onBatch(value)}
      aria-label={context.batchLabel(value)}
      data-coupon-batch={value}
    >
      <bdi dir="ltr">{value}</bdi>
    </button>
  )
}

/**
 * The coupons grid (ticket 515; the prototype's coupon table): the code, its status, how it came to
 * be, how many sales used it — a count, never against a limit (ADR 0094) — when it was created, its
 * local validity, the member it is bound to, and its batch. Plain cells are isolated by the core
 * grid base; the two renderers isolate their own.
 */
export function couponColumns(t: TFunction): ColDef<Row>[] {
  return [
    { colId: 'code', field: 'code', headerName: t('coupons.columns.code'), cellClass: 'font-mono', flex: 1, minWidth: 170 },
    {
      colId: 'status',
      field: 'status',
      headerName: t('coupons.columns.status'),
      cellRenderer: StatusCell,
      width: 130,
    },
    { colId: 'kind', field: 'kind', headerName: t('coupons.columns.kind'), valueFormatter: ({ value }) => (value ? t(`coupons.kind.${value}`) : ''), width: 130 },
    { colId: 'uses', field: 'uses', headerName: t('coupons.columns.uses'), type: 'rightAligned', width: 100 },
    { colId: 'created', field: 'created', headerName: t('coupons.columns.created'), valueFormatter: ({ value }) => formatDateTime(value), width: 160 },
    { colId: 'from', field: 'from', headerName: t('coupons.columns.from'), valueFormatter: ({ value }) => value || t('coupons.columns.atOnce'), width: 130 },
    { colId: 'until', field: 'until', headerName: t('coupons.columns.until'), valueFormatter: ({ value }) => value || t('coupons.columns.noEnd'), width: 130 },
    { colId: 'member', field: 'member', headerName: t('coupons.columns.member'), valueFormatter: ({ value }) => value || t('coupons.columns.anyone'), width: 150 },
    { colId: 'batch', field: 'batch', headerName: t('coupons.columns.batch'), cellRenderer: BatchCell, width: 140 },
  ]
}
