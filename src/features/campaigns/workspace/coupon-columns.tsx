import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { RuleCouponBatchSummary } from '@/core/models/rule-campaign'
import StatusBadge from '@/core/ui/StatusBadge'
import { COUPON_STATUS_SEV } from '@/core/rules/coupon'
import { formatDateTime } from '@/core/util/date-format'
import type { BatchCode, BatchCodeStatus } from './coupon-csv'

/** What the grids' renderers read from the page. */
export interface CouponGridContext {
  /** The status label, by status. */
  statusLabel: (status: BatchCodeStatus) => string
  /** Opens a batch: its codes, read from HQ's export. */
  onBatch: (batch: string) => void
  /** The batch button's accessible name, for a batch. */
  batchLabel: (batch: string) => string
}

function StatusCell({ value, context }: ICellRendererParams<BatchCode, BatchCodeStatus, CouponGridContext>) {
  return value ? <StatusBadge sev={COUPON_STATUS_SEV[value]}>{context.statusLabel(value)}</StatusBadge> : null
}

/** The batch id as a button: a click opens the batch, as the prototype's chip. */
function BatchCell({ value, context }: ICellRendererParams<RuleCouponBatchSummary, string, CouponGridContext>) {
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
 * The batches grid (ticket 526, `CouponBatches/List`): the batch id, its template, how many codes,
 * how many were used at least once — a count, never against a limit (ADR 0094) — how many are
 * disabled, and who created it when (local). Plain cells are isolated by the core grid base; the
 * batch renderer isolates its own.
 */
export function batchColumns(t: TFunction): ColDef<RuleCouponBatchSummary>[] {
  return [
    { colId: 'batchId', field: 'batchId', headerName: t('coupons.columns.batch'), cellRenderer: BatchCell, flex: 1, minWidth: 200 },
    { colId: 'templateId', field: 'templateId', headerName: t('coupons.columns.template'), cellClass: 'font-mono', width: 170 },
    { colId: 'codes', field: 'codes', headerName: t('coupons.columns.codes'), type: 'rightAligned', width: 110 },
    { colId: 'used', field: 'used', headerName: t('coupons.columns.used'), type: 'rightAligned', width: 110 },
    { colId: 'disabled', field: 'disabled', headerName: t('coupons.columns.disabled'), type: 'rightAligned', width: 110 },
    { colId: 'createdAt', field: 'createdAt', headerName: t('coupons.columns.created'), valueFormatter: ({ value }) => formatDateTime(value), width: 170 },
    { colId: 'createdBy', field: 'createdBy', headerName: t('coupons.columns.createdBy'), width: 170 },
  ]
}

/**
 * One batch's codes (ticket 526, read from `CouponBatches/Export`'s CSV): the code, its status, the
 * member it is bound to, and its own local validity (none = the template's).
 */
export function codeColumns(t: TFunction): ColDef<BatchCode>[] {
  return [
    { colId: 'code', field: 'code', headerName: t('coupons.columns.code'), cellClass: 'font-mono', flex: 1, minWidth: 190 },
    { colId: 'status', field: 'status', headerName: t('coupons.columns.status'), cellRenderer: StatusCell, width: 130 },
    { colId: 'member', field: 'customerId', headerName: t('coupons.columns.member'), valueFormatter: ({ value }) => value || t('coupons.columns.anyone'), width: 170 },
    { colId: 'from', field: 'validFrom', headerName: t('coupons.columns.from'), valueFormatter: ({ value }) => value || t('coupons.columns.templateDays'), width: 150 },
    { colId: 'until', field: 'validTo', headerName: t('coupons.columns.until'), valueFormatter: ({ value }) => value || t('coupons.columns.templateDays'), width: 150 },
  ]
}
