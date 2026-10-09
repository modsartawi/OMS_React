import { useTranslation } from 'react-i18next'
import { CloudOff, RotateCcw } from 'lucide-react'
import Button from '@/core/ui/Button'

/**
 * The "Stock Visibility unavailable — try again" panel (spec 2544 story 32, ticket 453), shown
 * IN PLACE OF the stock grid when the door answers `MAT-00004`: by the stock check, and by the
 * material detail's Stock tab (452). 🚩 An outage is never drawn as an empty grid, which would
 * read as "no stock anywhere".
 *
 * Its words are the area's shared ones (`materials-search:shared.*`, beside the stock-cap
 * refusal — the 451 ruling), so the two screens can never word the outage differently.
 */
export default function StockUnavailable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation('materials-search')
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-attention-border bg-attention-050 px-4 py-8 text-center text-attention-800"
      data-stock-unavailable=""
    >
      <CloudOff className="h-6 w-6" aria-hidden />
      <div className="text-sm font-semibold">{t('shared.stockUnavailableTitle')}</div>
      <p className="max-w-md text-[0.8125rem]">{t('shared.stockUnavailableBody')}</p>
      <Button variant="outlined" onClick={onRetry} disabled={retrying} data-stock-retry="">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t('shared.stockUnavailableRetry')}
      </Button>
    </div>
  )
}
