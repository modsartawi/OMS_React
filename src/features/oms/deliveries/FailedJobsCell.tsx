import type { ICellRendererParams } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import Ltr from '@/core/ui/Ltr'

/**
 * The Failed jobs column's cell (spec 380 L10; ruling 368 §1): a danger count pill while any job
 * failed, a muted "—" at 0. The value stays the number, so sort, filter and the export read it.
 *
 * The pill is `--danger` ground with `--primary-foreground` ink, and they must stay a PAIR: in
 * dark `--danger` is a light tonal fill (082 R2) on which white fails, and `--primary-foreground`
 * is the token that flips to dark ink with it.
 */
export function FailedJobsCell({ value }: ICellRendererParams<DeliveryDocumentModel>) {
  const { t } = useTranslation('deliveries')
  const count = typeof value === 'number' ? value : 0
  if (count <= 0) {
    return (
      <span className="text-ink-3" data-failed-jobs="0">
        {t('cell.noFailedJobs')}
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-[18px] min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-primary-foreground"
      data-failed-jobs={count}
    >
      <Ltr>{count}</Ltr>
    </span>
  )
}
