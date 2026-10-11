import { useTranslation } from 'react-i18next'
import type { StoreTransaction } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'

/**
 * The Transactions list's **View JSON** cell (an operator's only). It opens the drawer and
 * reads nothing itself: no prefetch on hover or focus.
 */
export default function ViewJsonButton({ row, onView }: { row: StoreTransaction; onView: (row: StoreTransaction) => void }) {
  const { t } = useTranslation('sync-console')
  return (
    <button
      type="button"
      onClick={() => onView(row)}
      // A string-only sink: the receipt number isolated once.
      aria-label={t('transactionsTab.snapshot.viewLabel', { receipt: fsi(row.receiptNumber) })}
      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
      data-transaction-view={row.transactionId}
    >
      {t('transactionsTab.snapshot.view')}
    </button>
  )
}
